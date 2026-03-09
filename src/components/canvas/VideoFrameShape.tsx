import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
} from "tldraw";
import { SourceDot } from "./YouTubeShape";

export type VideoFrameShape = TLBaseShape<
  "video-frame",
  {
    w: number;
    h: number;
    src: string;
    name: string;
    borderRadius: number;
    opacity: number;
  }
>;

export class VideoFrameShapeUtil extends BaseBoxShapeUtil<VideoFrameShape> {
  static override type = "video-frame" as const;

  static override props: RecordProps<VideoFrameShape> = {
    w: T.number,
    h: T.number,
    src: T.string,
    name: T.string,
    borderRadius: T.number,
    opacity: T.number,
  };

  getDefaultProps(): VideoFrameShape["props"] {
    return {
      w: 420,
      h: 280,
      src: "",
      name: "",
      borderRadius: 12,
      opacity: 1,
    };
  }

  override canResize() {
    return true;
  }

  override canBind() {
    return true;
  }

  override onResize(shape: VideoFrameShape, info: TLResizeInfo<VideoFrameShape>) {
    return resizeBox(shape, info);
  }

  component(shape: VideoFrameShape) {
    const hasVideo = Boolean(shape.props.src);

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
          position: "relative",
          overflow: "visible",
          opacity: shape.props.opacity,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "1.5px solid hsl(var(--border))",
            borderRadius: shape.props.borderRadius,
            overflow: "hidden",
            background: "hsl(var(--muted))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {hasVideo ? (
            <video
              src={shape.props.src}
              controls
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: "hsl(var(--muted-foreground))" }}
              aria-hidden="true"
            >
              <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <SourceDot shapeId={shape.id} shapeType="video-frame" />
      </HTMLContainer>
    );
  }

  indicator(shape: VideoFrameShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={shape.props.borderRadius}
        ry={shape.props.borderRadius}
      />
    );
  }

  override onDoubleClick = (shape: VideoFrameShape) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        this.editor.updateShape<VideoFrameShape>({
          id: shape.id,
          type: "video-frame",
          props: { src, name: file.name },
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
}
