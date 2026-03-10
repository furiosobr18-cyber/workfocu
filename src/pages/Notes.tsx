import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, X, Link2, Unlink, Network, Eye, Edit3, Search, Brain as BrainIcon, List, GitBranch, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import NoteGraph from "@/components/NoteGraph";
import BrainCard from "@/components/BrainCard";
import BrainDetail from "@/components/BrainDetail";
import CreateBrainDialog from "@/components/CreateBrainDialog";
import BrainTree from "@/components/BrainTree";
import { useBrains, Brain } from "@/hooks/useBrains";
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
  { name: 'default', class: 'bg-card border-border', dot: 'bg-muted-foreground' },
  { name: 'blue', class: 'bg-blue-500/10 border-blue-500/30', dot: 'bg-blue-500' },
  { name: 'green', class: 'bg-green-500/10 border-green-500/30', dot: 'bg-green-500' },
  { name: 'purple', class: 'bg-purple-500/10 border-purple-500/30', dot: 'bg-purple-500' },
  { name: 'orange', class: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-500' },
  { name: 'pink', class: 'bg-pink-500/10 border-pink-500/30', dot: 'bg-pink-500' },
];

// Brains View Component with Tree/Grid toggle
interface BrainsViewContentProps {
  brains: Brain[];
  getRootBrains: () => Brain[];
  getChildBrains: (parentId: string) => Brain[];
  getNotesInBrain: (brainId: string) => string[];
  onSelectBrain: (brain: Brain) => void;
  onDeleteBrain: (brainId: string) => void;
  onCreateBrain: () => void;
}

