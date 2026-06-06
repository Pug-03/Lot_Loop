import { io, Socket } from "socket.io-client";

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";

const KIOSK_ID_KEY = "kioskId";
function getOrCreateKioskId(): string {
  let id = localStorage.getItem(KIOSK_ID_KEY);
  if (!id) {
    id = "K-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem(KIOSK_ID_KEY, id);
  }
  return id;
}

export const kioskId = getOrCreateKioskId();

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
