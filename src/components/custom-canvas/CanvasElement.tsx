import { CanvasElement } from "@/hooks/useCanvasStore";
import { Image, Video, FileText, Youtube } from "lucide-react";

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match?.[1] || '';
}

interface Props {
  element: CanvasElement;
  isSelected: boolean;
  isEditing: boolean;
  zoom: number;
  onUpdateProps: (props: Record<string, any>) => void;
  onStopEditing: () => void;
}

export default function CanvasElementView({ element: el, isSelected, isEditing, zoom, onUpdateProps, onStopEditing }: Props) {
  const borderWidth = isSelected ? Math.max(1.5, 2 / zoom) : 0;
  const handleSize = Math.max(6, 10 / zoom);

  const renderContent = () => {
    switch (el.type) {
      case 'text':
        if (isEditing) {
          return (
            <textarea
              autoFocus
              defaultValue={el.props.text}
              onBlur={(e) => { onUpdateProps({ text: e.target.value }); onStopEditing(); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onUpdateProps({ text: (e.target as HTMLTextAreaElement).value });
                  onStopEditing();
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full h-full resize-none bg-transparent outline-none border-none p-1"
              style={{
                fontSize: el.props.fontSize,
                color: el.props.color,
                fontFamily: `'${el.props.fontFamily}', sans-serif`,
                fontWeight: el.props.bold ? 'bold' : 'normal',
                fontStyle: el.props.italic ? 'italic' : 'normal',
                textAlign: el.props.align,
              }}
            />
          );
        }
        return (
          <div
            className="w-full h-full overflow-hidden select-none pointer-events-none p-1 whitespace-pre-wrap break-words"
            style={{
              fontSize: el.props.fontSize,
              color: el.props.color,
              fontFamily: `'${el.props.fontFamily}', sans-serif`,
              fontWeight: el.props.bold ? 'bold' : 'normal',
              fontStyle: el.props.italic ? 'italic' : 'normal',
              textAlign: el.props.align,
            }}
          >
            {el.props.text}
          </div>
        );

      case 'image':
        return el.props.src ? (
          <img
            src={el.props.src}
            alt={el.props.name}
            className="w-full h-full pointer-events-none"
            style={{
              objectFit: el.props.fit || 'cover',
              borderRadius: el.props.borderRadius || 0,
              opacity: el.props.opacity ?? 1,
            }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/30 gap-2">
            <Image className="w-10 h-10 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/50">Duplo-clique para upload</span>
          </div>
        );

      case 'video':
        return el.props.src ? (
          <video
            src={el.props.src}
            controls
            className="w-full h-full pointer-events-none rounded-lg"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/30 gap-2">
            <Video className="w-10 h-10 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/50">Duplo-clique para upload</span>
          </div>
        );

      case 'youtube': {
        const videoId = extractYouTubeId(el.props.url || '');
        if (!videoId) {
          return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-xl border-2 border-dashed border-muted-foreground/30 gap-2">
              <Youtube className="w-10 h-10 text-red-500/50" />
              <span className="text-xs text-muted-foreground/50">Duplo-clique para adicionar URL</span>
            </div>
          );
        }
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className="w-full h-full rounded-lg pointer-events-none"
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
            allowFullScreen
          />
        );
      }

      case 'shape':
        return (
          <div
            className="w-full h-full"
            style={{
              backgroundColor: el.props.fill,
              border: `${el.props.strokeWidth}px solid ${el.props.stroke}`,
              borderRadius: el.props.shapeType === 'circle' ? '50%' : (el.props.borderRadius || 0),
            }}
          />
        );

      case 'file':
        return (
          <div className="w-full h-full flex items-center gap-3 px-4 bg-card/80 backdrop-blur border border-border rounded-xl shadow-sm">
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm text-foreground truncate">{el.props.name || 'Arquivo'}</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      data-element-id={el.id}
      className="absolute"
      style={{
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        transform: `rotate(${el.rotation}deg)`,
        outline: isSelected ? `${borderWidth}px solid hsl(210, 100%, 56%)` : 'none',
        outlineOffset: borderWidth > 0 ? 1 / zoom : 0,
        cursor: el.locked ? 'not-allowed' : (isEditing ? 'text' : 'move'),
        zIndex: el.zIndex,
      }}
    >
      {renderContent()}

      {/* Resize handles */}
      {isSelected && !el.locked && !isEditing && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map(handle => (
            <div
              key={handle}
              data-handle={handle}
              data-element-id={el.id}
              className="bg-white border-2 border-primary rounded-full"
              style={{
                position: 'absolute',
                width: handleSize,
                height: handleSize,
                ...(handle.includes('n') ? { top: -handleSize / 2 } : { bottom: -handleSize / 2 }),
                ...(handle.includes('w') ? { left: -handleSize / 2 } : { right: -handleSize / 2 }),
                cursor: `${handle}-resize`,
                zIndex: 100,
              }}
            />
          ))}
        </>
      )}

      {/* Lock indicator */}
      {el.locked && isSelected && (
        <div
          className="absolute flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow-lg"
          style={{
            top: -8 / zoom,
            left: 0,
            transform: `translateY(-100%) scale(${1 / zoom})`,
            transformOrigin: 'bottom left',
          }}
        >
          🔒 Fixado
        </div>
      )}
    </div>
  );
}
