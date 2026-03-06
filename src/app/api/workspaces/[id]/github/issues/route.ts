import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { GitHubIssue } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = request.nextUrl.searchParams.get('state') ?? 'open';

  try {
    const db = getDb();

    let sql = `
      SELECT gi.*, t.id as task_id
      FROM github_issues gi
      LEFT JOIN tasks t ON t.github_issue_id = gi.id
      WHERE gi.workspace_id = ?
    `;
    const values: unknown[] = [id];

    if (state !== 'all') {
      sql += ' AND gi.state = ?';
      values.push(state);
    }

    sql += ' ORDER BY gi.issue_number DESC';

    const issues = db
      .prepare(sql)
      .all(...values) as (GitHubIssue & { task_id: string | null })[];

    return NextResponse.json(issues);
  } catch (error) {
    console.error('Failed to fetch GitHub issues:', error);
    return NextResponse.json({ error: 'Failed to fetch GitHub issues' }, { status: 500 });
  }
}
