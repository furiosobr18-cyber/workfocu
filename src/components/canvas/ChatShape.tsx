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
import { supabase } from "@/integrations/supabase/client";
import { loadProviders, saveProviders, providerNameFromUrl, type AIProvider } from "./aiProviders";

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

// Helper to normalize YouTube URL
function getYouTubeUrl(url: string): string {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

// Extract YouTube video ID for display
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
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
  const [providers, setProviders] = useState<AIProvider[]>(() => loadProviders());
  const [addStep, setAddStep] = useState<null | "choose" | "apikey">(null);
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [memory, setMemory] = useState(shape.props.memory || "");
  const [showMemory, setShowMemory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const sessionsKey = `wf-chat-sessions-${shape.id}`;
  type ChatSession = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try { return JSON.parse(localStorage.getItem(`wf-chat-sessions-${shape.id}`) || "[]"); } catch { return []; }
  });
  const [showSessions, setShowSessions] = useState(false);
  const [activeSessionId, _setActive] = useState<string | null>(() => localStorage.getItem(`wf-chat-active-${shape.id}`));
  const setActiveSessionId = (id: string | null) => {
    _setActive(id);
    if (id) localStorage.setItem(`wf-chat-active-${shape.id}`, id); else localStorage.removeItem(`wf-chat-active-${shape.id}`);
  };
  const writeSessions = (next: ChatSession[]) => { setSessions(next); localStorage.setItem(sessionsKey, JSON.stringify(next)); };
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load cloud sessions in background (local shows instantly; newer wins)
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("chat_sessions").select("id,title,messages,updated_at").eq("shape_id", shape.id).order("updated_at", { ascending: false });
      if (!Array.isArray(data)) return;
      setSessions((local) => {
        const map = new Map(local.map((x) => [x.id, x]));
        for (const r of data) {
          const t = new Date(r.updated_at).getTime();
          const l = map.get(r.id);
          if (!l || l.updatedAt < t) map.set(r.id, { id: r.id, title: r.title, messages: r.messages || [], updatedAt: t });
        }
        const next = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
        localStorage.setItem(sessionsKey, JSON.stringify(next));
        return next;
      });
    })().catch(() => {});
  }, [shape.id, sessionsKey]);

  // Auto-save current conversation instantly (local) + cloud (debounced)
  useEffect(() => {
    if (messages.length === 0) return;
    const clean = (t: string) => t.replace(/\[CONNECTED_SOURCES_JSON\][\s\S]*?\[\/CONNECTED_SOURCES_JSON\]/g, "").trim();
    const title = clean(messages.find((m) => m.role === "user")?.content || "Chat").slice(0, 40) || "Chat";
    let id = activeSessionId;
    if (!id) { id = crypto.randomUUID(); setActiveSessionId(id); }
    const sid = id;
    const now = Date.now();
    setSessions((prev) => {
      const exists = prev.some((x) => x.id === sid);
      const next = exists
        ? prev.map((x) => x.id === sid ? { ...x, messages, updatedAt: now } : x)
        : [{ id: sid, title, messages, updatedAt: now }, ...prev];
      localStorage.setItem(sessionsKey, JSON.stringify(next));
      return next;
    });
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(() => {
      (supabase as any).from("chat_sessions").upsert({ id: sid, shape_id: shape.id, title, messages, updated_at: new Date(now).toISOString() }).then(() => {}, () => {});
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
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
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const customSel = selectedModel.startsWith("prov::") ? (() => {
    const [, pid, ...rest] = selectedModel.split("::");
    const prov = providers.find((p) => p.id === pid);
    return prov ? { prov, model: rest.join("::") } : null;
  })() : null;
  const currentModel = customSel
    ? { id: selectedModel, label: customSel.model, emoji: "🔌" }
    : AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];

  const connectProvider = async () => {
    setConnecting(true); setConnectError("");
    try {
      const baseUrl = newBaseUrl.trim().replace(/\/+$/, "");
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: "list_models", custom: { baseUrl, apiKey: newApiKey.trim() } }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !Array.isArray(data.models) || data.models.length === 0) throw new Error(data.error || "Não foi possível conectar");
      const prov: AIProvider = { id: crypto.randomUUID(), name: providerNameFromUrl(baseUrl), baseUrl, apiKey: newApiKey.trim(), models: data.models };
      const next = [...providers, prov];
      setProviders(next); saveProviders(next);
      setAddStep(null); setNewBaseUrl(""); setNewApiKey("");
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Erro");
    } finally { setConnecting(false); }
  };
  const removeProvider = (id: string) => {
    const next = providers.filter((p) => p.id !== id);
    setProviders(next); saveProviders(next);
    if (selectedModel.startsWith(`prov::${id}::`)) setSelectedModel(AI_MODELS[0].id);
  };

  // Build context from connected shapes
  const buildContext = useCallback((): string => {
    if (connections.length === 0) return "";

    const shapeDataMap = (window as any).__canvasShapeData || {};
    const sources = connections
      .map((conn) => {
        const data = shapeDataMap[conn.sourceId];
        if (!data) {
          const sh: any = editor.getShape(conn.sourceId as any);
          if (!sh) return null;
          const p = sh.props || {};
          let text = typeof p.text === "string" ? p.text : "";
          if (!text && p.richText) {
            const walk = (n: any): string => (n?.text || "") + (Array.isArray(n?.content) ? n.content.map(walk).join(n.type === "doc" ? "\n" : "") : "");
            text = walk(p.richText);
          }
          if (p.url) return { type: "text", name: sh.type, text: `Link: ${p.url}${text ? "\n" + text : ""}` };
          if (text) return { type: "text", name: sh.type, text: text.slice(0, 8000) };
          return null;
        }

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
  }, [connections, editor]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const context = buildContext();
    const userContent = input.trim();
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    stickToBottomRef.current = true;
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
        body: JSON.stringify({
          messages: finalMessages,
          model: customSel ? customSel.model : selectedModel,
          ...(customSel ? { custom: { baseUrl: customSel.prov.baseUrl, apiKey: customSel.prov.apiKey } } : {}),
        }),
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
  }, [input, messages, isLoading, selectedModel, customSel, buildContext, memory, updateMessages, activeSessionId, sessionsKey]);

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
          background: "hsl(0,0%,7%)",
          borderRadius: 12,
          border: linkingFrom ? "2px solid hsl(0,0%,50%)" : "1px solid hsl(0,0%,20%)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "6px 10px",
            background: "hsl(0,0%,10%)",
            borderBottom: "1px solid hsl(0,0%,20%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 600,
            color: "hsl(0,0%,75%)",
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
                background: memory.trim() ? "hsla(0,0%,40%,0.3)" : "hsl(0,0%,15%)",
                border: memory.trim() ? "1px solid hsl(0,0%,50%)" : "1px solid hsl(0,0%,25%)",
                borderRadius: 6, padding: "2px 6px", fontSize: 11, cursor: "pointer",
                color: memory.trim() ? "hsl(0,0%,80%)" : "hsl(0,0%,50%)",
                display: "flex", alignItems: "center", gap: 3,
              }}
            >
              🧠 {memory.trim() ? "Memória ✓" : "Memória"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSessions(!showSessions); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Chats salvos"
              style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,25%)", borderRadius: 6, padding: "2px 6px", fontSize: 11, cursor: "pointer", color: "hsl(0,0%,70%)" }}
            >🗂 Chats{sessions.length ? ` (${sessions.length})` : ""}</button>
            {connections.length > 0 && (
              <span
                style={{
                  background: "hsl(0,0%,18%)",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 10,
                  color: "hsl(0,0%,60%)",
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
              background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,25%)", borderRadius: 6,
              padding: "3px 8px", color: "hsl(0,0%,70%)", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {currentModel.emoji} {currentModel.label} ▾
          </button>

          {showModelPicker && (
            <div
              style={{
                position: "absolute", top: "100%", right: 4, zIndex: 999,
                background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,25%)", borderRadius: 8,
                padding: 4, minWidth: 240, maxHeight: 420, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
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
                    background: selectedModel === model.id ? "hsl(0,0%,20%)" : "transparent",
                    color: selectedModel === model.id ? "hsl(0,0%,90%)" : "hsl(0,0%,60%)",
                    fontSize: 12, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span>{model.emoji}</span>
                  <span style={{ flex: 1 }}>{model.label}</span>
                  {selectedModel === model.id && <span>✓</span>}
                </button>
              ))}
              {providers.map((prov) => (
                <div key={prov.id} style={{ borderTop: "1px solid hsl(0,0%,22%)", marginTop: 4, paddingTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "4px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "hsl(210,100%,66%)" }}>
                    <span style={{ flex: 1 }}>{prov.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeProvider(prov.id); }} title="Remover" style={{ background: "none", border: "none", color: "hsl(0,0%,50%)", cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: "auto" }} onWheel={(e) => e.stopPropagation()}>
                    {prov.models.map((m) => {
                      const id = `prov::${prov.id}::${m}`;
                      return (
                        <button key={id} onClick={(e) => { e.stopPropagation(); setSelectedModel(id); setShowModelPicker(false); }}
                          style={{ display: "flex", width: "100%", padding: "5px 10px", border: "none", borderRadius: 6, background: selectedModel === id ? "hsl(0,0%,20%)" : "transparent", color: selectedModel === id ? "hsl(0,0%,90%)" : "hsl(0,0%,60%)", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m}</span>
                          {selectedModel === id && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid hsl(0,0%,22%)", marginTop: 4, paddingTop: 4 }}>
                {addStep === null && (
                  <button onClick={(e) => { e.stopPropagation(); setAddStep("choose"); }}
                    style={{ width: "100%", padding: "6px 10px", border: "none", borderRadius: 6, background: "transparent", color: "hsl(210,100%,66%)", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                    ＋ Adicionar provedor
                  </button>
                )}
                {addStep === "choose" && (
                  <div style={{ display: "flex", gap: 4, padding: 4 }}>
                    <button disabled title="Em breve" style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid hsl(0,0%,25%)", background: "transparent", color: "hsl(0,0%,40%)", fontSize: 11 }}>Auth (em breve)</button>
                    <button onClick={(e) => { e.stopPropagation(); setAddStep("apikey"); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid hsl(210,100%,56%)", background: "hsl(210,100%,56%)", color: "white", fontSize: 11, cursor: "pointer" }}>API Key</button>
                  </div>
                )}
                {addStep === "apikey" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6 }} onKeyDown={(e) => e.stopPropagation()}>
                    <input value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} placeholder="Base URL (ex: https://api.openai.com/v1)"
                      style={{ padding: 6, borderRadius: 6, border: "1px solid hsl(0,0%,25%)", background: "hsl(0,0%,8%)", color: "hsl(0,0%,90%)", fontSize: 11 }} />
                    <input value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="API Key" type="password"
                      style={{ padding: 6, borderRadius: 6, border: "1px solid hsl(0,0%,25%)", background: "hsl(0,0%,8%)", color: "hsl(0,0%,90%)", fontSize: 11 }} />
                    {connectError && <span style={{ color: "hsl(0,90%,65%)", fontSize: 10 }}>{connectError}</span>}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setAddStep(null); setConnectError(""); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid hsl(0,0%,25%)", background: "transparent", color: "hsl(0,0%,60%)", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                      <button disabled={connecting || !newBaseUrl || !newApiKey} onClick={(e) => { e.stopPropagation(); connectProvider(); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: "none", background: "hsl(210,100%,56%)", color: "white", fontSize: 11, cursor: "pointer", opacity: connecting || !newBaseUrl || !newApiKey ? 0.5 : 1 }}>{connecting ? "Conectando..." : "Conectar"}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Memory panel */}
        {showSessions && (
          <div onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}
            style={{ padding: 8, background: "hsl(0,0%,9%)", borderBottom: "1px solid hsl(0,0%,20%)", maxHeight: 220, overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveSessionId(null); updateMessages([]); }}
                style={{ flex: 1, padding: 5, borderRadius: 6, border: "1px solid hsl(0,0%,25%)", background: "transparent", color: "hsl(0,0%,75%)", fontSize: 11, cursor: "pointer" }}
              >＋ Novo chat</button>
            </div>
            {sessions.length === 0 && <div style={{ fontSize: 11, color: "hsl(0,0%,45%)" }}>Seus chats aparecem aqui automaticamente.</div>}
            {sessions.map((ss) => (
              <div key={ss.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", borderRadius: 6, background: ss.id === activeSessionId ? "hsl(0,0%,18%)" : "transparent" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveSessionId(ss.id); stickToBottomRef.current = true; updateMessages(ss.messages); setShowSessions(false); }}
                  style={{ flex: 1, textAlign: "left", background: "none", border: "none", color: "hsl(0,0%,80%)", fontSize: 11, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >💬 {ss.title} <span style={{ color: "hsl(0,0%,45%)" }}>· {new Date(ss.updatedAt).toLocaleDateString("pt-BR")}</span></button>
                <button onClick={(e) => { e.stopPropagation(); writeSessions(sessions.filter((x) => x.id !== ss.id)); (supabase as any).from("chat_sessions").delete().eq("id", ss.id).then(() => {}, () => {}); if (activeSessionId === ss.id) { setActiveSessionId(null); updateMessages([]); } }}
                  title="Apagar" style={{ background: "none", border: "none", color: "hsl(0,0%,50%)", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {showMemory && (
          <div
            style={{
              padding: "8px 10px",
              background: "hsl(0,0%,9%)",
              borderBottom: "1px solid hsl(0,0%,20%)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 11, color: "hsl(0,0%,55%)", marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🧠 Memória (instruções persistentes)</span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMemory(false); }}
                style={{ background: "none", border: "none", color: "hsl(0,0%,45%)", cursor: "pointer", fontSize: 14 }}
              >✕</button>
            </div>
            <textarea
              value={memory}
              onChange={(e) => updateMemory(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Ex: Sempre responda em português. Seja objetivo. Foque em código React..."
              style={{
                width: "100%", minHeight: 60, maxHeight: 120, resize: "vertical",
                background: "hsl(0,0%,7%)", border: "1px solid hsl(0,0%,25%)", borderRadius: 6,
                padding: "6px 8px", color: "hsl(0,0%,80%)", fontSize: 11, outline: "none",
                fontFamily: "inherit", lineHeight: 1.4,
              }}
            />
            <div style={{ fontSize: 10, color: "hsl(0,0%,40%)", marginTop: 3 }}>
              Essa memória será enviada em todas as mensagens como contexto.
            </div>
          </div>
        )}

        {connections.length > 0 && (
          <div
            style={{
              padding: "4px 10px",
              background: "hsl(0,0%,8%)",
              borderBottom: "1px solid hsl(0,0%,20%)",
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
              const shapeDataMap = (window as any).__canvasShapeData || {};
              const data = shapeDataMap[conn.sourceId];
              let label = "Conectado";
              if (data?.type === "youtube" && data.url) {
                const vid = getYouTubeId(data.url);
                label = vid ? `YouTube (${vid.slice(0, 6)}...)` : "YouTube";
              } else if (data?.type === "canvas-image") {
                label = data.name || "Imagem";
              } else if (data?.type === "canvas-file") {
                label = data.name || "Arquivo";
              }
              return (
                <span
                  key={conn.id}
                  style={{
                    background: "hsl(0,0%,15%)",
                    borderRadius: 6,
                    padding: "2px 6px",
                    fontSize: 10,
                    color: "hsl(0,0%,60%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  {icons[conn.sourceType] || "📦"} {label}
                </span>
              );
            })}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="wf-selectable"
          onScroll={(e) => { const el = e.currentTarget; stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onCopy={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ flex: 1, overflowY: "auto", padding: 8, userSelect: "text", WebkitUserSelect: "text", cursor: "text", display: "flex", flexDirection: "column", gap: 6 }}
        >
          {messages.length === 0 && (
            <div style={{ color: "hsl(0,0%,35%)", fontSize: 12, textAlign: "center", marginTop: 20 }}>
              Usando {currentModel.emoji} {currentModel.label}
              {connections.length > 0 && (
                <>
                  <br />
                  <span style={{ color: "hsl(0,0%,55%)", fontSize: 11 }}>
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
                background: msg.role === "user" ? "hsla(0,0%,30%,0.3)" : "hsl(0,0%,12%)",
                color: "hsl(0,0%,88%)",
                border: msg.role === "user" ? "1px solid hsl(0,0%,30%)" : "1px solid hsl(0,0%,20%)",
                userSelect: "text", WebkitUserSelect: "text", position: "relative",
              }}
            >
              <button
                title="Copiar"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); const b = e.currentTarget; b.textContent = "✓"; setTimeout(() => { b.textContent = "⧉"; }, 1200); }}
                style={{ float: "right", marginLeft: 6, background: "none", border: "none", color: "hsl(0,0%,50%)", cursor: "pointer", fontSize: 11, padding: 0 }}
              >⧉</button>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none" style={{ fontSize: 12 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div style={{ color: "hsl(0,0%,40%)", fontSize: 12, padding: "4px 8px" }}>Pensando...</div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: 8, borderTop: "1px solid hsl(0,0%,20%)", display: "flex", gap: 6 }}>
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
              flex: 1, background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,22%)",
              borderRadius: 6, padding: "6px 10px", color: "hsl(0,0%,88%)",
              fontSize: 12, outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            style={{
              background: isLoading || !input.trim() ? "hsl(0,0%,18%)" : "hsl(0,0%,30%)",
              color: "hsl(0,0%,90%)", border: "none", borderRadius: 6,
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
