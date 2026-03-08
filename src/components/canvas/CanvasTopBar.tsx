import { useState, useRef, useEffect } from "react";
import { Editor } from "tldraw";
import {
  LayoutGrid,
  Frame,
  Rows3,
  Columns3,
  Grid3X3,
  LayoutList,
  Image,
  Video,
  Type,
  Youtube,
  FileUp,
  MessageSquare,
} from "lucide-react";

interface CanvasTopBarProps {
  editor: Editor | null;
}

const CanvasTopBar = ({ editor }: CanvasTopBarProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!editor) return null;

  const addShape = (type: string) => {
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    editor.createShape({
      type,
      x: point.x - 150,
      y: point.y - 100,
    });
    setOpenMenu(null);
  };

  const addGeoShape = (geo: string) => {
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    editor.createShape({
      type: "geo",
      x: point.x - 50,
      y: point.y - 50,
      props: { geo, w: 200, h: 200 },
    });
    setOpenMenu(null);
  };

  const addTextShape = () => {
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });
    editor.createShape({
      type: "text",
      x: point.x - 50,
      y: point.y - 15,
      props: { text: "Texto" },
    });
    setOpenMenu(null);
  };

  const layoutItems = [
    { label: "Frame", icon: Frame, shortcut: "F", action: () => addGeoShape("rectangle") },
    { label: "Rows", icon: Rows3, shortcut: "Shift+R", action: () => addGeoShape("rectangle") },
    { label: "Columns", icon: Columns3, shortcut: "Shift+C", action: () => addGeoShape("rectangle") },
    { label: "Grid", icon: Grid3X3, shortcut: "Shift+G", action: () => addGeoShape("rectangle") },
    { label: "Masonry", icon: LayoutList, shortcut: "Shift+M", action: () => addGeoShape("rectangle") },
    { divider: true },
    { label: "Imagem", icon: Image, shortcut: "Shift+I", action: () => addShape("canvas-image") },
    { label: "Vídeo", icon: Video, shortcut: "Shift+V", action: () => addShape("youtube") },
  ];

  const insertItems = [
    { label: "YouTube", icon: Youtube, action: () => addShape("youtube") },
    { label: "Imagem", icon: Image, action: () => addShape("canvas-image") },
    { label: "Arquivo", icon: FileUp, action: () => addShape("canvas-file") },
    { label: "Chat IA", icon: MessageSquare, action: () => addShape("canvas-chat") },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-0"
    >
      {/* Layout button */}
      <div className="relative">
        <button
          onClick={() => setOpenMenu(openMenu === "layout" ? null : "layout")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-[hsl(0,0%,18%)] text-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,24%)] border border-[hsl(0,0%,25%)] shadow-lg ${
            openMenu === "layout" ? "bg-[hsl(0,0%,24%)]" : ""
          }`}
        >
          <Columns3 className="w-4 h-4" />
          Layout
        </button>

        {openMenu === "layout" && (
          <div className="absolute top-full left-0 mt-1.5 w-56 bg-[hsl(0,0%,18%)] border border-[hsl(0,0%,25%)] rounded-xl py-2 shadow-2xl animate-fade-in">
            {layoutItems.map((item, i) =>
              (item as any).divider ? (
                <div key={i} className="h-px bg-[hsl(0,0%,25%)] my-2 mx-3" />
              ) : (
                <button
                  key={i}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,24%)] transition-colors"
                >
                  {item.icon && <item.icon className="w-4 h-4 text-[hsl(0,0%,60%)]" />}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-xs text-[hsl(0,0%,50%)]">{item.shortcut}</span>
                  )}
                </button>
              )
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default CanvasTopBar;
