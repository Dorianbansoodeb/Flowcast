/** Canadian institutions for demo mode (no Plaid keys). */
export const CANADIAN_BANKS = [
  { id: "rbc", name: "RBC Royal Bank" },
  { id: "td", name: "TD Canada Trust" },
  { id: "scotiabank", name: "Scotiabank" },
  { id: "bmo", name: "BMO Bank of Montreal" },
  { id: "cibc", name: "CIBC" },
  { id: "national", name: "National Bank of Canada" },
  { id: "desjardins", name: "Desjardins" },
  { id: "tangerine", name: "Tangerine" },
  { id: "simplii", name: "Simplii Financial" },
  { id: "atb", name: "ATB Financial" },
  { id: "vancity", name: "Vancity" },
  { id: "coast_capital", name: "Coast Capital Savings" },
  { id: "laurentian", name: "Laurentian Bank" },
  { id: "eq_bank", name: "EQ Bank" },
  { id: "motus", name: "Motus Bank" },
  { id: "wealthsimple", name: "Wealthsimple" },
  { id: "pc_financial", name: "PC Financial" },
  { id: "hsbc_ca", name: "HSBC Bank Canada" },
  { id: "other_ca", name: "Other Canadian institution" },
] as const;

export type BankOption = { id: string; name: string };
