import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShapeOverlay } from "./ShapeOverlay";
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

export type YouTubeShape = TLBaseShape<
  "youtube",
  {
    w: number;
    h: number;
    url: string;
  }
>;

type YouTubeEmbed =
  | { kind: "video"; id: string }
  | { kind: "playlist"; id: string }
  | { kind: "channel"; id: string }
  | { kind: "handle"; handle: string }
  | null;

function parseYouTube(url: string): YouTubeEmbed {
  if (!url) return null;
  const u = url.trim();

  // Video ID
  const v = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/
  );
  if (v) return { kind: "video", id: v[1] };

  // Playlist
  const p = u.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (p && /playlist|watch/.test(u)) return { kind: "playlist", id: p[1] };

  // Channel by ID: /channel/UCxxxx -> uploads playlist UU...
  const c = u.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/);
  if (c) return { kind: "channel", id: c[1] };

  // Handle: /@name or /c/name or /user/name
  const h = u.match(/youtube\.com\/(?:@|c\/|user\/)([a-zA-Z0-9._-]+)/);
  if (h) return { kind: "handle", handle: h[1] };

  return null;
}

function getEmbedUrl(parsed: YouTubeEmbed): string | null {
  if (!parsed) return null;
  if (parsed.kind === "video") return `https://www.youtube.com/embed/${parsed.id}`;
  if (parsed.kind === "playlist") return `https://www.youtube.com/embed/videoseries?list=${parsed.id}`;
  if (parsed.kind === "channel") {
    // Uploads playlist for a channel: replace UC -> UU
    const uploads = "UU" + parsed.id.slice(2);
    return `https://www.youtube.com/embed/videoseries?list=${uploads}`;
  }
  return null; // handle: needs resolution via API, fallback below
}

// Neutral WorkFocus colors
const WF = {
  dotBg: "radial-gradient(circle, hsl(0,0%,98%) 30%, hsl(0,0%,60%) 100%)",
  dotBorder: "hsl(0,0%,60%)",
  dotShadow: "0 0 10px hsla(0,0%,60%,0.5), 0 0 20px hsla(0,0%,60%,0.2)",
  dotHoverShadow: "0 0 16px hsla(0,0%,70%,0.7), 0 0 32px hsla(0,0%,60%,0.4)",
  targetBg: "radial-gradient(circle, hsl(0,0%,98%) 30%, hsl(0,0%,45%) 100%)",
  targetBorder: "hsl(0,0%,45%)",
  targetShadow: "0 0 10px hsla(0,0%,45%,0.5), 0 0 20px hsla(0,0%,45%,0.2)",
  targetHoverShadow: "0 0 16px hsla(0,0%,55%,0.7), 0 0 32px hsla(0,0%,45%,0.4)",
};

// Connection dot component used by YouTube, Image, File
export function SourceDot({
  shapeId,
  shapeType,
  side = "right",
}: {
  shapeId: string;
  shapeType: string;
  side?: "left" | "right";
}) {
  const posStyle =
    side === "right"
      ? { right: -14, left: "auto" as const }
      : { left: -14, right: "auto" as const };

  return (
    <div
      data-connection-source={shapeId}
      data-connection-type={shapeType}
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        ...posStyle,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: WF.dotBg,
        border: `3px solid ${WF.dotBorder}`,
        boxShadow: WF.dotShadow,
        cursor: "grab",
        zIndex: 20,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1.4)";
        (e.target as HTMLElement).style.boxShadow = WF.dotHoverShadow;
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1)";
        (e.target as HTMLElement).style.boxShadow = WF.dotShadow;
      }}
      title="Arraste para conectar ao Chat"
    />
  );
}

export function TargetDot({ shapeId }: { shapeId: string }) {
  return (
    <div
      data-connection-target={shapeId}
      style={{
        position: "absolute",
        left: -14,
        top: "50%",
        transform: "translateY(-50%)",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: WF.targetBg,
        border: `3px solid ${WF.targetBorder}`,
        boxShadow: WF.targetShadow,
        cursor: "pointer",
        zIndex: 20,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1.4)";
        (e.target as HTMLElement).style.boxShadow = WF.targetHoverShadow;
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1)";
        (e.target as HTMLElement).style.boxShadow = WF.targetShadow;
      }}
      title="Solte aqui para conectar"
    />
  );
}

