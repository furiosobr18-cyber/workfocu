import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Note {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

const Notes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch notes
  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as notas.",
        variant: "destructive"
      });
      return;
    }
    
    setNotes(data || []);
  };

  const createNote = async () => {
    if (!newTitle.trim() || !user) return;
    
    setIsCreating(true);
    
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        title: newTitle.trim(),
        content: ""
      })
      .select()
      .single();
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a nota.",
        variant: "destructive"
      });
    } else if (data) {
      setNotes([data, ...notes]);
      setSelectedNote(data);
      setEditContent("");
      setNewTitle("");
      toast({
        title: "Nota criada!",
        description: "Sua nova nota foi adicionada."
      });
    }
    
    setIsCreating(false);
  };

  const updateNote = async () => {
    if (!selectedNote) return;
    
    const { error } = await supabase
      .from('notes')
      .update({ content: editContent })
      .eq('id', selectedNote.id);
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a nota.",
        variant: "destructive"
      });
      return;
    }
    
    setNotes(notes.map(n => 
      n.id === selectedNote.id ? { ...n, content: editContent, updated_at: new Date().toISOString() } : n
    ));
    
    toast({
      title: "Nota salva!",
      description: "Suas alterações foram salvas."
    });
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a nota.",
        variant: "destructive"
      });
      return;
    }
    
    setNotes(notes.filter(n => n.id !== noteId));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setEditContent("");
    }
    toast({
      title: "Nota excluída",
      description: "A nota foi removida."
    });
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setEditContent(note.content || "");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      
      <main className="flex-1 flex">
        {/* Notes List */}
        <div className="w-80 border-r border-border p-4 flex flex-col">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-foreground mb-4">Notas</h1>
            <div className="flex gap-2">
              <Input
                placeholder="Título da nota..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1"
              />
              <Button onClick={createNote} disabled={isCreating || !newTitle.trim()} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {notes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma nota criada</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    selectedNote?.id === note.id
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{note.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(note.updated_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Note Editor */}
        <div className="flex-1 p-6">
          {selectedNote ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-foreground">{selectedNote.title}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedNote(null);
                    setEditContent("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                placeholder="Escreva sua nota..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 resize-none min-h-[300px]"
              />
              <div className="mt-4 flex justify-end">
                <Button onClick={updateNote}>Salvar</Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Selecione uma nota ou crie uma nova</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Notes;
