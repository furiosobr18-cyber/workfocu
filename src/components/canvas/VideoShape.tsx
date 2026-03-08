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

export type VideoShape = TLBaseShape<
  "canvas-video",
  {
    w: number;
    h: number;
    src: string;
    name: string;
  }
>;

export class VideoShapeUtil extends BaseBoxShapeUtil<VideoShape> {
  static override type = "canvas-video" as const;

  static override props: RecordProps<VideoShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string,
  };

  getDefaultProps(): VideoShape["props"] {
    return { w: 400, h: 260, src: "", name: "" };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: VideoShape, info: TLResizeInfo<VideoShape>) {
    return resizeBox(shape, info);
  }

  component(shape: VideoShape) {
    if (!shape.props.src) {
      return (
        <HTMLContainer style={{
          width: shape.props.w, height: shape.props.h,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "hsl(var(--card))", borderRadius: 12, border: "2px dashed hsl(var(--border))",
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
        borderRadius: 12, overflow: "visible", pointerEvents: "all", position: "relative",
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
          <video
            src={shape.props.src}
            controls
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            draggable={false}
          />
        </div>
        <SourceDot shapeId={shape.id} shapeType="canvas-video" />
      </HTMLContainer>
    );
  }

  indicator(shape: VideoShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
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
