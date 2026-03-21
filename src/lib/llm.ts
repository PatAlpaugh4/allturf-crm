// ============================================================================
// Allturf CRM — LLM Abstraction Layer (Phase 5.2)
// Currently: Groq only. Designed for future provider additions.
// ============================================================================

import Groq from "groq-sdk";

// ---------------------------------------------------------------------------
// Provider interface — any future LLM provider must implement this
// ---------------------------------------------------------------------------
export interface LLMProvider {
  chat(params: {
    system: string;
    user: string;
    temperature?: number;
    json?: boolean;
  }): Promise<string>;
}

// ---------------------------------------------------------------------------
// Groq Provider — wraps groq-sdk with llama-3.3-70b-versatile
// ---------------------------------------------------------------------------
class GroqProvider implements LLMProvider {
  private client: Groq;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY environment variable");
    }
    this.client = new Groq({ apiKey });
    this.model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }

  async chat(params: {
    system: string;
    user: string;
    temperature?: number;
    json?: boolean;
  }): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: params.temperature ?? 0.3,
      max_tokens: 4096,
      ...(params.json
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from Groq");
    }
    return content;
  }
}

// Future: add ClaudeProvider here
// class ClaudeProvider implements LLMProvider { ... }

// ---------------------------------------------------------------------------
// Factory — returns the configured provider
// ---------------------------------------------------------------------------
let cachedProvider: LLMProvider | null = null;

export type LLMProviderName = "groq";
// Future: export type LLMProviderName = "groq" | "claude";

export function getLLM(provider?: LLMProviderName): LLMProvider {
  const selected =
    provider || (process.env.DEFAULT_LLM_PROVIDER as LLMProviderName) || "groq";

  // Cache the provider instance for the process lifetime
  if (cachedProvider) return cachedProvider;

  switch (selected) {
    case "groq":
      cachedProvider = new GroqProvider();
      break;
    // Future: case "claude": cachedProvider = new ClaudeProvider(); break;
    default:
      throw new Error(`Unknown LLM provider: ${selected}`);
  }

  return cachedProvider;
}

// ---------------------------------------------------------------------------
// Test helper — validates the provider returns a well-formed response
// Usage: npx tsx src/lib/llm.ts
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const llm = getLLM("groq");
    console.log("Testing Groq provider...");

    const response = await llm.chat({
      system:
        "You are a turf management assistant. Respond in JSON with keys: diagnosis, confidence, recommendation.",
      user: "I see small, straw-colored circular patches about 2-5 inches across on my bentgrass green. It is late June with high humidity.",
      temperature: 0.1,
      json: true,
    });

    console.log("Raw response:", response);
    const parsed = JSON.parse(response);
    console.log("Parsed shape:", Object.keys(parsed));
    console.log("Test passed — provider returned valid JSON.");
  })().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
