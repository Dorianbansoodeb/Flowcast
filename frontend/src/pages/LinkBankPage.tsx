import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { usePlaidLinkFlow } from "../hooks/usePlaidLinkFlow";
import { setBankConnected } from "../lib/onboardingStorage";

const ACCOUNT_TYPES = [
  { id: "business_checking", label: "Business checking", hint: "Most common for payroll & expenses" },
  { id: "business_savings", label: "Business savings", hint: "Reserve cash & short-term savings" },
  { id: "credit_card", label: "Business credit card", hint: "Track card spend alongside cash" },
] as const;

const POPULAR_BANKS = [
  { id: "chase", name: "Chase" },
  { id: "bofa", name: "Bank of America" },
  { id: "wells", name: "Wells Fargo" },
  { id: "citi", name: "Citi" },
  { id: "capital_one", name: "Capital One" },
  { id: "usbank", name: "U.S. Bank" },
  { id: "pnc", name: "PNC" },
  { id: "other", name: "Other institution" },
] as const;

export function LinkBankPage() {
  const navigate = useNavigate();
  const [statusLoading, setStatusLoading] = useState(true);
  const [plaidConfigured, setPlaidConfigured] = useState(false);
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [linkedDisplay, setLinkedDisplay] = useState<string | null>(null);

  const [accountTypeId, setAccountTypeId] = useState<string>(ACCOUNT_TYPES[0].id);
  const [selectedBankId, setSelectedBankId] = useState<string>(POPULAR_BANKS[0].id);
  const [bankSearch, setBankSearch] = useState("");
  const [businessName, setBusinessName] = useState("Brightline Studio");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountTypeLabel =
    ACCOUNT_TYPES.find((t) => t.id === accountTypeId)?.label ?? accountTypeId;
  const selectedBankName =
    POPULAR_BANKS.find((b) => b.id === selectedBankId)?.name ??
    (bankSearch.trim() || "Your bank");

  const connectPayload = {
    account_type: accountTypeLabel,
    bank_name: selectedBankName,
  };

  const returnToOnboarding = useCallback(
    (institutionName: string, bankName: string) => {
      setBankConnected({
        accountType: accountTypeLabel,
        bankName,
        institutionName,
      });
      navigate("/onboarding", {
        replace: true,
        state: {
          bankConnected: true,
          institutionName,
          message: `Connected to ${institutionName}. Tap Sync Now to import transactions.`,
        },
      });
    },
    [navigate, accountTypeLabel]
  );

  const handlePlaidToken = useCallback(
    async (publicToken: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await api.exchangePlaidPublicToken(publicToken, connectPayload);
        returnToOnboarding(
          result.institution_name ?? selectedBankName,
          result.bank_name ?? selectedBankName
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to connect bank");
        setSubmitting(false);
      }
    },
    [connectPayload, returnToOnboarding, selectedBankName]
  );

  const { openPlaidLink, loadingToken, opening } = usePlaidLinkFlow({
    enabled: plaidConfigured,
    onSuccess: handlePlaidToken,
    onError: (msg) => {
      setError(msg);
      setSubmitting(false);
    },
    onClose: () => setSubmitting(false),
  });

  useEffect(() => {
    api
      .getPlaidStatus()
      .then((status) => {
        setPlaidConfigured(status.plaid_configured);
        if (status.linked) {
          setAlreadyLinked(true);
          setLinkedDisplay(status.institution_name ?? status.bank_name ?? "Bank account");
        }
      })
      .catch((e) => {
        setPlaidConfigured(false);
        setError(
          e instanceof Error
            ? e.message
            : "Could not reach API — demo mode is still available below."
        );
      })
      .finally(() => setStatusLoading(false));
  }, []);

  const handleDemoConnect = async () => {
    const name = businessName.trim();
    if (!name) {
      setError("Enter your business name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.connectDemoBank({
        ...connectPayload,
        business_name: name,
      });
      returnToOnboarding(
        result.institution_name ?? `${name} — ${selectedBankName}`,
        result.bank_name ?? selectedBankName
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect demo bank");
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    setError(null);
    if (plaidConfigured) {
      setSubmitting(true);
      await openPlaidLink();
      return;
    }
    await handleDemoConnect();
  };

  const filteredBanks = POPULAR_BANKS.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const busy = submitting || opening || loadingToken;

  if (alreadyLinked && !statusLoading) {
    return (
      <div className="onboarding-page link-bank-page">
        <header className="onboarding-topbar">
          <Link to="/onboarding" className="onboarding-back">
            ← Back to setup
          </Link>
          <span className="onboarding-badge">Link bank</span>
        </header>
        <main className="link-bank-main">
          <div className="link-bank-connected card">
            <h1>Bank already connected</h1>
            <p>
              <strong>{linkedDisplay}</strong> is linked to this workspace. Continue setup
              or sync transactions from the main onboarding screen.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                navigate("/onboarding", {
                  state: {
                    bankConnected: true,
                    institutionName: linkedDisplay ?? undefined,
                    message: "Bank connected. Tap Sync Now to import transactions.",
                  },
                })
              }
            >
              Back to setup
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="onboarding-page link-bank-page">
      <header className="onboarding-topbar">
        <Link to="/onboarding" className="onboarding-back">
          ← Back to setup
        </Link>
        <span className="onboarding-badge">Link bank · Step 1</span>
      </header>

      <main className="link-bank-main">
        <div className="onboarding-intro">
          <h1>Connect your business bank</h1>
          <p>
            Pick your account type and bank, then sign in securely through Plaid. Flowcast
            never stores your bank password.
          </p>
        </div>

        {statusLoading && (
          <p className="link-bank-status-loading" role="status">
            Checking connection status…
          </p>
        )}

        {error && (
          <p className="onboarding-error" role="alert">
            {error}
          </p>
        )}

        {!plaidConfigured && (
          <p className="onboarding-demo-hint">
            Running in <strong>demo mode</strong> (no Plaid keys). Add{" "}
            <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> to{" "}
            <code>backend/.env</code> for live bank linking.
          </p>
        )}

        <section className="link-bank-section card">
          <h2>1. Account type</h2>
          <p className="link-bank-section-desc">What kind of account are you connecting?</p>
          <div className="account-type-grid">
            {ACCOUNT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`account-type-option${accountTypeId === type.id ? " account-type-option--selected" : ""}`}
                onClick={() => setAccountTypeId(type.id)}
                disabled={busy}
              >
                <span className="account-type-label">{type.label}</span>
                <span className="account-type-hint">{type.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="link-bank-section card">
          <h2>2. Choose your bank</h2>
          <p className="link-bank-section-desc">
            Select your institution. {plaidConfigured && "Plaid will open next for sign-in."}
          </p>
          <input
            type="search"
            className="link-bank-search"
            placeholder="Search banks…"
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            disabled={busy}
            aria-label="Search banks"
          />
          <div className="bank-grid">
            {(bankSearch ? filteredBanks : POPULAR_BANKS).map((bank) => (
              <button
                key={bank.id}
                type="button"
                className={`bank-tile${selectedBankId === bank.id ? " bank-tile--selected" : ""}`}
                onClick={() => {
                  setSelectedBankId(bank.id);
                  setBankSearch("");
                }}
                disabled={busy}
              >
                <span className="bank-tile-icon" aria-hidden>
                  {bank.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="bank-tile-name">{bank.name}</span>
              </button>
            ))}
            {bankSearch && filteredBanks.length === 0 && (
              <p className="link-bank-empty-search">No matches — try &quot;Other institution&quot;</p>
            )}
          </div>
        </section>

        <section className="link-bank-section card">
          <h2>3. {plaidConfigured ? "Secure sign-in" : "Business details"}</h2>
          {plaidConfigured ? (
            <p className="link-bank-section-desc">
              Connecting <strong>{selectedBankName}</strong> ({accountTypeLabel}). Plaid will
              ask for your online banking username and password.
            </p>
          ) : (
            <>
              <p className="link-bank-section-desc">
                Demo connection for <strong>{selectedBankName}</strong> ({accountTypeLabel}).
              </p>
              <label className="link-bank-field">
                <span>Business name</span>
                <input
                  type="text"
                  placeholder="e.g. Brightline Studio"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={busy}
                />
              </label>
            </>
          )}
        </section>

        <div className="link-bank-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={handleContinue}
          >
            {busy
              ? opening
                ? "Opening Plaid…"
                : loadingToken
                  ? "Preparing…"
                  : "Connecting…"
              : plaidConfigured
                ? "Continue to Plaid sign-in"
                : "Connect demo bank"}
          </button>
          <p className="link-bank-secure-note">
            Bank-level encryption · read-only access · powered by Plaid
          </p>
        </div>
      </main>
    </div>
  );
}
