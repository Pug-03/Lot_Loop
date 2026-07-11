import { io, Socket } from "socket.io-client";

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";

const KIOSK_ID_KEY = "kioskId";
// A fixed kiosk NUMBER, resolved in priority order:
//   1. ?kiosk=N in the URL     — handy for running two demo kiosks in two tabs
//   2. VITE_KIOSK_ID env var   — set per machine when deploying a real kiosk
//   3. previously stored value — persists across reloads on the same machine
//   4. "1"                     — default
// Whatever wins is remembered in localStorage so a reload keeps the same number.
function resolveKioskId(): string {
  const fromUrl = new URLSearchParams(window.location.search).get("kiosk");
  const fromEnv = (import.meta as any).env?.VITE_KIOSK_ID as string | undefined;
  const stored = localStorage.getItem(KIOSK_ID_KEY);
  // Ignore values left by the old random-ID scheme (e.g. "K-3F9A", "K-<uuid>")
  // so existing machines heal to a plain number without clearing storage.
  const storedNumber = stored && /^\d+$/.test(stored) ? stored : null;
  const id =
    (fromUrl && fromUrl.trim()) ||
    (fromEnv && String(fromEnv).trim()) ||
    storedNumber ||
    "1";
  localStorage.setItem(KIOSK_ID_KEY, id);
  return id;
}

export const kioskId = resolveKioskId();

export const socket: Socket = io(SERVER_URL, {
  auth: { kioskId },
  transports: ["websocket"],
  autoConnect: true,
});

export type LockEntry = { number: string; kioskId: string; expiresAt: number };

export type Snapshot = {
  trending: string[];
  locks: LockEntry[];
  sold: string[];
  ttlMs: number;
};

export type LockUpdate =
  | { type: "locked"; number: string; kioskId: string; expiresAt: number }
  | { type: "unlocked"; number: string };

export type SoldUpdate = { numbers: string[] };

export function acquireLock(number: string): Promise<{ ok: boolean; reason?: string; entry?: LockEntry }> {
  return new Promise((resolve) => {
    socket.emit("lock:acquire", { number }, resolve);
  });
}

export function releaseLock(number: string): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    socket.emit("lock:release", { number }, resolve);
  });
}

export function requestRandom(): Promise<{ ok: boolean; number?: string; entry?: LockEntry; reason?: string }> {
  return new Promise((resolve) => {
    socket.emit("lock:random", {}, resolve);
  });
}

// Finalize a purchase: permanently remove these numbers from the system.
export function purchaseNumbers(
  numbers: string[]
): Promise<{ ok: boolean; sold?: string[]; reason?: string; unavailable?: string[] }> {
  return new Promise((resolve) => {
    socket.emit("purchase", { numbers }, resolve);
  });
}
