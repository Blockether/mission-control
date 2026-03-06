import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import os from 'os';
import type { SystemInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getServiceStatus(serviceName: string): 'active' | 'inactive' | 'unknown' {
  try {
    const result = execSync(`systemctl is-active ${serviceName} 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    return result === 'active' ? 'active' : 'inactive';
  } catch {
    return 'unknown';
  }
}

/**
 * GET /api/system/info - System and process information
 *
 * Returns Node.js process stats, system memory, and service statuses.
 */
export async function GET() {
  try {
    const mem = process.memoryUsage();
    const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024 * 10) / 10;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const info: SystemInfo = {
      node_version: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime_seconds: Math.round(process.uptime()),
      memory: {
        rss_mb: toMB(mem.rss),
        heap_total_mb: toMB(mem.heapTotal),
        heap_used_mb: toMB(mem.heapUsed),
        external_mb: toMB(mem.external),
      },
      system_memory: {
        total_mb: toMB(totalMem),
        free_mb: toMB(freeMem),
        used_percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      services: {
        web: getServiceStatus('mission-control'),
        daemon: getServiceStatus('mission-control-daemon'),
      },
    };

    return NextResponse.json(info);
  } catch (error) {
    console.error('Failed to get system info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
