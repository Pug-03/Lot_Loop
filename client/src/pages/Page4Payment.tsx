import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import { Icon } from "@iconify/react";

type Method = "cash" | "promptpay" | null;
type Phase = "method" | "cash" | "qr" | "printing" | "done";

export default function Page4Payment() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { selected, pricePerTicket, discount, resetSession } = useSession();

  const subtotal = selected.length * pricePerTicket;
  const total = Math.max(0, subtotal - discount);

  const [method, setMethod] = useState<Method>(null);
  const [phase, setPhase] = useState<Phase>("method");
  const [inserted, setInserted] = useState(0);

  useEffect(() => {
    if (selected.length === 0) {
      // Nothing to pay for — return to selection.
      nav("/select", { replace: true });
    }
  }, [selected.length, nav]);

  function chooseCash() { setMethod("cash"); setPhase("cash"); }
  function choosePromptpay() { setMethod("promptpay"); setPhase("qr"); }

  function insert(amount: number) {
    setInserted((v) => {
      const next = v + amount;
      if (next >= total) {
        completePayment();
      }
      return next;
    });
  }

  function completePayment() {
    setPhase("printing");
    setTimeout(() => setPhase("done"), 1500);
  }

  async function onNewSession() {
    await resetSession();
    nav("/identity");
  }

  return (
    <div>
      <h1 className="page-title">{t("page4.title")}</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between">
          <span>{t("page3.cart")}</span>
          <span className="badge ok">
            {selected.length} × {pricePerTicket} = {subtotal} {t("common.baht")}
          </span>
        </div>
        {discount > 0 && (
          <div className="row between" style={{ marginTop: 6 }}>
            <span>{t("page3.discount_label")}</span>
            <span>− {discount} {t("common.baht")}</span>
          </div>
        )}
        <div className="row between" style={{ marginTop: 6 }}>
          <strong>{t("page3.total")}</strong>
          <strong style={{ color: "var(--accent)", fontSize: "1.5rem" }}>
            {total} {t("common.baht")}
          </strong>
        </div>
      </div>

      {phase === "method" && (
        <div className="grid-2">
          <div className="card method" onClick={chooseCash}>
            <div className="icon"><Icon icon="mdi:cash" width={44} height={44} /></div>
            <div className="h">{t("page4.cash")}</div>
          </div>
          <div className="card method" onClick={choosePromptpay}>
            <div className="icon"><Icon icon="mdi:cellphone" width={44} height={44} /></div>
            <div className="h">{t("page4.promptpay")}</div>
          </div>
        </div>
      )}

      {phase === "cash" && (
        <div className="card">
          <p>{t("page4.cash_prompt")}</p>
          <div className="row between" style={{ marginTop: 8 }}>
            <span>{t("page4.inserted")}</span>
            <strong>{inserted} {t("common.baht")}</strong>
          </div>
          <div className="row between">
            <span>{t("page4.remaining")}</span>
            <strong style={{ color: "var(--accent)" }}>
              {Math.max(0, total - inserted)} {t("common.baht")}
            </strong>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => insert(10)}>{t("page4.insert_10")}</button>
            <button className="btn" onClick={() => insert(50)}>{t("page4.insert_50")}</button>
            <button className="btn" onClick={() => insert(100)}>{t("page4.insert_100")}</button>
            <button className="btn ghost" onClick={() => setPhase("method")}>{t("common.back")}</button>
          </div>
        </div>
      )}

      {phase === "qr" && (
        <div className="card">
          <p>{t("page4.qr_prompt")}</p>
          <PromptPayQR amount={total} />
          <div className="row" style={{ marginTop: 16, justifyContent: "center" }}>
            <button className="btn ghost" onClick={() => setPhase("method")}>{t("common.back")}</button>
            <button className="btn success" onClick={completePayment}>
              {t("page4.qr_paid")}
            </button>
          </div>
        </div>
      )}

      {phase === "printing" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:printer" width={20} height={20} /> {t("page4.printing")}
          </h3>
          <p className="note">{t("common.loading")}</p>
        </div>
      )}

      {phase === "done" && (
        <div className="card">
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:check-circle-outline" width={20} height={20} /> {t("page4.success")}
          </h3>
          <p>{t("page4.done")}</p>
          {method === "cash" && inserted > total && (
            <div className="row between">
              <span>{t("page4.change")}</span>
              <strong>{inserted - total} {t("common.baht")}</strong>
            </div>
          )}
          <ul>
            {selected.map((s) => (
              <li key={s.number} style={{ fontFamily: "monospace", fontSize: "1.2rem" }}>
                <Icon icon="mdi:ticket" width={16} height={16} /> {s.number}
              </li>
            ))}
          </ul>
          <button className="btn big full" onClick={onNewSession}>
            {t("page4.new_session")}
          </button>
        </div>
      )}
    </div>
  );
}

// Renders the PromptPay QR. Replace the pattern below with a real EMVCo
// PromptPay payload (merchant ID + amount) when wiring the payment gateway.
function PromptPayQR({ amount }: { amount: number }) {
  const N = 21;
  // Deterministic pseudo-random pattern seeded by amount
  const cells: boolean[] = [];
  let seed = amount * 9301 + 49297;
  for (let i = 0; i < N * N; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    cells.push((seed & 1) === 1);
  }
  // Add finder squares (corners)
  function setFinder(r: number, c: number) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const inBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const inCenter = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        cells[(r + i) * N + (c + j)] = inBorder || inCenter;
      }
    }
  }
  setFinder(0, 0);
  setFinder(0, N - 7);
  setFinder(N - 7, 0);

  return (
    <div className="qr">
      <svg viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges">
        <rect width={N} height={N} fill="white" />
        {cells.map((on, i) =>
          on ? (
            <rect
              key={i}
              x={i % N}
              y={Math.floor(i / N)}
              width={1}
              height={1}
              fill="black"
            />
          ) : null
        )}
      </svg>
    </div>
  );
}
