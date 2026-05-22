const BANK_KEY = "flowcast_bank_connected";
const BANK_META_KEY = "flowcast_bank_meta";

export interface BankConnectionMeta {
  accountType: string;
  bankName: string;
  institutionName?: string | null;
  isDemo?: boolean;
}

export function getBankConnected(): boolean {
  return sessionStorage.getItem(BANK_KEY) === "true";
}

export function setBankConnected(meta: BankConnectionMeta): void {
  sessionStorage.setItem(BANK_KEY, "true");
  sessionStorage.setItem(BANK_META_KEY, JSON.stringify(meta));
}

export function getBankMeta(): BankConnectionMeta | null {
  const raw = sessionStorage.getItem(BANK_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BankConnectionMeta;
  } catch {
    return null;
  }
}

export function syncBankFromApi(status: {
  linked: boolean;
  institution_name?: string | null;
  account_type?: string | null;
  bank_name?: string | null;
  is_demo?: boolean;
}): void {
  if (!status.linked) return;
  setBankConnected({
    accountType: status.account_type ?? "Business account",
    bankName: status.bank_name ?? status.institution_name ?? "Bank",
    institutionName: status.institution_name,
    isDemo: status.is_demo,
  });
}

export function clearBankConnection(): void {
  sessionStorage.removeItem(BANK_KEY);
  sessionStorage.removeItem(BANK_META_KEY);
}
