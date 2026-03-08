import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Trash2, Plus, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MirrorEntry {
  id: string;
  text: string;
  createdAt: string;
}

const STORAGE_KEY = "accountability-mirror-entries";

const AccountabilityMirror = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MirrorEntry[]>([]);
  const [newEntry, setNewEntry] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  const save = useCallback((updated: MirrorEntry[]) => {
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addEntry = () => {
    if (!newEntry.trim()) return;
    const entry: MirrorEntry = {
      id: crypto.randomUUID(),
      text: newEntry.trim(),
      createdAt: new Date().toISOString(),
    };
    save([entry, ...entries]);
    setNewEntry("");
    toast({ title: "Verdade registrada", description: "Sua reflexão foi salva." });
  };

  const deleteEntry = (id: string) => {
    save(entries.filter((e) => e.id !== id));
    toast({ title: "Removido", description: "Entrada removida." });
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
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Eye className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Accountability Mirror</h1>
                <p className="text-sm text-muted-foreground">
                  Encare a verdade sobre si mesmo. Sem filtros, sem desculpas.
                </p>
              </div>
            </div>
            <div className="border border-border rounded-lg bg-card p-4">
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                "Olhe no espelho e diga a verdade. Quem você é agora? O que precisa mudar?
                Escreva as verdades duras que você evita — e use-as como combustível."
              </p>
            </div>
          </div>

          {/* New Entry */}
          <div className="space-y-3">
            <Textarea
              placeholder="Escreva uma verdade sobre si mesmo..."
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              className="min-h-[120px] bg-card border-border text-foreground placeholder:text-muted-foreground resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) addEntry();
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Ctrl+Enter para salvar</span>
              <Button onClick={addEntry} disabled={!newEntry.trim()} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar verdade
              </Button>
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-3">
            {entries.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma verdade registrada ainda.</p>
                <p className="text-xs mt-1">Comece a encarar o espelho.</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="group border border-border rounded-lg bg-card p-4 space-y-2 transition-colors hover:border-muted-foreground/30"
                >
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {entry.text}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountabilityMirror;
