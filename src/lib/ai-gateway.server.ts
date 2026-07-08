import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const AIG_RUN_ID_HEADER = "X-AIG-Run-ID";

export const customFetchWithRetry: typeof fetch = async (input, init) => {
  let attempts = 0;
  const maxAttempts = 2;
  let delay = 300;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(input, init);
      if (response.status === 429) {
        return response;
      }
      return response;
    } catch (err) {
      if (attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`[AI Gateway] Fetch error: ${err}. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }
      throw err;
    }
  }
  return fetch(input, init);
};

export function getActiveAiKeyAndType(): { key: string; type: "gemini" | "openai" | "gateway" } | null {
  const gatewayKey = process.env.GATEWAY_API_KEY;
  if (gatewayKey) {
    return { key: gatewayKey, type: "gateway" };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && (geminiKey.startsWith("AIzaSy") || geminiKey.startsWith("AQ."))) {
    return { key: geminiKey, type: "gemini" };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && (openAiKey.startsWith("sk-proj-") || openAiKey.startsWith("sk-"))) {
    return { key: openAiKey, type: "openai" };
  }

  // Fallback if none are fully valid but some exist:
  const fallbackKey = process.env.GATEWAY_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (fallbackKey) {
    const isGemini = fallbackKey.startsWith("AIzaSy") || fallbackKey.startsWith("AQ.");
    const isOpenAi = fallbackKey.startsWith("sk-proj-") || fallbackKey.startsWith("sk-");
    return {
      key: fallbackKey,
      type: isGemini ? "gemini" : isOpenAi ? "openai" : "gateway",
    };
  }

  return null;
}

export function createAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) runId = nextRunId;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(AIG_RUN_ID_HEADER)) {
        headers.set(AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    }) as typeof fetch,
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

export function createAiGatewayProvider(apiKey: string, initialRunId?: string) {
  const isGemini = apiKey.startsWith("AIzaSy") || apiKey.startsWith("AQ.");
  const isOpenAi = apiKey.startsWith("sk-proj-") || apiKey.startsWith("sk-");

  if (isGemini) {
    const provider = createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      fetch: customFetchWithRetry,
    });
    const wrappedProvider = (modelId: string, settings?: any) => {
      let mapped = modelId;
      if (modelId.startsWith("google/")) {
        mapped = modelId.replace("google/", "");
      }
      if (mapped.includes("gemini-3")) {
        mapped = "gemini-2.5-flash";
      }
      return provider(mapped, settings);
    };
    return Object.assign(wrappedProvider, {
      getRunId: () => undefined,
      waitForRunId: () => Promise.resolve(undefined),
    });
  }

  if (isOpenAi) {
    const provider = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      fetch: customFetchWithRetry,
    });
    const wrappedProvider = (modelId: string, settings?: any) => {
      let mapped = "gpt-4o-mini";
      if (modelId.includes("pro") || modelId.includes("2.5")) {
        mapped = "gpt-4o";
      }
      return provider(mapped, settings);
    };
    return Object.assign(wrappedProvider, {
      getRunId: () => undefined,
      waitForRunId: () => Promise.resolve(undefined),
    });
  }

  // Fallback to primary AI Gateway
  const runIdFetch = createAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAICompatible({
    name: "gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Gateway-API-Key": apiKey,
      "X-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
    waitForRunId: runIdFetch.waitForRunId,
  });
}

/**
 * Helper to intercept direct HTTP completions/TTS/transcription fetch calls
 * and route them to direct Google Gemini or OpenAI endpoints if those keys are provided.
 */
export async function aiGatewayFetch(path: string, options: RequestInit): Promise<Response> {
  const active = getActiveAiKeyAndType();
  if (!active) {
    return new Response("No API key configured", { status: 500 });
  }

  const { key, type } = active;
  const isGemini = type === "gemini";
  const isOpenAi = type === "openai";

  let url = `https://ai.gateway.lovable.dev${path}`;
  const customOptions = { ...options };
  const headers = new Headers(customOptions.headers);

  if (isGemini) {
    if (path.includes("/chat/completions")) {
      url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      headers.set("Authorization", `Bearer ${key}`);
      headers.set("Content-Type", "application/json");

      // Map model in body
      if (typeof customOptions.body === "string") {
        try {
          const body = JSON.parse(customOptions.body);
          if (body.model && body.model.startsWith("google/")) {
            body.model = body.model.replace("google/", "");
          }
          if (body.model && body.model.includes("gemini-3")) {
            body.model = "gemini-2.5-flash";
          }
          customOptions.body = JSON.stringify(body);
        } catch {
          // ignore parsing error
        }
      }
    } else {
      // Audio speech or transcription is not natively supported on Gemini's OpenAI compatibility endpoint.
      return new Response("Gemini key does not support TTS or transcription endpoints natively.", { status: 501 });
    }
  } else if (isOpenAi) {
    if (path.includes("/chat/completions")) {
      url = "https://api.openai.com/v1/chat/completions";
      headers.set("Authorization", `Bearer ${key}`);
      headers.set("Content-Type", "application/json");

      if (typeof customOptions.body === "string") {
        try {
          const body = JSON.parse(customOptions.body);
          body.model = "gpt-4o-mini";
          customOptions.body = JSON.stringify(body);
        } catch {
          // ignore
        }
      }
    } else if (path.includes("/audio/speech")) {
      url = "https://api.openai.com/v1/audio/speech";
      headers.set("Authorization", `Bearer ${key}`);
      headers.set("Content-Type", "application/json");

      if (typeof customOptions.body === "string") {
        try {
          const body = JSON.parse(customOptions.body);
          body.model = "tts-1";
          customOptions.body = JSON.stringify(body);
        } catch {
          // ignore
        }
      }
    } else if (path.includes("/audio/transcriptions")) {
      url = "https://api.openai.com/v1/audio/transcriptions";
      headers.set("Authorization", `Bearer ${key}`);
      // Note: for Formdata, do NOT manually set Content-Type header so the browser
      // sets the correct boundary string.
    }
  } else {
    // Default setup
    headers.set("Gateway-API-Key", key);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${key}`);
    }
  }

  customOptions.headers = headers;
  return customFetchWithRetry(url, customOptions);
}
