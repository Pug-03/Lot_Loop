import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../state/SessionContext";
import HelpModal from "./HelpModal";
import { Icon } from "@iconify/react";

export default function TopBar() {
  const { t, i18n } = useTranslation();
  const { connected, kioskId } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  const lang = i18n.language;

  return (
    <div className="topbar">
      <div className="brand">
        <span className={`dot ${connected ? "" : "off"}`} />
        <span>{t("brand")}</span>
        <span className="kiosk-id">· {t("common.kiosk")} {kioskId}</span>
      </div>
      <div className="actions">
        <div className="lang-toggle" role="group" aria-label="language">
          <button
            className={lang.startsWith("en") ? "active" : ""}
            onClick={() => i18n.changeLanguage("en")}
          >
            {t("lang.en")}
          </button>
          <button
            className={lang.startsWith("th") ? "active" : ""}
            onClick={() => i18n.changeLanguage("th")}
          >
            {t("lang.th")}
          </button>
        </div>
        <button className="help-btn" onClick={() => setHelpOpen(true)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon icon="mdi:lifebuoy" width="18" height="18" /> {t("help")}
          </span>
        </button>
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
