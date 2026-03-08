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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const match = msg.content.match(
      /\[CONNECTED_SOURCES_JSON\]([\s\S]*?)\[\/CONNECTED_SOURCES_JSON\]/
    );
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
      // ignore
    }

    return {
      ...msg,
      content: msg.content
        .replace(
          /\n?\[CONNECTED_SOURCES_JSON\][\s\S]*?\[\/CONNECTED_SOURCES_JSON\]\n?/g,
          ""
        )
        .trim(),
    };
  });

  return { cleanedMessages, sources };
}

// Normalize YouTube URL to standard watch format
function normalizeYouTubeUrl(url: string): string {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

async function fetchYouTubeMetadata(url: string): Promise<{ title: string; author: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return { title: "", author: "" };
    const data = await res.json();
    return {
      title: data?.title || "",
      author: data?.author_name || "",
    };
  } catch {
    return { title: "", author: "" };
  }
}

// Build rich context for connected sources (used when routing to Gemini)
async function buildSourceContextForGemini(
  sources: ConnectedSource[]
): Promise<Array<{ type: string; text?: string; image_url?: { url: string } }>> {
  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  for (const source of sources) {
    if (source.type === "youtube" && source.url) {
      const normalizedUrl = normalizeYouTubeUrl(source.url);
      const meta = await fetchYouTubeMetadata(normalizedUrl);
      parts.push({
        type: "text",
        text: `[VÍDEO YOUTUBE CONECTADO]\nURL: ${normalizedUrl}\nTítulo: ${meta.title || "N/A"}\nCanal: ${meta.author || "N/A"}\nINSTRUÇÃO: Acesse e analise este vídeo do YouTube em detalhes. Transcreva o conteúdo falado, identifique temas, pontos-chave e qualquer informação visual relevante. Use o conteúdo real do vídeo para responder perguntas do usuário.\n[/VÍDEO YOUTUBE]`,
      });
    }

    if (source.type === "image") {
      const imageName = source.name || "imagem";
      if (source.src?.startsWith("data:image/")) {
        parts.push({
          type: "text",
          text: `[IMAGEM CONECTADA: "${imageName}"]\nAnalise esta imagem em detalhes. Extraia todo texto visível e descreva elementos visuais.`,
        });
        parts.push({
          type: "image_url",
          image_url: { url: source.src },
        });
      } else {
        parts.push({
          type: "text",
          text: `[IMAGEM "${imageName}" conectada, sem dados visuais disponíveis.]`,
        });
      }
    }

    if (source.type === "file") {
      const name = source.name || "arquivo";
      const fileType = source.fileType || "desconhecido";
      if (source.textSnippet) {
        parts.push({
          type: "text",
          text: `[ARQUIVO CONECTADO]\nNome: ${name} (${fileType})\nConteúdo:\n${source.textSnippet.slice(0, 8000)}\n[/ARQUIVO]`,
        });
      } else {
        parts.push({
          type: "text",
          text: `[ARQUIVO "${name}" (${fileType}) conectado, sem conteúdo textual extraído.]`,
        });
      }
    }
  }

  return parts;
}

