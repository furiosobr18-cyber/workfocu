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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] flex gap-2 bg-background/90 backdrop-blur-md border border-border rounded-xl px-3 py-2 shadow-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("youtube")}
        className="flex items-center gap-1.5 text-xs"
        title="Adicionar vídeo do YouTube"
      >
        <Youtube className="w-4 h-4 text-red-500" />
        YouTube
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("canvas-image")}
        className="flex items-center gap-1.5 text-xs"
        title="Adicionar imagem"
      >
        <Image className="w-4 h-4 text-blue-400" />
        Imagem
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("canvas-file")}
        className="flex items-center gap-1.5 text-xs"
        title="Anexar arquivo"
      >
        <FileUp className="w-4 h-4 text-green-400" />
        Arquivo
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => addShape("canvas-chat")}
        className="flex items-center gap-1.5 text-xs"
        title="Criar chat com IA"
      >
        <MessageSquare className="w-4 h-4 text-purple-400" />
        Chat IA
      </Button>
    </div>
  );
};

export default CanvasToolbar;
