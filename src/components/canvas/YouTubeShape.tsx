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
      ? { right: -8, left: "auto" as const }
      : { left: -8, right: "auto" as const };

  return (
    <div
      data-connection-source={shapeId}
      data-connection-type={shapeType}
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        ...posStyle,
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 40%, #4af 100%)",
        border: "2px solid #4af",
        boxShadow: "0 0 10px rgba(68,170,255,0.6), 0 0 20px rgba(68,170,255,0.2)",
        cursor: "pointer",
        zIndex: 20,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1.3)";
        (e.target as HTMLElement).style.boxShadow =
          "0 0 14px rgba(68,170,255,0.8), 0 0 28px rgba(68,170,255,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1)";
        (e.target as HTMLElement).style.boxShadow =
          "0 0 10px rgba(68,170,255,0.6), 0 0 20px rgba(68,170,255,0.2)";
      }}
      title="Clique para conectar ao Chat"
    />
  );
}

export function TargetDot({ shapeId }: { shapeId: string }) {
  return (
    <div
      data-connection-target={shapeId}
      style={{
        position: "absolute",
        left: -8,
        top: "50%",
        transform: "translateY(-50%)",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 40%, #a040ff 100%)",
        border: "2px solid #a040ff",
        boxShadow: "0 0 10px rgba(160,64,255,0.6), 0 0 20px rgba(160,64,255,0.2)",
        cursor: "pointer",
        zIndex: 20,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1.3)";
        (e.target as HTMLElement).style.boxShadow =
          "0 0 14px rgba(160,64,255,0.8), 0 0 28px rgba(160,64,255,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.transform = "translateY(-50%) scale(1)";
        (e.target as HTMLElement).style.boxShadow =
          "0 0 10px rgba(160,64,255,0.6), 0 0 20px rgba(160,64,255,0.2)";
      }}
      title="Clique para receber conexão"
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
    const videoId = getYouTubeId(shape.props.url);

    if (!videoId && !shape.props.url) {
      return (
        <HTMLContainer style={{
          width: shape.props.w, height: shape.props.h,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#1a1a2e", borderRadius: 12, border: "2px dashed #444",
          color: "#888", fontSize: 14, flexDirection: "column", gap: 8,
          pointerEvents: "all", position: "relative",
        }}>
          <SourceDot shapeId={shape.id} shapeType="youtube" />
          <span style={{ fontSize: 32 }}>🎬</span>
          <span>Clique duas vezes para adicionar URL do YouTube</span>
        </HTMLContainer>
      );
    }

    if (!videoId) {
      return (
        <HTMLContainer style={{
          width: shape.props.w, height: shape.props.h,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#1a1a2e", borderRadius: 12, border: "2px solid #f44",
          color: "#f88", fontSize: 14, position: "relative", pointerEvents: "all",
        }}>
          <SourceDot shapeId={shape.id} shapeType="youtube" />
          URL inválida do YouTube
        </HTMLContainer>
      );
    }

    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        borderRadius: 12, overflow: "visible", pointerEvents: "all", position: "relative",
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: 12, overflow: "hidden",
        }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            width="100%" height="100%"
            style={{ border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <SourceDot shapeId={shape.id} shapeType="youtube" />
      </HTMLContainer>
    );
  }

  indicator(shape: YouTubeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
  }

  override onDoubleClick = (shape: YouTubeShape) => {
    const url = window.prompt("Cole a URL do YouTube:", shape.props.url);
    if (url !== null) {
      this.editor.updateShape<YouTubeShape>({
        id: shape.id, type: "youtube", props: { url },
      });
    }
  };
}
