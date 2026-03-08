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

export type FileShape = TLBaseShape<
  "canvas-file",
  {
    w: number;
    h: number;
    src: string;
    name: string;
    fileType: string;
  }
>;

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
  ppt: "📽️", pptx: "📽️", txt: "📃", zip: "📦", rar: "📦",
  mp3: "🎵", wav: "🎵", mp4: "🎥", mov: "🎥", default: "📎",
};

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

export class FileShapeUtil extends BaseBoxShapeUtil<FileShape> {
  static override type = "canvas-file" as const;

  static override props: RecordProps<FileShape> = {
    w: T.number, h: T.number, src: T.string, name: T.string, fileType: T.string,
  };

  getDefaultProps(): FileShape["props"] {
    return { w: 220, h: 80, src: "", name: "", fileType: "" };
  }

  override canResize() { return true; }
  override canBind() { return true; }

  override onResize(shape: FileShape, info: TLResizeInfo<FileShape>) {
    return resizeBox(shape, info);
  }

  component(shape: FileShape) {
    if (!shape.props.name) {
      return (
        <HTMLContainer style={{
          width: shape.props.w, height: shape.props.h,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#1a1a2e", borderRadius: 12, border: "2px dashed #444",
          color: "#888", fontSize: 13, gap: 8, pointerEvents: "all", position: "relative",
        }}>
          <SourceDot shapeId={shape.id} shapeType="canvas-file" />
          <span style={{ fontSize: 24 }}>📎</span>
          <span>Clique 2x para anexar arquivo</span>
        </HTMLContainer>
      );
    }

    return (
      <HTMLContainer style={{
        width: shape.props.w, height: shape.props.h,
        display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
        background: "#1e1e30", borderRadius: 12, border: "1px solid #333",
        color: "#e0e0e0", fontSize: 13, pointerEvents: "all", position: "relative",
      }}>
        <SourceDot shapeId={shape.id} shapeType="canvas-file" />
        <span style={{ fontSize: 28 }}>{getFileIcon(shape.props.name)}</span>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {shape.props.name}
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>{shape.props.fileType || "Arquivo"}</div>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: FileShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
  }

  override onDoubleClick = (shape: FileShape) => {
    if (shape.props.name) return;
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          this.editor.updateShape<FileShape>({
            id: shape.id, type: "canvas-file",
            props: { src, name: file.name, fileType: file.type },
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
}
