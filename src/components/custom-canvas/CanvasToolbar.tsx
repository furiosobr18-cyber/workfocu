import { useRef } from "react";
import {
  MousePointer2, Hand, Type, Square, Image, Video, Youtube, FileUp,
  Sun, Moon, Grid3X3, Undo2, Redo2, Save, Cloud, CloudOff,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCanvasStore, ToolType } from "@/hooks/useCanvasStore";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface Props {
  store: ReturnType<typeof useCanvasStore>;
  isSaving: boolean;
  lastSaved: Date | null;
  onSaveNow: () => void;
  onChanged?: () => void;
}

export default function CanvasToolbar({ store, isSaving, lastSaved, onSaveNow, onChanged }: Props) {
  const { theme, toggleTheme } = useTheme();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    tool, viewport, gridEnabled,
    setTool, setGridEnabled,
    addElement, undo, redo, canUndo, canRedo,
    vpRef,
  } = store;

  const zoomPercent = Math.round(viewport.zoom * 100);

  const getCenterWorld = () => {
    const container = document.querySelector('[data-canvas-root]');
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const vp = vpRef.current;
    return {
      x: (rect.width / 2 - vp.x) / vp.zoom,
      y: (rect.height / 2 - vp.y) / vp.zoom,
    };
  };

  const handleFileUpload = (type: 'image' | 'video' | 'file', file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const center = getCenterWorld();
      addElement(type, center.x - 150, center.y - 100, {
        src: reader.result as string,
        name: file.name,
        ...(type === 'file' ? { fileType: file.type } : {}),
      });
      onChanged?.();
    };
    reader.readAsDataURL(file);
  };

  const handleYouTube = () => {
    const url = prompt('Cole a URL do YouTube:');
    if (url) {
      const center = getCenterWorld();
      addElement('youtube', center.x - 240, center.y - 135, { url });
      onChanged?.();
    }
  };

  const tools: { id: ToolType; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Selecionar (V)' },
    { id: 'hand', icon: Hand, label: 'Mover (H)' },
    { id: 'text', icon: Type, label: 'Texto (T)' },
    { id: 'shape', icon: Square, label: 'Forma (R)' },
  ];

  return (
    <TooltipProvider>
      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload('image', f); e.target.value = ''; }} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload('video', f); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload('file', f); e.target.value = ''; }} />

      {/* Main toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-0 bg-card/95 backdrop-blur-xl border border-border rounded-2xl px-2 py-1.5 shadow-2xl">
        {/* Tool buttons */}
        {tools.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTool(id)}
                className={`p-2.5 rounded-xl transition-all duration-150 ${
                  tool === id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{label}</p></TooltipContent>
          </Tooltip>
        ))}

        <Sep />

        {/* Media buttons */}
        <TBtn icon={Image} label="Imagem" onClick={() => imageInputRef.current?.click()} />
        <TBtn icon={Video} label="Vídeo" onClick={() => videoInputRef.current?.click()} />
        <TBtn icon={Youtube} label="YouTube" onClick={handleYouTube} className="text-red-500" />
        <TBtn icon={FileUp} label="Arquivo" onClick={() => fileInputRef.current?.click()} />

        <Sep />

        {/* Grid */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setGridEnabled(!gridEnabled)}
              className={`p-2.5 rounded-xl transition-all duration-150 ${
                gridEnabled ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Grid</p></TooltipContent>
        </Tooltip>

        {/* Theme */}
        <TBtn icon={theme === 'dark' ? Sun : Moon} label="Tema" onClick={toggleTheme} />

        <Sep />

        {/* Undo / Redo */}
        <TBtn icon={Undo2} label="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
        <TBtn icon={Redo2} label="Refazer (Ctrl+Y)" onClick={redo} disabled={!canRedo} />

        <Sep />

        {/* Save */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSaveNow}
              disabled={isSaving}
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150 disabled:opacity-40"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>{isSaving ? 'Salvando...' : 'Salvar (Ctrl+S)'}</p></TooltipContent>
        </Tooltip>

        {/* Status */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          {isSaving ? (
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          ) : lastSaved ? (
            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{zoomPercent}%</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Sep() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

function TBtn({ icon: Icon, label, onClick, disabled, className }: { icon: any; label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none ${className || ''}`}
        >
          <Icon className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top"><p>{label}</p></TooltipContent>
    </Tooltip>
  );
}
