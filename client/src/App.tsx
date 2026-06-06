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
  const { consentAccepted } = useSession();

  // PDPA consent is per-session: a page refresh wipes the in-memory session,
  // so any unconsented visit (incl. a refresh mid-flow) is sent back to the
  // identity page where the consent notice is shown before anything proceeds.
  const needsConsent = !consentAccepted && loc.pathname !== "/identity";

  return (
    <div className="app">
      <TopBar />
      <Stepper />
      <main className="main" key={loc.pathname}>
        {needsConsent ? (
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
