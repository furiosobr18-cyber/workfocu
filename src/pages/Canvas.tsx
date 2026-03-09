import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { useCanvasPersistence } from "@/hooks/useCanvasPersistence";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, Undo2, Redo2, Save, Cloud, CloudOff } from "lucide-react";
import { YouTubeShapeUtil } from "@/components/canvas/YouTubeShape";
import { TikTokShapeUtil } from "@/components/canvas/TikTokShape";
import { InstagramShapeUtil } from "@/components/canvas/InstagramShape";
import { ImageShapeUtil } from "@/components/canvas/ImageShape";
import { FileShapeUtil } from "@/components/canvas/FileShape";
import { ChatShapeUtil } from "@/components/canvas/ChatShape";
import { VideoShapeUtil } from "@/components/canvas/VideoShape";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";
import TextPanel from "@/components/canvas/TextPanel";
import { ConnectionProvider, useConnections } from "@/components/canvas/ConnectionContext";
import ConnectionOverlay from "@/components/canvas/ConnectionOverlay";
import { ImageFrameTool } from "@/components/canvas/ImageFrameTool";
import { VideoFrameTool } from "@/components/canvas/VideoFrameTool";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const customShapeUtils = [YouTubeShapeUtil, TikTokShapeUtil, InstagramShapeUtil, ImageShapeUtil, FileShapeUtil, ChatShapeUtil, VideoShapeUtil];
const customTools = [ImageFrameTool, VideoFrameTool];

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
  const { startLinking, completeLinking, linkingFrom, cancelLinking, setCurrentPageId } = useConnections();
  
  const { 
    isSaving, 
    lastSaved, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    saveNow 
  } = useCanvasPersistence(editor);

  // Force re-render for undo/redo state
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    if (!editor) return;
    const unsub = editor.store.listen(() => {
      forceUpdate({});
    });
    return () => unsub();
  }, [editor]);

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor);
  }, []);

  // Sync current tldraw page to connection context
  useEffect(() => {
    if (!editor) return;
    const updatePage = () => {
      const pageId = editor.getCurrentPageId();
      setCurrentPageId(pageId);
    };
    updatePage();
    const interval = setInterval(updatePage, 500);
    return () => clearInterval(interval);
  }, [editor, setCurrentPageId]);

  // Drag-to-connect: mousedown on source dot → drag wire → mouseup on target dot
  useEffect(() => {
    let linkStartTime = 0;

    const handleDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      const sourceId = target.getAttribute("data-connection-source");
      const sourceType = target.getAttribute("data-connection-type");
      if (sourceId && sourceType) {
        e.stopPropagation();
        e.preventDefault();
        startLinking(sourceId, sourceType);
        linkStartTime = Date.now();
        return;
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (!linkingFrom) return;

      if (Date.now() - linkStartTime < 200) return;

      const target = e.target as HTMLElement;

      if (target.getAttribute("data-connection-source")) return;

      const targetId = target.getAttribute("data-connection-target");
      if (targetId) {
        e.stopPropagation();
        e.preventDefault();
        completeLinking(targetId);
      } else {
        cancelLinking();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!linkingFrom) return;
      if (Date.now() - linkStartTime < 200) return;

      const target = e.target as HTMLElement;
      const targetId = target.getAttribute("data-connection-target");
      if (targetId) {
        e.stopPropagation();
        e.preventDefault();
        completeLinking(targetId);
      }
    };

    document.addEventListener("pointerdown", handleDown, true);
    document.addEventListener("pointerup", handleUp, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("pointerdown", handleDown, true);
      document.removeEventListener("pointerup", handleUp, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [startLinking, completeLinking, cancelLinking, linkingFrom]);

  // Keep connected source data available to Chat (without polling DOM attributes)
  useEffect(() => {
    if (!editor) return;

    const updateSourceData = () => {
      const shapes = editor.getCurrentPageShapes();
      const shapeData: Record<string, any> = {};

      for (const shape of shapes) {
        if (shape.type === "youtube" || shape.type === "tiktok" || shape.type === "instagram") {
          const url = (shape.props as any).url || "";
          shapeData[shape.id] = { type: shape.type, url };
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

  const editorCanUndo = editor?.getCanUndo() ?? false;
  const editorCanRedo = editor?.getCanRedo() ?? false;

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {sidebarOpen && <SidebarNav />}
        <main className="flex-1 relative">
          {/* Top left controls */}
          <div className="absolute top-14 left-2 z-[500] flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-background/80 backdrop-blur-sm shadow-sm border border-border hover:bg-accent"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </Button>
            
            {/* Undo/Redo buttons */}
            <div className="flex items-center gap-0.5 bg-background/80 backdrop-blur-sm shadow-sm border border-border rounded-md p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={undo}
                    disabled={!editorCanUndo}
                    className="h-8 w-8 hover:bg-accent disabled:opacity-40"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Desfazer (Ctrl+Z)</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={redo}
                    disabled={!editorCanRedo}
                    className="h-8 w-8 hover:bg-accent disabled:opacity-40"
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Refazer (Ctrl+Y)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Save status indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm shadow-sm border border-border rounded-md px-2 py-1.5">
                  {isSaving ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground">Salvando...</span>
                    </>
                  ) : lastSaved ? (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs text-muted-foreground">Salvo</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">-</span>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {lastSaved ? (
                  <p>Último salvamento: {lastSaved.toLocaleTimeString()}</p>
                ) : (
                  <p>Salvamento automático ativo</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Linking mode banner */}
          {linkingFrom && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] bg-muted/90 text-foreground px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg animate-fade-in border border-border">
              <span className="animate-pulse">🔗</span>
              Arraste até a bolinha do Chat para conectar
              <button
                onClick={cancelLinking}
                className="ml-2 bg-accent hover:bg-accent/80 rounded px-2 py-0.5 text-xs text-muted-foreground"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="absolute inset-0 [&_.tlui-toolbar]:hidden [&_.tlui-style-panel]:hidden [&_.tlui-zoom-menu]:hidden [&_.tlui-navigation-zone]:hidden">
            <Tldraw
              shapeUtils={customShapeUtils}
              tools={customTools}
              onMount={handleMount}
              hideUi={false}
            />
          </div>
          <ConnectionOverlay editor={editor} />
          <TextPanel editor={editor} />
          <CanvasToolbar editor={editor} />
        </main>
      </div>
    </TooltipProvider>
  );
}

const Canvas = () => (
  <ConnectionProvider>
    <CanvasInner />
  </ConnectionProvider>
);

export default Canvas;