// Build text-only context for Groq (fallback, no multimodal)
async function buildTextContextForGroq(
  sources: ConnectedSource[]
): Promise<string> {
  if (sources.length === 0) return "";

  const parts: string[] = [];

  for (const source of sources) {
    if (source.type === "youtube" && source.url) {
      const normalizedUrl = normalizeYouTubeUrl(source.url);
      const meta = await fetchYouTubeMetadata(normalizedUrl);
      parts.push(
        `[YOUTUBE] URL: ${normalizedUrl} | Título: ${meta.title || "N/A"} | Canal: ${meta.author || "N/A"}`
      );
    }
    if (source.type === "image") {
      parts.push(`[IMAGEM] ${source.name || "imagem"} conectada.`);
    }
    if (source.type === "file") {
      const name = source.name || "arquivo";
      if (source.textSnippet) {
        parts.push(`[ARQUIVO: ${name}]\n${source.textSnippet.slice(0, 6000)}\n[/ARQUIVO]`);
      } else {
        parts.push(`[ARQUIVO] ${name} conectado.`);
      }
    }
  }

  return parts.length
    ? `\n\n[FONTES CONECTADAS]\n${parts.join("\n\n")}\n[/FONTES CONECTADAS]`
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

async function callGemini({
  apiKey,
  messages,
}: {
  apiKey: string;
  messages: Array<{ role: string; content: string | Array<any> }>;
}) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      stream: true,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model } = await req.json();

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!GROQ_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No AI API key is configured");
    }

    const incomingMessages = Array.isArray(messages)
      ? (messages as ChatMessage[])
      : [];
    const { cleanedMessages, sources } =
      extractConnectedSources(incomingMessages);

    const hasYouTube = sources.some((s) => s.type === "youtube");
    const hasImage = sources.some((s) => s.type === "image" && s.src?.startsWith("data:image/"));
    const hasMultimodalSources = hasYouTube || hasImage;

    // Route to Gemini when we have YouTube or image sources (multimodal capabilities)
    if (hasMultimodalSources && LOVABLE_API_KEY) {
      const systemPrompt = `Você é um assistente inteligente integrado a um canvas criativo. Responda em português de forma objetiva e detalhada.

IMPORTANTE: Você tem acesso COMPLETO ao conteúdo das fontes conectadas. Quando um vídeo do YouTube estiver conectado:
- Acesse o vídeo pela URL fornecida
- Transcreva o conteúdo falado
- Analise temas, pontos-chave, informações visuais
- Use o conteúdo REAL do vídeo para responder perguntas

Quando imagens estiverem conectadas:
- Analise todos os elementos visuais
- Extraia todo texto visível
- Descreva contexto, layout, cores, significado

Sempre baseie suas respostas no conteúdo real das fontes.`;

      const sourceParts = await buildSourceContextForGemini(sources);

      // Build messages for Gemini with multimodal content
      const geminiMessages: Array<{ role: string; content: string | Array<any> }> = [
        { role: "system", content: systemPrompt },
      ];

      // Add previous messages as text
      for (const msg of cleanedMessages.slice(0, -1)) {
        geminiMessages.push({ role: msg.role, content: msg.content });
      }

      // Last user message with source context embedded as multimodal parts
      const lastUserMsg = cleanedMessages[cleanedMessages.length - 1];
      if (lastUserMsg) {
        const contentParts: Array<any> = [
          ...sourceParts,
          { type: "text", text: lastUserMsg.content },
        ];
        geminiMessages.push({ role: "user", content: contentParts });
      }

      const response = await callGemini({
        apiKey: LOVABLE_API_KEY,
        messages: geminiMessages,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini error:", response.status, errorText);

        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fallback to Groq if Gemini fails
        if (GROQ_API_KEY) {
          console.log("Falling back to Groq...");
          // Continue to Groq path below
        } else {
          return new Response(
            JSON.stringify({ error: errorText || "Erro no serviço de IA" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(response.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // Groq path (no multimodal sources or Gemini unavailable)
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const selectedModel = allowedModels.includes(String(model))
      ? String(model)
      : DEFAULT_MODEL;

    const contextText = await buildTextContextForGroq(sources);

    const systemPrompt = sources.length > 0
      ? `Você é um assistente inteligente integrado a um canvas criativo. Responda em português de forma objetiva e detalhada.
Você tem fontes conectadas com metadados. Use as informações disponíveis para responder.`
      : "Você é um assistente inteligente integrado a um canvas criativo. Responda em português de forma objetiva.";

    const payloadMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }, ...cleanedMessages];

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
        return new Response(
          JSON.stringify({ error: bodyText || "Erro no serviço de IA" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("Groq API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: t || "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("canvas-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
