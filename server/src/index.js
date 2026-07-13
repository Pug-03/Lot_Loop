import express from "express";
import cors from "cors";
import http from "node:http";
import { Server as IOServer } from "socket.io";
import { createLockStore } from "./lockStore.js";
import { createSoldStore } from "./soldStore.js";
import { getTrending, randomFromRange } from "./trending.js";

const PORT = process.env.PORT || 4000;
const TTL_MS = 90_000;
const NUMBER_RE = /^\d{6}$/;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const trending = getTrending();
// SOLD_FILE lets you point a draw (or a test run) at its own sold-numbers file.
const soldStore = createSoldStore(
  process.env.SOLD_FILE ? { file: process.env.SOLD_FILE } : {}
);

const lockStore = createLockStore({
  ttlMs: TTL_MS,
  onChange: ({ kind, number, entry }) => {
    if (kind === "locked" || kind === "renew") {
      io.emit("lock:update", {
        type: "locked",
        number,
        kioskId: entry.kioskId,
        expiresAt: entry.expiresAt,
      });
    } else if (kind === "unlocked" || kind === "expired") {
      io.emit("lock:update", { type: "unlocked", number });
    }
  },
});

setInterval(() => lockStore.sweep(), 5_000);

// True if a number cannot currently be offered: permanently sold or actively locked.
function isTaken(number) {
  if (soldStore.has(number)) return true;
  return lockStore.list().some((l) => l.number === number);
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    ttlMs: TTL_MS,
    lockedCount: lockStore.list().length,
    soldCount: soldStore.size(),
  });
});

app.get("/catalogue", (_req, res) => {
  res.json({
    trending,
    locks: lockStore.list(),
    sold: soldStore.list(),
  });
});

io.on("connection", (socket) => {
  const ownerId = socket.id;
  const kioskId = socket.handshake.auth?.kioskId || `kiosk-${socket.id.slice(0, 4)}`;

  socket.emit("snapshot", {
    trending,
    locks: lockStore.list(),
    sold: soldStore.list(),
    ttlMs: TTL_MS,
  });

  socket.on("lock:acquire", ({ number }, ack) => {
    if (typeof number !== "string" || !NUMBER_RE.test(number)) {
      return ack?.({ ok: false, reason: "invalid-number" });
    }
    if (soldStore.has(number)) {
      return ack?.({ ok: false, reason: "sold" });
    }
    const result = lockStore.acquire(number, ownerId, kioskId);
    ack?.(result);
  });

  socket.on("lock:release", ({ number }, ack) => {
    if (typeof number !== "string") {
      return ack?.({ ok: false, reason: "invalid-number" });
    }
    const result = lockStore.release(number, ownerId);
    ack?.(result);
  });

  socket.on("lock:random", (_payload, ack) => {
    const candidate = randomFromRange(isTaken);
    if (!candidate) return ack?.({ ok: false, reason: "no-candidates" });
    const result = lockStore.acquire(candidate, ownerId, kioskId);
    if (result.ok) return ack?.({ ok: true, number: candidate, entry: result.entry });
    ack?.({ ok: false, reason: "contention" });
  });

  // Finalize a purchase: permanently remove the numbers from the system.
  // Atomic — if any number is already sold or held by another kiosk, nothing is sold.
  socket.on("purchase", ({ numbers }, ack) => {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return ack?.({ ok: false, reason: "no-numbers" });
    }
    if (!numbers.every((n) => typeof n === "string" && NUMBER_RE.test(n))) {
      return ack?.({ ok: false, reason: "invalid-number" });
    }

    const unavailable = [];
    for (const number of numbers) {
      if (soldStore.has(number)) {
        unavailable.push(number);
        continue;
      }
      const lock = lockStore.get(number);
      // Authorize against the actual socket connection that holds the lock, not
      // the client-supplied kioskId (which can be spoofed or collide on the
      // default value). No lock = expired hold, still free, so we let the buyer
      // finalize it.
      if (lock && lock.ownerId !== ownerId) unavailable.push(number);
    }
    if (unavailable.length) {
      return ack?.({ ok: false, reason: "unavailable", unavailable });
    }

    const added = soldStore.add(numbers);
    // Drop the temporary holds — they are now permanently sold.
    for (const number of numbers) lockStore.release(number, ownerId);

    // Tell every OTHER kiosk these numbers are gone for good (the buyer keeps
    // them on screen for the printed receipt and updates its own state locally).
    socket.broadcast.emit("sold:update", { numbers: added });

    ack?.({ ok: true, sold: added });
  });

  socket.on("disconnect", () => {
    lockStore.releaseAllForOwner(ownerId);
    // emits already broadcast via lockStore.onChange
  });
});

httpServer.listen(PORT, () => {
  console.log(`Lottery kiosk server listening on :${PORT} (${soldStore.size()} numbers already sold)`);
});
