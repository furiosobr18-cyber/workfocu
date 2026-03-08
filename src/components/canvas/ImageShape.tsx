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

export type ImageShape = TLBaseShape<
  "canvas-image",
  {
    w: number;
    h: number;
    src: string;
    name: string;
  }
>;

export class ImageShapeUtil extends BaseBoxShapeUtil<ImageShape> {
  static override type = "canvas-image" as const;

  static override props: RecordProps<ImageShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string,
  };

  getDefaultProps(): ImageShape["props"] {
    return { w: 300, h: 200, src: "", name: "" };
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
          background: "#1a1a2e", borderRadius: 12, border: "2px dashed #444",
          color: "#888", fontSize: 14, flexDirection: "column", gap: 8,
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
        borderRadius: 12, overflow: "visible", pointerEvents: "all", position: "relative",
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden" }}>
          <img
            src={shape.props.src} alt={shape.props.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        </div>
        <SourceDot shapeId={shape.id} shapeType="canvas-image" />
      </HTMLContainer>
    );
  }

  indicator(shape: ImageShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
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
