import { useState, useEffect, useCallback } from "react";
import { Editor } from "tldraw";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Plus, ChevronDown, Type } from "lucide-react";
import FontPicker from "./FontPicker";

interface TextPanelProps {
  editor: Editor | null;
}

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
  500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black",
};

const SIZE_UNITS = ["Px", "Em", "Rem"] as const;

export default function TextPanel({ editor }: TextPanelProps) {
  const [visible, setVisible] = useState(false);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontWeight, setFontWeight] = useState(400);
  const [color, setColor] = useState("000000");
  const [fontSize, setFontSize] = useState(16);
  const [sizeUnit, setSizeUnit] = useState<string>("Px");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [letterUnit, setLetterUnit] = useState<string>("Em");
  const [lineHeight, setLineHeight] = useState(1.2);
  const [lineUnit, setLineUnit] = useState<string>("Em");
  const [align, setAlign] = useState<string>("start");
  const [fontPickerOpen, setFontPickerOpen] = useState(false);

  const syncFromEditor = useCallback(() => {
    if (!editor) return;
    const shapes = editor.getSelectedShapes();
    const textShape = shapes.find((s) => s.type === "text" || s.type === "geo");
    if (!textShape) { setVisible(false); return; }
    setVisible(true);
    const props = textShape.props as any;
    if (props.font) {
      const fontMap: Record<string, string> = { sans: "Inter", serif: "Georgia", mono: "JetBrains Mono", draw: "Comic Sans MS" };
      setFontFamily(fontMap[props.font] || "Inter");
    }
    if (props.size) {
      const sizeMap: Record<string, number> = { s: 12, m: 16, l: 24, xl: 36 };
      setFontSize(sizeMap[props.size] || 16);
    }
    if (props.color) setColor(props.color === "black" ? "000000" : props.color.replace("#", ""));
    if (props.align) setAlign(props.align);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    syncFromEditor();
    const unsub = editor.store.listen(syncFromEditor);
    return () => unsub();
  }, [editor, syncFromEditor]);

  const updateProp = (key: string, value: any) => {
    if (!editor) return;
    const shapes = editor.getSelectedShapes().filter((s) => s.type === "text" || s.type === "geo");
    shapes.forEach((shape) => {
      editor.updateShape({ id: shape.id, type: shape.type, props: { [key]: value } });
    });
  };

  const handleFontSelect = (font: string) => {
    setFontFamily(font);
    // Map back to tldraw fonts
    const reverseMap: Record<string, string> = {
      "Inter": "sans", "Georgia": "serif", "JetBrains Mono": "mono", "Comic Sans MS": "draw",
    };
    updateProp("font", reverseMap[font] || "sans");
    setFontPickerOpen(false);
  };

  const handleAlignChange = (a: string) => {
    setAlign(a);
    updateProp("align", a);
  };

  const handleSizeChange = (val: number) => {
    setFontSize(val);
    const sizeMap: Record<string, string> = {};
    if (val <= 14) updateProp("size", "s");
    else if (val <= 20) updateProp("size", "m");
    else if (val <= 30) updateProp("size", "l");
    else updateProp("size", "xl");
  };

  if (!visible) return null;

  const alignButtons = [
    { value: "start", icon: AlignLeft },
    { value: "middle", icon: AlignCenter },
    { value: "end", icon: AlignRight },
    { value: "justify", icon: AlignJustify },
  ];

  const weightLabel = WEIGHT_LABELS[fontWeight] || "Regular";

  return (
    <>
      <div className="absolute top-0 right-0 bottom-0 w-[260px] z-[500] bg-card border-l border-border flex flex-col shadow-xl">
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Texto</span>
              <button className="text-muted-foreground hover:text-foreground">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Estilos */}
            <Row label="Estilos">
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center text-foreground">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-muted-foreground">Select...</span>
              </div>
            </Row>

            {/* Fonte */}
            <Row label="Fonte">
              <button
                onClick={() => setFontPickerOpen(true)}
                className="flex-1 flex items-center justify-between bg-secondary rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
              >
                <span style={{ fontFamily: `'${fontFamily}', sans-serif` }}>{fontFamily}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </Row>

            {/* Peso */}
            <Row label="Peso">
              <div className="flex-1 flex items-center gap-1">
                <select
                  value={fontWeight}
                  onChange={(e) => setFontWeight(Number(e.target.value))}
                  className="flex-1 bg-secondary rounded-md px-2.5 py-1.5 text-xs text-foreground border-none outline-none"
                >
                  {Object.entries(WEIGHT_LABELS).map(([w, label]) => (
                    <option key={w} value={w}>{label}</option>
                  ))}
                </select>
              </div>
            </Row>

            {/* Cor */}
            <Row label="Cor">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="color"
                  value={`#${color}`}
                  onChange={(e) => {
                    const c = e.target.value.replace("#", "");
                    setColor(c);
                  }}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value.replace("#", "").slice(0, 6))}
                  className="flex-1 h-7 text-xs bg-secondary border-none font-mono"
                  maxLength={6}
                />
              </div>
            </Row>

            {/* Tamanho */}
            <Row label="Tamanho" icon>
              <div className="flex-1 flex items-center gap-1">
                <Input
                  type="number"
                  value={fontSize}
                  onChange={(e) => handleSizeChange(Number(e.target.value))}
                  className="flex-1 h-7 text-xs bg-secondary border-none"
                  min={1}
                />
                <UnitSelect value={sizeUnit} onChange={setSizeUnit} />
              </div>
            </Row>

            {/* Carta (Letter Spacing) */}
            <Row label="Carta">
              <div className="flex-1 flex items-center gap-1">
                <Input
                  type="number"
                  value={letterSpacing}
                  onChange={(e) => setLetterSpacing(Number(e.target.value))}
                  className="flex-1 h-7 text-xs bg-secondary border-none"
                  step={0.1}
                />
                <UnitSelect value={letterUnit} onChange={setLetterUnit} />
              </div>
            </Row>

            {/* Linha (Line Height) */}
            <Row label="Linha">
              <div className="flex-1 flex items-center gap-1">
                <Input
                  type="number"
                  value={lineHeight}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                  className="flex-1 h-7 text-xs bg-secondary border-none"
                  step={0.1}
                />
                <UnitSelect value={lineUnit} onChange={setLineUnit} />
              </div>
            </Row>

            {/* Alinhar */}
            <Row label="Alinhar">
              <div className="flex-1 flex items-center gap-0.5">
                {alignButtons.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleAlignChange(value)}
                    className={`p-1.5 rounded transition-colors ${
                      align === value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </Row>
          </div>
        </ScrollArea>
      </div>

      <FontPicker
        open={fontPickerOpen}
        onClose={() => setFontPickerOpen(false)}
        currentFont={fontFamily}
        onSelectFont={handleFontSelect}
      />
    </>
  );
}

function Row({ label, children, icon }: { label: string; children: React.ReactNode; icon?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-secondary rounded-md px-1.5 py-1 text-xs text-foreground border-none outline-none w-12"
    >
      <option>Px</option>
      <option>Em</option>
      <option>Rem</option>
    </select>
  );
}
