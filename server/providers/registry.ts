import type { ProviderId } from "../../shared/chat";
import { ProviderError, type AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { AnthropicProvider } from "./AnthropicProvider";
import { DeepSeekProvider } from "./DeepSeekProvider";
import { KimiProvider } from "./KimiProvider";

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
    case "anthropic":
      return new AnthropicProvider(config.apiKeys?.anthropic, config.fetchImpl);
    case "deepseek":
      return new DeepSeekProvider(config.apiKeys?.deepseek, config.fetchImpl);
    case "kimi":
      return new KimiProvider(config.apiKeys?.kimi, config.fetchImpl);
    default:
      throw new ProviderError(
        501,
        "This provider is not supported. Choose a supported model.",
      );
  }
}
