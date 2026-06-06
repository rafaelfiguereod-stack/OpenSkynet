import type { ToolCall, LLMResponse, ToolDefinition, ProviderInfo, ModelInfo } from "../core/types";
import { LLMError, AuthError, RateLimitError } from "../core/errors";
import { getKey, hasKey } from "../core/auth";
import logger from "../core/logging";
import { loadProviders, loadProviderCategories } from "./provider-loader";
import type { ProviderPreset } from "./provider-loader";
import OpenAI from "openai";

export type Message = Record<string, any>;

export { type ProviderPreset } from "./provider-loader";

let _providers: Record<string, ProviderPreset> | null = null;
let _categories: Record<string, string> | null = null;

export function getProviders(): Record<string, ProviderPreset> {
  if (!_providers) _providers = loadProviders();
  return _providers;
}
export function getProviderCategories(): Record<string, string> {
  if (!_categories) _categories = loadProviderCategories();
  return _categories;
}

export const PROVIDERS: Record<string, ProviderPreset> = new Proxy({} as Record<string, ProviderPreset>, {
  get(_, key) { return getProviders()[key as string]; },
  has(_, key) { return key in getProviders(); },
  ownKeys() { return Object.keys(getProviders()); },
  getOwnPropertyDescriptor(_, key) { return { enumerable: true, configurable: true, value: getProviders()[key as string] }; },
});
export const PROVIDER_CATEGORIES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, key) { return getProviderCategories()[key as string]; },
});


const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export abstract class LLMProvider {
  protected _tokenCallback: ((tokens: number) => void) | null = null;

  setTokenCallback(cb: (tokens: number) => void): void {
    this._tokenCallback = cb;
  }

  abstract chat(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
  ): Promise<LLMResponse>;

  abstract chatStream(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
  ): AsyncGenerator<string>;

  abstract chatStreamWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
    onToken?: (t: string) => void,
  ): Promise<LLMResponse>;

  abstract chatWithFailover(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
    fallback?: LLMProvider,
  ): Promise<LLMResponse>;
}

function toOpenAITools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] | undefined {
  if (!tools.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));
}

function parseToolCalls(raw: OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined): ToolCall[] {
  if (!raw) return [];
  return raw.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}");
    } catch {}
    return { id: tc.id, name: tc.function.name, arguments: args };
  });
}

function parseResponse(choice: OpenAI.Chat.ChatCompletion.Choice): LLMResponse {
  const msg = choice.message;
  return {
    text: msg.content ?? null,
    tool_calls: parseToolCalls(msg.tool_calls),
    done: choice.finish_reason === "stop",
  };
}

function isRetryable(err: any): boolean {
  if (err instanceof RateLimitError) return true;
  if (err?.status === 429 || (err?.status ?? 0) >= 500) return true;
  const name = err?.constructor?.name ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  if (name.includes("ConnectionError") || name.includes("TimeoutError")) return true;
  if (msg.includes("connection") || msg.includes("timeout")) return true;
  return false;
}

export class OpenAICompatibleProvider extends LLMProvider {
  protected client: OpenAI;
  protected model: string;

  constructor(model: string, apiKey?: string, baseUrl?: string) {
    super();
    this.model = model;
    this.client = new OpenAI({
      apiKey: apiKey ?? "unused",
      baseURL: baseUrl ?? undefined,
    });
  }

  protected async _chatWithRetry(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<OpenAI.Chat.ChatCompletion> {
    let lastErr: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const params: OpenAI.Chat.ChatCompletionCreateParams = {
          model: this.model,
          messages,
          tools,
        };
        return await this.client.chat.completions.create(params);
      } catch (err: any) {
        lastErr = err;
        if (!isRetryable(err)) break;
        if (err?.status === 401 || err?.status === 403) {
          throw new AuthError(err?.message ?? "Authentication failed");
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn({ attempt, delay, err: err?.message }, "llm_retry");
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (lastErr?.status === 429) throw new RateLimitError(lastErr?.message ?? "Rate limited");
    throw new LLMError(lastErr?.message ?? "LLM request failed");
  }

  protected buildMessages(
    messages: Message[],
    system?: string,
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) {
      out.push({ role: "system", content: system });
    }
    for (const m of messages) {
      out.push(m as OpenAI.Chat.ChatCompletionMessageParam);
    }
    return out;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
  ): Promise<LLMResponse> {
    const openaiMsgs = this.buildMessages(messages, system);
    const openaiTools = toOpenAITools(tools);
    const resp = await this._chatWithRetry(openaiMsgs, openaiTools);
    const choice = resp.choices?.[0];
    if (!choice) throw new LLMError("No choices returned");

    if (resp.usage && this._tokenCallback) {
      this._tokenCallback(resp.usage.total_tokens);
    }

    return parseResponse(choice);
  }

  async *chatStream(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
  ): AsyncGenerator<string> {
    const openaiMsgs = this.buildMessages(messages, system);
    const openaiTools = toOpenAITools(tools);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMsgs,
      tools: openaiTools,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async chatStreamWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
    onToken?: (t: string) => void,
  ): Promise<LLMResponse> {
    const openaiMsgs = this.buildMessages(messages, system);
    const openaiTools = toOpenAITools(tools);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMsgs,
      tools: openaiTools,
      stream: true,
    });

    let text = "";
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta?.content) {
        text += delta.content;
        onToken?.(delta.content);
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              arguments: "",
            });
          }
          const entry = toolCallMap.get(idx)!;
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    const toolCalls: ToolCall[] = [];
    for (const [, tc] of toolCallMap) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.arguments || "{}");
      } catch {}
      toolCalls.push({ id: tc.id, name: tc.name, arguments: args });
    }

    return {
      text: text || null,
      tool_calls: toolCalls,
      done: finishReason === "stop",
    };
  }

  async chatWithFailover(
    messages: Message[],
    tools: ToolDefinition[],
    system?: string,
    fallback?: LLMProvider,
  ): Promise<LLMResponse> {
    try {
      return await this.chat(messages, tools, system);
    } catch (err) {
      if (!fallback) throw err;
      logger.warn({ err: (err as Error).message }, "llm_failover_triggered");
      return await fallback.chat(messages, tools, system);
    }
  }
}

export function createProvider(
  provider: string,
  model?: string,
  baseUrl?: string,
  apiKey?: string,
): OpenAICompatibleProvider {
  const preset = PROVIDERS[provider];
  if (!preset) throw new LLMError(`Unknown provider: ${provider}`);

  const resolvedModel = model ?? preset.model;
  const resolvedBaseUrl = baseUrl ?? preset.base_url;

  return new OpenAICompatibleProvider(resolvedModel, apiKey, resolvedBaseUrl);
}

export function listProviders(): ProviderInfo[] {
  const result: ProviderInfo[] = [];
  for (const [name, preset] of Object.entries(PROVIDERS)) {
    result.push({
      name,
      default_model: preset.model,
      default_base_url: preset.base_url,
      category: preset.category,
      needs_api_key: !!preset.api_key_env,
      has_key: false,
      auto_detect: preset.auto_detect,
    });
  }
  return result;
}

export async function listProvidersWithAuth(): Promise<ProviderInfo[]> {
  const providers = listProviders();
  for (const p of providers) {
    if (p.needs_api_key) {
      p.has_key = await hasKey(p.name);
    }
  }
  return providers;
}
