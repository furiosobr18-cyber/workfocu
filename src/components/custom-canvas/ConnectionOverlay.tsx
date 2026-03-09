import { useCanvasStore } from "@/hooks/useCanvasStore";

const LINE_COLOR = "hsl(var(--muted-foreground) / 0.4)";
const DOT_COLOR = "hsl(var(--primary))";

interface Props {
  store: ReturnType<typeof useCanvasStore>;
  mousePos: { x: number; y: number } | null;
}

export default function ConnectionOverlay({ store, mousePos }: Props) {
  const { connections, linkingFrom, elements, viewport, removeConnection } = store;
  const { x: vx, y: vy, zoom } = viewport;

  const worldToScreen = (wx: number, wy: number) => ({
    x: wx * zoom + vx,
    y: wy * zoom + vy,
  });

  const lines = connections.map(conn => {
    const source = elements.find(e => e.id === conn.sourceId);
    const target = elements.find(e => e.id === conn.targetId);
    if (!source || !target) return null;

    const s = worldToScreen(source.x + source.width, source.y + source.height / 2);
    const t = worldToScreen(target.x, target.y + target.height / 2);
    return { id: conn.id, x1: s.x, y1: s.y, x2: t.x, y2: t.y };
  }).filter(Boolean) as { id: string; x1: number; y1: number; x2: number; y2: number }[];

  // Dragging wire from source
  let dragLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (linkingFrom && mousePos) {
    const source = elements.find(e => e.id === linkingFrom);
    if (source) {
      const s = worldToScreen(source.x + source.width, source.y + source.height / 2);
      dragLine = { x1: s.x, y1: s.y, x2: mousePos.x, y2: mousePos.y };
    }
  }

  if (lines.length === 0 && !dragLine) return null;

  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 450, overflow: "visible" }}
    >
      <defs>
        <style>{`
          @keyframes flowDash { to { stroke-dashoffset: -20; } }
          .conn-flow { stroke-dasharray: 8 4; animation: flowDash 0.8s linear infinite; }
          @keyframes dragPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          .drag-pulse { animation: dragPulse 0.8s ease-in-out infinite; }
        `}</style>
      </defs>

      {lines.map(line => {
        const dx = line.x2 - line.x1;
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 60);
        const path = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;
        const mx = (line.x1 + line.x2) / 2;
        const my = (line.y1 + line.y2) / 2;

        return (
          <g key={line.id}>
            {/* Glow */}
            <path d={path} stroke={LINE_COLOR} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.3} />
            {/* Main line */}
            <path d={path} stroke={LINE_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" className="conn-flow" />
            {/* Animated particles */}
            {[0, 0.7, 1.4].map((delay, i) => (
              <circle key={i} r={2.5} fill={DOT_COLOR} opacity={0.6}>
                <animateMotion dur="2s" repeatCount="indefinite" begin={`${delay}s`} path={path} />
              </circle>
            ))}
            {/* Source dot */}
            <circle cx={line.x1} cy={line.y1} r={5} fill={DOT_COLOR} stroke="white" strokeWidth={1.5} />
            {/* Target dot */}
            <circle cx={line.x2} cy={line.y2} r={5} fill={DOT_COLOR} stroke="white" strokeWidth={1.5} />
            {/* Delete button */}
            <g style={{ cursor: "pointer", pointerEvents: "all" }} onClick={() => removeConnection(line.id)}>
              <circle cx={mx} cy={my} r={9} fill="hsl(var(--card))" stroke="hsl(var(--destructive))" strokeWidth={1.5} />
              <line x1={mx - 3} y1={my - 3} x2={mx + 3} y2={my + 3} stroke="hsl(var(--destructive))" strokeWidth={2} strokeLinecap="round" />
              <line x1={mx + 3} y1={my - 3} x2={mx - 3} y2={my + 3} stroke="hsl(var(--destructive))" strokeWidth={2} strokeLinecap="round" />
            </g>
          </g>
        );
      })}

      {/* Drag wire */}
      {dragLine && (() => {
        const dx = dragLine.x2 - dragLine.x1;
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 40);
        const path = `M ${dragLine.x1} ${dragLine.y1} C ${dragLine.x1 + cpOffset} ${dragLine.y1}, ${dragLine.x2 - cpOffset} ${dragLine.y2}, ${dragLine.x2} ${dragLine.y2}`;
        return (
          <g>
            <path d={path} stroke={DOT_COLOR} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.3} />
            <path d={path} stroke={DOT_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="6 4" className="drag-pulse" />
            <circle cx={dragLine.x1} cy={dragLine.y1} r={5} fill={DOT_COLOR} stroke="white" strokeWidth={1.5} />
            <circle cx={dragLine.x2} cy={dragLine.y2} r={4} fill={DOT_COLOR} stroke="white" strokeWidth={1.5} opacity={0.7}>
              <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })()}
    </svg>
  );
}
