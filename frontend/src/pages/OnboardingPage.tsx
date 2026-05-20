import { Link } from "react-router-dom";

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

const STEPS = [
  {
    step: 1,
    Icon: BankIcon,
    title: "Link Your Bank Account",
    description: "Securely connect your business bank account",
    buttonLabel: "Connect Account",
    primary: true,
  },
  {
    step: 2,
    Icon: SyncIcon,
    title: "Sync Transactions",
    description: "We'll import your last 24 months of transactions",
    buttonLabel: "Sync Now",
    primary: false,
  },
  {
    step: 3,
    Icon: DashboardIcon,
    title: "View Your Dashboard",
    description: "See your 90-day cash flow forecast",
    buttonLabel: "Go to Dashboard",
    primary: true,
  },
] as const;

export function OnboardingPage() {
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

        <ol className="onboarding-steps">
          {STEPS.map(({ step, Icon, title, description, buttonLabel, primary }) => (
            <li key={step} className="onboarding-step-card card">
              <div className="onboarding-step-meta">
                <span className="onboarding-step-num">Step {step}</span>
                <div className="onboarding-step-icon">
                  <Icon />
                </div>
              </div>
              <div className="onboarding-step-body">
                <h2>{title}</h2>
                <p>{description}</p>
                <span
                  className={
                    primary
                      ? "btn btn-primary btn-inactive"
                      : "btn btn-inactive"
                  }
                  aria-disabled="true"
                >
                  {buttonLabel}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <p className="onboarding-footnote">
          Steps will activate once your workspace is ready.
        </p>
      </main>
    </div>
  );
}
