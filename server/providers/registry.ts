import type { ProviderId } from "../../shared/chat";
import { ProviderError, type AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";

export interface ProviderConfig {
  apiKeys?: Partial<Record<ProviderId, string | undefined>>;
  fetchImpl?: typeof fetch;
}

// Add one explicit case per implemented adapter. Demos bypass this factory entirely.
export function createProvider(
  provider: ProviderId,
  config: ProviderConfig,
): AIProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(config.apiKeys?.openai, config.fetchImpl);
    default:
      throw new ProviderError(
        501,
        "This live provider is not implemented yet. Choose a supported model.",
      );
  }
}
