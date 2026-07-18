import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import { Icon } from "@iconify/react";
import { checkPrize, claimPrize, Prize } from "../socket";

type Phase = "insert" | "checking" | "won" | "no-prize" | "claimed" | "dispensing" | "done";

// Simulated ticket reader. Replace with the real ticket OCR/barcode SDK read,
// which returns the 6-digit number printed on the inserted ticket. The demo
// pool mixes winning and non-winning numbers so each insert shows a realistic
// outcome against the demo draw in server/src/prizeStore.js.
const DEMO_TICKETS = ["123456", "555555", "246810", "888123", "000068", "314159", "271828"];
function readTicketNumber(): string {
  return DEMO_TICKETS[Math.floor(Math.random() * DEMO_TICKETS.length)];
}

export default function Page5Claim() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { resetSession, setFlowMode, setOldTicketUsed } = useSession();

  const [phase, setPhase] = useState<Phase>("insert");
  const [ticket, setTicket] = useState<string>("");
  const [prize, setPrize] = useState<Prize | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // A prize tier id from the server maps to a localized label.
  const tierLabel = (tier: string) => t(`page5.tier.${tier}`, { defaultValue: t("page5.prize") });

  // The customer inserts the physical ticket; the reader returns its number,
  // which we look up against the current draw.
  async function insertTicket() {
    setError(null);
    setPhase("checking");
    const number = readTicketNumber();
    setTicket(number);
    const res = await checkPrize(number);
    if (!res.ok) {
      setError(t("page5.error"));
      setPhase("insert");
      return;
    }
    if (!res.prize) {
      setPhase("no-prize");
      return;
    }
    if (res.claimed) {
      setPrize(res.prize);
      setPhase("claimed");
      return;
    }
    setPrize(res.prize);
    setPhase("won");
  }

  async function redeem() {
    setPhase("dispensing");
    const res = await claimPrize(ticket);
    if (!res.ok) {
      // Someone redeemed this exact ticket first, or it no longer wins.
      setError(res.reason === "already-claimed" ? t("page5.already_claimed") : t("page5.error"));
      setPhase(res.reason === "already-claimed" ? "claimed" : "insert");
      return;
    }
    setPaidAmount(res.amount ?? prize?.amount ?? 0);
    setTimeout(() => setPhase("done"), 1500);
  }

  function tryAnother() {
    setTicket("");
    setPrize(null);
    setError(null);
    setPhase("insert");
  }

  async function onNewSession() {
    await resetSession();
    nav("/identity");
  }

  // Carry the same (already verified) customer straight into the buy flow for
  // the next draw, recycling the ticket they just handed in for the discount.
  function buyNextDraw() {
    setOldTicketUsed(true);
    setFlowMode("buy");
    nav("/select");
  }

  return (
    <div>
      <h1 className="page-title">{t("page5.title")}</h1>
      <p className="page-subtitle">{t("page5.subtitle")}</p>

      {error && <div className="alert" style={{ marginBottom: 16 }}>{error}</div>}

      {phase === "insert" && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:ticket-confirmation-outline" width={20} height={20} /> {t("page5.insert_prompt")}
            </span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn big full" onClick={insertTicket}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon icon="mdi:tray-arrow-down" width={18} height={18} /> {t("page5.insert_btn")}
              </span>
            </button>
          </div>
        </div>
      )}

      {phase === "checking" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:magnify" width={20} height={20} /> {t("page5.checking")}
          </h3>
          <p className="note" style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem" }}>{ticket}</p>
        </div>
      )}

      {phase === "won" && prize && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:party-popper" width={20} height={20} /> {t("page5.congrats")}
            </span>
            <span className="badge ok">{tierLabel(prize.tier)}</span>
          </div>
          <p className="ticket-number" style={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", marginTop: 8 }}>
            {ticket}
          </p>
          <div className="row between" style={{ marginTop: 8 }}>
            <strong>{t("page5.prize_amount")}</strong>
            <strong style={{ color: "var(--accent)", fontSize: "1.6rem" }}>
              {prize.amount.toLocaleString()} {t("common.baht")}
            </strong>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={tryAnother}>{t("common.back")}</button>
            <button className="btn success big" onClick={redeem}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon icon="mdi:cash-multiple" width={18} height={18} /> {t("page5.redeem")}
              </span>
            </button>
          </div>
        </div>
      )}

      {phase === "no-prize" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:emoticon-sad-outline" width={20} height={20} /> {t("page5.no_prize")}
          </h3>
          <p className="note" style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem" }}>{ticket}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={tryAnother}>{t("page5.try_another")}</button>
            <button className="btn ghost" onClick={onNewSession}>{t("page5.finish")}</button>
          </div>
        </div>
      )}

      {phase === "claimed" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:alert-circle-outline" width={20} height={20} /> {t("page5.already_claimed")}
          </h3>
          <p className="note" style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem" }}>{ticket}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={tryAnother}>{t("page5.try_another")}</button>
            <button className="btn ghost" onClick={onNewSession}>{t("page5.finish")}</button>
          </div>
        </div>
      )}

      {phase === "dispensing" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:cash-fast" width={20} height={20} /> {t("page5.dispensing")}
          </h3>
          <p className="note">{t("common.loading")}</p>
        </div>
      )}

      {phase === "done" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:check-circle-outline" width={20} height={20} /> {t("page5.paid")}
          </h3>
          <div className="row between" style={{ marginTop: 8 }}>
            <span>{t("page5.prize_amount")}</span>
            <strong style={{ color: "var(--accent)", fontSize: "1.6rem" }}>
              {paidAmount.toLocaleString()} {t("common.baht")}
            </strong>
          </div>
          <p style={{ marginTop: 8 }}>{t("page5.collect_cash")}</p>

          <div className="card" style={{ marginTop: 16, background: "var(--surface-2, rgba(0,0,0,0.04))" }}>
            <div className="row between">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon icon="mdi:autorenew" width={20} height={20} /> <strong>{t("page5.next_draw_title")}</strong>
              </span>
              <span className="badge ok">−5 {t("common.baht")}</span>
            </div>
            <p className="note" style={{ marginTop: 8 }}>{t("page5.next_draw_desc")}</p>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn ghost" onClick={onNewSession}>{t("page5.finish")}</button>
              <button className="btn big" onClick={buyNextDraw}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon icon="mdi:cart-plus" width={18} height={18} /> {t("page5.buy_next")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
