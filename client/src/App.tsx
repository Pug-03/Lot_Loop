import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import Stepper from "./components/Stepper";
import IdleReset from "./components/IdleReset";
import Page1Identity from "./pages/Page1Identity";
import Page2Recycle from "./pages/Page2Recycle";
import Page3Select from "./pages/Page3Select";
import Page4Payment from "./pages/Page4Payment";
import { useSession } from "./state/SessionContext";

export default function App() {
  const loc = useLocation();
  const { consentAccepted, identityVerified } = useSession();

  // PDPA consent is per-session: a page refresh wipes the in-memory session,
  // so any unconsented visit (incl. a refresh mid-flow) is sent back to the
  // identity page where the consent notice is shown before anything proceeds.
  const needsConsent = !consentAccepted && loc.pathname !== "/identity";

  // Later steps require a verified identity. Without this, giving consent and
  // then navigating straight to /select or /payment would skip verification.
  const AFTER_IDENTITY = ["/recycle", "/select", "/payment"];
  const needsIdentity =
    consentAccepted &&
    !identityVerified &&
    AFTER_IDENTITY.some((p) => loc.pathname.startsWith(p));

  return (
    <div className="app">
      <TopBar />
      <Stepper />
      <main className="main" key={loc.pathname}>
        {needsConsent || needsIdentity ? (
          <Navigate to="/identity" replace />
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/identity" replace />} />
            <Route path="/identity" element={<Page1Identity />} />
            <Route path="/recycle" element={<Page2Recycle />} />
            <Route path="/select" element={<Page3Select />} />
            <Route path="/payment" element={<Page4Payment />} />
            <Route path="*" element={<Navigate to="/identity" replace />} />
          </Routes>
        )}
      </main>
      <IdleReset />
    </div>
  );
}
