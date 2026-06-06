import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSession } from "../state/SessionContext";
import { Icon } from "@iconify/react";
import ConsentModal from "../components/ConsentModal";

type Step = "choose" | "card-insert" | "thaid-handshake" | "face" | "done";

export default function Page1Identity() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { identityMethod, setIdentityMethod, setIdentityVerified } = useSession();
  const [step, setStep] = useState<Step>("choose");
  const [scanning, setScanning] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("pdpaAccepted") === "1";
    setConsentAccepted(v);
  }, []);

  function chooseMethod(method: "card" | "thaid") {
    setIdentityMethod(method);
    setStep(method === "card" ? "card-insert" : "thaid-handshake");
  }

  function handleAck() {
    setStep("face");
  }

  function handleFaceOk() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setIdentityVerified(true);
      setStep("done");
    }, 10000); // require at least 10s for verification
  }

  function continueNext() {
    nav("/recycle");
  }

  return (
    <div>
      <h1 className="page-title">{t("page1.title")}</h1>
      <p className="page-subtitle">{t("page1.subtitle")}</p>

      {!consentAccepted ? (
        <ConsentModal onAccept={() => { localStorage.setItem("pdpaAccepted", "1"); setConsentAccepted(true); }} />
      ) : step === "choose" && (
        <div className="grid-2">
          <div
            className={`card method ${identityMethod === "card" ? "selected" : ""}`}
            onClick={() => chooseMethod("card")}
          >
            <div className="icon"><Icon icon="mdi:credit-card-outline" width="44" height="44" /></div>
            <div className="h">{t("page1.method_card")}</div>
            <div className="desc">{t("page1.method_card_desc")}</div>
          </div>
          <div
            className={`card method ${identityMethod === "thaid" ? "selected" : ""}`}
            onClick={() => chooseMethod("thaid")}
          >
            <div className="icon"><Icon icon="mdi:cellphone" width="44" height="44" /></div>
            <div className="h">{t("page1.method_thaid")}</div>
            <div className="desc">{t("page1.method_thaid_desc")}</div>
          </div>
        </div>
      )}

      {step === "card-insert" && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:credit-card-outline" width="20" height="20" /> {t("page1.insert_card")}
            </span>
            <span className="badge warn">●●●</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setStep("choose")}>
              {t("common.back")}
            </button>
            <button className="btn" onClick={handleAck}>
              {t("page1.card_insert")}
            </button>
          </div>
        </div>
      )}

      {step === "thaid-handshake" && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:cellphone" width="20" height="20" /> {t("page1.thaid_pending")}
            </span>
            <span className="badge warn">●●●</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setStep("choose")}>
              {t("common.back")}
            </button>
            <button className="btn" onClick={handleAck}>
              {t("page1.thaid_ack")}
            </button>
          </div>
        </div>
      )}

      {step === "face" && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:camera" width="20" height="20" /> {scanning ? t("page1.face_scanning") : t("page1.face_prompt")}
            </span>
            <span className={`badge ${scanning ? "warn" : "ok"}`}>{scanning ? "..." : "READY"}</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setStep("choose")} disabled={scanning}>
              {t("common.back")}
            </button>
            <button className="btn" onClick={handleFaceOk} disabled={scanning}>
              {t("page1.face_ok_btn")}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="card">
          <div className="row between">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon icon="mdi:check-circle-outline" width="20" height="20" /> {t("page1.face_ok")}
            </span>
            <span className="badge ok">OK</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn big full" onClick={continueNext}>
              {t("page1.continue")} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
