// Mock pool of available lottery numbers + a "trending/lucky" subset.
// In production this comes from the lottery operator's catalogue.

const TRENDING = [
  "123456", "888888", "168168", "999999", "456789",
  "112233", "555555", "246810", "369369", "777777",
];

function pad6(n) {
  return n.toString().padStart(6, "0");
}

export function generateCatalogue(count = 200) {
  const set = new Set(TRENDING);
  // Deterministic-ish spread so demo data is stable across restarts
  let seed = 7;
  while (set.size < count) {
    seed = (seed * 9301 + 49297) % 233280;
    set.add(pad6(seed % 1_000_000));
  }
  return [...set];
}

export function getTrending() {
  return [...TRENDING];
}

export function randomFromCatalogue(catalogue, excluded = new Set()) {
  const candidates = catalogue.filter((n) => !excluded.has(n));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
