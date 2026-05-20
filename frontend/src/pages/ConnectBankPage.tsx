import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { api, ACCOUNT_ID } from "../api/client";

export function ConnectBankPage() {
  const navigate = useNavigate();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidConfigured, setPlaidConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPlaidStatus()
      .then((status) => {
        setPlaidConfigured(status.plaid_configured);
        if (status.linked && status.transaction_count > 0) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch((e) => setError(e.message));
  }, [navigate]);

  const fetchLinkToken = useCallback(() => {
    setError(null);
    return api
      .createPlaidLinkToken()
      .then((res) => setLinkToken(res.link_token))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (plaidConfigured) {
      fetchLinkToken();
    }
  }, [plaidConfigured, fetchLinkToken]);

  const onSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken) => {
      setConnecting(true);
      setError(null);
      try {
        const result = await api.exchangePlaidPublicToken(publicToken);
        const added = result.sync?.added ?? 0;
        setSyncSummary(
          `Imported ${added} transactions from your business bank account.`
        );
        setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to connect bank");
        setConnecting(false);
      }
    },
    [navigate]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) {
        setError(err.display_message ?? err.error_message ?? "Plaid Link closed");
      }
      setConnecting(false);
    },
  });

  const handleConnect = () => {
    if (ready) {
      setConnecting(true);
      open();
    }
  };

  const handleDemoData = async () => {
    setConnecting(true);
    setError(null);
    try {
      await api.mockLoad(ACCOUNT_ID);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load demo data");
      setConnecting(false);
    }
  };

  return (
    <div className="onboard-overlay">
      <div className="onboard-modal card" role="dialog" aria-labelledby="onboard-title">
        <Link to="/" className="onboard-close" aria-label="Back to home">
          ×
        </Link>

        <header className="onboard-header">
          <p className="onboard-eyebrow">Step 1 of 2</p>
          <h2 id="onboard-title">Connect your business bank</h2>
          <p>
            Securely import your bank statement transactions through Plaid so Flowcast
            can forecast cash flow from real activity.
          </p>
        </header>

        <ul className="onboard-steps">
          <li>
            <strong>Link your account</strong> — use Plaid&apos;s sandbox or your real
            business checking account.
          </li>
          <li>
            <strong>Sync transactions</strong> — we pull recent debits and credits into
            your Flowcast ledger.
          </li>
          <li>
            <strong>View your dashboard</strong> — forecasts, runway, and alerts update
            automatically.
          </li>
        </ul>

        {syncSummary && (
          <p className="onboard-success" role="status">
            {syncSummary}
          </p>
        )}

        {error && (
          <p className="onboard-error" role="alert">
            {error}
          </p>
        )}

        {plaidConfigured === false && (
          <div className="onboard-notice">
            <p>
              Plaid API keys are not set on the server. Add{" "}
              <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> to{" "}
              <code>backend/.env</code> (see <code>.env.example</code>), then restart
              the API.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDemoData}
              disabled={connecting}
            >
              Continue with demo data
            </button>
          </div>
        )}

        {plaidConfigured && (
          <div className="onboard-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={!ready || connecting || !!syncSummary}
            >
              {connecting
                ? "Connecting…"
                : ready
                  ? "Connect bank with Plaid"
                  : "Preparing Plaid…"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={fetchLinkToken}
              disabled={connecting}
            >
              Refresh link
            </button>
          </div>
        )}

        {plaidConfigured && (
          <p className="onboard-hint">
            Sandbox tip: choose <em>First Platypus Bank</em> and any test credentials
            Plaid shows in the Link modal.
          </p>
        )}

        <footer className="onboard-footer">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleDemoData}
            disabled={connecting}
          >
            Skip — use sample data
          </button>
        </footer>
      </div>
    </div>
  );
}
