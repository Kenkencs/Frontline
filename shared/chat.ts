// The UI and POST /api/chat share this contract. Incoming JSON still needs runtime validation.
export type ProviderId = "openai" | "anthropic" | "deepseek" | "kimi";
export type EmployeeRole = "waiter" | "cashier" | "kitchen_staff";
export type RiskLevel = "low" | "medium" | "high";

export interface ChatRequest {
  message: string;
  employee_role: EmployeeRole;
  provider: ProviderId;
  model: string;
}

export interface Source {
  id: string;
  title: string;
  version: string;
  section: string;
  excerpt: string;
  // Omitted on legacy fixtures. Only an explicit false denotes company evidence.
  sample?: boolean;
}

export interface ActionResponse {
  type: "action";
  risk: RiskLevel;
  summary: string;
  actions: string[];
  sources: Source[];
  confidence: "low" | "medium" | "high";
  escalate: boolean;
}

export type ChatResponse =
  | ActionResponse
  | {
      type: "message";
      content: string;
      sources: Source[];
    };
