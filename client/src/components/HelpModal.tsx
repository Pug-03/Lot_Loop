import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../state/SessionContext";

type Props = { onClose: () => void };

export default function HelpModal({ onClose }: Props) {
  const { t } = useTranslation();
  const { kioskId } = useSession();
  const [category, setCategory] = useState("screen");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);

  function submit() {
    // In production, POST to /api/reports. For now, log + acknowledge.
    console.info("[help-report]", { kioskId, category, details, ts: new Date().toISOString() });
    setSent(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("help_modal.title")}</h3>
        {sent ? (
          <p className="badge ok" style={{ display: "block", padding: "12px" }}>
            ✓ {t("help_modal.sent")}
          </p>
        ) : (
          <>
            <p className="note">{t("help_modal.body")}</p>
            <label>
              <div style={{ marginTop: 12, marginBottom: 6 }}>{t("help_modal.category")}</div>
              <select className="text" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="screen">{t("help_modal.cat_screen")}</option>
                <option value="card">{t("help_modal.cat_card")}</option>
                <option value="camera">{t("help_modal.cat_camera")}</option>
                <option value="cash">{t("help_modal.cat_cash")}</option>
                <option value="other">{t("help_modal.cat_other")}</option>
              </select>
            </label>
            <label>
              <div style={{ marginTop: 12, marginBottom: 6 }}>{t("help_modal.details")}</div>
              <textarea
                className="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={500}
              />
            </label>
            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={onClose}>{t("common.close")}</button>
              <button className="btn" onClick={submit} disabled={!details.trim()}>
                {t("help_modal.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
