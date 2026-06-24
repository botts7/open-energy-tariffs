// Bounded-concurrency map: run `worker` over `items` with at most `n` in flight,
// preserving input order in the results. No deps. Used to parallelise slow network
// fan-out (e.g. CDR per-plan detail fetches) without hammering the source.
export async function pool(items, n, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(n, items.length || 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
