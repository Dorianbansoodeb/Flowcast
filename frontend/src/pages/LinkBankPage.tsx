import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { CANADIAN_BANKS, type BankOption } from "../data/canadianBanks";
import { usePlaidLinkFlow } from "../hooks/usePlaidLinkFlow";
import { setBankConnected } from "../lib/onboardingStorage";

const ACCOUNT_TYPES = [
  { id: "business_checking", label: "Business checking", hint: "Most common for payroll & expenses" },
  { id: "business_savings", label: "Business savings", hint: "Reserve cash & short-term savings" },
  { id: "credit_card", label: "Business credit card", hint: "Track card spend alongside cash" },
] as const;

export function LinkBankPage() {
  const navigate = useNavigate();
  const [statusLoading, setStatusLoading] = useState(true);
  const [plaidConfigured, setPlaidConfigured] = useState(false);
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [linkedDisplay, setLinkedDisplay] = useState<string | null>(null);
  const [isDemoLinked, setIsDemoLinked] = useState(false);

  const [accountTypeId, setAccountTypeId] = useState<string>(ACCOUNT_TYPES[0].id);
  const [banks, setBanks] = useState<BankOption[]>([...CANADIAN_BANKS]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksTotal, setBanksTotal] = useState<number>(CANADIAN_BANKS.length);
  const [banksSource, setBanksSource] = useState<"demo" | "plaid">("demo");
  const [selectedBankId, setSelectedBankId] = useState<string>(CANADIAN_BANKS[0].id);
  const [bankSearch, setBankSearch] = useState("");
  const [businessName, setBusinessName] = useState("Brightline Studio");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountTypeLabel =
    ACCOUNT_TYPES.find((t) => t.id === accountTypeId)?.label ?? accountTypeId;

  const selectedBankName = useMemo(() => {
    const match = banks.find((b) => b.id === selectedBankId);
    if (match) return match.name;
    if (bankSearch.trim()) return bankSearch.trim();
    return "Your bank";
  }, [banks, selectedBankId, bankSearch]);

  const connectPayload = {
    account_type: accountTypeLabel,
    bank_name: selectedBankName,
  };

  const returnToOnboarding = useCallback(
    (institutionName: string, bankName: string, isDemo: boolean) => {
      setBankConnected({
        accountType: accountTypeLabel,
        bankName,
        institutionName,
        isDemo,
      });
      navigate("/onboarding", {
        replace: true,
        state: {
          bankConnected: true,
          institutionName,
          message: isDemo
            ? `Demo connection saved for ${institutionName}. Tap Sync Now to load sample transactions.`
            : `Connected to ${institutionName}. Tap Sync Now to import transactions from your bank.`,
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
          result.bank_name ?? selectedBankName,
          false
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

  const loadBanks = useCallback(
    async (query: string, usePlaid: boolean) => {
      if (!usePlaid) {
        const q = query.trim().toLowerCase();
        const filtered = q
          ? CANADIAN_BANKS.filter((b) => b.name.toLowerCase().includes(q))
          : [...CANADIAN_BANKS];
        setBanks(filtered);
        setBanksTotal(filtered.length);
        setBanksSource("demo");
        if (filtered.length > 0 && !filtered.some((b) => b.id === selectedBankId)) {
          setSelectedBankId(filtered[0].id);
        }
        return;
      }

      setBanksLoading(true);
      try {
        const result = await api.getPlaidInstitutions(query, 0, 100);
        const list = result.institutions.map((b) => ({ id: b.id, name: b.name }));
        setBanks(list.length > 0 ? list : [...CANADIAN_BANKS]);
        setBanksTotal(result.total);
        setBanksSource("plaid");
        if (list.length > 0 && !list.some((b) => b.id === selectedBankId)) {
          setSelectedBankId(list[0].id);
        }
      } catch {
        const q = query.trim().toLowerCase();
        setBanks(
          q
            ? CANADIAN_BANKS.filter((b) => b.name.toLowerCase().includes(q))
            : [...CANADIAN_BANKS]
        );
        setBanksSource("demo");
      } finally {
        setBanksLoading(false);
      }
    },
    [selectedBankId]
  );

  useEffect(() => {
    api
      .getPlaidStatus()
      .then((status) => {
        setPlaidConfigured(status.plaid_configured);
        if (status.linked) {
          setAlreadyLinked(true);
          setIsDemoLinked(status.is_demo);
          setLinkedDisplay(status.institution_name ?? status.bank_name ?? "Bank account");
        }
        if (status.plaid_configured) {
          loadBanks("", true);
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
  }, [loadBanks]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBanks(bankSearch, plaidConfigured);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bankSearch, plaidConfigured, loadBanks]);

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
        result.bank_name ?? selectedBankName,
        true
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

  const busy = submitting || opening || loadingToken || banksLoading;

  if (alreadyLinked && !statusLoading) {
    return (
      <div className="onboarding-page link-bank-page">
        <header className="onboarding-topbar onboarding-topbar--logo-only">
          <Link to="/onboarding" className="onboarding-brand">
            Flowcast
          </Link>
        </header>
        <main className="link-bank-main">
          <p className="onboarding-back-inline">
            <Link to="/onboarding">← Back to setup</Link>
          </p>
          <div className="link-bank-connected card">
            <h1>Bank already connected</h1>
            <p>
              <strong>{linkedDisplay}</strong>{" "}
              {isDemoLinked
                ? "(demo — not a real bank login)"
                : "(linked via Plaid)"}{" "}
              is connected. Continue setup from the onboarding screen.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                navigate("/onboarding", {
                  state: {
                    bankConnected: true,
                    institutionName: linkedDisplay ?? undefined,
                    message: isDemoLinked
                      ? "Demo bank connected. Tap Sync Now to load sample transactions."
                      : "Bank connected. Tap Sync Now to import transactions from your bank.",
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
      <header className="onboarding-topbar onboarding-topbar--logo-only">
        <Link to="/onboarding" className="onboarding-brand">
          Flowcast
        </Link>
      </header>

      <main className="link-bank-main">
        <p className="onboarding-back-inline">
          <Link to="/onboarding">← Back to setup</Link>
        </p>
        <div className="onboarding-intro">
          <h1>Connect your Canadian business bank</h1>
          <p>
            Choose your institution from Canadian banks and credit unions. With Plaid
            enabled, sign in securely — Flowcast never stores your bank password.
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
            <strong>Demo mode:</strong> no real bank is connected. You pick a Canadian
            bank for show — sync loads <em>sample</em> transactions only. Add{" "}
            <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> to{" "}
            <code>backend/.env</code> for a real Plaid connection.
          </p>
        )}

        {plaidConfigured && (
          <p className="onboarding-demo-hint onboarding-demo-hint--live">
            <strong>Live mode:</strong> Plaid will open with Canadian institutions. Search
            below loads banks from Plaid ({banksTotal} available
            {banksSource === "plaid" ? "" : ", showing demo list fallback"}).
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
          <h2>2. Choose your Canadian bank</h2>
          <p className="link-bank-section-desc">
            Search RBC, TD, Scotiabank, BMO, CIBC, and more.
            {plaidConfigured && " Plaid Link shows the full directory at sign-in."}
          </p>
          <input
            type="search"
            className="link-bank-search"
            placeholder="Search Canadian banks…"
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            disabled={busy}
            aria-label="Search Canadian banks"
          />
          {banksLoading && (
            <p className="link-bank-status-loading">Loading institutions…</p>
          )}
          <div className="bank-grid">
            {banks.map((bank) => (
              <button
                key={bank.id}
                type="button"
                className={`bank-tile${selectedBankId === bank.id ? " bank-tile--selected" : ""}`}
                onClick={() => {
                  setSelectedBankId(bank.id);
                }}
                disabled={busy}
              >
                <span className="bank-tile-icon" aria-hidden>
                  {bank.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="bank-tile-name">{bank.name}</span>
              </button>
            ))}
            {!banksLoading && banks.length === 0 && (
              <p className="link-bank-empty-search">
                No matches — try another name or use Plaid search at sign-in.
              </p>
            )}
          </div>
        </section>

        <section className="link-bank-section card">
          <h2>3. {plaidConfigured ? "Secure sign-in" : "Business details (demo)"}</h2>
          {plaidConfigured ? (
            <p className="link-bank-section-desc">
              Connecting <strong>{selectedBankName}</strong> ({accountTypeLabel}). Plaid
              opens with all supported Canadian institutions — enter your online banking
              credentials there.
            </p>
          ) : (
            <>
              <p className="link-bank-section-desc">
                Demo only: simulates linking <strong>{selectedBankName}</strong> (
                {accountTypeLabel}). No credentials are sent anywhere.
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
