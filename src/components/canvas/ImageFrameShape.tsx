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
import LayoutPanel from "./LayoutPanel";

export type ImageFrameShape = TLBaseShape<
  "image-frame",
  {
    w: number;
    h: number;
    src: string;
    name: string;
    objectFit: string;
    borderRadius: number;
    opacity: number;
    padding: number;
    alignX: string;
    alignY: string;
    overflow: string;
    bgColor: string;
    label: string;
  }
>;

const LABEL_H = 28;

export class ImageFrameShapeUtil extends BaseBoxShapeUtil<ImageFrameShape> {
  static override type = "image-frame" as const;

  static override props: RecordProps<ImageFrameShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string,
    objectFit: T.string, borderRadius: T.number, opacity: T.number,
    padding: T.number, alignX: T.string, alignY: T.string,
    overflow: T.string, bgColor: T.string, label: T.string,
  };

  getDefaultProps(): ImageFrameShape["props"] {
    return {
      w: 340, h: 240, src: "", name: "",
      objectFit: "cover", borderRadius: 8, opacity: 1,
      padding: 0, alignX: "center", alignY: "center",
      overflow: "hidden", bgColor: "transparent", label: "Image Frame",
    };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: ImageFrameShape, info: TLResizeInfo<ImageFrameShape>) {
    return resizeBox(shape, info);
  }

  component(shape: ImageFrameShape) {
    const { borderRadius: br, padding, alignX, alignY, overflow, bgColor, opacity, objectFit } = shape.props;
    const hasImage = !!shape.props.src;

    const justifyMap: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end" };
    const alignMap: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end" };

    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        pointerEvents: "all", position: "relative", overflow: "visible",
        opacity,
      }}>
        {/* Frame */}
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
            flex: 1, position: "relative",
            overflow: overflow as any,
            background: bgColor || "transparent",
            padding,
            display: "flex",
            justifyContent: justifyMap[alignX] || "center",
            alignItems: alignMap[alignY] || "center",
          }}>
            {hasImage ? (
              <img
                src={shape.props.src}
                alt={shape.props.name}
                style={{
                  width: objectFit === "none" ? "auto" : "100%",
                  height: objectFit === "none" ? "auto" : "100%",
                  objectFit: (objectFit || "cover") as any,
                  maxWidth: "100%", maxHeight: "100%",
                }}
                draggable={false}
              />
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                color: "hsl(var(--muted-foreground))", fontSize: 13,
              }}>
                <span style={{ fontSize: 28 }}>🖼️</span>
                <span>Clique duas vezes para adicionar imagem</span>
              </div>
            )}
          </div>
        </div>

        {/* Layout Panel */}
        <LayoutPanel
          shapeId={shape.id}
          shapeType="image-frame"
          padding={padding}
          borderRadius={br}
          objectFit={objectFit}
          alignX={alignX}
          alignY={alignY}
          overflow={overflow}
          opacity={opacity}
          bgColor={bgColor}
        />

        <SourceDot shapeId={shape.id} shapeType="image-frame" />
      </HTMLContainer>
    );
  }

  indicator(shape: ImageFrameShape) {
    const br = shape.props.borderRadius;
    return <rect width={shape.props.w} height={shape.props.h} rx={br} ry={br} />;
  }

  override onDoubleClick = (shape: ImageFrameShape) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          this.editor.updateShape<ImageFrameShape>({
            id: shape.id, type: "image-frame",
            props: { src, name: file.name, label: file.name },
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
}

function FrameLabel({ shape }: { shape: ImageFrameShape }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(shape.props.label);

  const save = () => {
    const editor = (window as any).__tldrawEditor;
    if (editor && val.trim()) {
      editor.updateShape({
        id: shape.id, type: "image-frame", props: { label: val.trim() },
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
      <span style={{ fontSize: 14 }}>🖼️</span>
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
