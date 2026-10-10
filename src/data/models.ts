import type { EmployeeRole, ProviderId } from "../../shared/chat";

// Demo IDs are fixtures, not live provider model IDs. Stage 5 moves this catalog to the backend.
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
