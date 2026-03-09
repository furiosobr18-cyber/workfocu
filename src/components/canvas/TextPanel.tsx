import { useState, useEffect, useCallback, useRef } from "react";
import { Editor, DefaultColorStyle, DefaultFontStyle, DefaultSizeStyle } from "tldraw";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Plus, ChevronDown, Type } from "lucide-react";
import FontPicker from "./FontPicker";

interface TextPanelProps {
  editor: Editor | null;
}

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

const TLDRAW_COLORS: Record<string, string> = {
  black: "000000",
  blue: "4263eb",
  green: "099268",
  grey: "adb5bd",
  "light-blue": "4dabf7",
  "light-green": "40c057",
  "light-red": "ff8787",
  "light-violet": "b197fc",
  orange: "f76707",
  red: "e03131",
  violet: "7048e8",
  white: "ffffff",
  yellow: "ffc078",
};

const FONT_TO_TLDRAW: Record<string, "sans" | "serif" | "mono" | "draw"> = {
  Inter: "sans",
  Arial: "sans",
  Helvetica: "sans",
  Roboto: "sans",
  Georgia: "serif",
  "Times New Roman": "serif",
  Palatino: "serif",
  Merriweather: "serif",
  "JetBrains Mono": "mono",
  "Fira Code": "mono",
  "Source Code Pro": "mono",
  "Courier New": "mono",
  "Comic Sans MS": "draw",
};

const TLDRAW_TO_FONT: Record<string, string> = {
  sans: "Inter",
  serif: "Georgia",
  mono: "JetBrains Mono",
  draw: "Comic Sans MS",
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").padStart(6, "0").slice(0, 6);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function getNearestTldrawColorName(hex: string): keyof typeof TLDRAW_COLORS {
  const source = hexToRgb(hex);
  let bestName: keyof typeof TLDRAW_COLORS = "black";
  let bestDistance = Number.POSITIVE_INFINITY;

  (Object.keys(TLDRAW_COLORS) as Array<keyof typeof TLDRAW_COLORS>).forEach((name) => {
    const target = hexToRgb(TLDRAW_COLORS[name]);
    const distance =
      (source.r - target.r) ** 2 +
      (source.g - target.g) ** 2 +
      (source.b - target.b) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = name;
    }
  });

  return bestName;
}

