import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ConnectedSource = {
  type: "youtube" | "image" | "file";
  url?: string;
  name?: string;
  src?: string;
  fileType?: string;
  textSnippet?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MULTIMODAL_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct";
const allowedModels = [
  "allam-2-7b-instruct",
  "deepseek-r1-distill-llama-70b",
  "gemma2-9b-it",
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "mistral-saba-24b",
  "qwen-qwq-32b",
];

function extractConnectedSources(messages: ChatMessage[]): {
  cleanedMessages: ChatMessage[];
  sources: ConnectedSource[];
} {
  const sources: ConnectedSource[] = [];

  const cleanedMessages = messages.map((msg) => {
    if (msg.role !== "user" || typeof msg.content !== "string") return msg;

    const match = msg.content.match(/\[CONNECTED_SOURCES_JSON\]([\s\S]*?)\[\/CONNECTED_SOURCES_JSON\]/);
    if (!match) return msg;

    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          const type = String(item.type || "");
          if (type === "youtube" || type === "image" || type === "file") {
            sources.push(item as ConnectedSource);
          }
        }
      }
    } catch {
      // ignore invalid context block
    }

    return {
      ...msg,
      content: msg.content.replace(/\n?\[CONNECTED_SOURCES_JSON\][\s\S]*?\[\/CONNECTED_SOURCES_JSON\]\n?/g, "").trim(),
    };
  });

  return { cleanedMessages, sources };
}

async function fetchYouTubeMetadata(url: string): Promise<string> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return `Vídeo conectado: ${url}`;
    const data = await res.json();
    const title = data?.title ? `Título: ${data.title}` : "";
    const author = data?.author_name ? `Canal: ${data.author_name}` : "";
    return [title, author].filter(Boolean).join(" | ") || `Vídeo conectado: ${url}`;
  } catch {
    return `Vídeo conectado: ${url}`;
  }
}

async function buildConnectedContext(sources: ConnectedSource[]): Promise<{
  contextText: string;
  imageDataUrls: string[];
}> {
  if (sources.length === 0) return { contextText: "", imageDataUrls: [] };

  const contextLines: string[] = [];
  const imageDataUrls: string[] = [];

  for (const source of sources) {
    if (source.type === "youtube" && source.url) {
      const videoInfo = await fetchYouTubeMetadata(source.url);
      contextLines.push(`[YOUTUBE] ${videoInfo} | URL: ${source.url}`);
    }

    if (source.type === "file") {
      const name = source.name || "arquivo";
      const fileType = source.fileType || "desconhecido";
      if (source.textSnippet) {
        contextLines.push(
          `[ARQUIVO] ${name} (${fileType})\nConteúdo extraído:\n${source.textSnippet.slice(0, 3000)}`
        );
      } else {
        contextLines.push(`[ARQUIVO] ${name} (${fileType}) conectado.`);
      }
    }

    if (source.type === "image" && source.src?.startsWith("data:image/")) {
      imageDataUrls.push(source.src);
      contextLines.push(`[IMAGEM] ${source.name || "imagem"} conectada.`);
    }
  }

  const contextText = contextLines.length
    ? `\n\n[CONTEXTO CONECTADO]\n${contextLines.join("\n\n")}\n[/CONTEXTO CONECTADO]`
    : "";

  return { contextText, imageDataUrls };
}

async function callGroq({
  apiKey,
  model,
  messages,
}: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | unknown[] }>;
}) {
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const incomingMessages = Array.isArray(messages) ? (messages as ChatMessage[]) : [];
    const { cleanedMessages, sources } = extractConnectedSources(incomingMessages);
    const { contextText, imageDataUrls } = await buildConnectedContext(sources);

    let selectedModel = allowedModels.includes(model) ? model : DEFAULT_MODEL;
    if (imageDataUrls.length > 0) {
      selectedModel = MULTIMODAL_MODEL;
    }

    const payloadMessages: Array<{ role: "system" | "user" | "assistant"; content: string | unknown[] }> = [
      {
        role: "system",
        content:
          "Você é um assistente inteligente integrado a um canvas criativo. Responda em português de forma objetiva. Sempre use os conteúdos conectados (vídeo, imagem e arquivo) quando estiverem disponíveis.",
      },
      ...cleanedMessages,
    ];

    if (contextText) {
      const lastUserIndex = [...payloadMessages]
        .map((m, i) => ({ i, role: m.role }))
        .reverse()
        .find((m) => m.role === "user")?.i;

      if (typeof lastUserIndex === "number") {
        const current = payloadMessages[lastUserIndex];
        const baseText = typeof current.content === "string" ? current.content : "";

        if (imageDataUrls.length > 0) {
          payloadMessages[lastUserIndex] = {
            role: "user",
            content: [
              { type: "text", text: `${contextText}\n\n${baseText}` },
              ...imageDataUrls.slice(0, 2).map((url) => ({
                type: "image_url",
                image_url: { url },
              })),
            ],
          };
        } else {
          payloadMessages[lastUserIndex] = {
            role: "user",
            content: `${contextText}\n\n${baseText}`.trim(),
          };
        }
      }
    }

    let response = await callGroq({
      apiKey: GROQ_API_KEY,
      model: selectedModel,
      messages: payloadMessages,
    });

    if (!response.ok && response.status === 400) {
      const bodyText = await response.text();
      const lower = bodyText.toLowerCase();

      if ((lower.includes("decommissioned") || lower.includes("not supported")) && selectedModel !== DEFAULT_MODEL) {
        response = await callGroq({
          apiKey: GROQ_API_KEY,
          model: DEFAULT_MODEL,
          messages: payloadMessages,
        });
      } else {
        console.error("Groq API error:", response.status, bodyText);
        return new Response(JSON.stringify({ error: bodyText || "Erro no serviço de IA" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Groq API error:", response.status, t);
      return new Response(JSON.stringify({ error: t || "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("canvas-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
