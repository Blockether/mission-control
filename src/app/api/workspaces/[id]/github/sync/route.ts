import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { extractOwnerRepo } from '@/lib/github';
import type { Workspace } from '@/lib/types';

interface GhLabel {
  name: string;
  color: string;
}

interface GhAssignee {
  login: string;
}

interface GhIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  stateReason: string | null;
  labels: GhLabel[];
  assignees: GhAssignee[];
  url: string;
  author: { login: string } | null;
  createdAt: string;
  updatedAt: string;
}

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

async function syncWorkspaceIssues(
  workspaceId: string
): Promise<{ synced_count: number; error?: string }> {
  const db = getDb();
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId) as
    | Workspace
    | undefined;

  if (!workspace?.github_repo) {
    return { synced_count: 0, error: 'No github_repo configured for this workspace' };
  }

  const parsed = extractOwnerRepo(workspace.github_repo);
  if (!parsed) {
    return { synced_count: 0, error: `Invalid github_repo format: ${workspace.github_repo}` };
  }

  let rawOutput: string;
  try {
    const { stdout } = await execFileAsync('gh', [
      'issue',
      'list',
      '--repo',
      `${parsed.owner}/${parsed.repo}`,
      '--json',
      'number,title,state,body,labels,assignees,createdAt,updatedAt,url,author,id,stateReason',
      '--limit',
      '200',
      '--state',
      'all',
    ]);
    rawOutput = stdout;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { synced_count: 0, error: `gh CLI failed: ${msg}` };
  }

  let issues: GhIssue[];
  try {
    issues = JSON.parse(rawOutput) as GhIssue[];
  } catch {
    return { synced_count: 0, error: 'Failed to parse gh CLI output' };
  }

  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO github_issues (id, workspace_id, github_id, issue_number, title, body, state, state_reason, labels, assignees, github_url, author, created_at_github, updated_at_github, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, issue_number) DO UPDATE SET
      title = excluded.title,
      body = excluded.body,
      state = excluded.state,
      state_reason = excluded.state_reason,
      labels = excluded.labels,
      assignees = excluded.assignees,
      github_url = excluded.github_url,
      author = excluded.author,
      updated_at_github = excluded.updated_at_github,
      synced_at = excluded.synced_at
  `);

  const insertMany = db.transaction((items: GhIssue[]) => {
    for (const issue of items) {
      const id = crypto.randomUUID();
      upsert.run(
        id,
        workspaceId,
        issue.id,
        issue.number,
        issue.title,
        issue.body ?? null,
        issue.state.toLowerCase(),
        issue.stateReason ?? null,
        JSON.stringify(issue.labels ?? []),
        JSON.stringify((issue.assignees ?? []).map((assignee: GhAssignee) => assignee.login)),
        issue.url,
        issue.author?.login ?? null,
        issue.createdAt ?? null,
        issue.updatedAt ?? null,
        now
      );
    }
  });

  insertMany(issues);
  broadcast({ type: 'github_issues_synced', payload: { workspace_id: workspaceId } } as any);

  return { synced_count: issues.length };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await syncWorkspaceIssues(id);
    if (result.error && result.synced_count === 0) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ synced_count: result.synced_count, workspace_id: id });
  } catch (error) {
    console.error('Failed to sync GitHub issues:', error);
    return NextResponse.json({ error: 'Failed to sync GitHub issues' }, { status: 500 });
  }
}
