// Prize table for the current draw + a persistent set of ALREADY-CLAIMED tickets.
//
// A winning ticket may be redeemed for cash exactly once. The winning numbers
// come from a draw file (WINNING_FILE); if none exists we seed a demo draw so
// the kiosk works out of the box. Claimed tickets are persisted to disk so a
// redeemed ticket can never be paid out twice — even after a server restart.
//
// For a single kiosk fleet on a LAN this file store is enough; for a
// multi-server deployment swap the JSON files for the same authoritative
// DB/Redis surface behind the same exports (draw / checkPrize / isClaimed /
// claim / claimedCount).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WINNING_FILE = path.join(__dirname, "..", "data", "winning.json");
const DEFAULT_CLAIMED_FILE = path.join(__dirname, "..", "data", "claimed.json");

// Demo draw used when no WINNING_FILE is present. Amounts in THB.
// `match` decides how a ticket is compared against `numbers`:
//   exact  — the full 6-digit ticket equals one of the numbers
//   front3 — the ticket's first 3 digits equal a 3-digit number
//   last3  — the ticket's last 3 digits equal a 3-digit number
//   last2  — the ticket's last 2 digits equal a 2-digit number
const DEMO_DRAW = {
  drawDate: "2026-07-16",
  tiers: [
    { id: "first", match: "exact", amount: 6_000_000, numbers: ["123456"] },
    { id: "second", match: "exact", amount: 200_000, numbers: ["112233", "555555"] },
    { id: "third", match: "exact", amount: 80_000, numbers: ["369369", "246810"] },
    { id: "front3", match: "front3", amount: 4_000, numbers: ["888", "111"] },
    { id: "last3", match: "last3", amount: 4_000, numbers: ["789", "456"] },
    { id: "last2", match: "last2", amount: 2_000, numbers: ["99", "68"] },
  ],
};

function matchTier(number, tier) {
  switch (tier.match) {
    case "exact":
      return tier.numbers.includes(number);
    case "front3":
      return tier.numbers.includes(number.slice(0, 3));
    case "last3":
      return tier.numbers.includes(number.slice(-3));
    case "last2":
      return tier.numbers.includes(number.slice(-2));
    default:
      return false;
  }
}

export function createPrizeStore({
  winningFile = DEFAULT_WINNING_FILE,
  claimedFile = DEFAULT_CLAIMED_FILE,
} = {}) {
  // Load the draw (winning numbers) — fall back to the demo draw.
  let draw = DEMO_DRAW;
  try {
    const raw = fs.readFileSync(winningFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tiers)) {
      draw = parsed;
    } else {
      console.warn(`[prizeStore] ${winningFile} has no "tiers" array — using demo draw`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[prizeStore] could not read ${winningFile}:`, err.message);
    }
  }

  // Load the set of tickets already redeemed.
  const claimed = new Set();
  try {
    const raw = fs.readFileSync(claimedFile, "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) for (const n of arr) claimed.add(n);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[prizeStore] could not read ${claimedFile}:`, err.message);
    }
  }

  function persistClaimed() {
    try {
      fs.mkdirSync(path.dirname(claimedFile), { recursive: true });
      // Write to a temp file then rename so a crash mid-write can't corrupt it.
      const tmp = `${claimedFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify([...claimed]));
      fs.renameSync(tmp, claimedFile);
    } catch (err) {
      console.error(`[prizeStore] FAILED to persist claimed tickets to ${claimedFile}:`, err.message);
    }
  }

  // Return the BEST (highest-paying) prize a ticket wins, or null if it wins
  // nothing. Never mutates state — safe to call for a preview/check.
  function checkPrize(number) {
    let best = null;
    for (const tier of draw.tiers) {
      if (matchTier(number, tier) && (!best || tier.amount > best.amount)) {
        best = { tier: tier.id, match: tier.match, amount: tier.amount };
      }
    }
    return best;
  }

  function isClaimed(number) {
    return claimed.has(number);
  }

  // Atomically redeem a ticket. Returns the paid prize on success, or a reason
  // it could not be paid: "no-prize" (didn't win) or "already-claimed".
  function claim(number) {
    const prize = checkPrize(number);
    if (!prize) return { ok: false, reason: "no-prize" };
    if (claimed.has(number)) return { ok: false, reason: "already-claimed" };
    claimed.add(number);
    persistClaimed();
    return { ok: true, tier: prize.tier, amount: prize.amount };
  }

  return {
    drawDate: draw.drawDate ?? null,
    checkPrize,
    isClaimed,
    claim,
    claimedCount: () => claimed.size,
  };
}
