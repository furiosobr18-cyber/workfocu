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

export type ImageShape = TLBaseShape<
  "canvas-image",
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

export class ImageShapeUtil extends BaseBoxShapeUtil<ImageShape> {
  static override type = "canvas-image" as const;

  static override props: RecordProps<ImageShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string,
    objectFit: T.string, borderRadius: T.number, opacity: T.number,
  };

  getDefaultProps(): ImageShape["props"] {
    return { w: 300, h: 200, src: "", name: "", objectFit: "cover", borderRadius: 12, opacity: 1 };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: ImageShape, info: TLResizeInfo<ImageShape>) {
    return resizeBox(shape, info);
  }

  component(shape: ImageShape) {
    if (!shape.props.src) {
      return (
        <HTMLContainer style={{
          width: shape.props.w, height: shape.props.h,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "hsl(var(--card))", borderRadius: shape.props.borderRadius,
          border: "2px dashed hsl(var(--border))",
          color: "hsl(var(--muted-foreground))", fontSize: 14, flexDirection: "column", gap: 8,
          pointerEvents: "all", position: "relative",
        }}>
          <SourceDot shapeId={shape.id} shapeType="canvas-image" />
          <span style={{ fontSize: 32 }}>🖼️</span>
          <span>Clique duas vezes para adicionar imagem</span>
        </HTMLContainer>
      );
    }

    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        borderRadius: shape.props.borderRadius, overflow: "visible",
        pointerEvents: "all", position: "relative",
        opacity: shape.props.opacity,
      }}>
        <div style={{
          width: "100%", height: "100%",
          borderRadius: shape.props.borderRadius, overflow: "hidden",
        }}>
          <img
            src={shape.props.src} alt={shape.props.name}
            style={{
              width: "100%", height: "100%",
              objectFit: (shape.props.objectFit || "cover") as any,
            }}
            draggable={false}
          />
        </div>
        <FitControls shape={shape} />
        <SourceDot shapeId={shape.id} shapeType="canvas-image" />
      </HTMLContainer>
    );
  }

  indicator(shape: ImageShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={shape.props.borderRadius} ry={shape.props.borderRadius} />;
  }

  override onDoubleClick = (shape: ImageShape) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          this.editor.updateShape<ImageShape>({
            id: shape.id, type: "canvas-image", props: { src, name: file.name },
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
}

function FitControls({ shape }: { shape: ImageShape }) {
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
                    id: shape.id, type: "canvas-image", props: { objectFit: mode },
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
