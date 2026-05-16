// In-memory distributed lock store with TTL.
//
// Holds an authoritative map of { number -> { ownerId, kioskId, expiresAt } }.
// Acquire is atomic per-number (single-threaded JS event loop). For multi-server
// production, swap this implementation for Redis SETNX + Pub/Sub keeping the
// same exported surface (acquire / release / releaseAllForOwner / list / sweep).

const DEFAULT_TTL_MS = 90_000;

export function createLockStore({ ttlMs = DEFAULT_TTL_MS, onChange } = {}) {
  const locks = new Map();

  function isActive(entry) {
    return entry && entry.expiresAt > Date.now();
  }

  function emit(kind, number, entry) {
    if (onChange) onChange({ kind, number, entry });
  }

  function acquire(number, ownerId, kioskId) {
    const existing = locks.get(number);
    if (isActive(existing)) {
      if (existing.ownerId === ownerId) {
        existing.expiresAt = Date.now() + ttlMs;
        emit("renew", number, existing);
        return { ok: true, renewed: true, entry: existing };
      }
      return { ok: false, reason: "locked-by-other", entry: existing };
    }
    const entry = {
      number,
      ownerId,
      kioskId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    locks.set(number, entry);
    emit("locked", number, entry);
    return { ok: true, renewed: false, entry };
  }

  function release(number, ownerId) {
    const existing = locks.get(number);
    if (!existing) return { ok: true, missing: true };
    if (existing.ownerId !== ownerId) {
      return { ok: false, reason: "not-owner" };
    }
    locks.delete(number);
    emit("unlocked", number, existing);
    return { ok: true };
  }

  function releaseAllForOwner(ownerId) {
    const released = [];
    for (const [number, entry] of locks.entries()) {
      if (entry.ownerId === ownerId) {
        locks.delete(number);
        released.push(number);
        emit("unlocked", number, entry);
      }
    }
    return released;
  }

  function list() {
    const now = Date.now();
    const out = [];
    for (const entry of locks.values()) {
      if (entry.expiresAt > now) {
        out.push({
          number: entry.number,
          kioskId: entry.kioskId,
          expiresAt: entry.expiresAt,
        });
      }
    }
    return out;
  }

  function sweep() {
    const now = Date.now();
    for (const [number, entry] of locks.entries()) {
      if (entry.expiresAt <= now) {
        locks.delete(number);
        emit("expired", number, entry);
      }
    }
  }

  return { acquire, release, releaseAllForOwner, list, sweep, ttlMs };
}
