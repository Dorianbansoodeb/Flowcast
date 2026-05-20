import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state card">
      <h3 style={{ margin: "0 0 0.5rem", color: "var(--text)" }}>{title}</h3>
      <p style={{ margin: "0 0 1.25rem" }}>{description}</p>
      {action}
    </div>
  );
}
