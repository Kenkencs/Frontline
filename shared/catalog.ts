import type { EmployeeRole, ProviderId } from "./chat";

// Demo IDs are fixtures, not real provider model IDs. The backend validates this allowlist.
export const models: {
  provider: ProviderId;
  model: string;
  label: string;
  company: string;
}[] = [
  { provider: "openai", model: "demo-gpt", label: "GPT", company: "OpenAI" },
  {
    provider: "anthropic",
    model: "demo-claude",
    label: "Claude",
    company: "Anthropic",
  },
  {
    provider: "deepseek",
    model: "demo-deepseek",
    label: "DeepSeek",
    company: "DeepSeek",
  },
  {
    provider: "kimi",
    model: "demo-kimi",
    label: "Kimi",
    company: "Moonshot AI",
  },
];

export const roles: { id: EmployeeRole; label: string }[] = [
  { id: "waiter", label: "Waiter" },
  { id: "cashier", label: "Cashier" },
  { id: "kitchen_staff", label: "Kitchen Staff" },
];
