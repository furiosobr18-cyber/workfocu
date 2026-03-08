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

  // Listen for clicks on connection dots
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Source dot clicked (YouTube/Image/File)
      const sourceId = target.getAttribute("data-connection-source");
      const sourceType = target.getAttribute("data-connection-type");
      if (sourceId && sourceType) {
        e.stopPropagation();
        e.preventDefault();
        startLinking(sourceId, sourceType);
        return;
      }

      // Target dot clicked (Chat)
      const targetId = target.getAttribute("data-connection-target");
      if (targetId && linkingFrom) {
        e.stopPropagation();
        e.preventDefault();
        completeLinking(targetId);
        return;
      }

      // Click elsewhere while linking → cancel
      if (linkingFrom && !sourceId && !targetId) {
        cancelLinking();
      }
    };

    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [startLinking, completeLinking, cancelLinking, linkingFrom]);

  // Inject shape info as data attributes for the AI context
  useEffect(() => {
    if (!editor) return;
    const interval = setInterval(() => {
      const shapes = editor.getCurrentPageShapes();
      // Remove old markers
      document.querySelectorAll("[data-shape-info-id]").forEach((el) => el.remove());

      for (const shape of shapes) {
        let info = "";
        if (shape.type === "youtube") {
          const url = (shape.props as any).url;
          if (url) info = `[YouTube] URL: ${url}`;
        } else if (shape.type === "canvas-image") {
          const name = (shape.props as any).name;
          if (name) info = `[Imagem] Arquivo: ${name}`;
        } else if (shape.type === "canvas-file") {
          const name = (shape.props as any).name;
          const fileType = (shape.props as any).fileType;
          if (name) info = `[Arquivo] Nome: ${name}, Tipo: ${fileType}`;
        }
        if (info) {
          const marker = document.createElement("div");
          marker.setAttribute("data-shape-info-id", shape.id);
          marker.setAttribute("data-shape-info", info);
          marker.style.display = "none";
          document.body.appendChild(marker);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
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
