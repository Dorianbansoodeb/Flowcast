import { useEffect, useState } from "react";
import { api, Transaction } from "../api/client";
import { Loading } from "../components/Loading";
import { EmptyState } from "../components/EmptyState";

export function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMock, setLoadingMock] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const load = () => {
    setLoading(true);
    api
      .getTransactions()
      .then(setTxs)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const mockLoad = () => {
    setLoadingMock(true);
    api
      .mockLoad()
      .then(load)
      .finally(() => setLoadingMock(false));
  };

  const filtered = txs.filter((t) => {
    if (filter === "income") return t.is_income;
    if (filter === "expense") return !t.is_income;
    return true;
  });

  if (loading) return <Loading message="Loading transactions…" />;

  return (
    <>
      <header className="page-header">
        <h1>Transactions</h1>
        <p>
          Transaction history from your linked business bank (Plaid) or sandbox mock data.
        </p>
      </header>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          className={`btn ${filter === "all" ? "btn-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({txs.length})
        </button>
        <button
          className={`btn ${filter === "income" ? "btn-primary" : ""}`}
          onClick={() => setFilter("income")}
        >
          Income
        </button>
        <button
          className={`btn ${filter === "expense" ? "btn-primary" : ""}`}
          onClick={() => setFilter("expense")}
        >
          Expenses
        </button>
        <button className="btn" onClick={mockLoad} disabled={loadingMock}>
          {loadingMock ? "Loading…" : "Reload mock data"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No transactions"
          description="Load sample data for a micro-business demo."
          action={
            <button className="btn btn-primary" onClick={mockLoad}>
              Load mock transactions
            </button>
          }
        />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.merchant_name}</td>
                  <td>{t.category}</td>
                  <td
                    className={
                      t.is_income ? "amount-income" : "amount-expense"
                    }
                  >
                    {t.is_income ? "+" : ""}${Math.abs(t.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Showing first 100 of {filtered.length} transactions.
            </p>
          )}
        </div>
      )}
    </>
  );
}
