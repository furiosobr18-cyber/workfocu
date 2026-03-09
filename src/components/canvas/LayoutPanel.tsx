import { useState } from "react";
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Maximize2,
  Eye,
  EyeOff,
} from "lucide-react";

interface LayoutPanelProps {
  shapeId: string;
  shapeType: string;
  padding: number;
  borderRadius: number;
  objectFit: string;
  alignX: string;
  alignY: string;
  overflow: string;
  opacity: number;
  bgColor: string;
}

const FIT_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Fit" },
  { value: "fill", label: "Stretch" },
  { value: "none", label: "Original" },
];

const BG_OPTIONS = [
  { value: "transparent", label: "—" },
  { value: "#000000", label: "⬛" },
  { value: "#ffffff", label: "⬜" },
  { value: "hsl(var(--card))", label: "🎨" },
];

function updateShape(shapeId: string, shapeType: string, props: Record<string, any>) {
  const editor = (window as any).__tldrawEditor;
  if (editor) {
    editor.updateShape({ id: shapeId, type: shapeType, props });
  }
}

export default function LayoutPanel({
  shapeId, shapeType, padding, borderRadius, objectFit,
  alignX, alignY, overflow, opacity, bgColor,
}: LayoutPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const u = (props: Record<string, any>) => updateShape(shapeId, shapeType, props);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute", top: 0, left: "calc(100% + 8px)", zIndex: 20,
        width: 200, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
        borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px hsla(0,0%,0%,0.25)",
        fontSize: 11, color: "hsl(var(--foreground))", pointerEvents: "all",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 10px", background: "hsl(var(--muted))",
          border: "none", borderBottom: expanded ? "1px solid hsl(var(--border))" : "none",
          cursor: "pointer", color: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600,
        }}
      >
        <span>⚙️ Layout</span>
        <span style={{ fontSize: 10 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Object Fit */}
          <Section label="Fit">
            <div style={{ display: "flex", gap: 2 }}>
              {FIT_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={objectFit === opt.value}
                  onClick={() => u({ objectFit: opt.value })}
                />
              ))}
            </div>
          </Section>

          {/* Alignment */}
          <Section label="Alinhamento">
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <MiniLabel>Horizontal</MiniLabel>
                <div style={{ display: "flex", gap: 2 }}>
                  <IconBtn active={alignX === "start"} onClick={() => u({ alignX: "start" })} title="Esquerda">
                    <AlignHorizontalJustifyStart size={12} />
                  </IconBtn>
                  <IconBtn active={alignX === "center"} onClick={() => u({ alignX: "center" })} title="Centro">
                    <AlignHorizontalJustifyCenter size={12} />
                  </IconBtn>
                  <IconBtn active={alignX === "end"} onClick={() => u({ alignX: "end" })} title="Direita">
                    <AlignHorizontalJustifyEnd size={12} />
                  </IconBtn>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <MiniLabel>Vertical</MiniLabel>
                <div style={{ display: "flex", gap: 2 }}>
                  <IconBtn active={alignY === "start"} onClick={() => u({ alignY: "start" })} title="Topo">
                    <AlignVerticalJustifyStart size={12} />
                  </IconBtn>
                  <IconBtn active={alignY === "center"} onClick={() => u({ alignY: "center" })} title="Centro">
                    <AlignVerticalJustifyCenter size={12} />
                  </IconBtn>
                  <IconBtn active={alignY === "end"} onClick={() => u({ alignY: "end" })} title="Base">
                    <AlignVerticalJustifyEnd size={12} />
                  </IconBtn>
                </div>
              </div>
            </div>
          </Section>

          {/* Padding */}
          <Section label="Padding">
            <SliderRow value={padding} min={0} max={60} onChange={(v) => u({ padding: v })} suffix="px" />
          </Section>

          {/* Border Radius */}
          <Section label="Radius">
            <SliderRow value={borderRadius} min={0} max={40} onChange={(v) => u({ borderRadius: v })} suffix="px" />
          </Section>

          {/* Opacity */}
          <Section label="Opacidade">
            <SliderRow value={Math.round(opacity * 100)} min={0} max={100} onChange={(v) => u({ opacity: v / 100 })} suffix="%" />
          </Section>

          {/* Overflow */}
          <Section label="Overflow">
            <div style={{ display: "flex", gap: 2 }}>
              <Chip label="Clip" active={overflow === "hidden"} onClick={() => u({ overflow: "hidden" })} />
              <Chip label="Visível" active={overflow === "visible"} onClick={() => u({ overflow: "visible" })} />
            </div>
          </Section>

          {/* Background */}
          <Section label="Background">
            <div style={{ display: "flex", gap: 3 }}>
              {BG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => u({ bgColor: opt.value })}
                  style={{
                    width: 22, height: 22, borderRadius: 4, cursor: "pointer",
                    border: bgColor === opt.value ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
                    background: opt.value === "transparent" ? "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%) 50% / 8px 8px" : opt.value,
                    fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    color: opt.value === "#000000" ? "#fff" : "#000",
                  }}
                >
                  {opt.value === "transparent" ? "" : ""}
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>{children}</span>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 7px", fontSize: 10, borderRadius: 4, cursor: "pointer",
        border: "none", fontWeight: active ? 600 : 400,
        background: active ? "hsl(var(--accent))" : "transparent",
        color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
      }}
    >
      {label}
    </button>
  );
}

function IconBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4, border: "none", cursor: "pointer",
        background: active ? "hsl(var(--accent))" : "transparent",
        color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
      }}
    >
      {children}
    </button>
  );
}

function SliderRow({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, height: 4, accentColor: "hsl(var(--primary))" }}
      />
      <span style={{ minWidth: 30, textAlign: "right", fontSize: 10, color: "hsl(var(--muted-foreground))", fontVariantNumeric: "tabular-nums" }}>
        {value}{suffix}
      </span>
    </div>
  );
}
