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
const allowedModels = [
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

async function describeImageWithLovable(imageDataUrl: string, lovableApiKey?: string): Promise<string> {
  if (!lovableApiKey) {
    return "Imagem conectada (análise visual indisponível no momento).";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "Você descreve imagens de forma curta e objetiva em português, destacando contexto útil para responder perguntas do usuário.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Descreva esta imagem em até 4 frases." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Image analysis error:", response.status, text);
      return "Imagem conectada, mas não foi possível analisar visualmente agora.";
    }

    const data = await response.json();
    const description = data?.choices?.[0]?.message?.content;
    return typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : "Imagem conectada, sem descrição visual disponível.";
  } catch (error) {
    console.error("describeImageWithLovable error:", error);
    return "Imagem conectada, mas ocorreu erro ao analisar.";
  }
}

async function buildConnectedContext(
  sources: ConnectedSource[],
  lovableApiKey?: string,
): Promise<string> {
  if (sources.length === 0) return "";

  const contextLines: string[] = [];

  for (const source of sources) {
    if (source.type === "youtube" && source.url) {
      const videoInfo = await fetchYouTubeMetadata(source.url);
      contextLines.push(`[YOUTUBE] ${videoInfo} | URL: ${source.url}`);
      continue;
    }

    if (source.type === "file") {
      const name = source.name || "arquivo";
      const fileType = source.fileType || "desconhecido";
      if (source.textSnippet) {
        contextLines.push(
          `[ARQUIVO] ${name} (${fileType})\nConteúdo extraído:\n${source.textSnippet.slice(0, 3000)}`,
        );
      } else {
        contextLines.push(`[ARQUIVO] ${name} (${fileType}) conectado.`);
      }
      continue;
    }

    if (source.type === "image") {
      const imageName = source.name || "imagem";
      if (source.src?.startsWith("data:image/")) {
        const description = await describeImageWithLovable(source.src, lovableApiKey);
        contextLines.push(`[IMAGEM] ${imageName}\nDescrição visual:\n${description}`);
      } else {
        contextLines.push(`[IMAGEM] ${imageName} conectada.`);
      }
    }
  }

  return contextLines.length
    ? `\n\n[CONTEXTO CONECTADO]\n${contextLines.join("\n\n")}\n[/CONTEXTO CONECTADO]`
    : "";
}

async function callGroq({
  apiKey,
  model,
  messages,
}: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || undefined;

    const incomingMessages = Array.isArray(messages) ? (messages as ChatMessage[]) : [];
    const { cleanedMessages, sources } = extractConnectedSources(incomingMessages);
    const contextText = await buildConnectedContext(sources, LOVABLE_API_KEY);

    const selectedModel = allowedModels.includes(String(model)) ? String(model) : DEFAULT_MODEL;

    const payloadMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
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
        payloadMessages[lastUserIndex] = {
          role: "user",
          content: `${contextText}\n\n${current.content}`.trim(),
        };
      }
    }

    let response = await callGroq({
      apiKey: GROQ_API_KEY,
      model: selectedModel,
      messages: payloadMessages,
    });

    if (!response.ok && (response.status === 400 || response.status === 404)) {
      const bodyText = await response.text();
      const lower = bodyText.toLowerCase();

      if (
        (lower.includes("decommissioned") ||
          lower.includes("not supported") ||
          lower.includes("model_not_found") ||
          lower.includes("does not exist")) &&
        selectedModel !== DEFAULT_MODEL
      ) {
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
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
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
