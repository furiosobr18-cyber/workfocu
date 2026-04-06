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
import { ShapeOverlay } from "./ShapeOverlay";
import { useState } from "react";

const FIT_MODES = ["cover", "contain", "fill", "none"] as const;
const FIT_LABELS: Record<string, string> = {
  cover: "Cover",
  contain: "Fit",
  fill: "Stretch",
  none: "Original",
};

export type VideoShape = TLBaseShape<
  "canvas-video",
  {
    w: number;
    h: number;
    src: string;
    name: string;
    objectFit: string;
    borderRadius: number;
    opacity: number;
  }
>;

export class VideoShapeUtil extends BaseBoxShapeUtil<VideoShape> {
  static override type = "canvas-video" as const;

  static override props: RecordProps<VideoShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string,
    objectFit: T.string, borderRadius: T.number, opacity: T.number,
  };

  getDefaultProps(): VideoShape["props"] {
    return { w: 400, h: 260, src: "", name: "", objectFit: "cover", borderRadius: 12, opacity: 1 };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: VideoShape, info: TLResizeInfo<VideoShape>) {
    return resizeBox(shape, info);
  }

  component(shape: VideoShape) {
    const br = shape.props.borderRadius;

    if (!shape.props.src) {
      return (
        <HTMLContainer style={{
          width: shape.props.w, height: shape.props.h,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "hsl(var(--card))", borderRadius: br, border: "2px dashed hsl(var(--border))",
          color: "hsl(var(--muted-foreground))", fontSize: 14, flexDirection: "column", gap: 8,
          pointerEvents: "all", position: "relative",
        }}>
          <SourceDot shapeId={shape.id} shapeType="canvas-video" />
          <span style={{ fontSize: 32 }}>🎬</span>
          <span>Clique duas vezes para adicionar vídeo</span>
        </HTMLContainer>
      );
    }

    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        borderRadius: br, overflow: "visible", pointerEvents: "all", position: "relative",
        opacity: shape.props.opacity,
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: br, overflow: "hidden", background: "#000" }}>
          <video
            src={shape.props.src}
            controls
            style={{
              width: "100%", height: "100%",
              objectFit: (shape.props.objectFit || "cover") as any,
            }}
            draggable={false}
          />
        </div>
        <FitControls shape={shape} />
        <SourceDot shapeId={shape.id} shapeType="canvas-video" />
      </HTMLContainer>
    );
  }

  indicator(shape: VideoShape) {
    const br = shape.props.borderRadius;
    return <rect width={shape.props.w} height={shape.props.h} rx={br} ry={br} />;
  }

  override onDoubleClick = (shape: VideoShape) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          this.editor.updateShape<VideoShape>({
            id: shape.id, type: "canvas-video", props: { src, name: file.name },
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
}

function FitControls({ shape }: { shape: VideoShape }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: "absolute", top: -36, left: 0, zIndex: 10,
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
                    id: shape.id, type: "canvas-video", props: { objectFit: mode },
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
