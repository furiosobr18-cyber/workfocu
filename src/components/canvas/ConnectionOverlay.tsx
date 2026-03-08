import { useEffect, useState, useRef, useCallback } from "react";
import { Editor } from "tldraw";
import { useConnections } from "./ConnectionContext";

interface LinePos {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// WorkFocus neutral palette
const SRC_COLOR = "hsl(0,0%,60%)";
const TGT_COLOR = "hsl(0,0%,45%)";
const LINE_COLOR = "hsl(0,0%,55%)";
const PARTICLE_COLOR = "hsl(0,0%,85%)";
const DEL_COLOR = "hsl(0,84%,60%)";

export default function ConnectionOverlay({ editor }: { editor: Editor | null }) {
  const { connections, linkingFrom, removeConnection } = useConnections();
  const [lines, setLines] = useState<LinePos[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toLocal = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: screenX, y: screenY };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: screenX - rect.left, y: screenY - rect.top };
  }, []);

  useEffect(() => {
    if (!linkingFrom) {
      setMousePos(null);
      setDragStartPos(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      setMousePos(toLocal(e.clientX, e.clientY));
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [linkingFrom, toLocal]);

  useEffect(() => {
    if (!linkingFrom || !editor) {
      setDragStartPos(null);
      return;
    }
    const calcPos = () => {
      const shape = editor.getShape(linkingFrom.id as any);
      if (!shape) return;
      const bounds = editor.getShapePageBounds(shape);
      if (!bounds) return;
      const camera = editor.getCamera();
      const dotOffset = 14 / camera.z;
      const screenPos = editor.pageToScreen({
        x: bounds.x + bounds.w + dotOffset,
        y: bounds.y + bounds.h / 2,
      });
      setDragStartPos(toLocal(screenPos.x, screenPos.y));
    };
    calcPos();
    const interval = setInterval(calcPos, 50);
    return () => clearInterval(interval);
  }, [linkingFrom, editor, toLocal]);

  useEffect(() => {
    if (!editor || connections.length === 0) {
      setLines([]);
      return;
    }
    const update = () => {
      const newLines: LinePos[] = [];
      for (const conn of connections) {
        const source = editor.getShape(conn.sourceId as any);
        const target = editor.getShape(conn.targetId as any);
        if (!source || !target) continue;
        const sB = editor.getShapePageBounds(source);
        const tB = editor.getShapePageBounds(target);
        if (!sB || !tB) continue;
        const camera = editor.getCamera();
        const dotOff = 14 / camera.z;
        const s = editor.pageToScreen({ x: sB.x + sB.w + dotOff, y: sB.y + sB.h / 2 });
        const t = editor.pageToScreen({ x: tB.x - dotOff, y: tB.y + tB.h / 2 });
        const sLocal = toLocal(s.x, s.y);
        const tLocal = toLocal(t.x, t.y);
        newLines.push({ id: conn.id, x1: sLocal.x, y1: sLocal.y, x2: tLocal.x, y2: tLocal.y });
      }
      setLines(newLines);
    };
    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [editor, connections, toLocal]);

  const isDragging = linkingFrom && dragStartPos && mousePos;

  return (
    <svg
      ref={svgRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 400, overflow: "visible" }}
    >
      <defs>
        <linearGradient id="conn-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={SRC_COLOR} />
          <stop offset="100%" stopColor={TGT_COLOR} />
        </linearGradient>
        <linearGradient id="drag-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={SRC_COLOR} />
          <stop offset="100%" stopColor={TGT_COLOR} stopOpacity={0.5} />
        </linearGradient>
        <filter id="wire-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>{`
          @keyframes flowDash { to { stroke-dashoffset: -20; } }
          .conn-line { stroke-dasharray: 8 4; animation: flowDash 0.6s linear infinite; }
          @keyframes pulseGlow { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.55; } }
          .conn-glow { animation: pulseGlow 2s ease-in-out infinite; }
          @keyframes dragPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .drag-wire { animation: dragPulse 0.8s ease-in-out infinite; }
        `}</style>
      </defs>

      {lines.map((line) => {
        const dx = line.x2 - line.x1;
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 60);
        const path = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;
        const mx = (line.x1 + line.x2) / 2;
        const my = (line.y1 + line.y2) / 2;

        return (
          <g key={line.id}>
            <path d={path} stroke="url(#conn-gradient)" strokeWidth={5} fill="none" strokeLinecap="round" className="conn-glow" />
            <path d={path} stroke="url(#conn-gradient)" strokeWidth={2} fill="none" strokeLinecap="round" className="conn-line" />
            {[0, 0.6, 1.2].map((delay, i) => (
              <circle key={i} r={3} fill={PARTICLE_COLOR} className="conn-glow">
                <animateMotion dur="2s" repeatCount="indefinite" begin={`${delay}s`} path={path} />
              </circle>
            ))}
            <circle cx={line.x1} cy={line.y1} r={6} fill={SRC_COLOR} stroke="hsl(0,0%,90%)" strokeWidth={1.5} />
            <circle cx={line.x2} cy={line.y2} r={6} fill={TGT_COLOR} stroke="hsl(0,0%,90%)" strokeWidth={1.5} />
            <g style={{ cursor: "pointer", pointerEvents: "all" }} onClick={() => removeConnection(line.id)}>
              <circle cx={mx} cy={my} r={10} fill="hsl(0,0%,10%)" stroke={DEL_COLOR} strokeWidth={1.5} opacity={0.9} />
              <line x1={mx - 4} y1={my - 4} x2={mx + 4} y2={my + 4} stroke={DEL_COLOR} strokeWidth={2} strokeLinecap="round" />
              <line x1={mx + 4} y1={my - 4} x2={mx - 4} y2={my + 4} stroke={DEL_COLOR} strokeWidth={2} strokeLinecap="round" />
            </g>
          </g>
        );
      })}

      {isDragging && (
        <g>
          {(() => {
            const dx = mousePos.x - dragStartPos.x;
            const cpOffset = Math.max(Math.abs(dx) * 0.4, 40);
            const path = `M ${dragStartPos.x} ${dragStartPos.y} C ${dragStartPos.x + cpOffset} ${dragStartPos.y}, ${mousePos.x - cpOffset} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;
            return (
              <>
                <path d={path} stroke="url(#drag-gradient)" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.3} filter="url(#wire-glow)" />
                <path d={path} stroke="url(#drag-gradient)" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="6 4" className="drag-wire" />
                <circle cx={dragStartPos.x} cy={dragStartPos.y} r={6} fill={SRC_COLOR} stroke="hsl(0,0%,90%)" strokeWidth={1.5} />
                <circle cx={mousePos.x} cy={mousePos.y} r={5} fill={TGT_COLOR} stroke="hsl(0,0%,90%)" strokeWidth={1.5} opacity={0.8}>
                  <animate attributeName="r" values="5;7;5" dur="1s" repeatCount="indefinite" />
                </circle>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