const BrainsViewContent = ({
  brains,
  getRootBrains,
  getChildBrains,
  getNotesInBrain,
  onSelectBrain,
  onDeleteBrain,
  onCreateBrain,
}: BrainsViewContentProps) => {
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");
  
  return (
    <div className="flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {getRootBrains().length} {getRootBrains().length === 1 ? 'cérebro' : 'cérebros'}
          </p>
          
          {/* View Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("grid")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "tree" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("tree")}
            >
              <GitBranch className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button onClick={onCreateBrain}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cérebro
        </Button>
      </div>
      
      {getRootBrains().length === 0 ? (
        <Card className="p-12 text-center">
          <BrainIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum Segundo Cérebro</h3>
          <p className="text-muted-foreground mb-4">
            Conecte notas para criar automaticamente um cérebro, ou crie um manualmente.
          </p>
          <Button onClick={onCreateBrain}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Primeiro Cérebro
          </Button>
        </Card>
      ) : viewMode === "tree" ? (
        <Card className="p-4">
          <BrainTree
            brains={brains}
            getChildBrains={getChildBrains}
            getNotesInBrain={getNotesInBrain}
            onSelectBrain={onSelectBrain}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {getRootBrains().map((brain) => (
            <BrainCard
              key={brain.id}
              brain={brain}
              noteCount={getNotesInBrain(brain.id).length}
              subBrainCount={getChildBrains(brain.id).length}
              onClick={() => onSelectBrain(brain)}
              onDelete={() => onDeleteBrain(brain.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Notes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [notes, setNotes] = useState<Note[]>(() => { try { const r = localStorage.getItem("notes_cache"); return r ? JSON.parse(r) : []; } catch { return []; } });
  const [noteLinks, setNoteLinks] = useState<NoteLink[]>(() => { try { const r = localStorage.getItem("notelinks_cache"); return r ? JSON.parse(r) : []; } catch { return []; } });
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [activeView, setActiveView] = useState<"notes" | "brains" | "graph">("notes");
  const [isLinking, setIsLinking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState<"edit" | "preview">("edit");
  
  // Brain state
  const {
    brains,
    loading: brainsLoading,
    createBrain,
    updateBrain,
    deleteBrain,
    addNoteToBrain,
    removeNoteFromBrain,
    getNotesInBrain,
    getLooseNoteIds,
    getBrainColor,
    getBrainForNote,
    getRootBrains,
    getChildBrains,
  } = useBrains(user?.id);
  
  const [selectedBrain, setSelectedBrain] = useState<Brain | null>(null);
  const [brainStack, setBrainStack] = useState<Brain[]>([]); // Stack for navigation
  const [showCreateBrainDialog, setShowCreateBrainDialog] = useState(false);
  const [pendingBrainNotes, setPendingBrainNotes] = useState<string[]>([]);
  const [isCreatingSubBrain, setIsCreatingSubBrain] = useState(false);

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
    try { localStorage.setItem("notes_cache", JSON.stringify(data || [])); } catch {}
  };

  const fetchNoteLinks = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('note_links')
      .select('*')
      .eq('user_id', user.id);
    
    setNoteLinks(data || []);
    try { localStorage.setItem("notelinks_cache", JSON.stringify(data || [])); } catch {}
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
      setEditMode("edit");
      toast({ title: "Nota criada!" });
    }
    
    setIsCreating(false);
  };

  // Create note directly inside a brain
  const createNoteInBrain = async (title: string, brainId: string) => {
    if (!title.trim() || !user) return null;
    
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: user.id, title: title.trim(), content: "" })
      .select()
      .single();
    
    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar a nota.", variant: "destructive" });
      return null;
    }
    
    if (data) {
      setNotes([data, ...notes]);
      await addNoteToBrain(brainId, data.id);
      toast({ title: "Nota criada no cérebro!" });
      return data;
    }
    
    return null;
  };

  const updateNote = async () => {
    if (!selectedNote) return;
    
    const { error } = await supabase
      .from('notes')
      .update({ content: editContent })
      .eq('id', selectedNote.id);
    
    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
      return;
    }
    
    setNotes(notes.map(n => 
      n.id === selectedNote.id ? { ...n, content: editContent, updated_at: new Date().toISOString() } : n
    ));
    
    toast({ title: "Salvo!" });
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
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
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
      toast({ title: "Erro", description: "Não foi possível conectar.", variant: "destructive" });
    } else if (data) {
      setNoteLinks([...noteLinks, data]);
      toast({ title: "Notas conectadas!" });
      
      // Check if we should prompt for brain creation
      const connectedNotesCount = getConnectedNotesRecursive(selectedNote.id, [...noteLinks, data]).length;
      if (connectedNotesCount >= 2) {
        const looseNoteIds = getLooseNoteIds(notes.map(n => n.id));
        const connectedLooseNotes = getConnectedNotesRecursive(selectedNote.id, [...noteLinks, data])
          .filter(id => looseNoteIds.includes(id) || id === selectedNote.id);
        
        if (connectedLooseNotes.length >= 2 && looseNoteIds.includes(selectedNote.id)) {
          setPendingBrainNotes(connectedLooseNotes);
          setShowCreateBrainDialog(true);
        }
      }
    }
    
    setIsLinking(false);
  };

  const getConnectedNotesRecursive = (noteId: string, links: NoteLink[], visited: Set<string> = new Set()): string[] => {
    if (visited.has(noteId)) return [];
    visited.add(noteId);
    
    const directConnections = links
      .filter(l => l.source_note_id === noteId || l.target_note_id === noteId)
      .map(l => l.source_note_id === noteId ? l.target_note_id : l.source_note_id);
    
    let allConnections = [noteId];
    for (const connId of directConnections) {
      allConnections = [...allConnections, ...getConnectedNotesRecursive(connId, links, visited)];
    }
    
    return allConnections;
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
    setEditMode("edit");
    setActiveView("notes");
    // Keep selectedBrain reference if the note belongs to a brain
    const noteBrain = getBrainForNote(note.id);
    if (!noteBrain) {
      setSelectedBrain(null);
    }
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

  // Get loose notes (notes not in any brain) - memoized
  const looseNoteIds = useMemo(() => getLooseNoteIds(notes.map(n => n.id)), [notes, getLooseNoteIds]);
  const looseNotes = useMemo(() => notes.filter(n => looseNoteIds.includes(n.id)), [notes, looseNoteIds]);
  
  const filteredNotes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return looseNotes.filter(n => 
      n.title.toLowerCase().includes(q) ||
      (n.content && n.content.toLowerCase().includes(q))
    );
  }, [looseNotes, searchQuery]);

  const handleCreateBrain = async (name: string, color: string) => {
    if (isCreatingSubBrain && selectedBrain) {
      await createBrain(name, pendingBrainNotes, color, selectedBrain.id);
    } else {
      await createBrain(name, pendingBrainNotes, color);
    }
    setPendingBrainNotes([]);
    setIsCreatingSubBrain(false);
  };

  const handleDeleteBrain = async (brainId: string) => {
    await deleteBrain(brainId);
    if (selectedBrain?.id === brainId) {
      // Go back to parent or root
      if (brainStack.length > 0) {
        const newStack = [...brainStack];
        const parent = newStack.pop();
        setBrainStack(newStack);
        setSelectedBrain(parent || null);
      } else {
        setSelectedBrain(null);
      }
    }
  };

  const handleSelectBrain = (brain: Brain) => {
    if (selectedBrain) {
      setBrainStack([...brainStack, selectedBrain]);
    }
    setSelectedBrain(brain);
  };

  const handleBackFromBrain = () => {
    if (brainStack.length > 0) {
      const newStack = [...brainStack];
      const parent = newStack.pop();
      setBrainStack(newStack);
      setSelectedBrain(parent || null);
    } else {
      setSelectedBrain(null);
    }
  };

  const handleCreateSubBrain = () => {
    setIsCreatingSubBrain(true);
    setPendingBrainNotes([]);
    setShowCreateBrainDialog(true);
  };

  const connectedNotes = useMemo(() => selectedNote ? getConnectedNotes(selectedNote.id) : [], [selectedNote, noteLinks, notes]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  // Brain detail view
  if (selectedBrain) {
    const brainNoteIds = getNotesInBrain(selectedBrain.id);
    const brainNotes = notes.filter(n => brainNoteIds.includes(n.id));
    const childBrains = getChildBrains(selectedBrain.id);
    
    // If a note is selected within the brain, show only the editor
    if (selectedNote && brainNoteIds.includes(selectedNote.id)) {
      return (
        <div className="flex min-h-screen bg-background">
          <SidebarNav />
          <main className="flex-1 p-6 overflow-hidden">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              {/* Back button */}
              <div className="mb-4">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedNote(null); setEditContent(""); }}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para {selectedBrain.name}
                </Button>
              </div>

              <Card className="flex-1 flex flex-col min-w-0">
                {/* Note Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${getDotClass(selectedNote.color)}`} />
                      <h2 className="text-lg font-semibold text-foreground truncate">{selectedNote.title}</h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-1 p-1 bg-muted rounded-lg">
                        {NOTE_COLORS.map((color) => (
                          <button
                            key={color.name}
                            onClick={() => updateNoteColor(selectedNote.id, color.name)}
                            className={`w-5 h-5 rounded-full transition-transform ${color.dot} ${
                              selectedNote.color === color.name ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setSelectedNote(null); setEditContent(""); }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Editor/Preview Toggle */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                  <div className="flex gap-1">
                    <Button variant={editMode === "edit" ? "secondary" : "ghost"} size="sm" onClick={() => setEditMode("edit")} className="h-8">
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button variant={editMode === "preview" ? "secondary" : "ghost"} size="sm" onClick={() => setEditMode("preview")} className="h-8">
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Preview
                    </Button>
                  </div>
                  <Button size="sm" onClick={updateNote} className="h-8">Salvar</Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {editMode === "preview" ? (
                    <div className="h-full overflow-auto p-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-sm">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0 font-mono">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mb-3 mt-5 font-mono">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mb-2 mt-4 font-mono">{children}</h3>,
                            p: ({ children }) => <p className="text-foreground mb-3 leading-relaxed font-mono">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside text-foreground mb-3 space-y-1 font-mono">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside text-foreground mb-3 space-y-1 font-mono">{children}</ol>,
                            li: ({ children }) => <li className="text-foreground font-mono">{children}</li>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>,
                            pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-3 font-mono">{children}</pre>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-3 font-mono">{children}</blockquote>,
                            a: ({ children, href }) => <a href={href} className="text-primary underline hover:opacity-80 font-mono">{children}</a>,
                            hr: () => <hr className="border-border my-4" />,
                          }}
                        >
                          {editContent || "*Comece a escrever...*"}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      placeholder="Escreva em Markdown..."
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="h-full resize-none border-0 rounded-none focus-visible:ring-0 font-mono text-sm p-6"
                    />
                  )}
                </div>
              </Card>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen bg-background">
        <SidebarNav />
        <main className="flex-1 p-6 overflow-hidden">
          <div className="max-w-7xl mx-auto h-full">
            <BrainDetail
              brain={selectedBrain}
              brainNotes={brainNotes}
              allNotes={notes}
              noteLinks={noteLinks}
              looseNotes={looseNotes}
              childBrains={childBrains}
              onBack={handleBackFromBrain}
              onUpdateBrain={(updates) => updateBrain(selectedBrain.id, updates)}
              onAddNote={(noteId) => addNoteToBrain(selectedBrain.id, noteId)}
              onRemoveNote={(noteId) => removeNoteFromBrain(selectedBrain.id, noteId)}
              onSelectNote={selectNote}
              onSelectBrain={handleSelectBrain}
              onCreateSubBrain={handleCreateSubBrain}
              onDeleteBrain={handleDeleteBrain}
              getNotesInBrain={getNotesInBrain}
              onCreateNoteInBrain={(title) => createNoteInBrain(title, selectedBrain.id)}
            />
          </div>
        </main>
        
        <CreateBrainDialog
          open={showCreateBrainDialog}
          onOpenChange={(open) => {
            setShowCreateBrainDialog(open);
            if (!open) setIsCreatingSubBrain(false);
          }}
          onCreateBrain={handleCreateBrain}
          initialNoteCount={pendingBrainNotes.length}
          isSubBrain={isCreatingSubBrain}
          parentBrainName={selectedBrain.name}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      
      <main className="flex-1 p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segundo Cérebro</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {notes.length} notas · {brains.length} cérebros · {noteLinks.length} conexões
              </p>
            </div>
            
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "notes" | "brains" | "graph")}>
              <TabsList>
                <TabsTrigger value="notes">Notas</TabsTrigger>
                <TabsTrigger value="brains">
                  <BrainIcon className="w-4 h-4 mr-2" />
                  Cérebros
                </TabsTrigger>
                <TabsTrigger value="graph">
                  <Network className="w-4 h-4 mr-2" />
                  Grafo
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Brains View */}
          {activeView === "brains" && (
            <BrainsViewContent
              brains={brains}
              getRootBrains={getRootBrains}
              getChildBrains={getChildBrains}
              getNotesInBrain={getNotesInBrain}
              onSelectBrain={handleSelectBrain}
              onDeleteBrain={handleDeleteBrain}
              onCreateBrain={() => {
                setPendingBrainNotes([]);
                setIsCreatingSubBrain(false);
                setShowCreateBrainDialog(true);
              }}
            />
          )}

          {activeView === "graph" ? (
            <Card className="flex-1 p-4">
              <NoteGraph 
                notes={notes} 
                links={noteLinks} 
                onSelectNote={(note) => {
                  selectNote(note);
                  setActiveView("notes");
                }}
                selectedNoteId={selectedNote?.id}
              />
            </Card>
          ) : activeView === "notes" && (
            <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={25} minSize={15} maxSize={50}>
                {/* Notes List */}
                <Card className="h-full flex flex-col mr-3">
                <div className="p-4 border-b border-border space-y-3">
                  {!(selectedNote && getBrainForNote(selectedNote.id)) && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar notas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  )}
                  
                  {/* Esconder "Nova nota" se a nota selecionada pertence a um cérebro */}
                  {!(selectedNote && getBrainForNote(selectedNote.id)) && (
                    <div className="flex gap-2">
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
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {brainsLoading ? (
                    <p className="text-muted-foreground text-sm p-4 text-center">
                      Carregando...
                    </p>
                  ) : looseNotes.length === 0 && notes.length > 0 ? (
                    <p className="text-muted-foreground text-sm p-4 text-center">
                      Todas as notas estão em cérebros.
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-primary" 
                        onClick={() => setActiveView("brains")}
                      >
                        Ver cérebros
                      </Button>
                    </p>
                  ) : filteredNotes.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-4 text-center">
                      {notes.length === 0 ? "Crie sua primeira nota" : "Nenhuma nota encontrada"}
                    </p>
                  ) : (
                    filteredNotes.map((note) => {
                      const connections = noteLinks.filter(
                        l => l.source_note_id === note.id || l.target_note_id === note.id
                      ).length;
                      
                      return (
                        <div
                          key={note.id}
                          onClick={() => isLinking ? linkNotes(note.id) : selectNote(note)}
                          className={`p-3 rounded-lg cursor-pointer transition-all group border ${getColorClass(note.color)} ${
                            selectedNote?.id === note.id
                              ? "ring-2 ring-primary"
                              : "hover:bg-accent/50"
                          } ${isLinking && selectedNote?.id !== note.id ? "hover:ring-2 hover:ring-green-500" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${getDotClass(note.color)}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">{note.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(note.updated_at).toLocaleDateString("pt-BR")}
                                </span>
                                {connections > 0 && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Link2 className="w-3 h-3" />
                                    {connections}
                                  </span>
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
                              className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                </Card>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={75} minSize={40}>
                {/* Editor */}
                <Card className="h-full flex flex-col min-w-0 ml-3">
                {selectedNote ? (
                  <>
                    {/* Note Header */}
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${getDotClass(selectedNote.color)}`} />
                          <h2 className="text-lg font-semibold text-foreground truncate">{selectedNote.title}</h2>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex gap-1 p-1 bg-muted rounded-lg">
                            {NOTE_COLORS.map((color) => (
                              <button
                                key={color.name}
                                onClick={() => updateNoteColor(selectedNote.id, color.name)}
                                className={`w-5 h-5 rounded-full transition-transform ${color.dot} ${
                                  selectedNote.color === color.name ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'
                                }`}
                              />
                            ))}
                          </div>
                          
                          <Button
                            variant={isLinking ? "default" : "outline"}
                            size="sm"
                            onClick={() => setIsLinking(!isLinking)}
                          >
                            <Link2 className="w-4 h-4" />
                            <span className="ml-2 hidden sm:inline">
                              {isLinking ? "Selecione" : "Conectar"}
                            </span>
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
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="text-xs text-muted-foreground">Conexões:</span>
                          {connectedNotes.map((note) => {
                            const link = noteLinks.find(
                              l => (l.source_note_id === selectedNote.id && l.target_note_id === note.id) ||
                                   (l.source_note_id === note.id && l.target_note_id === selectedNote.id)
                            );
                            return (
                              <Badge
                                key={note.id}
                                variant="secondary"
                                className="cursor-pointer hover:bg-accent group text-xs"
                              >
                                <span onClick={() => selectNote(note)}>{note.title}</span>
                                {link && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      unlinkNotes(link.id);
                                    }}
                                    className="ml-1.5 opacity-0 group-hover:opacity-100"
                                  >
                                    <Unlink className="w-3 h-3" />
                                  </button>
                                )}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Editor/Preview Toggle */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                      <div className="flex gap-1">
                        <Button
                          variant={editMode === "edit" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setEditMode("edit")}
                          className="h-8"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                          Editar
                        </Button>
                        <Button
                          variant={editMode === "preview" ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setEditMode("preview")}
                          className="h-8"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Preview
                        </Button>
                      </div>
                      
                      <Button size="sm" onClick={updateNote} className="h-8">
                        Salvar
                      </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                      {editMode === "preview" ? (
                        <div className="h-full overflow-auto p-6">
                          <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-sm">
                            <ReactMarkdown
                              components={{
                                h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0 font-mono">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mb-3 mt-5 font-mono">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mb-2 mt-4 font-mono">{children}</h3>,
                                p: ({ children }) => <p className="text-foreground mb-3 leading-relaxed font-mono">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc list-inside text-foreground mb-3 space-y-1 font-mono">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal list-inside text-foreground mb-3 space-y-1 font-mono">{children}</ol>,
                                li: ({ children }) => <li className="text-foreground font-mono">{children}</li>,
                                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>,
                                pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-3 font-mono">{children}</pre>,
                                blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-3 font-mono">{children}</blockquote>,
                                a: ({ children, href }) => <a href={href} className="text-primary underline hover:opacity-80 font-mono">{children}</a>,
                                hr: () => <hr className="border-border my-4" />,
                              }}
                            >
                              {editContent || "*Comece a escrever...*"}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <Textarea
                          placeholder="Escreva em Markdown...&#10;&#10;# Título&#10;## Subtítulo&#10;- Lista&#10;**negrito** _itálico_"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="h-full resize-none border-0 rounded-none focus-visible:ring-0 font-mono text-sm p-6"
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Network className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Selecione uma nota</p>
                      <p className="text-sm mt-1">ou crie uma nova para começar</p>
                    </div>
                  </div>
                )}
                </Card>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </main>

      <CreateBrainDialog
        open={showCreateBrainDialog}
        onOpenChange={setShowCreateBrainDialog}
        onCreateBrain={handleCreateBrain}
        initialNoteCount={pendingBrainNotes.length}
      />
    </div>
  );
};

export default Notes;
