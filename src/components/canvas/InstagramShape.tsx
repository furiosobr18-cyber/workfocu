import { useState, useCallback } from "react";
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
import { SourceDot } from "./YouTubeShape";

export type InstagramShape = TLBaseShape<
  "instagram",
  {
    w: number;
    h: number;
    url: string;
  }
>;

type InstagramUrlType = "post" | "profile" | null;

function parseInstagramUrl(url: string): { type: InstagramUrlType; id: string | null; username: string | null } {
  // Post or reel
  const postMatch = url.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  if (postMatch) return { type: "post", id: postMatch[1], username: null };

  // Profile URL: instagram.com/username (no /p/ /reel/ etc)
  const profileMatch = url.match(/instagram\.com\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/);
  if (profileMatch && !["p", "reel", "reels", "explore", "stories", "accounts", "directory"].includes(profileMatch[1])) {
    return { type: "profile", id: null, username: profileMatch[1] };
  }

  return { type: null, id: null, username: null };
}

export class InstagramShapeUtil extends BaseBoxShapeUtil<InstagramShape> {
  static override type = "instagram" as const;

  static override props: RecordProps<InstagramShape> = {
    w: T.number,
    h: T.number,
    url: T.string,
  };

  getDefaultProps(): InstagramShape["props"] {
    return { w: 400, h: 480, url: "" };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: InstagramShape, info: TLResizeInfo<InstagramShape>) {
    return resizeBox(shape, info);
  }

  component(shape: InstagramShape) {
    return <InstagramComponent shape={shape} />;
  }

  indicator(shape: InstagramShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
  }
}

function InstagramComponent({ shape }: { shape: InstagramShape }) {
  const editor = useEditor();
  const [showUrlInput, setShowUrlInput] = useState(!shape.props.url);
  const [urlValue, setUrlValue] = useState(shape.props.url || "");
  const parsed = parseInstagramUrl(shape.props.url);

  const handleSubmit = useCallback(() => {
    editor.updateShape({ id: shape.id, type: "instagram", props: { url: urlValue.trim() } });
    if (urlValue.trim()) setShowUrlInput(false);
  }, [editor, shape.id, urlValue]);

  if ((!parsed.type) || showUrlInput) {
    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "hsl(0,0%,10%)", borderRadius: 12, border: "1px solid hsl(0,0%,20%)",
        color: "hsl(0,0%,50%)", fontSize: 14, flexDirection: "column", gap: 12,
        pointerEvents: "all", position: "relative", overflow: "visible",
      }}>
        <SourceDot shapeId={shape.id} shapeType="instagram" />
        <span style={{ fontSize: 32 }}>📸</span>
        <div
          style={{
            background: "hsl(0,0%,7%)", border: "1px solid hsl(0,0%,22%)",
            borderRadius: 10, padding: "16px", display: "flex",
            flexDirection: "column", gap: 10, width: "85%", maxWidth: 340,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span style={{ fontSize: 12, color: "hsl(0,0%,60%)", fontWeight: 500 }}>
            Cole a URL do Instagram (post, reel ou perfil)
          </span>
          <input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") { setShowUrlInput(false); setUrlValue(shape.props.url || ""); }
            }}
            placeholder="https://instagram.com/usuario ou /p/..."
            autoFocus
            style={{
              width: "100%", background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,25%)",
              borderRadius: 6, padding: "8px 10px", color: "hsl(0,0%,90%)", fontSize: 12, outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {shape.props.url && (
              <button
                onClick={() => { setShowUrlInput(false); setUrlValue(shape.props.url); }}
                style={{
                  background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,25%)",
                  borderRadius: 6, padding: "5px 14px", color: "hsl(0,0%,60%)", fontSize: 11, cursor: "pointer",
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
                fontSize: 11, cursor: urlValue.trim() ? "pointer" : "not-allowed", fontWeight: 500,
              }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </HTMLContainer>
    );
  }

  // Build embed URL based on type
  let embedSrc = "";
  if (parsed.type === "post" && parsed.id) {
    embedSrc = `https://www.instagram.com/p/${parsed.id}/embed`;
  } else if (parsed.type === "profile" && parsed.username) {
    embedSrc = `https://www.instagram.com/${parsed.username}/embed`;
  }

  return (
    <HTMLContainer style={{
      width: shape.props.w, height: shape.props.h,
      borderRadius: 12, overflow: "visible", pointerEvents: "all", position: "relative",
    }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", position: "relative" }}>
        <iframe
          src={embedSrc}
          width="100%" height="100%"
          style={{ border: "none" }}
          allowFullScreen
        />
        <ShapeOverlay shapeId={shape.id} />
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
      <SourceDot shapeId={shape.id} shapeType="instagram" />
    </HTMLContainer>
  );
}
