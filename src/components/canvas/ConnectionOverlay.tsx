import { useEffect, useState } from "react";
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

        // Source: right side center
        const sx = sB.x + sB.w;
        const sy = sB.y + sB.h / 2;
        // Target: left side center
        const tx = tB.x;
        const ty = tB.y + tB.h / 2;

        // Convert page coords to screen
        const s = editor.pageToScreen({ x: sx, y: sy });
        const t = editor.pageToScreen({ x: tx, y: ty });

        newLines.push({ id: conn.id, x1: s.x, y1: s.y, x2: t.x, y2: t.y });
      }
      setLines(newLines);
    };

    update();
    // Listen to camera and shape changes
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [editor, connections]);

  if (lines.length === 0 && !linkingFrom) return null;

  return (
    <svg
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
        {/* Animated dash */}
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
        `}</style>
      </defs>
      {lines.map((line) => (
        <g key={line.id}>
          {/* Glow */}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="url(#conn-gradient)"
            strokeWidth={6}
            strokeLinecap="round"
            className="conn-glow"
          />
          {/* Main line */}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="url(#conn-gradient)"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="conn-line"
          />
          {/* Data transfer particles (moving) */}
          {[0, 0.35, 0.7].map((delay, i) => (
            <circle key={i} r={3} fill="#ffffff" className="conn-glow">
              <animateMotion
                dur="1.8s"
                repeatCount="indefinite"
                begin={`${delay}s`}
                path={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
              />
            </circle>
          ))}
          {/* Source dot */}
          <circle cx={line.x1} cy={line.y1} r={6} fill="#4af" stroke="#fff" strokeWidth={2} />
          {/* Target dot */}
          <circle cx={line.x2} cy={line.y2} r={6} fill="#a040ff" stroke="#fff" strokeWidth={2} />
        </g>
      ))}
      {/* Linking mode indicator */}
      {linkingFrom && (
        <text x={20} y={30} fill="#4af" fontSize={13} fontFamily="sans-serif">
          🔗 Clique na bolinha do Chat para conectar...
        </text>
      )}
    </svg>
  );
}
