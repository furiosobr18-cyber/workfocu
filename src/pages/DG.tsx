import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Eye, Brain, Flame } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MirrorEntry {
  id: string;
  text: string;
  createdAt: string;
}

const STORAGE_KEY = "accountability-mirror-entries";

const DG = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MirrorEntry[]>([]);
  const [newEntry, setNewEntry] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setEntries(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const save = useCallback((updated: MirrorEntry[]) => {
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addEntry = () => {
    if (!newEntry.trim()) return;
    save([{ id: crypto.randomUUID(), text: newEntry.trim(), createdAt: new Date().toISOString() }, ...entries]);
    setNewEntry("");
    toast({ title: "Verdade registrada", description: "Sua reflexão foi salva." });
  };

  const deleteEntry = (id: string) => {
    save(entries.filter((e) => e.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Flame className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">DG</h1>
              <p className="text-xs text-muted-foreground">Ferramentas de mentalidade</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="mirror" className="w-full">
            <TabsList className="w-full bg-secondary">
              <TabsTrigger value="mirror" className="flex-1 gap-2 text-xs">
                <Eye className="w-4 h-4" />
                Accountability Mirror
              </TabsTrigger>
              <TabsTrigger value="40rule" className="flex-1 gap-2 text-xs">
                <Brain className="w-4 h-4" />
                The 40% Rule
              </TabsTrigger>
            </TabsList>

            {/* === ACCOUNTABILITY MIRROR === */}
            <TabsContent value="mirror" className="mt-4 space-y-4">
              <div className="border border-border rounded-lg bg-card p-4">
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  Encare a verdade sobre si mesmo. Olhe no espelho e escreva — sem filtros, sem desculpas.
                </p>
              </div>

              <div className="space-y-3">
                <Textarea
                  placeholder="Escreva uma verdade sobre si mesmo..."
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  className="min-h-[100px] bg-card border-border text-foreground placeholder:text-muted-foreground resize-none"
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) addEntry(); }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Ctrl+Enter para salvar</span>
                  <Button onClick={addEntry} disabled={!newEntry.trim()} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {entries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma verdade registrada.</p>
                  </div>
                ) : (
                  entries.map((entry) => (
                    <div key={entry.id} className="group border border-border rounded-lg bg-card p-3 flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{entry.text}</p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          {new Date(entry.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <button onClick={() => deleteEntry(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* === THE 40% RULE === */}
            <TabsContent value="40rule" className="mt-4">
              <div className="flex flex-col items-center text-center space-y-8 py-8">
                {/* Brain ring */}
                <div className="relative w-44 h-44">
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    <circle cx="100" cy="100" r="88" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                    <circle
                      cx="100" cy="100" r="88" fill="none"
                      stroke="hsl(var(--foreground))" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 88 * 0.4} ${2 * Math.PI * 88 * 0.6}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Brain className="w-12 h-12 text-foreground mb-1" />
                    <span className="text-xl font-bold text-foreground">40%</span>
                  </div>
                </div>

                <div className="space-y-4 max-w-md">
                  <h2 className="text-2xl font-bold text-foreground">The 40% Rule</h2>
                  <div className="border border-border rounded-lg bg-card p-5 space-y-3">
                    <p className="text-sm text-foreground leading-relaxed">
                      Quando você acha que chegou no seu limite, você está apenas a <span className="font-bold">40%</span> do seu potencial.
                    </p>
                    <div className="w-10 border-t border-border mx-auto" />
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      "A mente desiste muito antes do corpo. Ainda restam 60% de capacidade inexplorada."
                    </p>
                  </div>
                </div>

                {/* Bar */}
                <div className="w-full max-w-xs space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Limite percebido</span>
                    <span>Potencial real</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-foreground" style={{ width: "40%" }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium">40%</span>
                    <span className="text-muted-foreground">100%</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default DG;