function getFontFormatFromUrl(fontUrl: string) {
  try {
    const pathname = new URL(fontUrl).pathname.toLowerCase();
    if (pathname.endsWith(".woff2")) return "woff2";
    if (pathname.endsWith(".woff")) return "woff";
    if (pathname.endsWith(".otf")) return "opentype";
    return "truetype";
  } catch {
    return "truetype";
  }
}

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

  const lastSyncedShapeId = useRef<string | null>(null);
  const sansOverrideFontRef = useRef<string>("Inter");
  const sansOverrideBlobUrlRef = useRef<string | null>(null);

  const refreshSansTextShapes = useCallback(() => {
    if (!editor) return;

    const sansShapes = editor
      .getCurrentPageShapes()
      .filter((shape) => (shape.type === "text" || shape.type === "geo") && (shape.props as any).font === "sans");

    sansShapes.forEach((shape) => {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { font: "sans" } as any,
      });
    });
  }, [editor]);

  const applyTldrawSansOverride = useCallback(async (fontName: string, fontUrl: string) => {
    sansOverrideFontRef.current = fontName;

    if (sansOverrideBlobUrlRef.current) {
      URL.revokeObjectURL(sansOverrideBlobUrlRef.current);
      sansOverrideBlobUrlRef.current = null;
    }

    let resolvedFontUrl = fontUrl;
    try {
      const response = await fetch(fontUrl);
      if (response.ok) {
        const blob = await response.blob();
        resolvedFontUrl = URL.createObjectURL(blob);
        sansOverrideBlobUrlRef.current = resolvedFontUrl;
      }
    } catch {
      resolvedFontUrl = fontUrl;
    }

    const format = getFontFormatFromUrl(fontUrl);
    const styleId = "tldraw-sans-font-override";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const faces = [100, 200, 300, 400, 500, 600, 700, 800, 900].map(
      (weight) => `
        @font-face {
          font-family: 'tldraw_sans';
          src: url('${resolvedFontUrl}') format('${format}');
          font-style: normal;
          font-weight: ${weight};
          font-display: swap;
        }
      `
    );

    styleEl.textContent = faces.join("\n");

    localStorage.setItem("canvas_sans_override_font", fontName);
    localStorage.setItem("canvas_sans_override_url", fontUrl);

    try {
      await document.fonts.load(`16px "tldraw_sans"`);
    } catch {
      // no-op
    }

    refreshSansTextShapes();
  }, [refreshSansTextShapes]);

  const clearTldrawSansOverride = useCallback(() => {
    const styleEl = document.getElementById("tldraw-sans-font-override");
    if (styleEl) styleEl.remove();

    if (sansOverrideBlobUrlRef.current) {
      URL.revokeObjectURL(sansOverrideBlobUrlRef.current);
      sansOverrideBlobUrlRef.current = null;
    }

    sansOverrideFontRef.current = "Inter";
    localStorage.removeItem("canvas_sans_override_font");
    localStorage.removeItem("canvas_sans_override_url");
    refreshSansTextShapes();
  }, [refreshSansTextShapes]);

  useEffect(() => {
    const savedFont = localStorage.getItem("canvas_sans_override_font");
    const savedUrl = localStorage.getItem("canvas_sans_override_url");

    if (savedFont && savedUrl) {
      void applyTldrawSansOverride(savedFont, savedUrl);
      setFontFamily(savedFont);
    }

    return () => {
      if (sansOverrideBlobUrlRef.current) {
        URL.revokeObjectURL(sansOverrideBlobUrlRef.current);
        sansOverrideBlobUrlRef.current = null;
      }
    };
  }, [applyTldrawSansOverride]);

  const syncFromEditor = useCallback(() => {
    if (!editor) return;

    const currentTool = editor.getCurrentToolId();
    const shapes = editor.getSelectedShapes();
    const textShape = shapes.find((s) => s.type === "text" || s.type === "geo");

    if (currentTool === "text" || textShape) {
      setVisible(true);
    } else {
      setVisible(false);
      return;
    }

    if (textShape && textShape.id !== lastSyncedShapeId.current) {
      lastSyncedShapeId.current = textShape.id;
      const props = textShape.props as any;

      if (props.font) {
        if (props.font === "sans" && sansOverrideFontRef.current && sansOverrideFontRef.current !== "Inter") {
          setFontFamily(sansOverrideFontRef.current);
        } else {
          setFontFamily(TLDRAW_TO_FONT[props.font] || "Inter");
        }
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

  const handleFontSelect = (font: string, customFontUrl?: string) => {
    if (!editor) return;

    setFontFamily(font);
    const mappedFont = FONT_TO_TLDRAW[font] ?? "sans";

    if (customFontUrl) {
      applyTldrawSansOverride(font, customFontUrl);
    } else if (font === "Inter") {
      clearTldrawSansOverride();
    }

    editor.setStyleForSelectedShapes(DefaultFontStyle, mappedFont as any);
    editor.setStyleForNextShapes(DefaultFontStyle, mappedFont as any);
    setFontPickerOpen(false);
  };

  const handleColorChange = (hex: string) => {
    if (!editor) return;

    const cleanHex = hex.replace("#", "").slice(0, 6).toLowerCase();
    const nearestName = getNearestTldrawColorName(cleanHex);

    setColor(cleanHex);
    editor.setStyleForSelectedShapes(DefaultColorStyle, nearestName as any);
    editor.setStyleForNextShapes(DefaultColorStyle, nearestName as any);
  };

  const handleAlignChange = (a: string) => {
    setAlign(a);

    if (!editor) return;
    const shapes = editor.getSelectedShapes().filter((s) => s.type === "text" || s.type === "geo");
    shapes.forEach((shape) => {
      editor.updateShape({ id: shape.id, type: shape.type, props: { align: a } as any });
    });
  };

  const handleSizeChange = (val: number) => {
    if (!editor) return;

    setFontSize(val);
    const size = val <= 14 ? "s" : val <= 20 ? "m" : val <= 30 ? "l" : "xl";

    editor.setStyleForSelectedShapes(DefaultSizeStyle, size as any);
    editor.setStyleForNextShapes(DefaultSizeStyle, size as any);
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
                    <option key={w} value={w}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </Row>

            <Row label="Cor">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="color"
                  value={`#${color}`}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <Input
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="flex-1 h-7 text-xs bg-secondary border-none font-mono"
                  maxLength={7}
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
                      align === value
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
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

function Row({ label, children }: { label: string; children: React.ReactNode; icon?: boolean }) {
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
