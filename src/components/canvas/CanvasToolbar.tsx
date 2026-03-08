import { Button } from "@/components/ui/button";
import { Youtube, Image, FileUp, MessageSquare, MousePointer2, Hand, Pen, Sun, Moon, Grid3X3 } from "lucide-react";
import { Editor } from "tldraw";
import { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

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

      {/* Grid */}
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

      {/* Custom shape buttons */}
      <button
        onClick={() => addShape("youtube")}
        title="YouTube"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Youtube className="w-4 h-4 text-destructive" />
      </button>
      <button
        onClick={() => addShape("canvas-image")}
        title="Imagem"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <Image className="w-4 h-4" />
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
