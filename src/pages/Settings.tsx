import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import SidebarNav from "@/components/SidebarNav";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Plus, Eye, EyeOff, Shield } from "lucide-react";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "wf_";
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

const Settings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, permissions, last_used_at, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (data) setKeys(data as unknown as ApiKeyRow[]);
  }, [user]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const createKey = async () => {
    if (!user) return;
    setCreatingKey(true);
    try {
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.substring(0, 11); // "wf_" + 8 chars

      const { error } = await supabase.from("api_keys").insert({
        user_id: user.id,
        name: newKeyName || "API Key",
        key_hash: keyHash,
        key_prefix: keyPrefix,
      });

      if (error) throw error;

      setNewlyCreatedKey(rawKey);
      setNewKeyName("");
      setShowKey(true);
      fetchKeys();
      toast({ title: "Chave criada!", description: "Copie agora — ela não será mostrada novamente." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Chave removida" });
    fetchKeys();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copiado!" });
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/canvas-api`;

  if (loading) return null;

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Configurações
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie suas chaves de API para agentes IA</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="w-5 h-5" />
                Chaves de API
              </CardTitle>
              <CardDescription>
                Crie chaves para que agentes IA acessem seu canvas via API REST.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da chave (ex: Meu Agente)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={createKey} disabled={creatingKey}>
                  <Plus className="w-4 h-4 mr-1" />
                  Criar
                </Button>
              </div>

              {newlyCreatedKey && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                  <p className="text-sm font-medium text-primary">
                    ⚠️ Copie esta chave agora — ela não será mostrada novamente!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded font-mono break-all">
                      {showKey ? newlyCreatedKey : "•".repeat(40)}
                    </code>
                    <Button size="icon" variant="ghost" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => copyKey(newlyCreatedKey)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setNewlyCreatedKey(null)}>
                    Fechar
                  </Button>
                </div>
              )}

              {keys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma chave criada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{k.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {k.key_prefix}••••••••
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {k.last_used_at
                            ? `Usado em ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}`
                            : "Nunca usado"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteKey(k.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documentação da API</CardTitle>
              <CardDescription>Como usar a API do Canvas com agentes IA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Base URL:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted p-2 rounded font-mono flex-1 break-all">
                    {baseUrl}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => copyKey(baseUrl)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Header de autenticação:</p>
                <code className="block text-xs bg-muted p-2 rounded font-mono">
                  x-api-key: wf_sua_chave_aqui
                </code>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Endpoints:</p>
                <div className="space-y-2 text-xs font-mono bg-muted p-3 rounded">
                  <p><span className="text-green-500">GET</span> /documents — Listar canvas</p>
                  <p><span className="text-green-500">GET</span> /documents/:id — Detalhes do canvas</p>
                  <p><span className="text-blue-500">POST</span> /documents — Criar canvas</p>
                  <p><span className="text-yellow-500">PUT</span> /documents/:id — Atualizar canvas</p>
                  <p><span className="text-red-500">DELETE</span> /documents/:id — Deletar canvas</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Exemplo (curl):</p>
                <pre className="text-xs bg-muted p-3 rounded font-mono overflow-x-auto whitespace-pre-wrap">
{`curl ${baseUrl}/documents \\\
  -H "x-api-key: wf_sua_chave"`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
