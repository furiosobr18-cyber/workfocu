import { Button } from "@/components/ui/button";
import { Youtube, Image, FileUp, MessageSquare, MousePointer2, Hand, Pen, Sun, Moon, Grid3X3 } from "lucide-react";
import { Editor } from "tldraw";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

interface CanvasToolbarProps {
  editor: Editor | null;
}

const brushSizes = [
  { label: "S", size: 2, dotSize: 4 },
  { label: "M", size: 6, dotSize: 8 },
  { label: "L", size: 12, dotSize: 14 },
  { label: "XL", size: 22, dotSize: 18 },
];

const CanvasToolbar = ({ editor }: CanvasToolbarProps) => {
  const { theme, toggleTheme } = useTheme();
  const [activeTool, setActiveTool] = useState<string>("select");
  const [brushIndex, setBrushIndex] = useState(1); // default M
  const [showBrushPicker, setShowBrushPicker] = useState(false);
  const brushRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brushRef.current && !brushRef.current.contains(e.target as Node)) {
        setShowBrushPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!editor) return null;

  const selectTool = (tool: string) => {
    setActiveTool(tool);
    editor.setCurrentTool(tool);
  };

  const selectBrush = (index: number) => {
    setBrushIndex(index);
    setShowBrushPicker(false);
    editor.setStyleForNextShapes(editor.getStyleForNextShape("size" as any) as any, brushSizes[index].size as any);
    // Also activate draw tool
    selectTool("draw");
  };

  const zoomLevel = Math.round((editor.getZoomLevel?.() ?? 1) * 100);

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

      {/* Draw / Brush picker */}
      <div className="relative" ref={brushRef}>
        <button
          onClick={() => {
            if (activeTool === "draw") {
              setShowBrushPicker(!showBrushPicker);
            } else {
              selectTool("draw");
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowBrushPicker(!showBrushPicker);
          }}
          title="Desenhar (clique de novo para tamanho)"
          className={`p-2 rounded-lg transition-colors ${
            activeTool === "draw"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Pen className="w-4 h-4" />
        </button>

        {showBrushPicker && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[hsl(0,0%,18%)] border border-[hsl(0,0%,25%)] rounded-xl p-2 shadow-2xl animate-fade-in flex items-end gap-2">
            {brushSizes.map((b, i) => (
              <button
                key={i}
                onClick={() => selectBrush(i)}
                className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg transition-colors ${
                  brushIndex === i
                    ? "bg-[hsl(0,0%,30%)]"
                    : "hover:bg-[hsl(0,0%,24%)]"
                }`}
                title={b.label}
              >
                <div
                  className="rounded-full bg-[hsl(0,0%,85%)]"
                  style={{ width: b.dotSize, height: b.dotSize }}
                />
                <span className="text-[10px] text-[hsl(0,0%,55%)]">{b.label}</span>
              </button>
            ))}
          </div>
        )}

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
