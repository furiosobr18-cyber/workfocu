import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Upload, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const GOOGLE_FONTS = [
  "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald", "Raleway",
  "Poppins", "Nunito", "Ubuntu", "Merriweather", "Playfair Display",
  "Source Sans Pro", "PT Sans", "Noto Sans", "Rubik", "Work Sans",
  "Fira Sans", "Quicksand", "Mulish", "Barlow", "Josefin Sans",
  "DM Sans", "Cabin", "Archivo", "Libre Baskerville", "Bitter",
  "Crimson Text", "EB Garamond", "Lora", "Spectral", "Cormorant",
  "Space Grotesk", "Space Mono", "JetBrains Mono", "Fira Code",
  "IBM Plex Mono", "Inconsolata", "Source Code Pro",
];

const WEB_FONTS = [
  "Inter", "Arial", "Helvetica", "Georgia", "Times New Roman",
  "Verdana", "Trebuchet MS", "Courier New", "Tahoma", "Impact",
  "Comic Sans MS", "Palatino", "Garamond", "Lucida Console",
];

function loadGoogleFont(fontName: string) {
  const id = `gf-${fontName.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

interface CustomFont {
  id: string;
  name: string;
  file_name: string;
  storage_path: string;
}

interface FontPickerProps {
  open: boolean;
  onClose: () => void;
  currentFont: string;
  onSelectFont: (font: string, customFontUrl?: string) => void;
}

type Category = "All" | "Web" | "Custom" | "Google";

export default function FontPicker({ open, onClose, currentFont, onSelectFont }: FontPickerProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchCustomFonts();
  }, [user]);

  useEffect(() => {
    customFonts.forEach((f) => {
      const id = `cf-${f.id}`;
      if (document.getElementById(id)) return;
      const { data } = supabase.storage.from("custom-fonts").getPublicUrl(f.storage_path);
      const ext = f.file_name.split(".").pop()?.toLowerCase() || "truetype";
      const formatMap: Record<string, string> = {
        ttf: "truetype",
        otf: "opentype",
        woff: "woff",
        woff2: "woff2",
      };
      const format = formatMap[ext] || "truetype";
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `@font-face { font-family: '${f.name}'; src: url('${data.publicUrl}') format('${format}'); font-display: swap; }`;
      document.head.appendChild(style);
    });
  }, [customFonts]);

  const fetchCustomFonts = async () => {
    if (!user) return;
    const { data } = await supabase.from("custom_fonts").select("*").eq("user_id", user.id);
    if (data) setCustomFonts(data);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["ttf", "otf", "woff", "woff2"].includes(ext || "")) {
      toast.error("Formato inválido. Use .ttf, .otf, .woff ou .woff2");
      return;
    }
    setUploading(true);
    const fontName = file.name.replace(/\.[^.]+$/, "");
    const storagePath = `${user.id}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage.from("custom-fonts").upload(storagePath, file, {
      contentType: file.type || "font/ttf",
    });
    if (uploadErr) {
      toast.error("Erro ao fazer upload: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: dbErr } = await supabase.from("custom_fonts").insert({
      user_id: user.id,
      name: fontName,
      file_name: file.name,
      storage_path: storagePath,
    });
    if (dbErr) {
      toast.error("Erro ao salvar fonte: " + dbErr.message);
      setUploading(false);
      return;
    }

    toast.success(`Fonte "${fontName}" adicionada!`);
    await fetchCustomFonts();
    setCategory("Custom");
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteFont = async (font: CustomFont) => {
    await supabase.storage.from("custom-fonts").remove([font.storage_path]);
    await supabase.from("custom_fonts").delete().eq("id", font.id);
    const el = document.getElementById(`cf-${font.id}`);
    el?.remove();
    setCustomFonts((prev) => prev.filter((f) => f.id !== font.id));
    toast.success(`Fonte "${font.name}" removida`);
  };

  const getFonts = (): string[] => {
    const customNames = customFonts.map((f) => f.name);
    let list: string[] = [];
    if (category === "All") list = [...WEB_FONTS, ...customNames, ...GOOGLE_FONTS];
    else if (category === "Web") list = WEB_FONTS;
    else if (category === "Custom") list = customNames;
    else if (category === "Google") list = GOOGLE_FONTS;
    if (search) list = list.filter((f) => f.toLowerCase().includes(search.toLowerCase()));
    return list;
  };

  const getCustomFontUrl = (fontName: string) => {
    const custom = customFonts.find((f) => f.name === fontName);
    if (!custom) return undefined;
    return supabase.storage.from("custom-fonts").getPublicUrl(custom.storage_path).data.publicUrl;
  };

  if (!open) return null;

  const categories: Category[] = ["All", "Web", "Custom", "Google"];
  const fonts = getFonts();

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-[320px] max-h-[520px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-semibold text-foreground">Fonts</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-2">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs bg-secondary border-none"
          />
        </div>

        <div className="px-4 pb-2 relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between bg-secondary rounded-md px-3 py-1.5 text-xs text-foreground"
          >
            {category}
            <ChevronDown className="w-3 h-3" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-4 right-4 z-10 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors ${
                    category === cat ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-1 flex flex-col gap-0.5">
            {fonts.map((font) => {
              const isGoogle = GOOGLE_FONTS.includes(font);
              const customUrl = getCustomFontUrl(font);
              return (
                <button
                  key={font}
                  onMouseEnter={() => isGoogle && loadGoogleFont(font)}
                  onClick={() => {
                    if (isGoogle) loadGoogleFont(font);
                    onSelectFont(font, customUrl);
                  }}
                  className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    currentFont === font ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  }`}
                  style={{ fontFamily: `'${font}', sans-serif` }}
                >
                  {font}
                </button>
              );
            })}
            {fonts.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma fonte encontrada</p>}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3 flex flex-col gap-2">
          {category === "Custom" && (
            <>
              {customFonts.length > 0 && (
                <div className="flex flex-col gap-1 max-h-24 overflow-auto">
                  {customFonts.map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-xs text-foreground">
                      <span style={{ fontFamily: `'${f.name}', sans-serif` }}>{f.name}</span>
                      <button onClick={() => handleDeleteFont(f)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 bg-secondary hover:bg-accent rounded-lg py-2 text-xs text-foreground transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Enviando..." : "Upload de fonte (.ttf, .otf, .woff)"}
                </div>
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </>
          )}
          {category !== "Custom" && (
            <Button variant="secondary" className="w-full text-xs" onClick={() => setCategory("Custom")}>
              Gerenciar fontes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
