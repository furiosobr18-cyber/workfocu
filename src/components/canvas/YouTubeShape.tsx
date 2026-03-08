import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  RecordProps,
} from "tldraw";

export type YouTubeShape = TLBaseShape<
  "youtube",
  {
    w: number;
    h: number;
    url: string;
  }
>;

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export class YouTubeShapeUtil extends BaseBoxShapeUtil<YouTubeShape> {
  static override type = "youtube" as const;

  static override props: RecordProps<YouTubeShape> = {
    w: T.number,
    h: T.number,
    url: T.string,
  };

  getDefaultProps(): YouTubeShape["props"] {
    return {
      w: 480,
      h: 300,
      url: "",
    };
  }

  override canResize() {
    return true;
  }

  override canBind() {
    return true;
  }

  override onResize(shape: YouTubeShape, info: TLResizeInfo<YouTubeShape>) {
    return resizeBox(shape, info);
  }

  component(shape: YouTubeShape) {
    const videoId = getYouTubeId(shape.props.url);

    if (!videoId && !shape.props.url) {
      return (
        <HTMLContainer
          style={{
            width: shape.props.w,
            height: shape.props.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1a1a2e",
            borderRadius: 12,
            border: "2px dashed #444",
            color: "#888",
            fontSize: 14,
            flexDirection: "column",
            gap: 8,
            pointerEvents: "all",
          }}
        >
          <span style={{ fontSize: 32 }}>🎬</span>
          <span>Clique duas vezes para adicionar URL do YouTube</span>
        </HTMLContainer>
      );
    }

    if (!videoId) {
      return (
        <HTMLContainer
          style={{
            width: shape.props.w,
            height: shape.props.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1a1a2e",
            borderRadius: 12,
            border: "2px solid #f44",
            color: "#f88",
            fontSize: 14,
          }}
        >
          URL inválida do YouTube
        </HTMLContainer>
      );
    }

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: 12,
          overflow: "hidden",
          pointerEvents: "all",
          position: "relative",
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          width="100%"
          height="100%"
          style={{ border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {/* Connection indicators */}
        <div
          style={{
            position: "absolute",
            right: -6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#4a4aff",
            border: "2px solid #fff",
            boxShadow: "0 0 6px rgba(74,74,255,0.6)",
            cursor: "crosshair",
            zIndex: 10,
          }}
          title="Arraste uma seta daqui para o Chat"
        />
        <div
          style={{
            position: "absolute",
            left: -6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#4a4aff",
            border: "2px solid #fff",
            boxShadow: "0 0 6px rgba(74,74,255,0.6)",
            cursor: "crosshair",
            zIndex: 10,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#4a4aff",
            border: "2px solid #fff",
            boxShadow: "0 0 6px rgba(74,74,255,0.6)",
            cursor: "crosshair",
            zIndex: 10,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#4a4aff",
            border: "2px solid #fff",
            boxShadow: "0 0 6px rgba(74,74,255,0.6)",
            cursor: "crosshair",
            zIndex: 10,
          }}
        />
      </HTMLContainer>
    );
  }

  indicator(shape: YouTubeShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
    );
  }

  override onDoubleClick = (shape: YouTubeShape) => {
    const url = window.prompt("Cole a URL do YouTube:", shape.props.url);
    if (url !== null) {
      this.editor.updateShape<YouTubeShape>({
        id: shape.id,
        type: "youtube",
        props: { url },
      });
    }
  };
}
