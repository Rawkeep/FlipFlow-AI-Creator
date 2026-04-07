import { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

export const CLOUD_PROVIDERS = {
  anthropic: {
    id: "anthropic",
    label: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com",
    chatPath: "/v1/messages",
    browserDirect: false,
    defaultModels: [
      "claude-sonnet-4-20250514",
      "claude-haiku-4-20250414",
      "claude-opus-4-20250514",
    ],
    pricing: "Sonnet: $3/$15 | Haiku: $0.80/$4 per 1M tokens",

    authHeader(key) {
      return {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json",
      };
    },

    formatBody(messages, model, options = {}) {
      const systemMsg = messages.find((m) => m.role === "system");
      const filtered = messages.filter((m) => m.role !== "system");
      return {
        model,
        max_tokens: options.maxTokens || 4096,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: filtered.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        ...(options.stream ? { stream: true } : {}),
      };
    },

    extractResponse(data) {
      return data.content[0].text;
    },

    extractStreamChunk(json) {
      if (json.type === "content_block_delta") {
        return json.delta.text || "";
      }
      return "";
    },

    isStreamDone(json) {
      return json.type === "message_stop";
    },
  },

  openai: {
    id: "openai",
    label: "OpenAI (GPT)",
    baseUrl: "https://api.openai.com",
    chatPath: "/v1/chat/completions",
    browserDirect: true,
    defaultModels: ["gpt-4o", "gpt-4o-mini", "o4-mini", "o3"],
    pricing: "GPT-4o: $2.50/$10 | 4o-mini: $0.15/$0.60 per 1M tokens",

    authHeader(key) {
      return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
    },

    formatBody(messages, model, options = {}) {
      return {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.stream ? { stream: true } : {}),
      };
    },

    extractResponse(data) {
      return data.choices[0].message.content;
    },

    extractStreamChunk(json) {
      const delta = json.choices?.[0]?.delta?.content;
      return delta || "";
    },

    isStreamDone(json) {
      return json.choices?.[0]?.finish_reason != null;
    },
  },

  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    chatPath: "/v1beta/chat/completions",
    browserDirect: true,
    defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    pricing: "Flash: $0.15/$0.60 | Pro: $1.25/$10 per 1M tokens",

    authHeader(key) {
      return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
    },

    formatBody(messages, model, options = {}) {
      return {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.stream ? { stream: true } : {}),
      };
    },

    extractResponse(data) {
      return data.choices[0].message.content;
    },

    extractStreamChunk(json) {
      return json.choices?.[0]?.delta?.content || "";
    },

    isStreamDone(json) {
      return json.choices?.[0]?.finish_reason != null;
    },
  },

  mistral: {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai",
    chatPath: "/v1/chat/completions",
    browserDirect: true,
    defaultModels: [
      "mistral-large-latest",
      "mistral-small-latest",
      "codestral-latest",
    ],
    pricing: "Large: $2/$6 | Small: $0.10/$0.30 per 1M tokens",

    authHeader(key) {
      return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
    },

    formatBody(messages, model, options = {}) {
      return {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.stream ? { stream: true } : {}),
      };
    },

    extractResponse(data) {
      return data.choices[0].message.content;
    },

    extractStreamChunk(json) {
      return json.choices?.[0]?.delta?.content || "";
    },

    isStreamDone(json) {
      return json.choices?.[0]?.finish_reason != null;
    },
  },

  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api",
    chatPath: "/v1/chat/completions",
    browserDirect: true,
    defaultModels: [
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-r1",
    ],
    pricing: "Pay-per-use",

    authHeader(key) {
      return {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": globalThis.location?.origin || "https://localhost",
        "X-Title": "Raiders Arbitrage",
        "Content-Type": "application/json",
      };
    },

    formatBody(messages, model, options = {}) {
      return {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.stream ? { stream: true } : {}),
      };
    },

    extractResponse(data) {
      return data.choices[0].message.content;
    },

    extractStreamChunk(json) {
      return json.choices?.[0]?.delta?.content || "";
    },

    isStreamDone(json) {
      return json.choices?.[0]?.finish_reason != null;
    },
  },

  groq: {
    id: "groq",
    label: "Groq (Ultra-Fast)",
    baseUrl: "https://api.groq.com/openai",
    chatPath: "/v1/chat/completions",
    browserDirect: true,
    defaultModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
    pricing: "Kostenlos (Rate Limits)",

    authHeader(key) {
      return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
    },

    formatBody(messages, model, options = {}) {
      return {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.stream ? { stream: true } : {}),
      };
    },

    extractResponse(data) {
      return data.choices[0].message.content;
    },

    extractStreamChunk(json) {
      return json.choices?.[0]?.delta?.content || "";
    },

    isStreamDone(json) {
      return json.choices?.[0]?.finish_reason != null;
    },
  },
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const KEYS_STORAGE = "universal_ai_keys";
const CONFIG_STORAGE = "universal_ai_config";
const USAGE_STORAGE = "universal_ai_usage";
const FREE_DAILY_LIMIT = 5;

