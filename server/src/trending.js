// Lottery numbers span the full 6-digit range (000000-999999). Every valid
// 6-digit string is a sellable number unless it has been sold or is currently
// locked by another kiosk. A small "trending/lucky" subset is surfaced first.

const TRENDING = [
  "123456", "888888", "168168", "999999", "456789",
  "112233", "555555", "246810", "369369", "777777",
];

export const NUMBER_MAX = 1_000_000; // exclusive: numbers are 000000..999999

function pad6(n) {
  return n.toString().padStart(6, "0");
}

export function getTrending() {
  return [...TRENDING];
}

// Pick a random available 6-digit number from the full range.
// `isTaken(number)` returns true for numbers that are sold or already locked.
// Returns null only if the whole range is effectively exhausted.
export function randomFromRange(isTaken) {
  // Try random probes first (fast while the range is mostly empty).
  for (let i = 0; i < 50; i++) {
    const candidate = pad6(Math.floor(Math.random() * NUMBER_MAX));
    if (!isTaken(candidate)) return candidate;
  }
  // Fallback: linear scan from a random offset (handles a nearly-full range).
  const start = Math.floor(Math.random() * NUMBER_MAX);
  for (let i = 0; i < NUMBER_MAX; i++) {
    const candidate = pad6((start + i) % NUMBER_MAX);
    if (!isTaken(candidate)) return candidate;
  }
  return null;
}
