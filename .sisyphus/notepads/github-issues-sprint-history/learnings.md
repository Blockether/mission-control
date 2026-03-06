# GitHub Issues + Sprint History — Learnings

## Pre-work Discoveries

### gh CLI
- `gh` is authenticated as `michal-blockether` on github.com
- Token scopes include `repo` — can read issues
- `blockether/mission-control` has issues DISABLED — use `Blockether/spel` for testing
- gh CLI output format: `--json number,title,state,body,labels,assignees,createdAt,updatedAt,url,author,id,stateReason`
- Note: `id` in gh CLI output is the GitHub internal integer ID (not UUID)

### Workspaces
- `default` workspace: github_repo = `https://github.com/Blockether/mission-control` (issues disabled)
- `f46fd2b7` workspace: github_repo = `https://github.com/Blockether/spel` (issues ENABLED, use this for testing)
- `7ea5483e` workspace: github_repo = `https://github.com/Blockether/mission-control` (issues disabled)

### Existing Infrastructure
- `extractOwnerRepo()` in `src/lib/github.ts` — parses owner/repo from URL or short form
- `broadcast()` in `src/lib/events.ts` — SSE broadcast to all connected clients
- `WEBHOOK_SECRET` env var exists for agent-completion webhooks — use NEW `GITHUB_WEBHOOK_SECRET` for GitHub
- Existing webhook at `/api/webhooks/agent-completion/route.ts` — uses `x-webhook-signature` header (NOT GitHub's format)
- GitHub uses `x-hub-signature-256: sha256=<hex>` — different from existing pattern

### Schema
- `workspaces.github_repo` already exists (column 7)
- No `github_issues` table yet
- No `tasks.github_issue_id` yet
- Migration 020 is the last one — next is 021

### Sprint State
- Only 2 sprints in DB, both `planning` status — no completed sprints yet for history testing
- Sprint history section will show empty initially but structure must be correct

### Store
- `selectedSprintId` does NOT exist in Zustand store yet — must add for sprint history navigation
- ActiveSprint manages sprint selection internally via local useState

### DashboardView
- Currently: `'sprint' | 'backlog' | 'pareto' | 'activity'`
- Must extend to include `'issues'`
- Defined in `src/components/Header.tsx` line 19

## Task 1 Learnings (Migration + Schema + Types)

- Migration pattern for safe column add uses `PRAGMA table_info(tasks)` guard before `ALTER TABLE`.
- Added migration `021` should keep the same logging pattern as `020` with `console.warn` progress messages.
- Fresh schema must include both `github_issues` table creation and tasks FK column (`github_issue_id`) so new DBs match migrated DBs.
- Added indexes for `github_issues(workspace_id)` and `github_issues(workspace_id, state)` in both migration and fresh schema.
- `GitHubIssue` interface includes optional `task_id` as joined/read model field, while actual persisted linkage is `tasks.github_issue_id`.

## Task 3 Learnings (Cron Endpoint + System Job)

### Cron Endpoint Implementation
- Created `GET /api/cron/github-sync` at `src/app/api/cron/github-sync/route.ts`
- Syncs all workspaces where `github_repo IS NOT NULL AND github_repo != ''`
- Uses `gh issue list --repo owner/repo --json ... --limit 200 --state all` to fetch issues
- Upserts into `github_issues` table with `ON CONFLICT(workspace_id, issue_number)` strategy
- Broadcasts `github_issues_synced` SSE event per workspace after successful sync
- Returns JSON: `{ synced_workspaces: N, total_issues: M, errors?: [...] }`

### Security
- Endpoint checks `x-forwarded-for` header for localhost detection
- Falls back to Bearer token auth if not localhost: `Authorization: Bearer <MC_API_TOKEN>`
- Returns 403 Forbidden if neither condition met
- Safe for cron execution from localhost (no token needed)

### System Cron Job
- Installed: `*/10 * * * * curl -s -o /dev/null http://localhost:4000/api/cron/github-sync`
- Runs every 10 minutes as root user
- Uses `-s -o /dev/null` to suppress output (silent mode)
- Cron job persists across reboots (stored in `/var/spool/cron/crontabs/root`)

### Type System Updates
- Added `github_issues_synced` to `SSEEventType` union
- Extended `SSEEvent.payload` to accept `{ workspace_id: string }` for GitHub sync events
- TypeScript compilation passes with no errors

### Implementation Details
- Inline sync logic (no circular dependency risk from importing sync route)
- Uses `db.transaction()` for atomic batch upserts
- Handles `gh` CLI errors gracefully with try-catch per workspace
- Parses GitHub issue JSON with proper type interfaces (GhIssue, GhLabel, GhAssignee)
- Converts state to lowercase for consistency
- Stores author as string (login name) not full object
- Synced timestamp recorded as ISO string for each batch

### Commit
- Hash: `ca9d2bb8991cb3a1b914b288acba7991d7302816`
- Message: `feat(cron): add GitHub issues auto-sync cron endpoint every 10 minutes`
- Includes Sisyphus footer and co-author attribution

## Task 2 Learnings (Sync + Cached List Endpoints)

- Added `POST /api/workspaces/[id]/github/sync` route using `child_process.execFile` with `gh issue list` (state=all, limit=200), then JSON parse + transactional upsert into `github_issues`.
- Sync route exports reusable `syncWorkspaceIssues(workspaceId)` helper for future cron reuse.
- `extractOwnerRepo` in `src/lib/github.ts` had to be exported for route-level reuse.
- Added `GET /api/workspaces/[id]/github/issues` route that reads cached rows only and supports `?state=open|closed|all` filtering.
- Issues list query left-joins `tasks` to expose `task_id` alongside each cached issue row.
- Existing SSE event union does not yet include `github_issues_synced`, so route broadcasts with a narrow cast at callsite to preserve current runtime behavior without broad type-surface edits.
