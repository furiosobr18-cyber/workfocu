import { useState } from "react";
import { useEditor } from "tldraw";

/**
 * Transparent overlay that blocks iframe/video pointer events,
 * allowing tldraw to handle drag/move. Double-click to interact.
 */
export function ShapeOverlay({ shapeId }: { shapeId: string }) {
  const editor = useEditor();
  const [interacting, setInteracting] = useState(false);

  // When user is interacting, let events pass through
  if (interacting) {
    return (
      <div
        style={{
          position: "absolute", inset: 0, zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setInteracting(false); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: 4, left: 4, zIndex: 10,
            pointerEvents: "all",
            background: "hsla(0,0%,7%,0.85)", border: "1px solid hsl(0,0%,25%)",
            borderRadius: 6, padding: "3px 8px", color: "hsl(0,0%,70%)",
            fontSize: 10, cursor: "pointer", backdropFilter: "blur(4px)",
          }}
        >
          🔓 Mover
        </button>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setInteracting(true);
      }}
      style={{
        position: "absolute", inset: 0, zIndex: 5,
        cursor: "grab", background: "transparent",
      }}
    />
  );
}
