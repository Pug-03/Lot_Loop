import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  socket,
  kioskId,
  Snapshot,
  LockUpdate,
  SoldUpdate,
  acquireLock as acquireLockSocket,
  releaseLock as releaseLockSocket,
  purchaseNumbers,
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
  trending: string[];
  ttlMs: number;
  // Map number -> kioskId of holder. If holder === our kioskId, it's our hold.
  locks: Map<string, { kioskId: string; expiresAt: number }>;
  // Numbers permanently sold and removed from the system.
  sold: Set<string>;

  // Wizard state
  // PDPA consent — required once per customer/session (resets on new session & reload).
  consentAccepted: boolean;
  acceptConsent: () => void;
  identityMethod: IdentityMethod;
  identityVerified: boolean;
  oldTicketUsed: boolean;
  selected: SelectedNumber[];
  pricePerTicket: number;
  discount: number;

  setIdentityMethod: (m: IdentityMethod) => void;
  setIdentityVerified: (v: boolean) => void;
  // Mark whether the customer recycled an old ticket (drives the discount only —
  // the old ticket's number is intentionally not tracked or carried forward).
  setOldTicketUsed: (used: boolean) => void;

  selectNumber: (number: string, source: SelectedNumber["source"]) => Promise<{ ok: boolean; reason?: string }>;
  deselectNumber: (number: string) => Promise<void>;
  clearSelection: () => Promise<void>;

  // Finalize the purchase: permanently removes the selected numbers from the system.
  purchaseSelected: () => Promise<{ ok: boolean; reason?: string; unavailable?: string[] }>;

  resetSession: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

const PRICE_PER_TICKET = 80;
const DISCOUNT_AMOUNT = 5;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(socket.connected);
  const [trending, setTrending] = useState<string[]>([]);
  const [ttlMs, setTtlMs] = useState(90_000);
  const [locks, setLocks] = useState<Map<string, { kioskId: string; expiresAt: number }>>(new Map());
  const [sold, setSold] = useState<Set<string>>(new Set());

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [identityMethod, setIdentityMethod] = useState<IdentityMethod>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [oldTicketUsed, setOldTicketUsed] = useState(false);
  const [selected, setSelected] = useState<SelectedNumber[]>([]);

  useEffect(() => {
    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }
    function onSnapshot(snap: Snapshot) {
      setTrending(snap.trending);
      setTtlMs(snap.ttlMs);
      const m = new Map<string, { kioskId: string; expiresAt: number }>();
      for (const l of snap.locks) m.set(l.number, { kioskId: l.kioskId, expiresAt: l.expiresAt });
      setLocks(m);
      setSold(new Set(snap.sold));
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
    function onSoldUpdate(u: SoldUpdate) {
      setSold((prev) => {
        const next = new Set(prev);
        for (const n of u.numbers) next.add(n);
        return next;
      });
      // A number sold elsewhere can no longer be held or kept in our cart.
      setLocks((prev) => {
        const next = new Map(prev);
        for (const n of u.numbers) next.delete(n);
        return next;
      });
      setSelected((prev) => prev.filter((s) => !u.numbers.includes(s.number)));
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("snapshot", onSnapshot);
    socket.on("lock:update", onLockUpdate);
    socket.on("sold:update", onSoldUpdate);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("snapshot", onSnapshot);
      socket.off("lock:update", onLockUpdate);
      socket.off("sold:update", onSoldUpdate);
    };
  }, []);

  // Periodic re-render so TTL countdowns refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
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

  const purchaseSelected = useCallback<SessionState["purchaseSelected"]>(async () => {
    if (selected.length === 0) return { ok: false, reason: "no-numbers" };
    const numbers = selected.map((s) => s.number);
    const res = await purchaseNumbers(numbers);
    if (res.ok) {
      // Permanently sold. Keep `selected` for the on-screen receipt; mark them
      // sold locally (the server only broadcasts sold:update to OTHER kiosks).
      setSold((prev) => {
        const next = new Set(prev);
        for (const n of numbers) next.add(n);
        return next;
      });
      setLocks((prev) => {
        const next = new Map(prev);
        for (const n of numbers) next.delete(n);
        return next;
      });
    }
    return res;
  }, [selected]);

  const acceptConsent = useCallback(() => setConsentAccepted(true), []);

  const resetSession = useCallback(async () => {
    await Promise.all(selected.map((s) => releaseLockSocket(s.number)));
    setSelected([]);
    // New customer in the queue must give PDPA consent again.
    setConsentAccepted(false);
    setIdentityMethod(null);
    setIdentityVerified(false);
    setOldTicketUsed(false);
  }, [selected]);

  const value = useMemo<SessionState>(() => ({
    kioskId,
    connected,
    trending,
    ttlMs,
    locks,
    sold,
    consentAccepted,
    acceptConsent,
    identityMethod,
    identityVerified,
    oldTicketUsed,
    selected,
    pricePerTicket: PRICE_PER_TICKET,
    discount: oldTicketUsed ? DISCOUNT_AMOUNT : 0,
    setIdentityMethod,
    setIdentityVerified,
    setOldTicketUsed,
    selectNumber,
    deselectNumber,
    clearSelection,
    purchaseSelected,
    resetSession,
  }), [
    connected, trending, ttlMs, locks, sold, consentAccepted, acceptConsent,
    identityMethod, identityVerified, oldTicketUsed, selected,
    selectNumber, deselectNumber, clearSelection, purchaseSelected, resetSession,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
}
