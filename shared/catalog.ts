import type { EmployeeRole, ProviderId } from "./chat";

// The backend validates this allowlist. Demo IDs never call a paid provider.
export const models: {
  provider: ProviderId;
  model: string;
  label: string;
  company: string;
  mode: "demo" | "live";
}[] = [
  {
    provider: "openai",
    model: "demo-gpt",
    label: "GPT",
    company: "OpenAI",
    mode: "demo",
  },
  {
    provider: "anthropic",
    model: "demo-claude",
    label: "Claude",
    company: "Anthropic",
    mode: "demo",
  },
  {
    provider: "deepseek",
    model: "demo-deepseek",
    label: "DeepSeek",
    company: "DeepSeek",
    mode: "demo",
  },
  {
    provider: "kimi",
    model: "demo-kimi",
    label: "Kimi",
    company: "Moonshot AI",
    mode: "demo",
  },
  {
    provider: "openai",
    model: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    company: "OpenAI",
    mode: "live",
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    company: "Anthropic",
    mode: "live",
  },
  {
    provider: "deepseek",
    model: "deepseek-flash",
    label: "DeepSeek Flash",
    company: "DeepSeek",
    mode: "live",
  },
  {
    provider: "kimi",
    model: "kimi-k2.6",
    label: "Kimi K2.6",
    company: "Moonshot AI",
    mode: "live",
  },
];

export const roles: { id: EmployeeRole; label: string }[] = [
  { id: "waiter", label: "Waiter" },
  { id: "cashier", label: "Cashier" },
  { id: "kitchen_staff", label: "Kitchen Staff" },
];
