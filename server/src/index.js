import express from "express";
import cors from "cors";
import http from "node:http";
import { Server as IOServer } from "socket.io";
import { createLockStore } from "./lockStore.js";
import { generateCatalogue, getTrending, randomFromCatalogue } from "./trending.js";

const PORT = process.env.PORT || 4000;
const TTL_MS = 90_000;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const catalogue = generateCatalogue(240);
const trending = getTrending();

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

app.get("/health", (_req, res) => {
  res.json({ ok: true, ttlMs: TTL_MS, lockedCount: lockStore.list().length });
});

app.get("/catalogue", (_req, res) => {
  res.json({
    catalogue,
    trending,
    locks: lockStore.list(),
  });
});

io.on("connection", (socket) => {
  const ownerId = socket.id;
  const kioskId = socket.handshake.auth?.kioskId || `kiosk-${socket.id.slice(0, 4)}`;

  socket.emit("snapshot", {
    catalogue,
    trending,
    locks: lockStore.list(),
    ttlMs: TTL_MS,
  });

  socket.on("lock:acquire", ({ number }, ack) => {
    if (typeof number !== "string" || !/^\d{6}$/.test(number)) {
      return ack?.({ ok: false, reason: "invalid-number" });
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
    const taken = new Set(lockStore.list().map((l) => l.number));
    for (let i = 0; i < 8; i++) {
      const candidate = randomFromCatalogue(catalogue, taken);
      if (!candidate) return ack?.({ ok: false, reason: "no-candidates" });
      const result = lockStore.acquire(candidate, ownerId, kioskId);
      if (result.ok) return ack?.({ ok: true, number: candidate, entry: result.entry });
      taken.add(candidate);
    }
    ack?.({ ok: false, reason: "contention" });
  });

  socket.on("disconnect", () => {
    const released = lockStore.releaseAllForOwner(ownerId);
    if (released.length) {
      // emits already broadcast via lockStore.onChange
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Lottery kiosk server listening on :${PORT}`);
});
