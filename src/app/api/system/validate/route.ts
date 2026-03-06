import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import type { ValidationCheck, ValidationResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PROJECT_DIR = '/root/repos/blockether/mission-control';
const DB_PATH = `${PROJECT_DIR}/mission-control.db`;
const ENV_FILE = `${PROJECT_DIR}/.env.local`;
const URL = 'https://control.blockether.com';
const REQUIRED_VARS = ['OPENCLAW_GATEWAY_URL', 'OPENCLAW_GATEWAY_TOKEN', 'MC_API_TOKEN'];

function check(name: string, fn: () => { status: 'pass' | 'fail' | 'warn'; message: string; details?: string }): ValidationCheck {
  try {
    return { name, ...fn() };
  } catch (err) {
    return { name, status: 'fail', message: String(err) };
  }
}

/**
 * POST /api/system/validate - Run validation checks
 *
 * Performs the same checks as scripts/validate.sh but returns JSON.
 * Checks: environment, database, web service, daemon service, HTTP endpoint.
 */
export async function POST() {
  const checks: ValidationCheck[] = [];

  // Step 1: Environment file
  checks.push(check('Environment File', () => {
    if (!existsSync(ENV_FILE)) {
      return { status: 'fail', message: '.env.local not found' };
    }
    return { status: 'pass', message: '.env.local exists' };
  }));

  // Step 1b: Required environment variables
  if (existsSync(ENV_FILE)) {
    const envContent = readFileSync(ENV_FILE, 'utf8');
    for (const varName of REQUIRED_VARS) {
      checks.push(check(`Env: ${varName}`, () => {
        const regex = new RegExp(`^${varName}=`, 'm');
        if (regex.test(envContent)) {
          return { status: 'pass', message: `${varName} is set` };
        }
        return { status: 'warn', message: `${varName} is not set in .env.local` };
      }));
    }
  }

  // Step 2: Database
  checks.push(check('Database', () => {
    if (!existsSync(DB_PATH)) {
      return { status: 'fail', message: 'Database not found', details: DB_PATH };
    }
    return { status: 'pass', message: 'Database exists' };
  }));

  if (existsSync(DB_PATH)) {
    checks.push(check('Database Tables', () => {
      try {
        const result = execSync(
          `sqlite3 "${DB_PATH}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 2>/dev/null`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        return { status: 'pass', message: `${result} tables found` };
      } catch {
        return { status: 'warn', message: 'Could not query tables (sqlite3 not installed?)' };
      }
    }));

    checks.push(check('Migrations', () => {
      try {
        const result = execSync(
          `sqlite3 "${DB_PATH}" "SELECT count(*) FROM _migrations;" 2>/dev/null`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        return { status: 'pass', message: `${result} migrations applied` };
      } catch {
        return { status: 'warn', message: 'Could not query migrations' };
      }
    }));
  }

  // Step 3: Web service
  checks.push(check('Web Service', () => {
    try {
      const result = execSync('systemctl is-active mission-control 2>/dev/null', {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      if (result === 'active') {
        const uptimeRaw = execSync(
          'systemctl show mission-control --property=ActiveEnterTimestamp --no-pager 2>/dev/null',
          { encoding: 'utf8', timeout: 5000 }
        ).trim().split('=')[1] || 'unknown';
        return { status: 'pass', message: 'Service is running', details: `Since ${uptimeRaw}` };
      }
      return { status: 'fail', message: `Service is ${result}` };
    } catch {
      return { status: 'fail', message: 'Service is not running or systemctl unavailable' };
    }
  }));

  // Step 4: Daemon service
  checks.push(check('Daemon Service', () => {
    try {
      const result = execSync('systemctl is-active mission-control-daemon 2>/dev/null', {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      if (result === 'active') {
        const uptimeRaw = execSync(
          'systemctl show mission-control-daemon --property=ActiveEnterTimestamp --no-pager 2>/dev/null',
          { encoding: 'utf8', timeout: 5000 }
        ).trim().split('=')[1] || 'unknown';
        return { status: 'pass', message: 'Daemon is running', details: `Since ${uptimeRaw}` };
      }
      return { status: 'fail', message: `Daemon is ${result}` };
    } catch {
      return { status: 'fail', message: 'Daemon is not running or systemctl unavailable' };
    }
  }));

  // Step 5: HTTP endpoint
  checks.push(check('HTTP Endpoint', () => {
    try {
      const httpCode = execSync(
        `curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${URL}" 2>/dev/null`,
        { encoding: 'utf8', timeout: 15000 }
      ).trim();
      if (httpCode === '200') {
        return { status: 'pass', message: `${URL} responding 200` };
      }
      if (httpCode === '000') {
        return { status: 'fail', message: `${URL} not reachable` };
      }
      return { status: 'warn', message: `${URL} returned HTTP ${httpCode}` };
    } catch {
      return { status: 'fail', message: `${URL} not reachable` };
    }
  }));

  const errors = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;

  const result: ValidationResult = {
    passed: errors === 0,
    checks,
    errors,
    warnings,
    ran_at: new Date().toISOString(),
  };

  return NextResponse.json(result);
}
