import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import { requestRandom, releaseLock } from "../socket";
import { Icon } from "@iconify/react";

type Mode = "single" | "set";
const SET_SIZE = 5;

export default function Page3Select() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const {
    kioskId,
    catalogue,
    trending,
    locks,
    selected,
    selectNumber,
    deselectNumber,
    pricePerTicket,
    discount,
    oldTicketNumber,
  } = useSession();

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [error, setError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);
  const [randomCandidate, setRandomCandidate] = useState<string | null>(null);
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomActive, setRandomActive] = useState(false);

  // Auto-attempt to pre-select the recycled-ticket number once.
  useEffect(() => {
    if (autoTried || !oldTicketNumber) return;
    setAutoTried(true);
    selectNumber(oldTicketNumber, "recycle").then((res) => {
      if (!res.ok) setError(t("page3.locked_other"));
    });
  }, [autoTried, oldTicketNumber, selectNumber, t]);

  function tileState(number: string): "free" | "self" | "other" | "selected" {
    const sel = selected.some((s) => s.number === number);
    if (sel) return "selected";
    const lock = locks.get(number);
    if (!lock) return "free";
    // Treat numbers locked by our kiosk as unavailable unless they are actively in `selected`.
    // This prevents showing our own held tickets as "self" by default (they look like already claimed/announced).
    return lock.kioskId === kioskId ? "other" : "other";
  }

  async function onTileClick(number: string, source: "trending" | "search" | "random" | "set") {
    setError(null);
    const state = tileState(number);
    if (state === "selected") {
      await deselectNumber(number);
      return;
    }
    if (state === "other") {
      setError(t("page3.locked_other"));
      return;
    }
    if (mode === "set") {
      // Pick `number` and the next 4 free ones from catalogue
      const targets = [number];
      for (const c of catalogue) {
        if (targets.length >= SET_SIZE) break;
        if (targets.includes(c)) continue;
        const s = tileState(c);
        if (s === "free") targets.push(c);
      }
      for (const n of targets) {
        const r = await selectNumber(n, "set");
        if (!r.ok) {
          setError(t("page3.locked_other"));
          break;
        }
      }
      return;
    }
    const r = await selectNumber(number, source);
    if (!r.ok) setError(t("page3.locked_other"));
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = search.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t("page3.invalid"));
      return;
    }
    if (!catalogue.includes(trimmed)) {
      setError(t("page3.not_found"));
      return;
    }
    const state = tileState(trimmed);
    if (state === "other") {
      setError(t("page3.locked_other"));
      return;
    }
    if (state === "selected") return;
    const r = await selectNumber(trimmed, "search");
    if (!r.ok) {
      setError(t("page3.locked_other"));
    } else {
      setSearch("");
      // search-to-buy: go to payment after successful select
      nav("/payment");
    }
  }

  async function onRandom() {
    setError(null);
    const res = await requestRandom();
    if (!res.ok || !res.number) {
      setError(t("page3.locked_other"));
      return;
    }
    // Server locked candidate; show confirmation modal allowing take/reroll/cancel
    setRandomCandidate(res.number);
    setRandomOpen(true);
    setRandomActive(true);
  }

  async function handleRandomTake() {
    if (!randomCandidate) return;
    await selectNumber(randomCandidate, "random");
    setRandomOpen(false);
    setRandomActive(false);
    setRandomCandidate(null);
  }

  async function handleRandomCancel() {
    if (randomCandidate) {
      await releaseLock(randomCandidate);
    }
    setRandomOpen(false);
    setRandomActive(false);
    setRandomCandidate(null);
  }

  async function handleRandomReroll() {
    if (randomCandidate) {
      await releaseLock(randomCandidate);
    }
    setRandomCandidate(null);
    setRandomActive(false);
    // try again
    await onRandom();
  }

  const subtotal = selected.length * pricePerTicket;
  const total = Math.max(0, subtotal - discount);

  const trendingTiles = useMemo(() => trending, [trending]);

  return (
    <div>
      <h1 className="page-title">{t("page3.title")}</h1>

      <div className="grid-2">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row between">
              <strong>{t("page3.mode")}</strong>
              <div className="row">
                <button
                  className={`btn ${mode === "single" ? "" : "ghost"}`}
                  onClick={() => setMode("single")}
                >{t("page3.single")}</button>
                <button
                  className={`btn ${mode === "set" ? "" : "ghost"}`}
                  onClick={() => setMode("set")}
                >{t("page3.set")}</button>
                <button className={randomActive ? "btn" : "btn ghost"} onClick={onRandom}><Icon icon="mdi:cube" width={16} height={16} /> {t("page3.random")}</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <strong>{t("page3.search")}</strong>
            <form onSubmit={onSearch} style={{ marginTop: 10 }}>
              <input
                className="text"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("page3.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                <button className="btn" type="submit" disabled={search.length !== 6}>
                  {t("page3.select")}
                </button>
              </div>
            </form>
            {/** When searching, if found we will select and navigate to payment (search-to-buy) */}
          </div>

          <div className="card">
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon icon="mdi:star-outline" width={18} height={18} /> {t("page3.trending")}</strong>
            <div className="grid-5" style={{ marginTop: 12 }}>
              {trendingTiles.map((n) => {
                const state = tileState(n);
                const cls =
                  state === "selected" ? "num-tile selected"
                  : state === "self" ? "num-tile locked-self"
                  : state === "other" ? "num-tile locked-other"
                  : "num-tile";
                return (
                  <div
                    key={n}
                    className={cls}
                    onClick={() => onTileClick(n, "trending")}
                    title={state === "other" ? t("page3.locked_other") : ""}
                  >
                    {n}
                    {state === "other" && <span className="sub"><Icon icon="mdi:lock-outline" width={14} height={14} /> {t("page3.unavailable")}</span>}
                    {state === "self" && <span className="sub">{t("page3.locked_self")}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}
        </div>

          <div className="card">
          <strong style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon icon="mdi:cart-outline" width={18} height={18} /> {t("page3.cart")}</strong>
          <div className="cart" style={{ marginTop: 12 }}>
            {selected.length === 0 && (
              <div className="empty">{t("page3.empty_cart")}</div>
            )}
            {selected.map((s) => {
              const ttl = Math.max(0, Math.round((s.expiresAt - Date.now()) / 1000));
              return (
                <div key={s.number} className="item">
                  <div>
                    {s.number}
                    <div className="meta">{t("page3.ttl", { seconds: ttl })}</div>
                  </div>
                  <button className="btn ghost" onClick={() => deselectNumber(s.number)}>
                    <Icon icon="mdi:close" width={14} height={14} /> {t("page3.deselect")}
                  </button>
                </div>
              );
            })}
          </div>

          {selected.length > 0 && (
            <div className="summary">
              <div className="row">
                <span>{t("page3.cart_total")}</span>
                <span>{subtotal} {t("common.baht")}</span>
              </div>
              {discount > 0 && (
                <div className="row">
                  <span>{t("page3.discount_label")}</span>
                  <span>− {discount} {t("common.baht")}</span>
                </div>
              )}
              <div className="row total">
                <span>{t("page3.total")}</span>
                <span>{total} {t("common.baht")}</span>
              </div>
              <button
                className="btn big full"
                style={{ marginTop: 12 }}
                onClick={() => nav("/payment")}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {t("page3.proceed")} <Icon icon="mdi:arrow-right" width={18} height={18} />
                </span>
              </button>
            </div>
          )}

          <div className="note" style={{ marginTop: 14 }}>
            {t("page3.price_each", { price: pricePerTicket })}
          </div>
        {randomOpen && randomCandidate && (
          <div className="modal-back" onClick={handleRandomCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{t("page3.random")}</h3>
              <p style={{ fontSize: "1.6rem", fontFamily: "Courier New, monospace", marginTop: 8 }}>{randomCandidate}</p>
              <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
                <button className="btn ghost" onClick={handleRandomCancel}>{t("common.cancel")}</button>
                <button className="btn ghost" onClick={handleRandomReroll} style={{ marginLeft: 8 }}>{t("page3.random")}</button>
                <button className="btn" onClick={handleRandomTake} style={{ marginLeft: 8 }}>{t("page3.select")}</button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
