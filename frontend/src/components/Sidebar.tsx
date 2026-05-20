import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: "◫" },
  { to: "/forecast", label: "Cash Flow Forecast", icon: "◎" },
  { to: "/api-costs", label: "API Cost Optimizer", icon: "⚡" },
  { to: "/transactions", label: "Transactions", icon: "⇄" },
  { to: "/alerts", label: "Alerts & Insights", icon: "◉" },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <NavLink to="/">
          <span className="brand-mark">F</span>
          <span className="brand-name">Flowcast</span>
        </NavLink>
      </div>
      <nav className="sidebar-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <span className="link-icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <p className="sidebar-user">Alex Morgan</p>
        <p className="sidebar-meta">Brightline Studio</p>
      </div>
    </aside>
  );
}
