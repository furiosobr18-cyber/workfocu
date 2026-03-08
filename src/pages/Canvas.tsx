import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { YouTubeShapeUtil } from "@/components/canvas/YouTubeShape";
import { ImageShapeUtil } from "@/components/canvas/ImageShape";
import { FileShapeUtil } from "@/components/canvas/FileShape";
import { ChatShapeUtil } from "@/components/canvas/ChatShape";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import { ConnectionProvider, useConnections } from "@/components/canvas/ConnectionContext";
import ConnectionOverlay from "@/components/canvas/ConnectionOverlay";

const customShapeUtils = [YouTubeShapeUtil, ImageShapeUtil, FileShapeUtil, ChatShapeUtil];

function isTextLikeMime(fileType: string): boolean {
  const t = (fileType || "").toLowerCase();
  return (
    t.startsWith("text/") ||
    t.includes("json") ||
    t.includes("xml") ||
    t.includes("csv") ||
    t.includes("javascript") ||
    t.includes("markdown")
  );
}

function dataUrlToTextSnippet(dataUrl: string, maxChars = 4000): string {
  try {
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) return "";

    const isBase64 = Boolean(match[2]);
    const payload = match[3] || "";
    const decoded = isBase64 ? atob(payload) : decodeURIComponent(payload);
    return decoded.slice(0, maxChars);
  } catch {
    return "";
  }
}

function CanvasInner() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const { startLinking, completeLinking, linkingFrom, cancelLinking } = useConnections();

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor);
  }, []);

  // Drag-to-connect: mousedown on source dot → drag wire → mouseup on target dot
  useEffect(() => {
    const handleDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      // Source dot: start dragging wire
      const sourceId = target.getAttribute("data-connection-source");
      const sourceType = target.getAttribute("data-connection-type");
      if (sourceId && sourceType) {
        e.stopPropagation();
        e.preventDefault();
        startLinking(sourceId, sourceType);
        return;
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (!linkingFrom) return;

      const target = e.target as HTMLElement;
      const targetId = target.getAttribute("data-connection-target");
      if (targetId) {
        e.stopPropagation();
        e.preventDefault();
        completeLinking(targetId);
      } else {
        cancelLinking();
      }
    };

    document.addEventListener("pointerdown", handleDown, true);
    document.addEventListener("pointerup", handleUp, true);
    return () => {
      document.removeEventListener("pointerdown", handleDown, true);
      document.removeEventListener("pointerup", handleUp, true);
    };
  }, [startLinking, completeLinking, cancelLinking, linkingFrom]);

  // Keep connected source data available to Chat (without polling DOM attributes)
  useEffect(() => {
    if (!editor) return;

    const updateSourceData = () => {
      const shapes = editor.getCurrentPageShapes();
      const shapeData: Record<string, any> = {};

      for (const shape of shapes) {
        if (shape.type === "youtube") {
          const url = (shape.props as any).url || "";
          shapeData[shape.id] = { type: "youtube", url };
        } else if (shape.type === "canvas-image") {
          const name = (shape.props as any).name || "imagem";
          const src = (shape.props as any).src || "";
          shapeData[shape.id] = { type: "canvas-image", name, src };
        } else if (shape.type === "canvas-file") {
          const name = (shape.props as any).name || "arquivo";
          const fileType = (shape.props as any).fileType || "";
          const src = (shape.props as any).src || "";

          shapeData[shape.id] = {
            type: "canvas-file",
            name,
            fileType,
            textSnippet: isTextLikeMime(fileType) && src ? dataUrlToTextSnippet(src) : "",
          };
        }
      }

      (window as any).__canvasShapeData = shapeData;
    };

    updateSourceData();
    const interval = setInterval(updateSourceData, 300);
    return () => {
      clearInterval(interval);
      (window as any).__canvasShapeData = {};
    };
  }, [editor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && <SidebarNav />}
      <main className="flex-1 relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-14 left-2 z-[500] bg-background/80 backdrop-blur-sm shadow-sm border border-border hover:bg-accent"
        >
          {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </Button>

        {/* Linking mode banner */}
        {linkingFrom && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] bg-purple-600/90 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg animate-fade-in">
            <span className="animate-pulse">🔗</span>
            Clique na bolinha roxa do Chat para conectar
            <button
              onClick={cancelLinking}
              className="ml-2 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="absolute inset-0">
          <Tldraw shapeUtils={customShapeUtils} onMount={handleMount} />
        </div>
        <ConnectionOverlay editor={editor} />
        <CanvasToolbar editor={editor} />
      </main>
    </div>
  );
}

const Canvas = () => (
  <ConnectionProvider>
    <CanvasInner />
  </ConnectionProvider>
);

export default Canvas;
