import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  socket,
  kioskId,
  Snapshot,
  LockEntry,
  LockUpdate,
  acquireLock as acquireLockSocket,
  releaseLock as releaseLockSocket,
} from "../socket";

export type SelectedNumber = {
  number: string;
  expiresAt: number;
  source: "trending" | "search" | "random" | "set" | "recycle";
};

type IdentityMethod = "card" | "thaid" | null;

type SessionState = {
  kioskId: string;
  connected: boolean;
  catalogue: string[];
  trending: string[];
  ttlMs: number;
  // Map number -> kioskId of holder. If holder === our kioskId, it's our hold.
  locks: Map<string, { kioskId: string; expiresAt: number }>;

  // Wizard state
  identityMethod: IdentityMethod;
  identityVerified: boolean;
  oldTicketUsed: boolean;
  oldTicketNumber: string | null;
  selected: SelectedNumber[];
  pricePerTicket: number;
  discount: number;

  setIdentityMethod: (m: IdentityMethod) => void;
  setIdentityVerified: (v: boolean) => void;
  setOldTicket: (number: string | null) => void;

  selectNumber: (number: string, source: SelectedNumber["source"]) => Promise<{ ok: boolean; reason?: string }>;
  deselectNumber: (number: string) => Promise<void>;
  clearSelection: () => Promise<void>;

  resetSession: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

const PRICE_PER_TICKET = 80;
const DISCOUNT_AMOUNT = 5;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(socket.connected);
  const [catalogue, setCatalogue] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [ttlMs, setTtlMs] = useState(90_000);
  const [locks, setLocks] = useState<Map<string, { kioskId: string; expiresAt: number }>>(new Map());

  const [identityMethod, setIdentityMethod] = useState<IdentityMethod>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [oldTicketUsed, setOldTicketUsed] = useState(false);
  const [oldTicketNumber, setOldTicketNumber] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedNumber[]>([]);

  useEffect(() => {
    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }
    function onSnapshot(snap: Snapshot) {
      setCatalogue(snap.catalogue);
      setTrending(snap.trending);
      setTtlMs(snap.ttlMs);
      const m = new Map<string, { kioskId: string; expiresAt: number }>();
      for (const l of snap.locks) m.set(l.number, { kioskId: l.kioskId, expiresAt: l.expiresAt });
      setLocks(m);
    }
    function onLockUpdate(u: LockUpdate) {
      setLocks((prev) => {
        const next = new Map(prev);
        if (u.type === "locked") {
          next.set(u.number, { kioskId: u.kioskId, expiresAt: u.expiresAt });
        } else {
          next.delete(u.number);
        }
        return next;
      });
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("snapshot", onSnapshot);
    socket.on("lock:update", onLockUpdate);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("snapshot", onSnapshot);
      socket.off("lock:update", onLockUpdate);
    };
  }, []);

  // Periodic re-render so TTL countdowns refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const setOldTicket = useCallback((number: string | null) => {
    if (number) {
      setOldTicketUsed(true);
      setOldTicketNumber(number);
    } else {
      setOldTicketUsed(false);
      setOldTicketNumber(null);
    }
  }, []);

  const selectNumber = useCallback<SessionState["selectNumber"]>(async (number, source) => {
    if (selected.some((s) => s.number === number)) return { ok: true };
    const res = await acquireLockSocket(number);
    if (!res.ok) return { ok: false, reason: res.reason };
    setSelected((prev) => [
      ...prev,
      { number, expiresAt: res.entry?.expiresAt ?? Date.now() + 90_000, source },
    ]);
    return { ok: true };
  }, [selected]);

  const deselectNumber = useCallback(async (number: string) => {
    await releaseLockSocket(number);
    setSelected((prev) => prev.filter((s) => s.number !== number));
  }, []);

  const clearSelection = useCallback(async () => {
    await Promise.all(selected.map((s) => releaseLockSocket(s.number)));
    setSelected([]);
  }, [selected]);

  const resetSession = useCallback(async () => {
    await Promise.all(selected.map((s) => releaseLockSocket(s.number)));
    setSelected([]);
    setIdentityMethod(null);
    setIdentityVerified(false);
    setOldTicketUsed(false);
    setOldTicketNumber(null);
  }, [selected]);

  const value = useMemo<SessionState>(() => ({
    kioskId,
    connected,
    catalogue,
    trending,
    ttlMs,
    locks,
    identityMethod,
    identityVerified,
    oldTicketUsed,
    oldTicketNumber,
    selected,
    pricePerTicket: PRICE_PER_TICKET,
    discount: oldTicketUsed ? DISCOUNT_AMOUNT : 0,
    setIdentityMethod,
    setIdentityVerified,
    setOldTicket,
    selectNumber,
    deselectNumber,
    clearSelection,
    resetSession,
  }), [
    connected, catalogue, trending, ttlMs, locks,
    identityMethod, identityVerified, oldTicketUsed, oldTicketNumber, selected,
    setOldTicket, selectNumber, deselectNumber, clearSelection, resetSession,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
}
