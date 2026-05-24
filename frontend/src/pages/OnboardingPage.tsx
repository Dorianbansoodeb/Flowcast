import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ACCOUNT_ID } from "../api/client";
import {
  clearBankConnection,
  getBankMeta,
  syncBankFromApi,
} from "../lib/onboardingStorage";
import {
  clearSetupComplete,
  isSetupComplete,
  markSetupComplete,
} from "../lib/userSettings";

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
  fresh?: boolean;
  bankConnected?: boolean;
  transactionsSynced?: boolean;
  message?: string;
  institutionName?: string;
  syncCount?: number;
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? {}) as OnboardingLocationState;
  const isFreshStart = Boolean(routeState.fresh);

  const [plaidConfigured, setPlaidConfigured] = useState(false);
  const [bankConnected, setBankConnectedState] = useState(
    isFreshStart ? false : Boolean(routeState.bankConnected)
  );
  const [transactionsSynced, setTransactionsSynced] = useState(
    isFreshStart ? false : Boolean(routeState.transactionsSynced)
  );
  const [institutionName, setInstitutionName] = useState<string | null>(
    isFreshStart ? null : (routeState.institutionName ?? getBankMeta()?.institutionName ?? null)
  );
  const [syncCount, setSyncCount] = useState<number | null>(
    isFreshStart ? null : (routeState.syncCount ?? null)
  );
  const [loadingStep, setLoadingStep] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    isFreshStart ? null : (routeState.message ?? null)
  );

  useEffect(() => {
    if (isFreshStart) {
      clearBankConnection();
      clearSetupComplete();
      return;
    }
    if (!isFreshStart && isSetupComplete()) {
      navigate("/dashboard", { replace: true });
    }
  }, [isFreshStart, navigate]);

  useEffect(() => {
    if (isFreshStart) return;

    if (routeState.bankConnected) {
      setBankConnectedState(true);
      if (routeState.institutionName) {
        setInstitutionName(routeState.institutionName);
      }
      if (routeState.message) {
        setStatusMessage(routeState.message);
      }
    }

    if (routeState.transactionsSynced) {
      setTransactionsSynced(true);
      if (routeState.syncCount != null) {
        setSyncCount(routeState.syncCount);
      }
    }
  }, [
    isFreshStart,
    routeState.bankConnected,
    routeState.transactionsSynced,
    routeState.institutionName,
    routeState.message,
    routeState.syncCount,
  ]);

  useEffect(() => {
    api
      .getPlaidStatus()
      .then((status) => {
        setPlaidConfigured(status.plaid_configured);
        if (isFreshStart) return;
        if (status.linked) {
          syncBankFromApi(status);
          setBankConnectedState(true);
          setInstitutionName(status.institution_name ?? status.bank_name);
        }
        if (status.linked && status.transaction_count > 0) {
          setTransactionsSynced(true);
          setSyncCount(status.transaction_count);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load status"));
  }, [isFreshStart]);

  const handleConnectAccount = () => {
    if (bankConnected) return;
    navigate("/onboarding/connect");
  };

  const handleSyncNow = async () => {
    if (!bankConnected || transactionsSynced) return;
    setLoadingStep(2);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await api.syncPlaidTransactions(ACCOUNT_ID, true);
      const total = result.added + result.modified;
      setSyncCount(total);
      setTransactionsSynced(true);
      const source = plaidConfigured ? "linked bank account" : "demo bank account";
      setStatusMessage(`Imported ${total} transactions from your ${source}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync transactions");
    } finally {
      setLoadingStep(null);
    }
  };

  const handleGoToDashboard = () => {
    if (!transactionsSynced) return;
    markSetupComplete();
    navigate("/dashboard", { replace: true, state: { setupComplete: true } });
  };

  const step1Done = bankConnected;
  const step2Done = transactionsSynced;
  const activeStep: StepId = !step1Done ? 1 : !step2Done ? 2 : 3;

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
      description: "Securely connect your business bank account",
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
      buttonLabel:
        loadingStep === 2
          ? "Syncing…"
          : step2Done
            ? `Synced${syncCount != null ? ` (${syncCount})` : ""}`
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
      <header className="onboarding-topbar onboarding-topbar--logo-only">
        <Link to="/" className="onboarding-brand">
          Flowcast
        </Link>
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
            ({ id, Icon, title, description, buttonLabel, primary, done, enabled, onClick }) => {
              const isActive = activeStep === id && !done;
              const isLocked = !done && !enabled;

              return (
                <li
                  key={id}
                  className={[
                    "onboarding-step-card card",
                    done ? "onboarding-step-card--done" : "",
                    isActive ? "onboarding-step-card--active" : "",
                    isLocked ? "onboarding-step-card--locked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
              );
            }
          )}
        </ol>
      </main>
    </div>
  );
}
