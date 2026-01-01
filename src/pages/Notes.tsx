import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, FileText, X, Link2, Unlink, Network, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import NoteGraph from "@/components/NoteGraph";
import ReactMarkdown from "react-markdown";

interface Note {
  id: string;
  title: string;
  content: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface NoteLink {
  id: string;
  source_note_id: string;
  target_note_id: string;
}

const NOTE_COLORS = [
  { name: 'default', class: 'bg-card', dot: 'bg-muted-foreground' },
  { name: 'blue', class: 'bg-blue-500/20', dot: 'bg-blue-500' },
  { name: 'green', class: 'bg-green-500/20', dot: 'bg-green-500' },
  { name: 'purple', class: 'bg-purple-500/20', dot: 'bg-purple-500' },
  { name: 'orange', class: 'bg-orange-500/20', dot: 'bg-orange-500' },
  { name: 'pink', class: 'bg-pink-500/20', dot: 'bg-pink-500' },
];

const Notes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showGraph, setShowGraph] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchNotes();
      fetchNoteLinks();
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
      toast({ title: "Erro", description: "Não foi possível carregar as notas.", variant: "destructive" });
      return;
    }
    
    setNotes(data || []);
  };

  const fetchNoteLinks = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('note_links')
      .select('*')
      .eq('user_id', user.id);
    
    setNoteLinks(data || []);
  };

  const createNote = async () => {
    if (!newTitle.trim() || !user) return;
    
    setIsCreating(true);
    
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: user.id, title: newTitle.trim(), content: "" })
      .select()
      .single();
    
    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar a nota.", variant: "destructive" });
    } else if (data) {
      setNotes([data, ...notes]);
      setSelectedNote(data);
      setEditContent("");
      setNewTitle("");
      toast({ title: "Nota criada!", description: "Sua nova nota foi adicionada." });
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
      toast({ title: "Erro", description: "Não foi possível salvar a nota.", variant: "destructive" });
      return;
    }
    
    setNotes(notes.map(n => 
      n.id === selectedNote.id ? { ...n, content: editContent, updated_at: new Date().toISOString() } : n
    ));
    
    toast({ title: "Nota salva!" });
  };

  const updateNoteColor = async (noteId: string, color: string) => {
    const { error } = await supabase
      .from('notes')
      .update({ color })
      .eq('id', noteId);
    
    if (!error) {
      setNotes(notes.map(n => n.id === noteId ? { ...n, color } : n));
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, color });
      }
    }
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir a nota.", variant: "destructive" });
      return;
    }
    
    setNotes(notes.filter(n => n.id !== noteId));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setEditContent("");
    }
    toast({ title: "Nota excluída" });
  };

  const linkNotes = async (targetNoteId: string) => {
    if (!selectedNote || !user || selectedNote.id === targetNoteId) return;
    
    // Check if link already exists
    const existingLink = noteLinks.find(
      l => (l.source_note_id === selectedNote.id && l.target_note_id === targetNoteId) ||
           (l.source_note_id === targetNoteId && l.target_note_id === selectedNote.id)
    );
    
    if (existingLink) {
      toast({ title: "Conexão já existe", variant: "destructive" });
      return;
    }
    
    const { data, error } = await supabase
      .from('note_links')
      .insert({
        user_id: user.id,
        source_note_id: selectedNote.id,
        target_note_id: targetNoteId
      })
      .select()
      .single();
    
    if (error) {
      toast({ title: "Erro", description: "Não foi possível conectar as notas.", variant: "destructive" });
    } else if (data) {
      setNoteLinks([...noteLinks, data]);
      toast({ title: "Notas conectadas!" });
    }
    
    setIsLinking(false);
  };

  const unlinkNotes = async (linkId: string) => {
    const { error } = await supabase.from('note_links').delete().eq('id', linkId);
    
    if (!error) {
      setNoteLinks(noteLinks.filter(l => l.id !== linkId));
      toast({ title: "Conexão removida" });
    }
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setEditContent(note.content || "");
    setIsLinking(false);
  };

  const getConnectedNotes = (noteId: string) => {
    const connectedIds = noteLinks
      .filter(l => l.source_note_id === noteId || l.target_note_id === noteId)
      .map(l => l.source_note_id === noteId ? l.target_note_id : l.source_note_id);
    
    return notes.filter(n => connectedIds.includes(n.id));
  };

  const getColorClass = (color: string | null) => {
    return NOTE_COLORS.find(c => c.name === color)?.class || NOTE_COLORS[0].class;
  };

  const getDotClass = (color: string | null) => {
    return NOTE_COLORS.find(c => c.name === color)?.dot || NOTE_COLORS[0].dot;
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (n.content && n.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  const connectedNotes = selectedNote ? getConnectedNotes(selectedNote.id) : [];

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      
      <main className="flex-1 flex">
        {/* Notes List */}
        <div className="w-80 border-r border-border p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-foreground">Segundo Cérebro</h1>
            <Button
              variant={showGraph ? "default" : "outline"}
              size="icon"
              onClick={() => setShowGraph(!showGraph)}
              title="Ver grafo de conexões"
            >
              <Network className="w-4 h-4" />
            </Button>
          </div>
          
          <Input
            placeholder="Buscar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />
          
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nova nota..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && createNote()}
            />
            <Button onClick={createNote} disabled={isCreating || !newTitle.trim()} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredNotes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma nota encontrada</p>
            ) : (
              filteredNotes.map((note) => {
                const connections = noteLinks.filter(
                  l => l.source_note_id === note.id || l.target_note_id === note.id
                ).length;
                
                return (
                  <div
                    key={note.id}
                    onClick={() => isLinking ? linkNotes(note.id) : selectNote(note)}
                    className={`p-3 rounded-lg cursor-pointer transition-all group ${getColorClass(note.color)} ${
                      selectedNote?.id === note.id
                        ? "ring-2 ring-primary"
                        : "hover:ring-1 hover:ring-border"
                    } ${isLinking && selectedNote?.id !== note.id ? "hover:ring-2 hover:ring-green-500" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-3 h-3 rounded-full mt-1 ${getDotClass(note.color)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{note.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {new Date(note.updated_at).toLocaleDateString("pt-BR")}
                          </p>
                          {connections > 0 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              <Link2 className="w-3 h-3 mr-1" />
                              {connections}
                            </Badge>
                          )}
                        </div>
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
                );
              })
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {showGraph ? (
            <div className="flex-1 p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Mapa de Conexões</h2>
              <NoteGraph 
                notes={notes} 
                links={noteLinks} 
                onSelectNote={selectNote}
                selectedNoteId={selectedNote?.id}
              />
            </div>
          ) : selectedNote ? (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${getDotClass(selectedNote.color)}`} />
                  <h2 className="text-2xl font-bold text-foreground">{selectedNote.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Color Picker */}
                  <div className="flex gap-1">
                    {NOTE_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => updateNoteColor(selectedNote.id, color.name)}
                        className={`w-5 h-5 rounded-full ${color.dot} ${
                          selectedNote.color === color.name ? 'ring-2 ring-offset-2 ring-primary' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant={isLinking ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsLinking(!isLinking)}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    {isLinking ? "Clique em uma nota" : "Conectar"}
                  </Button>
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
              </div>

              {/* Connected Notes */}
              {connectedNotes.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">Conectada a:</p>
                  <div className="flex flex-wrap gap-2">
                    {connectedNotes.map((note) => {
                      const link = noteLinks.find(
                        l => (l.source_note_id === selectedNote.id && l.target_note_id === note.id) ||
                             (l.source_note_id === note.id && l.target_note_id === selectedNote.id)
                      );
                      return (
                        <Badge
                          key={note.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-accent group"
                        >
                          <span onClick={() => selectNote(note)}>{note.title}</span>
                          {link && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                unlinkNotes(link.id);
                              }}
                              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Unlink className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Toggle Preview/Edit */}
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant={!isPreviewMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPreviewMode(false)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant={isPreviewMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPreviewMode(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </div>

              {isPreviewMode ? (
                <div className="flex-1 overflow-auto min-h-[300px] p-4 bg-muted/30 rounded-lg border border-border prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mb-3 mt-5">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mb-2 mt-4">{children}</h3>,
                      p: ({ children }) => <p className="text-foreground mb-3 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-foreground mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside text-foreground mb-3 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-foreground">{children}</li>,
                      strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                      em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                      code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>,
                      pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-3">{children}</blockquote>,
                      a: ({ children, href }) => <a href={href} className="text-primary underline hover:opacity-80">{children}</a>,
                      hr: () => <hr className="border-border my-4" />,
                    }}
                  >
                    {editContent || "*Nenhum conteúdo*"}
                  </ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  placeholder="Escreva sua nota em Markdown...&#10;&#10;# Título&#10;## Subtítulo&#10;- Lista&#10;**negrito** _itálico_&#10;`código`"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 resize-none min-h-[300px] font-mono"
                />
              )}
              
              <div className="mt-4 flex justify-end">
                <Button onClick={updateNote}>Salvar</Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Segundo Cérebro</p>
                <p className="text-sm mt-2">Crie notas e conecte ideias</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Notes;
