import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CreateSprintSchema } from '@/lib/validation';
import type { Sprint } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  const status = request.nextUrl.searchParams.get('status');

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  try {
    const db = getDb();

    let sql = 'SELECT * FROM sprints WHERE workspace_id = ?';
    const values: unknown[] = [workspaceId];

    if (status) {
      sql += ' AND status = ?';
      values.push(status);
    }

    sql += ' ORDER BY sprint_number DESC, created_at DESC';

    const sprints = db.prepare(sql).all(...values) as Sprint[];
    return NextResponse.json(sprints);
  } catch (error) {
    console.error('Failed to fetch sprints:', error);
    return NextResponse.json({ error: 'Failed to fetch sprints' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = CreateSprintSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const maxRow = db.prepare(
      'SELECT MAX(sprint_number) as max_num FROM sprints WHERE workspace_id = ?'
    ).get(data.workspace_id) as { max_num: number | null };
    const nextNumber = (maxRow?.max_num || 0) + 1;
    const name = `SPRINT-${nextNumber}`;

    db.prepare(`
      INSERT INTO sprints (id, workspace_id, name, goal, sprint_number, start_date, end_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.workspace_id, name, data.goal || null, nextNumber, data.start_date, data.end_date, 'planning', now, now);

    const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as Sprint;
    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    console.error('Failed to create sprint:', error);
    return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 });
  }
}
