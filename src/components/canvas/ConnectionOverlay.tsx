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

export default function ConnectionOverlay({ editor }: { editor: Editor | null }) {
  const { connections, linkingFrom } = useConnections();
  const [lines, setLines] = useState<LinePos[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Get the offset of the SVG container to convert screen coords to local coords
  const toLocal = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: screenX, y: screenY };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: screenX - rect.left, y: screenY - rect.top };
  }, []);

  // Track mouse while dragging a wire
  useEffect(() => {
    if (!linkingFrom) {
      setMousePos(null);
      setDragStartPos(null);
      return;
    }

    const onMove = (e: PointerEvent) => {
      const local = toLocal(e.clientX, e.clientY);
      setMousePos(local);
    };

    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [linkingFrom, toLocal]);

  // Find the source dot screen position when linking starts
  useEffect(() => {
    if (!linkingFrom || !editor) {
      setDragStartPos(null);
      return;
    }

    const shape = editor.getShape(linkingFrom.id as any);
    if (!shape) return;
    const bounds = editor.getShapePageBounds(shape);
    if (!bounds) return;

    // The dot is 14px outside the shape edge; account for zoom
    const camera = editor.getCamera();
    const dotOffset = 14 / camera.z;

    const screenPos = editor.pageToScreen({
      x: bounds.x + bounds.w + dotOffset,
      y: bounds.y + bounds.h / 2,
    });
    setDragStartPos(toLocal(screenPos.x, screenPos.y));
  }, [linkingFrom, editor, toLocal]);

  // Update existing connection lines
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

        const s = editor.pageToScreen({ x: sB.x + sB.w, y: sB.y + sB.h / 2 });
        const t = editor.pageToScreen({ x: tB.x, y: tB.y + tB.h / 2 });

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

  if (lines.length === 0 && !isDragging) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 400,
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id="conn-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4af" />
          <stop offset="100%" stopColor="#a040ff" />
        </linearGradient>
        <linearGradient id="drag-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4af" />
          <stop offset="100%" stopColor="#a040ff" stopOpacity={0.5} />
        </linearGradient>
        <filter id="wire-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>{`
          @keyframes flowDash {
            to { stroke-dashoffset: -20; }
          }
          .conn-line {
            stroke-dasharray: 8 4;
            animation: flowDash 0.6s linear infinite;
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
          }
          .conn-glow {
            animation: pulseGlow 2s ease-in-out infinite;
          }
          @keyframes dragPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .drag-wire {
            animation: dragPulse 0.8s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* Existing connections */}
      {lines.map((line) => {
        const dx = line.x2 - line.x1;
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 60);
        const path = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;

        return (
          <g key={line.id}>
            {/* Glow */}
            <path
              d={path}
              stroke="url(#conn-gradient)"
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              className="conn-glow"
            />
            {/* Main line */}
            <path
              d={path}
              stroke="url(#conn-gradient)"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              className="conn-line"
            />
            {/* Particles */}
            {[0, 0.6, 1.2].map((delay, i) => (
              <circle key={i} r={3.5} fill="#ffffff" className="conn-glow">
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  begin={`${delay}s`}
                  path={path}
                />
              </circle>
            ))}
            {/* Endpoint dots */}
            <circle cx={line.x1} cy={line.y1} r={7} fill="#4af" stroke="#fff" strokeWidth={2} />
            <circle cx={line.x2} cy={line.y2} r={7} fill="#a040ff" stroke="#fff" strokeWidth={2} />
          </g>
        );
      })}

      {/* Dragging wire preview */}
      {isDragging && (
        <g>
          {(() => {
            const dx = mousePos.x - dragStartPos.x;
            const cpOffset = Math.max(Math.abs(dx) * 0.4, 40);
            const path = `M ${dragStartPos.x} ${dragStartPos.y} C ${dragStartPos.x + cpOffset} ${dragStartPos.y}, ${mousePos.x - cpOffset} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;
            return (
              <>
                {/* Glow */}
                <path
                  d={path}
                  stroke="url(#drag-gradient)"
                  strokeWidth={5}
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.4}
                  filter="url(#wire-glow)"
                />
                {/* Wire */}
                <path
                  d={path}
                  stroke="url(#drag-gradient)"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                  className="drag-wire"
                />
                {/* Start dot */}
                <circle cx={dragStartPos.x} cy={dragStartPos.y} r={7} fill="#4af" stroke="#fff" strokeWidth={2} />
                {/* Cursor dot */}
                <circle cx={mousePos.x} cy={mousePos.y} r={5} fill="#a040ff" stroke="#fff" strokeWidth={2} opacity={0.8}>
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
