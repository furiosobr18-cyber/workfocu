import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { CanvasElement, CanvasConnection } from "@/hooks/useCanvasStore";

type ChatMessage = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/canvas-chat`;

const AI_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", emoji: "🦙" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", emoji: "⚡" },
  { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B", emoji: "🧠" },
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick", emoji: "🚀" },
  { id: "qwen-qwq-32b", label: "Qwen QWQ 32B", emoji: "🔮" },
  { id: "mistral-saba-24b", label: "Mistral Saba 24B", emoji: "🌊" },
];

function getYouTubeUrl(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

interface Props {
  element: CanvasElement;
  connections: CanvasConnection[];
  allElements: CanvasElement[];
  onUpdateProps: (props: Record<string, any>) => void;
  onChanged?: () => void;
}

export default function ChatElement({ element: el, connections, allElements, onUpdateProps, onChanged }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(el.props.messages || "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(el.props.model || AI_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [memory, setMemory] = useState(el.props.memory || "");
  const [showMemory, setShowMemory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onUpdateProps({ messages: JSON.stringify(msgs) });
      onChanged?.();
    }, 500);
  }, [onUpdateProps, onChanged]);

  const updateMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistMessages(next);
      return next;
    });
  }, [persistMessages]);

  const updateMemory = useCallback((val: string) => {
    setMemory(val);
    onUpdateProps({ memory: val });
    onChanged?.();
  }, [onUpdateProps, onChanged]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

  const buildContext = useCallback((): string => {
    if (connections.length === 0) return "";

    const sources = connections.map(conn => {
      const source = allElements.find(e => e.id === conn.sourceId);
      if (!source) return null;

      if (source.type === "youtube" && source.props.url) {
        return { type: "youtube", url: getYouTubeUrl(source.props.url) };
      }
      if (source.type === "image" && source.props.src) {
        return { type: "image", name: source.props.name || "imagem", src: source.props.src };
      }
      if (source.type === "file") {
        return {
          type: "file",
          name: source.props.name || "arquivo",
          fileType: source.props.fileType || "",
          textSnippet: "",
        };
      }
      return null;
    }).filter(Boolean);

    if (sources.length === 0) return "";
    return `\n\n[CONNECTED_SOURCES_JSON]\n${JSON.stringify(sources)}\n[/CONNECTED_SOURCES_JSON]`;
  }, [connections, allElements]);

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
      ? [{ role: "user" as const, content: `[MEMÓRIA DO SISTEMA]\n${memory.trim()}\n[/MEMÓRIA]` }]
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
              updateMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
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
      updateMessages(prev => [...prev, { role: "assistant", content: `❌ ${e instanceof Error ? e.message : "Erro desconhecido"}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, selectedModel, buildContext, memory, updateMessages]);

  return (
    <div
      className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-border bg-card"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border text-sm">
        <div className="flex items-center gap-2">
          <span>🤖</span>
          <span className="font-semibold text-foreground">Chat IA</span>
          <button
            onClick={() => setShowMemory(!showMemory)}
            className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            🧠 {memory.trim() ? "Memória ✓" : "Memória"}
          </button>
          {connections.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {connections.length} conectado{connections.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
        >
          {currentModel.emoji} {currentModel.label} ▾
        </button>
      </div>

      {/* Model picker dropdown */}
      {showModelPicker && (
        <div className="bg-card border-b border-border p-1 max-h-[200px] overflow-y-auto">
          {AI_MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => { setSelectedModel(model.id); setShowModelPicker(false); onUpdateProps({ model: model.id }); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
                selectedModel === model.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <span>{model.emoji}</span>
              <span className="flex-1 text-left">{model.label}</span>
              {selectedModel === model.id && <span>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Memory panel */}
      {showMemory && (
        <div className="px-3 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">🧠 Instruções persistentes</span>
            <button onClick={() => setShowMemory(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <textarea
            value={memory}
            onChange={e => updateMemory(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Ex: Sempre responda em português..."
            className="w-full min-h-[50px] max-h-[100px] resize-y bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none"
          />
        </div>
      )}

      {/* Connected sources */}
      {connections.length > 0 && (
        <div className="flex gap-1 px-3 py-1.5 bg-muted/20 border-b border-border flex-wrap">
          {connections.map(conn => {
            const source = allElements.find(e => e.id === conn.sourceId);
            const icons: Record<string, string> = { youtube: "🎬", image: "🖼️", file: "📎", video: "📹" };
            const label = source?.props.name || source?.type || "Conectado";
            return (
              <span key={conn.id} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground flex items-center gap-1">
                {icons[source?.type || ""] || "📦"} {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground/50 text-xs mt-8 space-y-1">
            <p>{currentModel.emoji} {currentModel.label}</p>
            {connections.length > 0 && <p>✨ {connections.length} fonte{connections.length > 1 ? "s" : ""} conectada{connections.length > 1 ? "s" : ""}</p>}
            <p>Envie uma mensagem para começar</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
              msg.role === "user"
                ? "self-end bg-primary/20 text-foreground"
                : "self-start bg-muted text-foreground"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_pre]:bg-background/50 [&_pre]:p-2 [&_pre]:rounded [&_code]:text-xs">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="self-start text-xs text-muted-foreground animate-pulse">Pensando...</div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/30">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
          }}
          placeholder="Pergunte algo..."
          disabled={isLoading}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {isLoading ? "..." : "→"}
        </button>
      </div>

      {/* Clear button */}
      {messages.length > 0 && (
        <div className="flex justify-center pb-1.5">
          <button
            onClick={() => { updateMessages([]); }}
            className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
          >
            Limpar conversa
          </button>
        </div>
      )}
    </div>
  );
}
