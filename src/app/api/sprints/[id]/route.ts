import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { UpdateSprintSchema } from '@/lib/validation';
import type { Sprint } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();
    const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as Sprint | undefined;

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    return NextResponse.json(sprint);
  } catch (error) {
    console.error('Failed to fetch sprint:', error);
    return NextResponse.json({ error: 'Failed to fetch sprint' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const validation = UpdateSprintSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    const db = getDb();

    const existing = db.prepare('SELECT id, workspace_id, status FROM sprints WHERE id = ?').get(id) as Pick<Sprint, 'id' | 'workspace_id' | 'status'> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    if (data.status === 'active') {
      const activeSprint = db.prepare(
        'SELECT id FROM sprints WHERE workspace_id = ? AND status = ? AND id != ?'
      ).get(existing.workspace_id, 'active', id) as { id: string } | undefined;

      if (activeSprint) {
        return NextResponse.json(
          { error: 'Another sprint is already active in this workspace. End it first.' },
          { status: 400 }
        );
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    const now = new Date().toISOString();

    if (data.goal !== undefined) {
      updates.push('goal = ?');
      values.push(data.goal);
    }
    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(data.end_date);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE sprints SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    if (data.status === 'completed') {
      db.prepare('UPDATE tasks SET sprint_id = NULL, updated_at = ? WHERE sprint_id = ? AND status != ?').run(now, id, 'done');
    }

    const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as Sprint | undefined;
    return NextResponse.json(sprint);
  } catch (error) {
    console.error('Failed to update sprint:', error);
    return NextResponse.json({ error: 'Failed to update sprint' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const db = getDb();

    const existing = db.prepare('SELECT id FROM sprints WHERE id = ?').get(id) as { id: string } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE sprint_id = ?').get(id) as { count: number };
    if (taskCount.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete sprint with related tasks', taskCount: taskCount.count },
        { status: 400 }
      );
    }

    db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete sprint:', error);
    return NextResponse.json({ error: 'Failed to delete sprint' }, { status: 500 });
  }
}
