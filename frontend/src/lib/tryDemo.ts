import { api } from "../api/client";
import { setBankConnected } from "./onboardingStorage";
import { markSetupComplete } from "./userSettings";

export async function tryDemo(): Promise<void> {
  await api.quickStartDemo();
  setBankConnected({
    accountType: "Business checking",
    bankName: "RBC Royal Bank",
    institutionName: "Brightline Studio — RBC Royal Bank",
    isDemo: true,
  });
  markSetupComplete({ viaDemo: true });
}
