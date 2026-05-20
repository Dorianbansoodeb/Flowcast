import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForecastPage } from "./pages/ForecastPage";
import { ApiCostsPage } from "./pages/ApiCostsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { AlertsPage } from "./pages/AlertsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/api-costs" element={<ApiCostsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>
    </Routes>
  );
}
