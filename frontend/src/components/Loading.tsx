export function Loading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="loading-state card">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  );
}
