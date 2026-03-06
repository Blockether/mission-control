import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

const SERVICE_NAME = 'openclaw-gateway';

/**
 * POST /api/system/restart-gateway - Restart the OpenClaw Gateway service
 *
 * Runs `systemctl restart openclaw-gateway` and verifies it came back up.
 */
export async function POST() {
  try {
    // Check current status before restart
    let wasActive = false;
    try {
      const before = execSync(`systemctl is-active ${SERVICE_NAME} 2>/dev/null`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      wasActive = before === 'active';
    } catch {
      // Service may not exist
    }

    // Restart the service
    try {
      execSync(`systemctl restart ${SERVICE_NAME} 2>&1`, {
        encoding: 'utf8',
        timeout: 30000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, error: `Restart command failed: ${message}` },
        { status: 500 },
      );
    }

    // Wait briefly then verify it came back
    execSync('sleep 2', { timeout: 5000 });

    let isActive = false;
    let pid: string | undefined;
    try {
      const after = execSync(`systemctl is-active ${SERVICE_NAME} 2>/dev/null`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      isActive = after === 'active';

      if (isActive) {
        pid = execSync(
          `systemctl show ${SERVICE_NAME} --property=MainPID --no-pager 2>/dev/null`,
          { encoding: 'utf8', timeout: 5000 },
        ).trim().split('=')[1] || undefined;
      }
    } catch {
      // Failed to check
    }

    if (!isActive) {
      return NextResponse.json({
        success: false,
        error: 'Service restarted but did not come back as active',
        was_active: wasActive,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      was_active: wasActive,
      is_active: true,
      pid: pid ? parseInt(pid, 10) : undefined,
      restarted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Gateway restart failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
