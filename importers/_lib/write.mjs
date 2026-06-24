// Shared entry-writing helpers: write only when the DATA changed, and record when a
// source was last refreshed. Together these stop the stats importers churning
// hundreds of files with a date-only diff on every scheduled run.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// Stable comparison of two entries IGNORING the run-stamp meta.updated, so a re-run
// with identical rates produces no rewrite (and no git diff).
function canon(entry) {
  const c = JSON.parse(JSON.stringify(entry));
  if (c && c.meta) delete c.meta.updated;
  return JSON.stringify(c);
}

/**
 * Write `entry` to `file` only if its data differs from what's already committed
 * (meta.updated ignored). Returns 'added' | 'changed' | 'unchanged'.
 */
export async function writeEntryIfChanged(file, entry) {
  let old = null;
  try { old = JSON.parse(await readFile(file, 'utf8')); } catch { /* new file */ }
  if (old && canon(old) === canon(entry)) return 'unchanged';
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(entry, null, 2) + '\n');
  return old ? 'changed' : 'added';
}

/**
 * Record that `source` was refreshed on `date` (default: today) in data-status.json
 * at the repo root, merging with other sources' stamps. Lets the GUI judge staleness
 * by last-CHECK not last-CHANGE, so a skip-if-unchanged source isn't flagged stale.
 */
export async function stampRefresh(root, source, date) {
  const file = join(root, 'data-status.json');
  let status = {};
  try { status = JSON.parse(await readFile(file, 'utf8')); } catch { /* first time */ }
  status[source] = { lastRefresh: date || new Date().toISOString().slice(0, 10) };
  await writeFile(file, JSON.stringify(status, null, 2) + '\n');
}