export class YouTubeShapeUtil extends BaseBoxShapeUtil<YouTubeShape> {
  static override type = "youtube" as const;

  static override props: RecordProps<YouTubeShape> = {
    w: T.number,
    h: T.number,
    url: T.string,
  };

  getDefaultProps(): YouTubeShape["props"] {
    return { w: 480, h: 300, url: "" };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: YouTubeShape, info: TLResizeInfo<YouTubeShape>) {
    return resizeBox(shape, info);
  }

  component(shape: YouTubeShape) {
    return <YouTubeComponent shape={shape} />;
  }

  indicator(shape: YouTubeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
  }

  override onDoubleClick = (shape: YouTubeShape) => {
    // Handled inline now
  };
}

function YouTubeComponent({ shape }: { shape: YouTubeShape }) {
  const editor = useEditor();
  const [showUrlInput, setShowUrlInput] = useState(!shape.props.url);
  const [urlValue, setUrlValue] = useState(shape.props.url || "");
  const parsed = useMemo(() => parseYouTube(shape.props.url), [shape.props.url]);
  const embedUrl = useMemo(() => getEmbedUrl(parsed), [parsed]);
  const needsHandleHelp = parsed?.kind === "handle";

  const handleSubmit = useCallback(() => {
    editor.updateShape({ id: shape.id, type: "youtube", props: { url: urlValue.trim() } });
    if (urlValue.trim()) setShowUrlInput(false);
  }, [editor, shape.id, urlValue]);

  const isChannel = parsed?.kind === "channel" || parsed?.kind === "handle";

  // Empty state or editing (but not for channels — they have their own UI)
  if ((!embedUrl && !isChannel) || showUrlInput) {
    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "hsl(0,0%,10%)", borderRadius: 12, border: "1px solid hsl(0,0%,20%)",
        color: "hsl(0,0%,50%)", fontSize: 14, flexDirection: "column", gap: 12,
        pointerEvents: "all", position: "relative", overflow: "visible",
      }}>
        <SourceDot shapeId={shape.id} shapeType="youtube" />
        <span style={{ fontSize: 32 }}>🎬</span>
        <div
          style={{
            background: "hsl(0,0%,7%)",
            border: "1px solid hsl(0,0%,22%)",
            borderRadius: 10,
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "85%",
            maxWidth: 340,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span style={{ fontSize: 12, color: "hsl(0,0%,60%)", fontWeight: 500 }}>
            Cole a URL do YouTube (vídeo, playlist ou canal)
          </span>
          {needsHandleHelp && (
            <span style={{ fontSize: 10, color: "hsl(30,80%,65%)" }}>
              Para canais com @handle, use a URL no formato /channel/UC… (abra o canal no YouTube e copie a URL completa).
            </span>
          )}
          <input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") { setShowUrlInput(false); setUrlValue(shape.props.url || ""); }
            }}
            placeholder="vídeo, playlist ou /channel/UC..."
            autoFocus
            style={{
              width: "100%",
              background: "hsl(0,0%,12%)",
              border: "1px solid hsl(0,0%,25%)",
              borderRadius: 6,
              padding: "8px 10px",
              color: "hsl(0,0%,90%)",
              fontSize: 12,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {shape.props.url && (
              <button
                onClick={() => { setShowUrlInput(false); setUrlValue(shape.props.url); }}
                style={{
                  background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,25%)",
                  borderRadius: 6, padding: "5px 14px", color: "hsl(0,0%,60%)",
                  fontSize: 11, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!urlValue.trim()}
              style={{
                background: urlValue.trim() ? "hsl(0,0%,30%)" : "hsl(0,0%,15%)",
                border: "none", borderRadius: 6, padding: "5px 14px",
                color: urlValue.trim() ? "hsl(0,0%,95%)" : "hsl(0,0%,40%)",
                fontSize: 11, cursor: urlValue.trim() ? "pointer" : "not-allowed",
                fontWeight: 500,
              }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </HTMLContainer>
    );
  }

  return (
    <HTMLContainer style={{
      width: shape.props.w, height: shape.props.h,
      borderRadius: 12, overflow: "visible", pointerEvents: "all", position: "relative",
    }}>
      <div
        style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", position: "relative", background: "hsl(0,0%,7%)" }}
      >
        {isChannel ? (
          <ChannelView url={shape.props.url} />
        ) : (
          <iframe
            src={embedUrl!}
            width="100%" height="100%"
            style={{ border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        <ShapeOverlay shapeId={shape.id} />
        {/* Edit button overlay */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowUrlInput(true); setUrlValue(shape.props.url); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 10,
            background: "hsla(0,0%,7%,0.85)", border: "1px solid hsl(0,0%,25%)",
            borderRadius: 6, padding: "4px 8px", color: "hsl(0,0%,70%)",
            fontSize: 11, cursor: "pointer", backdropFilter: "blur(4px)",
          }}
        >
          ✏️ Editar URL
        </button>
      </div>
      <SourceDot shapeId={shape.id} shapeType="youtube" />
    </HTMLContainer>
  );
}

interface ChannelData {
  channelId: string;
  title: string;
  handle: string | null;
  avatar: string | null;
  banner: string | null;
  description: string;
  subscriberText: string | null;
  videos: { id: string; title: string; thumbnail: string; published: string; author: string }[];
}

function ChannelView({ url }: { url: string }) {
  const [data, setData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data: res, error: invokeErr } = await supabase.functions.invoke(
          "youtube-channel",
          { method: "GET" } as any,
        );
        // Edge function uses query params — call via fetch instead
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const r = await fetch(
          `https://${projectId}.supabase.co/functions/v1/youtube-channel?url=${encodeURIComponent(url)}`,
          { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as ChannelData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Falha ao carregar canal");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0,0%,60%)", fontSize: 13 }}>
        Carregando canal…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "hsl(0,80%,65%)", fontSize: 12, padding: 16, textAlign: "center", gap: 8 }}>
        <span>⚠️ {error || "Não foi possível carregar o canal"}</span>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: "hsl(0,0%,70%)", fontSize: 11 }}>Abrir no YouTube ↗</a>
      </div>
    );
  }

  if (playingId) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <iframe
          src={`https://www.youtube.com/embed/${playingId}?autoplay=1`}
          width="100%" height="100%"
          style={{ border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <button
          onClick={(e) => { e.stopPropagation(); setPlayingId(null); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: 8, left: 8, zIndex: 10,
            background: "hsla(0,0%,7%,0.85)", border: "1px solid hsl(0,0%,25%)",
            borderRadius: 6, padding: "4px 10px", color: "hsl(0,0%,80%)",
            fontSize: 11, cursor: "pointer", backdropFilter: "blur(4px)",
          }}
        >
          ← Voltar ao canal
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ width: "100%", height: "100%", overflowY: "auto", background: "hsl(0,0%,6%)", color: "hsl(0,0%,90%)", fontFamily: "system-ui, -apple-system, sans-serif" }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Banner */}
      {data.banner && (
        <div style={{ width: "100%", aspectRatio: "6.2 / 1", overflow: "hidden", background: "hsl(0,0%,10%)" }}>
          <img src={data.banner} alt="banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", gap: 16, padding: "16px 20px", alignItems: "center" }}>
        {data.avatar && (
          <img src={data.avatar} alt={data.title} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{data.title}</div>
          <div style={{ fontSize: 12, color: "hsl(0,0%,60%)", marginTop: 4 }}>
            {data.handle && <span>{data.handle}</span>}
            {data.subscriberText && <span> · {data.subscriberText}</span>}
            <span> · {data.videos.length} vídeos recentes</span>
          </div>
          {data.description && (
            <div style={{ fontSize: 12, color: "hsl(0,0%,70%)", marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {data.description}
            </div>
          )}
        </div>
      </div>

      {/* Videos grid */}
      <div style={{ padding: "0 20px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {data.videos.map((v) => (
          <div
            key={v.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setPlayingId(v.id); }}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 8, overflow: "hidden", background: "hsl(0,0%,12%)" }}>
              <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.3, color: "hsl(0,0%,92%)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {v.title}
            </div>
            <div style={{ fontSize: 10, color: "hsl(0,0%,55%)" }}>
              {new Date(v.published).toLocaleDateString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
