import { useState, useRef, useEffect, useCallback } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  RecordProps,
  useEditor,
} from "tldraw";
import ReactMarkdown from "react-markdown";
import { TargetDot } from "./YouTubeShape";
import { useConnections } from "./ConnectionContext";

export type ChatShape = TLBaseShape<
  "canvas-chat",
  {
    w: number;
    h: number;
    messages: string;
    memory: string;
  }
>;

type ChatMessage = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/canvas-chat`;

const AI_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", emoji: "🦙" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", emoji: "⚡" },
  { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B", emoji: "🧠" },
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick", emoji: "🚀" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", emoji: "🔍" },
  { id: "qwen-qwq-32b", label: "Qwen QWQ 32B", emoji: "🔮" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B", emoji: "💎" },
  { id: "mistral-saba-24b", label: "Mistral Saba 24B", emoji: "🌊" },
];

// Helper to get YouTube URL from shape
function getYouTubeUrl(url: string): string {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

function ChatComponent({ shape }: { shape: ChatShape }) {
  const editor = useEditor();
  const { getConnectionsForChat, completeLinking, linkingFrom } = useConnections();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(shape.props.messages || "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [memory, setMemory] = useState(shape.props.memory || "");
  const [showMemory, setShowMemory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist messages to shape props (debounced)
  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        editor.updateShape({ id: shape.id, type: shape.type, props: { messages: JSON.stringify(msgs) } });
      } catch { /* shape may have been deleted */ }
    }, 500);
  }, [editor, shape.id, shape.type]);

  // Persist memory to shape props (debounced)
  const persistMemory = useCallback((mem: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        editor.updateShape({ id: shape.id, type: shape.type, props: { memory: mem } });
      } catch { /* shape may have been deleted */ }
    }, 500);
  }, [editor, shape.id, shape.type]);

  // Override setMessages to also persist
  const updateMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistMessages(next);
      return next;
    });
  }, [persistMessages]);

  // Override setMemory to also persist
  const updateMemory = useCallback((val: string) => {
    setMemory(val);
    persistMemory(val);
  }, [persistMemory]);

  const connections = getConnectionsForChat(shape.id);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];

  // Build context from connected shapes
  const buildContext = useCallback((): string => {
    if (connections.length === 0) return "";

    const shapeDataMap = (window as any).__canvasShapeData || {};
    const sources = connections
      .map((conn) => {
        const data = shapeDataMap[conn.sourceId];
        if (!data) return null;

        if (data.type === "youtube" && data.url) {
          return { type: "youtube", url: getYouTubeUrl(data.url) };
        }

        if (data.type === "canvas-image" && data.src) {
          return {
            type: "image",
            name: data.name || "imagem",
            src: data.src,
          };
        }

        if (data.type === "canvas-file") {
          return {
            type: "file",
            name: data.name || "arquivo",
            fileType: data.fileType || "",
            textSnippet: data.textSnippet || "",
          };
        }

        return null;
      })
      .filter(Boolean);

    if (sources.length === 0) return "";
    return `\n\n[CONNECTED_SOURCES_JSON]\n${JSON.stringify(sources)}\n[/CONNECTED_SOURCES_JSON]`;
  }, [connections]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const context = buildContext();
    const userContent = input.trim();
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    updateMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const memoryMsg: ChatMessage[] = memory.trim()
      ? [{ role: "user" as const, content: `[MEMÓRIA DO SISTEMA - INSTRUÇÕES PERMANENTES]\n${memory.trim()}\n[/MEMÓRIA]` }]
      : [];

    const finalMessages = [
      ...memoryMsg,
      ...messages,
      { role: "user" as const, content: context ? `${context}\n\n${userContent}` : userContent },
    ];

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: finalMessages, model: selectedModel }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao enviar mensagem");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              updateMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      updateMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${e instanceof Error ? e.message : "Erro desconhecido"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, selectedModel, buildContext]);

  const handleTargetClick = useCallback(() => {
    if (linkingFrom) {
      completeLinking(shape.id);
    }
  }, [linkingFrom, completeLinking, shape.id]);

  return (
    <div
      style={{
        width: shape.props.w,
        height: shape.props.h,
        position: "relative",
        pointerEvents: "all",
      }}
    >
      {/* Target connection dot */}
      <div onClick={handleTargetClick} onPointerDown={(e) => e.stopPropagation()}>
        <TargetDot shapeId={shape.id} />
      </div>

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#12121f",
          borderRadius: 12,
          border: linkingFrom ? "2px solid #a040ff" : "1px solid #2a2a40",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "6px 10px",
            background: "#1a1a30",
            borderBottom: "1px solid #2a2a40",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 600,
            color: "#a0a0ff",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>🤖</span> Chat IA
            <button
              onClick={(e) => { e.stopPropagation(); setShowMemory(!showMemory); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Memória"
              style={{
                background: memory.trim() ? "#6a3aff44" : "#2a2a45",
                border: memory.trim() ? "1px solid #6a3aff" : "1px solid #3a3a55",
                borderRadius: 6, padding: "2px 6px", fontSize: 11, cursor: "pointer",
                color: memory.trim() ? "#c0a0ff" : "#8080a0",
                display: "flex", alignItems: "center", gap: 3,
              }}
            >
              🧠 {memory.trim() ? "Memória ✓" : "Memória"}
            </button>
            {connections.length > 0 && (
              <span
                style={{
                  background: "#3a3a60",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 10,
                  color: "#8080ff",
                }}
              >
                {connections.length} conectado{connections.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowModelPicker(!showModelPicker); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              background: "#2a2a45", border: "1px solid #3a3a55", borderRadius: 6,
              padding: "3px 8px", color: "#c0c0ff", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {currentModel.emoji} {currentModel.label} ▾
          </button>

          {showModelPicker && (
            <div
              style={{
                position: "absolute", top: "100%", right: 4, zIndex: 999,
                background: "#1e1e35", border: "1px solid #3a3a55", borderRadius: 8,
                padding: 4, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {AI_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedModel(model.id); setShowModelPicker(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "6px 10px", border: "none", borderRadius: 6,
                    background: selectedModel === model.id ? "#3a3a60" : "transparent",
                    color: selectedModel === model.id ? "#e0e0ff" : "#a0a0c0",
                    fontSize: 12, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span>{model.emoji}</span>
                  <span style={{ flex: 1 }}>{model.label}</span>
                  {selectedModel === model.id && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Memory panel */}
        {showMemory && (
          <div
            style={{
              padding: "8px 10px",
              background: "#18182e",
              borderBottom: "1px solid #2a2a40",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 11, color: "#8080c0", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🧠 Memória (instruções persistentes)</span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMemory(false); }}
                style={{ background: "none", border: "none", color: "#6060a0", cursor: "pointer", fontSize: 14 }}
              >✕</button>
            </div>
            <textarea
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Ex: Sempre responda em português. Seja objetivo. Foque em código React..."
              style={{
                width: "100%", minHeight: 60, maxHeight: 120, resize: "vertical",
                background: "#12121f", border: "1px solid #3a3a55", borderRadius: 6,
                padding: "6px 8px", color: "#d0d0ff", fontSize: 11, outline: "none",
                fontFamily: "inherit", lineHeight: 1.4,
              }}
            />
            <div style={{ fontSize: 10, color: "#5050a0", marginTop: 3 }}>
              Essa memória será enviada em todas as mensagens como contexto.
            </div>
          </div>
        )}

        {connections.length > 0 && (
          <div
            style={{
              padding: "4px 10px",
              background: "#15152a",
              borderBottom: "1px solid #2a2a40",
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
            }}
          >
            {connections.map((conn) => {
              const icons: Record<string, string> = {
                youtube: "🎬",
                "canvas-image": "🖼️",
                "canvas-file": "📎",
              };
              return (
                <span
                  key={conn.id}
                  style={{
                    background: "#2a2a45",
                    borderRadius: 6,
                    padding: "2px 6px",
                    fontSize: 10,
                    color: "#80c0ff",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  {icons[conn.sourceType] || "📦"} Conectado
                </span>
              );
            })}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}
        >
          {messages.length === 0 && (
            <div style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 20 }}>
              Usando {currentModel.emoji} {currentModel.label}
              {connections.length > 0 && (
                <>
                  <br />
                  <span style={{ color: "#4af", fontSize: 11 }}>
                    ✨ {connections.length} fonte{connections.length > 1 ? "s" : ""} conectada{connections.length > 1 ? "s" : ""}
                  </span>
                </>
              )}
              <br />
              <span style={{ fontSize: 11 }}>Envie uma mensagem para começar</span>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%", padding: "6px 10px", borderRadius: 8,
                fontSize: 12, lineHeight: 1.4,
                background: msg.role === "user" ? "#3a3aff33" : "#22223a",
                color: "#e0e0e0",
                border: msg.role === "user" ? "1px solid #3a3aff55" : "1px solid #2a2a40",
              }}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none" style={{ fontSize: 12 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div style={{ color: "#666", fontSize: 12, padding: "4px 8px" }}>Pensando...</div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: 8, borderTop: "1px solid #2a2a40", display: "flex", gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={connections.length > 0 ? "Pergunte sobre o conteúdo conectado..." : "Digite sua mensagem..."}
            style={{
              flex: 1, background: "#1a1a2e", border: "1px solid #333",
              borderRadius: 6, padding: "6px 10px", color: "#e0e0e0",
              fontSize: 12, outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            style={{
              background: isLoading || !input.trim() ? "#333" : "#4a4aff",
              color: "#fff", border: "none", borderRadius: 6,
              padding: "6px 12px", fontSize: 12,
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export class ChatShapeUtil extends BaseBoxShapeUtil<ChatShape> {
  static override type = "canvas-chat" as const;

  static override props: RecordProps<ChatShape> = {
    w: T.number, h: T.number, messages: T.string, memory: T.string,
  };

  getDefaultProps(): ChatShape["props"] {
    return { w: 350, h: 420, messages: "[]", memory: "" };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: ChatShape, info: TLResizeInfo<ChatShape>) {
    return resizeBox(shape, info);
  }

  component(shape: ChatShape) {
    return <ChatComponent shape={shape} />;
  }

  indicator(shape: ChatShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
  }
}
