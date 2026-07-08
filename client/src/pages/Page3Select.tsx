import { useMemo, useState } from "react";
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
    trending,
    locks,
    sold,
    selected,
    selectNumber,
    deselectNumber,
    pricePerTicket,
    discount,
  } = useSession();

  const [search, setSearch] = useState("");
  const [searchConfirm, setSearchConfirm] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [error, setError] = useState<string | null>(null);
  const [randomCandidate, setRandomCandidate] = useState<string | null>(null);
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomActive, setRandomActive] = useState(false);

  function tileState(number: string): "free" | "self" | "other" | "selected" | "sold" {
    const sel = selected.some((s) => s.number === number);
    if (sel) return "selected";
    if (sold.has(number)) return "sold";
    const lock = locks.get(number);
    if (!lock) return "free";
    // Any active lock (ours or another kiosk's) that isn't in `selected` is
    // shown as unavailable so held tickets don't look claimable.
    return "other";
  }

  async function onTileClick(number: string, source: "trending" | "search" | "random" | "set") {
    setError(null);
    const state = tileState(number);
    if (state === "selected") {
      await deselectNumber(number);
      return;
    }
    if (state === "sold") {
      setError(t("page3.sold"));
      return;
    }
    if (state === "other") {
      setError(t("page3.locked_other"));
      return;
    }
    if (mode === "set") {
      // Pick `number` and the next free numbers in sequence across the full range.
      const targets = [number];
      const start = Number(number);
      let cursor = start;
      while (targets.length < SET_SIZE) {
        cursor = (cursor + 1) % 1_000_000;
        if (cursor === start) break; // wrapped all the way around
        const candidate = cursor.toString().padStart(6, "0");
        if (targets.includes(candidate)) continue;
        if (tileState(candidate) === "free") targets.push(candidate);
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
    const state = tileState(trimmed);
    if (state === "sold") {
      setError(t("page3.sold"));
      return;
    }
    if (state === "other") {
      setError(t("page3.locked_other"));
      return;
    }
    if (state === "selected") {
      // Already reserved in this session — go straight to confirmation.
      setSearch("");
      setSearchConfirm(trimmed);
      return;
    }
    const r = await selectNumber(trimmed, "search");
    if (!r.ok) {
      setError(r.reason === "sold" ? t("page3.sold") : t("page3.locked_other"));
    } else {
      setSearch("");
      // Reserve the number, then ask the customer to confirm before checkout.
      setSearchConfirm(trimmed);
    }
  }

  async function handleSearchConfirm() {
    // Keep the number reserved in the cart, but stay on selection — the
    // customer goes to payment later via the cart's "Proceed" button.
    setSearchConfirm(null);
  }

  async function handleSearchCancel() {
    if (searchConfirm) await deselectNumber(searchConfirm);
    setSearchConfirm(null);
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
              <div className="mode-toggle">
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
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t("page3.search")}
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
            <div className="lucky-marquee" style={{ marginTop: 12 }}>
              <div className="lucky-track">
                {[...trendingTiles, ...trendingTiles].map((n, i) => {
                  const isClone = i >= trendingTiles.length;
                  const state = tileState(n);
                  const cls =
                    "lucky-chip"
                    + (state === "selected" ? " selected"
                      : state === "self" ? " self"
                      : state === "other" ? " other"
                      : state === "sold" ? " sold" : "");
                  return (
                    <button
                      key={`${n}-${i}`}
                      type="button"
                      className={cls}
                      onClick={() => onTileClick(n, "trending")}
                      title={state === "sold" ? t("page3.sold") : state === "other" ? t("page3.locked_other") : ""}
                      aria-hidden={isClone || undefined}
                      tabIndex={isClone ? -1 : undefined}
                    >
                      <Icon icon="mdi:clover" width={14} height={14} />
                      {n}
                      {state === "sold" && <Icon icon="mdi:close-circle-outline" width={12} height={12} />}
                      {state === "other" && <Icon icon="mdi:lock-outline" width={12} height={12} />}
                      {state === "self" && <Icon icon="mdi:check" width={12} height={12} />}
                    </button>
                  );
                })}
              </div>
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
                  <button
                    className="btn ghost"
                    onClick={() => deselectNumber(s.number)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <Icon icon="mdi:close-thick" width="1.1em" height="1.1em" /> {t("page3.deselect")}
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
        {searchConfirm && (
          <div className="modal-back" onClick={handleSearchCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{t("page3.confirm_title")}</h3>
              <p style={{ fontSize: "1.6rem", fontFamily: "var(--font-mono)", marginTop: 8 }}>{searchConfirm}</p>
              <p className="note" style={{ marginTop: 8 }}>
                {t("page3.confirm_prompt", { number: searchConfirm, price: pricePerTicket })}
              </p>
              <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
                <button className="btn ghost" onClick={handleSearchCancel}>{t("common.cancel")}</button>
                <button className="btn" onClick={handleSearchConfirm} style={{ marginLeft: 8 }}>{t("common.confirm")}</button>
              </div>
            </div>
          </div>
        )}
        {randomOpen && randomCandidate && (
          <div className="modal-back" onClick={handleRandomCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{t("page3.random")}</h3>
              <p style={{ fontSize: "1.6rem", fontFamily: "var(--font-mono)", marginTop: 8 }}>{randomCandidate}</p>
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
