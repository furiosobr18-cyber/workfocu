import { useState, useCallback, useRef } from "react";

export type ElementType = 'text' | 'image' | 'video' | 'youtube' | 'shape' | 'file' | 'chat';
export type ToolType = 'select' | 'text' | 'shape' | 'hand';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  zIndex: number;
  props: Record<string, any>;
}

export interface CanvasConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface CanvasSnapshot {
  version: 2;
  elements: CanvasElement[];
  connections?: CanvasConnection[];
}

const MAX_HISTORY = 80;
let _zCounter = 1;

function uid(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useCanvasStore() {
  const [elements, _setElements] = useState<CanvasElement[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<ToolType>('select');
  const [viewport, _setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gridEnabled, setGridEnabled] = useState(true);

  // Connections
  const [connections, _setConnections] = useState<CanvasConnection[]>([]);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const connectionsRef = useRef<CanvasConnection[]>([]);

  const elRef = useRef<CanvasElement[]>([]);
  const vpRef = useRef({ x: 0, y: 0, zoom: 1 });
  const historyRef = useRef<string[]>([JSON.stringify([])]);
  const historyIdxRef = useRef(0);

  const setElements = useCallback((els: CanvasElement[]) => {
    elRef.current = els;
    _setElements(els);
  }, []);

  const setConnections = useCallback((conns: CanvasConnection[]) => {
    connectionsRef.current = conns;
    _setConnections(conns);
  }, []);

  const setViewport = useCallback((vp: { x: number; y: number; zoom: number }) => {
    vpRef.current = vp;
    _setViewport(vp);
  }, []);

  const commit = useCallback((els: CanvasElement[]) => {
    setElements(els);
    const snap = JSON.stringify(els);
    const h = historyRef.current.slice(0, historyIdxRef.current + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.shift();
    historyRef.current = h;
    historyIdxRef.current = h.length - 1;
  }, [setElements]);

  const updateSilent = useCallback((els: CanvasElement[]) => {
    setElements(els);
  }, [setElements]);

  const commitHistory = useCallback(() => {
    const snap = JSON.stringify(elRef.current);
    const h = historyRef.current.slice(0, historyIdxRef.current + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.shift();
    historyRef.current = h;
    historyIdxRef.current = h.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current--;
      setElements(JSON.parse(historyRef.current[historyIdxRef.current]));
    }
  }, [setElements]);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++;
      setElements(JSON.parse(historyRef.current[historyIdxRef.current]));
    }
  }, [setElements]);

  const addElement = useCallback((type: ElementType, x: number, y: number, extraProps: Record<string, any> = {}) => {
    const defaults: Record<ElementType, { w: number; h: number; props: Record<string, any> }> = {
      text: { w: 220, h: 44, props: { text: 'Texto', fontSize: 20, color: '#ffffff', fontFamily: 'Inter', bold: false, italic: false, align: 'left' as const } },
      image: { w: 300, h: 200, props: { src: '', name: 'Imagem', fit: 'cover' as const, borderRadius: 8, opacity: 1 } },
      video: { w: 420, h: 240, props: { src: '', name: 'Vídeo' } },
      youtube: { w: 480, h: 270, props: { url: '' } },
      shape: { w: 160, h: 160, props: { shapeType: 'rect', fill: '#3b82f6', stroke: '#1d4ed8', strokeWidth: 2, borderRadius: 12 } },
      file: { w: 240, h: 64, props: { src: '', name: 'Arquivo', fileType: '' } },
      chat: { w: 380, h: 480, props: { messages: '[]', memory: '', model: 'llama-3.3-70b-versatile' } },
    };
    const d = defaults[type];
    const el: CanvasElement = {
      id: uid(),
      type,
      x, y,
      width: extraProps.width ?? d.w,
      height: extraProps.height ?? d.h,
      rotation: 0,
      locked: false,
      zIndex: _zCounter++,
      props: { ...d.props, ...extraProps },
    };
    const newEls = [...elRef.current, el];
    commit(newEls);
    setSelectedIds([el.id]);
    setTool('select');
    return el.id;
  }, [commit]);

  const updateElementSilent = useCallback((id: string, changes: Partial<CanvasElement>) => {
    const newEls = elRef.current.map(el => el.id === id ? { ...el, ...changes } : el);
    updateSilent(newEls);
  }, [updateSilent]);

  const updateElementProps = useCallback((id: string, propChanges: Record<string, any>) => {
    const newEls = elRef.current.map(el => el.id === id ? { ...el, props: { ...el.props, ...propChanges } } : el);
    commit(newEls);
  }, [commit]);

  // Silent props update (no history push) - for chat messages during streaming
  const updateElementPropsSilent = useCallback((id: string, propChanges: Record<string, any>) => {
    const newEls = elRef.current.map(el => el.id === id ? { ...el, props: { ...el.props, ...propChanges } } : el);
    updateSilent(newEls);
  }, [updateSilent]);

  const deleteElements = useCallback((ids: string[]) => {
    const set = new Set(ids);
    commit(elRef.current.filter(el => !set.has(el.id)));
    setSelectedIds(prev => prev.filter(id => !set.has(id)));
    // Remove connections involving deleted elements
    setConnections(connectionsRef.current.filter(c => !set.has(c.sourceId) && !set.has(c.targetId)));
  }, [commit, setConnections]);

  const bringToFront = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const maxZ = Math.max(...elRef.current.map(e => e.zIndex), 0);
    commit(elRef.current.map((el, i) => set.has(el.id) ? { ...el, zIndex: maxZ + 1 + i } : el));
  }, [commit]);

  const sendToBack = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const minZ = Math.min(...elRef.current.map(e => e.zIndex), 0);
    commit(elRef.current.map((el, i) => set.has(el.id) ? { ...el, zIndex: minZ - 1 - i } : el));
  }, [commit]);

  const toggleLock = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const shapes = elRef.current.filter(e => set.has(e.id));
    const allLocked = shapes.every(s => s.locked);
    commit(elRef.current.map(el => set.has(el.id) ? { ...el, locked: !allLocked } : el));
  }, [commit]);

  const duplicateElements = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const dupes = elRef.current.filter(e => set.has(e.id)).map(el => ({
      ...el,
      id: uid(),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: _zCounter++,
    }));
    commit([...elRef.current, ...dupes]);
    setSelectedIds(dupes.map(d => d.id));
  }, [commit]);

  // Connection methods
  const startLinking = useCallback((sourceId: string) => {
    setLinkingFrom(sourceId);
  }, []);

  const completeLinking = useCallback((targetId: string) => {
    if (!linkingFrom || linkingFrom === targetId) {
      setLinkingFrom(null);
      return;
    }
    const exists = connectionsRef.current.some(c => c.sourceId === linkingFrom && c.targetId === targetId);
    if (!exists) {
      const newConn: CanvasConnection = {
        id: `${linkingFrom}-${targetId}`,
        sourceId: linkingFrom,
        targetId,
      };
      setConnections([...connectionsRef.current, newConn]);
    }
    setLinkingFrom(null);
  }, [linkingFrom, setConnections]);

  const cancelLinking = useCallback(() => {
    setLinkingFrom(null);
  }, []);

  const removeConnection = useCallback((connId: string) => {
    setConnections(connectionsRef.current.filter(c => c.id !== connId));
  }, [setConnections]);

  const getConnectionsForElement = useCallback((elementId: string) => {
    return connectionsRef.current.filter(c => c.targetId === elementId);
  }, []);

  const getSnapshot = useCallback((): CanvasSnapshot => ({
    version: 2,
    elements: elRef.current,
    connections: connectionsRef.current,
  }), []);

  const loadSnapshot = useCallback((snap: any) => {
    if (snap && snap.version === 2 && Array.isArray(snap.elements)) {
      const maxZ = snap.elements.length > 0 ? Math.max(...snap.elements.map((e: CanvasElement) => e.zIndex)) : 0;
      _zCounter = maxZ + 1;
      setElements(snap.elements);
      setConnections(Array.isArray(snap.connections) ? snap.connections : []);
      historyRef.current = [JSON.stringify(snap.elements)];
      historyIdxRef.current = 0;
      setSelectedIds([]);
      setEditingId(null);
    }
  }, [setElements, setConnections]);

  return {
    elements, selectedIds, tool, viewport, editingId, gridEnabled,
    connections, linkingFrom,
    setSelectedIds, setTool, setViewport, setEditingId, setGridEnabled,
    addElement, updateElementSilent, updateElementProps, updateElementPropsSilent,
    deleteElements, bringToFront, sendToBack, toggleLock, duplicateElements,
    startLinking, completeLinking, cancelLinking, removeConnection, getConnectionsForElement,
    undo, redo, commitHistory,
    get canUndo() { return historyIdxRef.current > 0; },
    get canRedo() { return historyIdxRef.current < historyRef.current.length - 1; },
    getSnapshot, loadSnapshot,
    elRef, vpRef, connectionsRef,
  };
}
