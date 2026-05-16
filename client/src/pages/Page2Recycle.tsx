import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import { Icon } from "@iconify/react";

type Step = "ask" | "scan" | "done";

export default function Page2Recycle() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { setOldTicket, oldTicketNumber, catalogue } = useSession();
  const [step, setStep] = useState<Step>("ask");

  function chooseUse() { setStep("scan"); }
  function chooseSkip() {
    setOldTicket(null);
    nav("/select");
  }

  function simulateScan() {
    // Pick a deterministic-ish demo number from the catalogue
    const idx = Math.floor(Math.random() * catalogue.length);
    const number = catalogue[idx] ?? "246810";
    setOldTicket(number);
    setStep("done");
  }

  function continueNext() {
    nav("/select");
  }

  return (
    <div>
      <h1 className="page-title">{t("page2.title")}</h1>
      <p className="page-subtitle">{t("page2.subtitle")}</p>

      {step === "ask" && (
        <div className="grid-2">
          <div className="card method" onClick={chooseUse}>
            <div className="icon"><Icon icon="mdi:ticket" width={44} height={44} /></div>
            <div className="h">{t("page2.use_old")}</div>
            <div className="desc">−5 {t("common.baht")}</div>
          </div>
          <div className="card method" onClick={chooseSkip}>
            <div className="icon"><Icon icon="mdi:arrow-right" width={44} height={44} /></div>
            <div className="h">{t("page2.skip")}</div>
          </div>
        </div>
      )}

      {step === "scan" && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:camera" width={20} height={20} /> {t("page2.scan_prompt")}
            </span>
            <span className="badge warn">●●●</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setStep("ask")}>{t("common.back")}</button>
            <button className="btn" onClick={simulateScan}>{t("page2.sim_scan")}</button>
          </div>
        </div>
      )}

      {step === "done" && oldTicketNumber && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:check-circle-outline" width={20} height={20} /> {t("page2.scanned")}
            </span>
            <span className="badge ok">−5 {t("common.baht")}</span>
          </div>
          <p style={{ fontSize: "1.2rem" }}>
            {t("page2.prefilled", { number: oldTicketNumber })}
          </p>
          <p className="note">{t("page2.discount")}</p>
          <button className="btn big full" onClick={continueNext}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {t("page1.continue")} <Icon icon="mdi:arrow-right" width={18} height={18} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
