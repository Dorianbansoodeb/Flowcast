import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForecastPage } from "./pages/ForecastPage";
import { ApiCostsPage } from "./pages/ApiCostsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { LinkBankPage } from "./pages/LinkBankPage";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/onboarding/connect" element={<LinkBankPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/api-costs" element={<ApiCostsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>
    </Routes>
    </ToastProvider>
  );
}
