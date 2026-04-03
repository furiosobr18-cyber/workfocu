import { Button } from "@/components/ui/button";
import { Youtube, Image, FileUp, MessageSquare, MousePointer2, Hand, Pen, Sun, Moon, Grid3X3, Frame, Video, Music2, Instagram, Type, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown, Layers, Files, Plus, Trash2 } from "lucide-react";
import { Editor, TLPageId, createShapeId } from "tldraw";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";

function SocialDrawer({ addShape }: { addShape: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  const items = [
    { type: "instagram", icon: Instagram, title: "Instagram", color: "text-pink-400" },
    { type: "tiktok", icon: Music2, title: "TikTok", color: "text-cyan-400" },
  ];

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={() => addShape("youtube")}
        title="YouTube"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Youtube className="w-4 h-4 text-destructive" />
      </button>
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-col items-center gap-0.5 bg-card border border-border rounded-lg p-1 shadow-xl transition-all duration-200 origin-bottom"
        style={{
          opacity: open ? 1 : 0,
          transform: `translateX(-50%) scaleY(${open ? 1 : 0})`,
          pointerEvents: open ? "auto" : "none",
          maxHeight: open ? 200 : 0,
        }}
      >
        {items.map(({ type, icon: Icon, title, color }) => (
          <button
            key={type}
            onClick={() => { addShape(type); setOpen(false); }}
            title={title}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Icon className={`w-4 h-4 ${color}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function LayerDrawer({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  const hasSelection = editor.getSelectedShapeIds().length > 0;

  const actions = [
    { id: "front", icon: ArrowUpToLine, title: "Trazer para frente", action: () => editor.bringToFront(editor.getSelectedShapeIds()) },
    { id: "forward", icon: ArrowUp, title: "Avançar uma camada", action: () => editor.bringForward(editor.getSelectedShapeIds()) },
    { id: "backward", icon: ArrowDown, title: "Recuar uma camada", action: () => editor.sendBackward(editor.getSelectedShapeIds()) },
    { id: "back", icon: ArrowDownToLine, title: "Enviar para trás", action: () => editor.sendToBack(editor.getSelectedShapeIds()) },
  ];

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        title="Camadas"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Layers className="w-4 h-4" />
      </button>
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-col items-center gap-0.5 bg-card border border-border rounded-lg p-1 shadow-xl transition-all duration-200 origin-bottom"
        style={{
          opacity: open ? 1 : 0,
          transform: `translateX(-50%) scaleY(${open ? 1 : 0})`,
          pointerEvents: open ? "auto" : "none",
          maxHeight: open ? 300 : 0,
        }}
      >
        {actions.map(({ id, icon: Icon, title, action }) => (
          <button
            key={id}
            onClick={() => { if (hasSelection) action(); }}
            title={title}
            className={`p-2 rounded-lg transition-colors ${
              hasSelection
                ? "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                : "text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PagesDrawer({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [pages, setPages] = useState(editor.getPages());
  const [currentPageId, setCurrentPageId] = useState(editor.getCurrentPageId());

  useEffect(() => {
    const update = () => {
      setPages(editor.getPages());
      setCurrentPageId(editor.getCurrentPageId());
    };
    const unsub = editor.store.listen(update);
    return () => unsub();
  }, [editor]);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 300);
  };

  const addPage = () => {
    const id = `page:${Date.now()}` as TLPageId;
    editor.createPage({ name: `Página ${pages.length + 1}`, id });
    editor.setCurrentPage(id);
  };

  const deletePage = (pageId: TLPageId) => {
    if (pages.length <= 1) return;
    editor.deletePage(pageId);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        title="Páginas"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Files className="w-4 h-4" />
      </button>
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-col items-center gap-0.5 bg-card border border-border rounded-lg p-1.5 shadow-xl transition-all duration-200 origin-bottom min-w-[140px]"
        style={{
          opacity: open ? 1 : 0,
          transform: `translateX(-50%) scaleY(${open ? 1 : 0})`,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {pages.map((page) => (
          <div key={page.id} className="flex items-center w-full gap-1">
            <button
              onClick={() => editor.setCurrentPage(page.id)}
              className={`flex-1 px-2 py-1.5 rounded text-xs text-left truncate transition-colors ${
                currentPageId === page.id
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {page.name}
            </button>
            {pages.length > 1 && (
              <button
                onClick={() => deletePage(page.id)}
                title="Excluir página"
                className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addPage}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors mt-0.5 border-t border-border pt-1.5"
        >
          <Plus className="w-3 h-3" />
          Nova página
        </button>
      </div>
    </div>
  );
}

interface CanvasToolbarProps {
  editor: Editor | null;
}

const CanvasToolbar = ({ editor }: CanvasToolbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const [activeTool, setActiveTool] = useState<string>("select");
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (!editor) return;
    
    const updateState = () => {
      setZoomLevel(Math.round(editor.getZoomLevel() * 100));
      setActiveTool(editor.getCurrentToolId());
    };
    
    updateState();
    const unsubscribe = editor.store.listen(updateState);
    return () => unsubscribe();
  }, [editor]);

  if (!editor) return null;

  const selectTool = (tool: string) => {
    editor.setCurrentTool(tool);
  };

  const addShape = (type: string) => {
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    editor.createShape({
      type,
      x: point.x - 150,
      y: point.y - 100,
    });
  };

  const toolButtons = [
    { id: "select", icon: MousePointer2, title: "Selecionar" },
    { id: "hand", icon: Hand, title: "Mover" },
    { id: "draw", icon: Pen, title: "Desenhar" },
    { id: "frame", icon: Frame, title: "Frame (Layout)" },
    { id: "text", icon: Type, title: "Texto" },
  ];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-0 bg-card border border-border rounded-xl px-1.5 py-1.5 shadow-xl">
      {/* Tool buttons */}
      {toolButtons.map(({ id, icon: Icon, title }) => (
        <button
          key={id}
          onClick={() => selectTool(id)}
          title={title}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === id
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Alternar tema"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Pages & Layer ordering */}
      <PagesDrawer editor={editor} />
      <LayerDrawer editor={editor} />
      <button
        onClick={() => editor.updateInstanceState({ isGridMode: !editor.getInstanceState().isGridMode })}
        title="Grid"
        className={`p-2 rounded-lg transition-colors ${
          editor.getInstanceState().isGridMode
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <Grid3X3 className="w-4 h-4" />
      </button>

      {/* Zoom */}
      <div className="flex items-center gap-1 ml-1">
        <span className="text-xs text-muted-foreground tabular-nums min-w-[32px] text-center">
          {zoomLevel}%
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Social embed drawer */}
      <SocialDrawer addShape={addShape} />
      <button
        onClick={() => selectTool("image-frame")}
        title="Imagem (Frame)"
        className={`p-2 rounded-lg transition-colors ${
          activeTool === "image-frame"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <Image className="w-4 h-4" />
      </button>
      <button
        onClick={() => selectTool("video-frame")}
        title="Vídeo (Frame)"
        className={`p-2 rounded-lg transition-colors ${
          activeTool === "video-frame"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        <Video className="w-4 h-4" />
      </button>
      <button
        onClick={() => addShape("canvas-file")}
        title="Arquivo"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <FileUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => addShape("canvas-chat")}
        title="Chat IA"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    </div>
  );
};

export default CanvasToolbar;
