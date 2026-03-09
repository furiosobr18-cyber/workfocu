import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import CanvasElementView from "./CanvasElement";
import ConnectionOverlay from "./ConnectionOverlay";
import { Lock, Unlock, Trash2, Copy, ArrowUpToLine, ArrowDownToLine } from "lucide-react";

interface InteractionState {
  mode: 'idle' | 'panning' | 'maybe-dragging' | 'dragging' | 'resizing';
  startX: number;
  startY: number;
  elementId?: string;
  handle?: string;
  offsetX?: number;
  offsetY?: number;
  startVX?: number;
  startVY?: number;
  origEl?: { x: number; y: number; w: number; h: number };
}

interface Props {
  store: ReturnType<typeof useCanvasStore>;
  onChanged?: () => void;
}

export default function CustomCanvas({ store, onChanged }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState>({ mode: 'idle', startX: 0, startY: 0 });
  const spaceHeldRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const {
    elements, selectedIds, tool, viewport, editingId, gridEnabled,
    connections, linkingFrom,
    setSelectedIds, setTool, setViewport, setEditingId,
    addElement, updateElementSilent, updateElementProps,
    deleteElements, bringToFront, sendToBack, toggleLock, duplicateElements,
    startLinking, completeLinking, cancelLinking, getConnectionsForElement,
    commitHistory, elRef, vpRef,
  } = store;

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const vp = vpRef.current;
    return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
  }, [vpRef]);

  // Track mouse position for linking wire
  useEffect(() => {
    if (!linkingFrom) { setMousePos(null); return; }
    const handleMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const handleUp = () => { cancelLinking(); };
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [linkingFrom, cancelLinking]);

  // Space key for pan mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) { spaceHeldRef.current = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeldRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vp = vpRef.current;
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.002;
        const newZoom = Math.max(0.1, Math.min(5, vp.zoom * (1 + delta)));
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const worldX = (cx - vp.x) / vp.zoom;
        const worldY = (cy - vp.y) / vp.zoom;
        setViewport({ x: cx - worldX * newZoom, y: cy - worldY * newZoom, zoom: newZoom });
      } else {
        setViewport({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setViewport, vpRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (linkingFrom) return; // Don't interact during linking
    setContextMenu(null);
    const container = containerRef.current;
    if (!container) return;
    container.setPointerCapture(e.pointerId);
    container.focus();

    const rect = container.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const target = e.target as HTMLElement;

    // Don't intercept connection dots
    if (target.getAttribute('data-connection-source') || target.getAttribute('data-connection-target')) return;

    const handleType = target.getAttribute('data-handle');
    const elementDiv = target.closest('[data-element-id]');
    const elementId = elementDiv?.getAttribute('data-element-id') || null;

    if (handleType && elementId) {
      const el = elRef.current.find(e => e.id === elementId);
      if (el && !el.locked) {
        interactionRef.current = {
          mode: 'resizing', startX: sx, startY: sy, elementId, handle: handleType,
          origEl: { x: el.x, y: el.y, w: el.width, h: el.height },
        };
      }
      return;
    }

    if (spaceHeldRef.current || tool === 'hand' || e.button === 1) {
      const vp = vpRef.current;
      interactionRef.current = { mode: 'panning', startX: e.clientX, startY: e.clientY, startVX: vp.x, startVY: vp.y };
      return;
    }

    if (elementId && tool === 'select') {
      const el = elRef.current.find(e => e.id === elementId);
      if (el) {
        if (!selectedIds.includes(elementId)) {
          setSelectedIds(e.shiftKey ? [...selectedIds, elementId] : [elementId]);
        }
        if (!el.locked && el.type !== 'chat') {
          interactionRef.current = { mode: 'maybe-dragging', startX: sx, startY: sy, elementId };
        } else {
          interactionRef.current = { mode: 'idle', startX: 0, startY: 0 };
        }
      }
      return;
    }

    if (tool === 'text' || tool === 'shape') {
      const world = screenToWorld(sx, sy);
      addElement(tool === 'text' ? 'text' : 'shape', world.x, world.y);
      onChanged?.();
      return;
    }

    if (!elementId) {
      setSelectedIds([]);
      setEditingId(null);
      interactionRef.current = {
        mode: 'panning', startX: e.clientX, startY: e.clientY,
        startVX: vpRef.current.x, startVY: vpRef.current.y,
      };
    }
  }, [tool, selectedIds, linkingFrom, setSelectedIds, setEditingId, addElement, screenToWorld, elRef, vpRef, onChanged]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ix = interactionRef.current;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (ix.mode === 'panning') {
      const dx = e.clientX - ix.startX;
      const dy = e.clientY - ix.startY;
      setViewport({ ...vpRef.current, x: (ix.startVX ?? 0) + dx, y: (ix.startVY ?? 0) + dy });
      return;
    }

    if (ix.mode === 'maybe-dragging') {
      const dist = Math.abs(sx - ix.startX) + Math.abs(sy - ix.startY);
      if (dist > 3 && ix.elementId) {
        ix.mode = 'dragging';
        const el = elRef.current.find(e => e.id === ix.elementId);
        if (el) {
          const worldStart = screenToWorld(ix.startX, ix.startY);
          ix.offsetX = el.x - worldStart.x;
          ix.offsetY = el.y - worldStart.y;
        }
      }
      return;
    }

    if (ix.mode === 'dragging' && ix.elementId) {
      const world = screenToWorld(sx, sy);
      updateElementSilent(ix.elementId, { x: world.x + (ix.offsetX ?? 0), y: world.y + (ix.offsetY ?? 0) });
      return;
    }

    if (ix.mode === 'resizing' && ix.elementId && ix.origEl && ix.handle) {
      const world = screenToWorld(sx, sy);
      const startWorld = screenToWorld(ix.startX, ix.startY);
      const dx = world.x - startWorld.x;
      const dy = world.y - startWorld.y;
      const o = ix.origEl;
      let newX = o.x, newY = o.y, newW = o.w, newH = o.h;

      if (ix.handle.includes('e')) { newW = Math.max(30, o.w + dx); }
      if (ix.handle.includes('w')) { newW = Math.max(30, o.w - dx); newX = o.x + dx; }
      if (ix.handle.includes('s')) { newH = Math.max(30, o.h + dy); }
      if (ix.handle.includes('n')) { newH = Math.max(30, o.h - dy); newY = o.y + dy; }

      updateElementSilent(ix.elementId, { x: newX, y: newY, width: newW, height: newH });
    }
  }, [setViewport, screenToWorld, updateElementSilent, elRef, vpRef]);

  const handlePointerUp = useCallback(() => {
    const ix = interactionRef.current;
    if (ix.mode === 'dragging' || ix.mode === 'resizing') {
      commitHistory();
      onChanged?.();
    }
    interactionRef.current = { mode: 'idle', startX: 0, startY: 0 };
  }, [commitHistory, onChanged]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const elementDiv = target.closest('[data-element-id]');
    const elementId = elementDiv?.getAttribute('data-element-id');
    if (!elementId) return;
    const el = elRef.current.find(e => e.id === elementId);
    if (!el) return;

    if (el.type === 'text') {
      setEditingId(elementId);
    } else if (el.type === 'image' || el.type === 'video') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = el.type === 'image' ? 'image/*' : 'video/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { updateElementProps(elementId, { src: reader.result as string, name: file.name }); onChanged?.(); };
        reader.readAsDataURL(file);
      };
      input.click();
    } else if (el.type === 'youtube') {
      const url = prompt('URL do YouTube:', el.props.url || '');
      if (url !== null) { updateElementProps(elementId, { url }); onChanged?.(); }
    } else if (el.type === 'file') {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { updateElementProps(elementId, { src: reader.result as string, name: file.name, fileType: file.type }); onChanged?.(); };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  }, [elRef, setEditingId, updateElementProps, onChanged]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const elementDiv = target.closest('[data-element-id]');
    if (elementDiv) {
      const id = elementDiv.getAttribute('data-element-id')!;
      setSelectedIds([id]);
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: id });
    }
  }, [setSelectedIds]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedIds.length > 0) { deleteElements(selectedIds); onChanged?.(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); setSelectedIds(elements.map(e => e.id)); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); if (selectedIds.length > 0) { duplicateElements(selectedIds); onChanged?.(); } }
    if (e.key === 'Escape') { setSelectedIds([]); setEditingId(null); setTool('select'); cancelLinking(); }
  }, [editingId, selectedIds, elements, deleteElements, setSelectedIds, setEditingId, setTool, duplicateElements, store, onChanged, cancelLinking]);

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const { x: vx, y: vy, zoom } = viewport;

  const gridSize = 24;
  const scaledGrid = gridSize * zoom;
  const gridStyle = gridEnabled ? {
    backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)`,
    backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
    backgroundPosition: `${vx % scaledGrid}px ${vy % scaledGrid}px`,
  } : {};

  const cursorMap: Record<string, string> = { select: 'default', hand: 'grab', text: 'text', shape: 'crosshair' };
  const contextEl = contextMenu ? elRef.current.find(e => e.id === contextMenu.elementId) : null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden outline-none bg-background"
      tabIndex={0}
      style={{
        cursor: linkingFrom ? 'crosshair' : (spaceHeldRef.current ? 'grab' : cursorMap[tool] || 'default'),
        ...gridStyle,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {/* World container */}
      <div style={{ transform: `translate(${vx}px, ${vy}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
        {sorted.map(el => (
          <CanvasElementView
            key={el.id}
            element={el}
            isSelected={selectedIds.includes(el.id)}
            isEditing={editingId === el.id}
            zoom={zoom}
            connections={getConnectionsForElement(el.id)}
            allElements={elements}
            isLinking={!!linkingFrom}
            onUpdateProps={(props) => { updateElementProps(el.id, props); onChanged?.(); }}
            onStopEditing={() => setEditingId(null)}
            onStartLinking={startLinking}
            onCompleteLinking={completeLinking}
            onChanged={onChanged}
          />
        ))}
      </div>

      {/* Connection overlay */}
      <ConnectionOverlay store={store} mousePos={mousePos} />

      {/* Linking banner */}
      {linkingFrom && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] bg-card/95 backdrop-blur-xl text-foreground px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-2xl border border-border animate-in fade-in-0">
          <span className="animate-pulse">🔗</span>
          Arraste até a bolinha do Chat para conectar
          <button onClick={cancelLinking} className="ml-2 bg-accent hover:bg-accent/80 rounded-lg px-2 py-0.5 text-xs text-muted-foreground">
            Cancelar
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && contextEl && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setContextMenu(null)} />
          <div className="fixed z-[999] bg-card border border-border rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-in fade-in-0 zoom-in-95"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <CtxButton onClick={() => { toggleLock([contextMenu.elementId]); setContextMenu(null); onChanged?.(); }}>
              {contextEl.locked ? <><Unlock className="w-4 h-4" /> Desbloquear</> : <><Lock className="w-4 h-4" /> Fixar</>}
            </CtxButton>
            <CtxButton onClick={() => { duplicateElements([contextMenu.elementId]); setContextMenu(null); onChanged?.(); }}>
              <Copy className="w-4 h-4" /> Duplicar
            </CtxButton>
            <div className="h-px bg-border my-1" />
            <CtxButton onClick={() => { bringToFront([contextMenu.elementId]); setContextMenu(null); onChanged?.(); }}>
              <ArrowUpToLine className="w-4 h-4" /> Trazer para frente
            </CtxButton>
            <CtxButton onClick={() => { sendToBack([contextMenu.elementId]); setContextMenu(null); onChanged?.(); }}>
              <ArrowDownToLine className="w-4 h-4" /> Enviar para trás
            </CtxButton>
            <div className="h-px bg-border my-1" />
            <CtxButton onClick={() => { deleteElements([contextMenu.elementId]); setContextMenu(null); onChanged?.(); }} danger>
              <Trash2 className="w-4 h-4" /> Excluir
            </CtxButton>
          </div>
        </>
      )}

      {/* Empty state */}
      {elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground/40 space-y-2">
            <p className="text-lg font-medium">Canvas vazio</p>
            <p className="text-sm">Use a toolbar abaixo para adicionar elementos</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CtxButton({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-accent'}`}>
      {children}
    </button>
  );
}