function loadKeys() {
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORAGE) || "{}");
  } catch {
    return {};
  }
}

function saveKeys(keys) {
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_STORAGE) || "{}");
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_STORAGE, JSON.stringify(cfg));
}

function getDailyUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_STORAGE) || "{}");
    const today = new Date().toISOString().slice(0, 10);
    if (raw.date !== today) return { date: today, count: 0 };
    return raw;
  } catch {
    return { date: new Date().toISOString().slice(0, 10), count: 0 };
  }
}

function incrementUsage() {
  const usage = getDailyUsage();
  usage.count += 1;
  localStorage.setItem(USAGE_STORAGE, JSON.stringify(usage));
  return usage;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUniversalAI() {
  const [keys, setKeysState] = useState(loadKeys);
  const [config, setConfigState] = useState(() => ({
    provider: "openai",
    model: "",
    proxyUrl: "",
    ...loadConfig(),
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef(null);

  // ---- Key management ------------------------------------------------------

  const setKey = useCallback((providerId, key) => {
    setKeysState((prev) => {
      const next = { ...prev, [providerId]: key };
      saveKeys(next);
      return next;
    });
  }, []);

  const removeKey = useCallback((providerId) => {
    setKeysState((prev) => {
      const next = { ...prev };
      delete next[providerId];
      saveKeys(next);
      return next;
    });
  }, []);

  const hasKey = useCallback(
    (providerId) => {
      return Boolean(keys[providerId]);
    },
    [keys]
  );

  // ---- Config management ----------------------------------------------------

  const setProvider = useCallback((providerId) => {
    setConfigState((prev) => {
      const next = { ...prev, provider: providerId, model: "" };
      saveConfig(next);
      return next;
    });
  }, []);

  const setModel = useCallback((model) => {
    setConfigState((prev) => {
      const next = { ...prev, model };
      saveConfig(next);
      return next;
    });
  }, []);

  const setProxyUrl = useCallback((url) => {
    setConfigState((prev) => {
      const next = { ...prev, proxyUrl: url };
      saveConfig(next);
      return next;
    });
  }, []);

  // ---- Helpers --------------------------------------------------------------

  const getProvider = useCallback(
    (id) => {
      return CLOUD_PROVIDERS[id || config.provider];
    },
    [config.provider]
  );

  const getActiveModel = useCallback(() => {
    const p = getProvider();
    return config.model || (p ? p.defaultModels[0] : "");
  }, [config.model, getProvider]);

  const buildUrl = useCallback(
    (provider) => {
      if (config.proxyUrl) return config.proxyUrl;
      return provider.baseUrl + provider.chatPath;
    },
    [config.proxyUrl]
  );

  // ---- Freemium check -------------------------------------------------------

  const checkFreemium = useCallback(
    (providerId) => {
      const key = keys[providerId || config.provider];
      if (key) return true; // BYOK = unlimited
      const usage = getDailyUsage();
      if (usage.count >= FREE_DAILY_LIMIT) {
        throw new Error(
          `Tageslimit erreicht (${FREE_DAILY_LIMIT}/Tag). Bitte hinterlege einen API-Key fuer unbegrenzte Nutzung.`
        );
      }
      return true;
    },
    [keys, config.provider]
  );

  // ---- Detect available models -----------------------------------------------

  const detectModels = useCallback(
    (providerId) => {
      const p = getProvider(providerId);
      if (!p) return [];
      return p.defaultModels;
    },
    [getProvider]
  );

  // ---- Abort ----------------------------------------------------------------

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // ---- ask (non-streaming with retry) ----------------------------------------

  const ask = useCallback(
    async (messages, options = {}) => {
      const providerId = options.provider || config.provider;
      const provider = getProvider(providerId);
      if (!provider) {
        throw new Error(`Unbekannter Anbieter: ${providerId}`);
      }

      const key = keys[providerId];
      if (!key && !config.proxyUrl) {
        checkFreemium(providerId);
      }

      const model = options.model || getActiveModel();
      const maxRetries = options.retries || 2;
      const url = buildUrl(provider);
      const headers = key ? provider.authHeader(key) : { "Content-Type": "application/json" };
      const body = provider.formatBody(messages, model, {
        maxTokens: options.maxTokens,
        stream: false,
      });

      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          setLoading(true);
          setError(null);

          const controller = new AbortController();
          abortRef.current = controller;

          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            throw new Error(
              `API-Fehler ${res.status}: ${errBody || res.statusText}`
            );
          }

          const data = await res.json();
          const text = provider.extractResponse(data);

          if (!key && !config.proxyUrl) incrementUsage();

          setLoading(false);
          return { text, raw: data, provider: providerId, model };
        } catch (err) {
          lastError = err;
          if (err.name === "AbortError") {
            setLoading(false);
            throw new Error("Anfrage abgebrochen.");
          }
          if (attempt < maxRetries) {
            await new Promise((r) =>
              setTimeout(r, 1000 * Math.pow(2, attempt))
            );
          }
        }
      }

      setLoading(false);
      const msg =
        lastError?.message || "Unbekannter Fehler bei der API-Anfrage.";
      setError(msg);
      throw new Error(msg);
    },
    [keys, config, getProvider, getActiveModel, buildUrl, checkFreemium]
  );

  // ---- askStream (SSE streaming) --------------------------------------------

  const askStream = useCallback(
    async (messages, options = {}) => {
      const providerId = options.provider || config.provider;
      const provider = getProvider(providerId);
      if (!provider) {
        throw new Error(`Unbekannter Anbieter: ${providerId}`);
      }

      const key = keys[providerId];
      if (!key && !config.proxyUrl) {
        checkFreemium(providerId);
      }

      const model = options.model || getActiveModel();
      const url = buildUrl(provider);
      const headers = key ? provider.authHeader(key) : { "Content-Type": "application/json" };
      const body = provider.formatBody(messages, model, {
        maxTokens: options.maxTokens,
        stream: true,
      });

      setLoading(true);
      setError(null);
      setStreamText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(
            `Stream-Fehler ${res.status}: ${errBody || res.statusText}`
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload);
              if (provider.isStreamDone(json)) continue;

              const chunk = provider.extractStreamChunk(json);
              if (chunk) {
                accumulated += chunk;
                setStreamText(accumulated);
                if (options.onChunk) options.onChunk(chunk, accumulated);
              }
            } catch {
              // Unvollstaendiges JSON-Fragment, ignorieren
            }
          }
        }

        if (!key && !config.proxyUrl) incrementUsage();
        setLoading(false);

        return {
          text: accumulated,
          provider: providerId,
          model,
        };
      } catch (err) {
        setLoading(false);
        if (err.name === "AbortError") {
          throw new Error("Stream abgebrochen.");
        }
        const msg = err.message || "Stream-Fehler.";
        setError(msg);
        throw new Error(msg);
      }
    },
    [keys, config, getProvider, getActiveModel, buildUrl, checkFreemium]
  );

  // ---- Return ---------------------------------------------------------------

  return {
    // State
    loading,
    error,
    streamText,

    // Provider / model
    provider: config.provider,
    model: getActiveModel(),
    providers: CLOUD_PROVIDERS,
    setProvider,
    setModel,
    detectModels,
    getProvider,

    // Keys
    keys,
    setKey,
    removeKey,
    hasKey,

    // Config
    proxyUrl: config.proxyUrl,
    setProxyUrl,

    // Actions
    ask,
    askStream,
    abort,

    // Freemium
    dailyUsage: getDailyUsage(),
    dailyLimit: FREE_DAILY_LIMIT,
  };
}
