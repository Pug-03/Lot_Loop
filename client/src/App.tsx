import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import Stepper from "./components/Stepper";
import IdleReset from "./components/IdleReset";
import Page1Identity from "./pages/Page1Identity";
import Page2Recycle from "./pages/Page2Recycle";
import Page3Select from "./pages/Page3Select";
import Page4Payment from "./pages/Page4Payment";

export default function App() {
  const loc = useLocation();
  return (
    <div className="app">
      <TopBar />
      <Stepper />
      <main className="main" key={loc.pathname}>
        <Routes>
          <Route path="/" element={<Navigate to="/identity" replace />} />
          <Route path="/identity" element={<Page1Identity />} />
          <Route path="/recycle" element={<Page2Recycle />} />
          <Route path="/select" element={<Page3Select />} />
          <Route path="/payment" element={<Page4Payment />} />
          <Route path="*" element={<Navigate to="/identity" replace />} />
        </Routes>
      </main>
      <IdleReset />
    </div>
  );
}
