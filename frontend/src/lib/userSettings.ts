const SETUP_KEY = "flowcast_setup_complete";
const THRESHOLD_KEY = "flowcast_alert_threshold";
const DIGEST_EMAIL_KEY = "flowcast_digest_email";
const DIGEST_ENABLED_KEY = "flowcast_digest_enabled";
const SAVINGS_KEY = "flowcast_savings_applied";
const DEFAULT_THRESHOLD = 5000;

export function isSetupComplete(): boolean {
  return localStorage.getItem(SETUP_KEY) === "true";
}

export function markSetupComplete(opts?: { viaDemo?: boolean }): void {
  localStorage.setItem(SETUP_KEY, "true");
  if (opts?.viaDemo) {
    localStorage.setItem("flowcast_demo_mode", "true");
  }
}

export function clearSetupComplete(): void {
  localStorage.removeItem(SETUP_KEY);
  localStorage.removeItem("flowcast_demo_mode");
}

export function isDemoMode(): boolean {
  return localStorage.getItem("flowcast_demo_mode") === "true";
}

export function getAlertThreshold(): number {
  const raw = localStorage.getItem(THRESHOLD_KEY);
  if (!raw) return DEFAULT_THRESHOLD;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

export function setAlertThreshold(value: number): void {
  localStorage.setItem(THRESHOLD_KEY, String(value));
}

export function getDigestEmail(): string {
  return localStorage.getItem(DIGEST_EMAIL_KEY) ?? "";
}

export function setDigestEmail(email: string): void {
  localStorage.setItem(DIGEST_EMAIL_KEY, email);
}

export function isDigestEnabled(): boolean {
  return localStorage.getItem(DIGEST_ENABLED_KEY) === "true";
}

export function setDigestEnabled(enabled: boolean): void {
  localStorage.setItem(DIGEST_ENABLED_KEY, enabled ? "true" : "false");
}

export interface AppliedSaving {
  id: string;
  label: string;
  amount: number;
  appliedAt: string;
}

export function getAppliedSavings(): AppliedSaving[] {
  const raw = localStorage.getItem(SAVINGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppliedSaving[];
  } catch {
    return [];
  }
}

export function applySaving(item: AppliedSaving): void {
  const existing = getAppliedSavings();
  if (existing.some((s) => s.id === item.id)) return;
  localStorage.setItem(SAVINGS_KEY, JSON.stringify([...existing, item]));
}

export function totalAppliedSavingsThisMonth(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return getAppliedSavings()
    .filter((s) => {
      const d = new Date(s.appliedAt);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, s) => sum + s.amount, 0);
}
