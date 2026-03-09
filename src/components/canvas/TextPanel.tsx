import { useState, useEffect, useCallback, useRef } from "react";
import { Editor } from "tldraw";
import { Input } from "@/components/ui/input";
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

// tldraw color names mapped to hex
const TLDRAW_COLORS: Record<string, string> = {
  black: "000000", blue: "4263eb", green: "099268", grey: "adb5bd",
  "light-blue": "4dabf7", "light-green": "40c057", "light-red": "ff8787",
  "light-violet": "b197fc", orange: "f76707", red: "e03131",
  violet: "7048e8", white: "ffffff", yellow: "ffc078",
};
const HEX_TO_TLDRAW: Record<string, string> = {};
Object.entries(TLDRAW_COLORS).forEach(([name, hex]) => { HEX_TO_TLDRAW[hex] = name; });

const FONT_TO_TLDRAW: Record<string, string> = {
  "Inter": "sans", "Arial": "sans", "Helvetica": "sans", "Roboto": "sans",
  "Georgia": "serif", "Times New Roman": "serif", "Palatino": "serif", "Merriweather": "serif",
  "JetBrains Mono": "mono", "Fira Code": "mono", "Source Code Pro": "mono", "Courier New": "mono",
  "Comic Sans MS": "draw",
};
const TLDRAW_TO_FONT: Record<string, string> = { sans: "Inter", serif: "Georgia", mono: "JetBrains Mono", draw: "Comic Sans MS" };

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
  
  // Track which shape we last synced from, to avoid overwriting user edits
  const lastSyncedShapeId = useRef<string | null>(null);
  const skipNextSync = useRef(false);

  const syncFromEditor = useCallback(() => {
    if (!editor) return;
    
    // If we just made a change, skip this sync cycle
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    
    const currentTool = editor.getCurrentToolId();
    const shapes = editor.getSelectedShapes();
    const textShape = shapes.find((s) => s.type === "text" || s.type === "geo");
    
    if (currentTool === "text" || textShape) {
      setVisible(true);
    } else {
      setVisible(false);
      return;
    }

    // Only sync props when a DIFFERENT shape is selected
    if (textShape && textShape.id !== lastSyncedShapeId.current) {
      lastSyncedShapeId.current = textShape.id;
      const props = textShape.props as any;
      if (props.font) {
        setFontFamily(TLDRAW_TO_FONT[props.font] || "Inter");
      }
      if (props.size) {
        const sizeMap: Record<string, number> = { s: 12, m: 16, l: 24, xl: 36 };
        setFontSize(sizeMap[props.size] || 16);
      }
      if (props.color) {
        setColor(TLDRAW_COLORS[props.color] || "000000");
      }
      if (props.align) setAlign(props.align);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    syncFromEditor();
    const unsub = editor.store.listen(syncFromEditor);
    return () => unsub();
  }, [editor, syncFromEditor]);

  const updateProp = (key: string, value: any) => {
    if (!editor) return;
    skipNextSync.current = true;
    const shapes = editor.getSelectedShapes().filter((s) => s.type === "text" || s.type === "geo");
    shapes.forEach((shape) => {
      editor.updateShape({ id: shape.id, type: shape.type, props: { [key]: value } });
    });
  };

  const handleFontSelect = (font: string) => {
    setFontFamily(font);
    const tldrawFont = FONT_TO_TLDRAW[font] || "sans";
    updateProp("font", tldrawFont);
    setFontPickerOpen(false);
  };

  const handleColorChange = (hex: string) => {
    setColor(hex);
    // Find closest tldraw color
    const tldrawColor = HEX_TO_TLDRAW[hex.toLowerCase()] || "black";
    updateProp("color", tldrawColor);
  };

  const handleAlignChange = (a: string) => {
    setAlign(a);
    updateProp("align", a);
  };

  const handleSizeChange = (val: number) => {
    setFontSize(val);
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

  return (
    <>
      <div className="absolute top-0 right-0 bottom-0 w-[260px] z-[500] bg-card border-l border-border flex flex-col shadow-xl">
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Texto</span>
              <button className="text-muted-foreground hover:text-foreground">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <Row label="Estilos">
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center text-foreground">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-muted-foreground">Select...</span>
              </div>
            </Row>

            <Row label="Fonte">
              <button
                onClick={() => setFontPickerOpen(true)}
                className="flex-1 flex items-center justify-between bg-secondary rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
              >
                <span style={{ fontFamily: `'${fontFamily}', sans-serif` }}>{fontFamily}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </Row>

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

            <Row label="Cor">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="color"
                  value={`#${color}`}
                  onChange={(e) => handleColorChange(e.target.value.replace("#", ""))}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <Input
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value.replace("#", "").slice(0, 6))}
                  className="flex-1 h-7 text-xs bg-secondary border-none font-mono"
                  maxLength={6}
                />
              </div>
            </Row>

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
