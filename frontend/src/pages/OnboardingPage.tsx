import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ACCOUNT_ID } from "../api/client";
import { getBankMeta, syncBankFromApi } from "../lib/onboardingStorage";

function BankIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10h18M5 10V19M9 10V19M15 10V19M19 10V19M4 19h16M12 3l8 5H4l8-5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0113.5-5.7M20 12a8 8 0 01-13.5 5.7M4 8v4H0M20 16v-4h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14v6M10 10v10M16 6v14M22 2v18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type StepId = 1 | 2 | 3;

type OnboardingLocationState = {
  bankConnected?: boolean;
  message?: string;
  institutionName?: string;
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? {}) as OnboardingLocationState;
  const cachedMeta = getBankMeta();

  const [plaidConfigured, setPlaidConfigured] = useState(false);
  const [bankConnected, setBankConnected] = useState(Boolean(routeState.bankConnected));
  const [transactionsSynced, setTransactionsSynced] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(
    routeState.institutionName ??
      cachedMeta?.institutionName ??
      cachedMeta?.bankName ??
      null
  );
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const [loadingStep, setLoadingStep] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    routeState.message ?? null
  );

  useEffect(() => {
    api
      .getPlaidStatus()
      .then((status) => {
        setPlaidConfigured(status.plaid_configured);
        if (status.linked) {
          syncBankFromApi(status);
          setBankConnected(true);
          setInstitutionName(status.institution_name ?? status.bank_name);
        }
        if (status.transaction_count > 0) {
          setTransactionsSynced(true);
          setSyncCount(status.transaction_count);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load status"));
  }, []);

  const handleConnectAccount = () => {
    if (bankConnected) return;
    navigate("/onboarding/connect");
  };

  const handleSyncNow = async () => {
    if (!bankConnected) return;
    setLoadingStep(2);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await api.syncPlaidTransactions(ACCOUNT_ID, true);
      const total = result.added + result.modified;
      setSyncCount(total);
      setTransactionsSynced(true);
      setStatusMessage(
        `Imported ${total} transactions. You're ready for your dashboard.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync transactions");
    } finally {
      setLoadingStep(null);
    }
  };

  const handleGoToDashboard = () => {
    if (!transactionsSynced) return;
    navigate("/dashboard");
  };

  const step1Done = bankConnected;
  const step2Done = transactionsSynced;

  const steps: {
    id: StepId;
    Icon: typeof BankIcon;
    title: string;
    description: string;
    buttonLabel: string;
    primary: boolean;
    done: boolean;
    enabled: boolean;
    onClick: () => void;
  }[] = [
    {
      id: 1,
      Icon: BankIcon,
      title: "Link Your Bank Account",
      description: "Choose your bank and account type, then sign in securely",
      buttonLabel: step1Done ? "Connected" : "Connect Account",
      primary: true,
      done: step1Done,
      enabled: !step1Done,
      onClick: handleConnectAccount,
    },
    {
      id: 2,
      Icon: SyncIcon,
      title: "Sync Transactions",
      description: "We'll import your last 24 months of transactions",
      buttonLabel: step2Done
        ? `Synced${syncCount != null ? ` (${syncCount})` : ""}`
        : loadingStep === 2
          ? "Syncing…"
          : "Sync Now",
      primary: false,
      done: step2Done,
      enabled: step1Done && !step2Done && loadingStep !== 2,
      onClick: handleSyncNow,
    },
    {
      id: 3,
      Icon: DashboardIcon,
      title: "View Your Dashboard",
      description: "See your 90-day cash flow forecast",
      buttonLabel: "Go to Dashboard",
      primary: true,
      done: false,
      enabled: step2Done && loadingStep === null,
      onClick: handleGoToDashboard,
    },
  ];

  return (
    <div className="onboarding-page">
      <header className="onboarding-topbar">
        <Link to="/" className="onboarding-brand">
          Flowcast
        </Link>
        <span className="onboarding-badge">Setup</span>
      </header>

      <main className="onboarding-main">
        <div className="onboarding-intro">
          <h1>Get your books flowing</h1>
          <p>
            Connect your business bank, sync historical transactions, and unlock
            cash flow forecasting in three simple steps.
          </p>
        </div>

        {statusMessage && (
          <p className="onboarding-status" role="status">
            {statusMessage}
            {institutionName && step1Done && (
              <span className="onboarding-status-sub"> · {institutionName}</span>
            )}
          </p>
        )}

        {error && (
          <p className="onboarding-error" role="alert">
            {error}
          </p>
        )}

        <ol className="onboarding-steps">
          {steps.map(
            ({ id, Icon, title, description, buttonLabel, primary, done, enabled, onClick }) => (
              <li
                key={id}
                className={`onboarding-step-card card${done ? " onboarding-step-card--done" : ""}${enabled ? " onboarding-step-card--active" : ""}`}
              >
                <div className="onboarding-step-meta">
                  <span className="onboarding-step-num">
                    {done ? "Done" : `Step ${id}`}
                  </span>
                  <div className="onboarding-step-icon">
                    <Icon />
                  </div>
                </div>
                <div className="onboarding-step-body">
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <button
                    type="button"
                    className={
                      primary
                        ? `btn btn-primary${!enabled ? " btn-inactive" : ""}`
                        : `btn${!enabled ? " btn-inactive" : ""}`
                    }
                    disabled={!enabled}
                    onClick={onClick}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </li>
            )
          )}
        </ol>

        {bankConnected && !transactionsSynced && (
          <p className="onboarding-footnote">
            {plaidConfigured
              ? "After Plaid sign-in, tap Sync Now to pull transactions into Flowcast."
              : "Demo bank linked — tap Sync Now to load sample transactions."}
          </p>
        )}
      </main>
    </div>
  );
}
