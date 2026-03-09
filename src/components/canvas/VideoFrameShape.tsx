import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  RecordProps,
} from "tldraw";
import { SourceDot } from "./YouTubeShape";
import { useState } from "react";

const FIT_MODES = ["cover", "contain", "fill", "none"] as const;
const FIT_LABELS: Record<string, string> = {
  cover: "Cover",
  contain: "Fit",
  fill: "Stretch",
  none: "Original",
};

export type VideoFrameShape = TLBaseShape<
  "video-frame",
  {
    w: number;
    h: number;
    src: string;
    name: string;
    objectFit: string;
    borderRadius: number;
    label: string;
  }
>;

const LABEL_H = 28;

export class VideoFrameShapeUtil extends BaseBoxShapeUtil<VideoFrameShape> {
  static override type = "video-frame" as const;

  static override props: RecordProps<VideoFrameShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string,
    objectFit: T.string, borderRadius: T.number, label: T.string,
  };

  getDefaultProps(): VideoFrameShape["props"] {
    return { w: 420, h: 280, src: "", name: "", objectFit: "cover", borderRadius: 8, label: "Video Frame" };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: VideoFrameShape, info: TLResizeInfo<VideoFrameShape>) {
    return resizeBox(shape, info);
  }

  component(shape: VideoFrameShape) {
    const br = shape.props.borderRadius;
    const hasVideo = !!shape.props.src;

    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        pointerEvents: "all", position: "relative", overflow: "visible",
      }}>
        {/* Frame border */}
        <div style={{
          width: "100%", height: "100%",
          border: "2px solid hsl(var(--border))",
          borderRadius: br,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          background: "hsl(var(--card))",
        }}>
          {/* Label bar */}
          <FrameLabel shape={shape} />

          {/* Content area */}
          <div style={{
            flex: 1, position: "relative", overflow: "hidden",
            background: hasVideo ? "#000" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {hasVideo ? (
              <video
                src={shape.props.src}
                controls
                style={{
                  width: "100%", height: "100%",
                  objectFit: (shape.props.objectFit || "cover") as any,
                }}
                draggable={false}
              />
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                color: "hsl(var(--muted-foreground))", fontSize: 13,
              }}>
                <span style={{ fontSize: 28 }}>🎬</span>
                <span>Clique duas vezes para adicionar vídeo</span>
              </div>
            )}
          </div>
        </div>

        {/* Fit controls */}
        {hasVideo && <FitControls shape={shape} />}
        <SourceDot shapeId={shape.id} shapeType="video-frame" />
      </HTMLContainer>
    );
  }

  indicator(shape: VideoFrameShape) {
    const br = shape.props.borderRadius;
    return <rect width={shape.props.w} height={shape.props.h} rx={br} ry={br} />;
  }

  override onDoubleClick = (shape: VideoFrameShape) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          this.editor.updateShape<VideoFrameShape>({
            id: shape.id, type: "video-frame",
            props: { src, name: file.name, label: file.name },
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
}

function FrameLabel({ shape }: { shape: VideoFrameShape }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(shape.props.label);

  const save = () => {
    const editor = (window as any).__tldrawEditor;
    if (editor && val.trim()) {
      editor.updateShape({
        id: shape.id, type: "video-frame", props: { label: val.trim() },
      });
    }
    setEditing(false);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); setVal(shape.props.label); }}
      style={{
        height: LABEL_H, minHeight: LABEL_H,
        display: "flex", alignItems: "center", padding: "0 10px",
        borderBottom: "1px solid hsl(var(--border))",
        background: "hsl(var(--muted))",
        fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))",
        gap: 6, userSelect: "none",
      }}
    >
      <span style={{ fontSize: 14 }}>🎬</span>
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", padding: 0,
          }}
        />
      ) : (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shape.props.label}
        </span>
      )}
    </div>
  );
}

function FitControls({ shape }: { shape: VideoFrameShape }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: "absolute", top: -32, right: 0, zIndex: 10,
        display: "flex", gap: 2, pointerEvents: "all",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
            borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer",
            color: "hsl(var(--foreground))", whiteSpace: "nowrap",
          }}
        >
          {FIT_LABELS[shape.props.objectFit] || "Cover"} ▾
        </button>
      ) : (
        <div style={{
          display: "flex", gap: 2, background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))", borderRadius: 6, padding: 2,
        }}>
          {FIT_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => {
                const editor = (window as any).__tldrawEditor;
                if (editor) {
                  editor.updateShape({
                    id: shape.id, type: "video-frame", props: { objectFit: mode },
                  });
                }
                setOpen(false);
              }}
              style={{
                padding: "2px 6px", fontSize: 11, borderRadius: 4, cursor: "pointer",
                border: "none",
                background: shape.props.objectFit === mode ? "hsl(var(--accent))" : "transparent",
                color: "hsl(var(--foreground))",
              }}
            >
              {FIT_LABELS[mode]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
