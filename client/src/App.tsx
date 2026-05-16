import { Navigate, Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import Page1Identity from "./pages/Page1Identity";
import Page2Recycle from "./pages/Page2Recycle";
import Page3Select from "./pages/Page3Select";
import Page4Payment from "./pages/Page4Payment";

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/identity" replace />} />
          <Route path="/identity" element={<Page1Identity />} />
          <Route path="/recycle" element={<Page2Recycle />} />
          <Route path="/select" element={<Page3Select />} />
          <Route path="/payment" element={<Page4Payment />} />
          <Route path="*" element={<Navigate to="/identity" replace />} />
        </Routes>
      </main>
    </div>
  );
}
