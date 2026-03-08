import { useState, useRef, useEffect, useCallback } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  RecordProps,
} from "tldraw";
import ReactMarkdown from "react-markdown";

export type ChatShape = TLBaseShape<
  "canvas-chat",
  {
    w: number;
    h: number;
    messages: string;
  }
>;

type ChatMessage = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/canvas-chat`;

const AI_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini Flash", emoji: "⚡" },
  { id: "google/gemini-2.5-pro", label: "Gemini Pro", emoji: "🧠" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", emoji: "💨" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini Lite", emoji: "🪶" },
  { id: "openai/gpt-5", label: "GPT-5", emoji: "🤖" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", emoji: "🔹" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", emoji: "⚛️" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", emoji: "🚀" },
];

function ChatComponent({ shape }: { shape: ChatShape }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(shape.props.messages || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const currentModel = AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, model: selectedModel }),
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
              setMessages((prev) => {
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${e instanceof Error ? e.message : "Erro desconhecido"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, selectedModel]);

  return (
    <div
      style={{
        width: shape.props.w,
        height: shape.props.h,
        position: "relative",
        pointerEvents: "all",
      }}
    >
      {/* Connection dot - right side */}
      <div
        style={{
          position: "absolute",
          right: -7,
          top: "50%",
          transform: "translateY(-50%)",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#ffffff",
          border: "2px solid #888",
          boxShadow: "0 0 8px rgba(255,255,255,0.4)",
          cursor: "crosshair",
          zIndex: 10,
        }}
        title="Conecte ao YouTube"
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#12121f",
          borderRadius: 12,
          border: "1px solid #2a2a40",
          overflow: "hidden",
        }}
      >
      {/* Header with model picker */}
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
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModelPicker(!showModelPicker);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: "#2a2a45",
            border: "1px solid #3a3a55",
            borderRadius: 6,
            padding: "3px 8px",
            color: "#c0c0ff",
            fontSize: 11,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {currentModel.emoji} {currentModel.label} ▾
        </button>

        {/* Model dropdown */}
        {showModelPicker && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 4,
              zIndex: 999,
              background: "#1e1e35",
              border: "1px solid #3a3a55",
              borderRadius: 8,
              padding: 4,
              minWidth: 200,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {AI_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedModel(model.id);
                  setShowModelPicker(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: 6,
                  background: selectedModel === model.id ? "#3a3a60" : "transparent",
                  color: selectedModel === model.id ? "#e0e0ff" : "#a0a0c0",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
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

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 20 }}>
            Usando {currentModel.emoji} {currentModel.label}
            <br />
            <span style={{ fontSize: 11 }}>Envie uma mensagem para começar</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.4,
              background: msg.role === "user" ? "#3a3aff33" : "#22223a",
              color: "#e0e0e0",
              border: msg.role === "user" ? "1px solid #3a3aff55" : "1px solid #2a2a40",
            }}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm prose-invert max-w-none" style={{ fontSize: 12 }}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
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
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Digite sua mensagem..."
          style={{
            flex: 1,
            background: "#1a1a2e",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#e0e0e0",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            background: isLoading || !input.trim() ? "#333" : "#4a4aff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
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
    w: T.number,
    h: T.number,
    messages: T.string,
  };

  getDefaultProps(): ChatShape["props"] {
    return {
      w: 350,
      h: 420,
      messages: "[]",
    };
  }

  override canResize() {
    return true;
  }

  override canBind() {
    return true;
  }

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
