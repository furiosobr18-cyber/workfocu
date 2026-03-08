import { Button } from "@/components/ui/button";
import { Youtube, Image, FileUp, MessageSquare } from "lucide-react";
import { Editor } from "tldraw";

interface CanvasToolbarProps {
  editor: Editor | null;
}

const CanvasToolbar = ({ editor }: CanvasToolbarProps) => {
  if (!editor) return null;

  const addShape = (type: string) => {
    const { x, y } = editor.getViewportScreenCenter();
    const point = editor.screenToPage({ x, y });

    editor.createShape({
      type,
      x: point.x - 150,
      y: point.y - 100,
    });
  };

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[500] flex gap-1 bg-card/95 backdrop-blur-md border border-border rounded-xl px-3 py-2 shadow-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("youtube")}
        className="flex items-center gap-1.5 text-xs text-foreground hover:bg-accent"
        title="Adicionar vídeo do YouTube"
      >
        <Youtube className="w-4 h-4 text-destructive" />
        YouTube
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("canvas-image")}
        className="flex items-center gap-1.5 text-xs text-foreground hover:bg-accent"
        title="Adicionar imagem"
      >
        <Image className="w-4 h-4 text-muted-foreground" />
        Imagem
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("canvas-file")}
        className="flex items-center gap-1.5 text-xs text-foreground hover:bg-accent"
        title="Anexar arquivo"
      >
        <FileUp className="w-4 h-4 text-success" />
        Arquivo
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("canvas-chat")}
        className="flex items-center gap-1.5 text-xs text-foreground hover:bg-accent"
        title="Criar chat com IA"
      >
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        Chat IA
      </Button>
    </div>
  );
};

export default CanvasToolbar;
