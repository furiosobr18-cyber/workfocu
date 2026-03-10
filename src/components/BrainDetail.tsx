import { useState } from "react";
import { Brain, BRAIN_COLORS } from "@/hooks/useBrains";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Brain as BrainIcon,
  Plus,
  X,
  Edit2,
  Check,
  Network,
  ChevronRight,
  Trash2,
  FileText,
} from "lucide-react";
import NoteGraph from "@/components/NoteGraph";

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

interface BrainDetailProps {
  brain: Brain;
  brainNotes: Note[];
  allNotes: Note[];
  noteLinks: NoteLink[];
  looseNotes: Note[];
  childBrains: Brain[];
  onBack: () => void;
  onUpdateBrain: (updates: Partial<Pick<Brain, 'name' | 'color'>>) => void;
  onAddNote: (noteId: string) => void;
  onRemoveNote: (noteId: string) => void;
  onSelectNote: (note: Note) => void;
  onSelectBrain: (brain: Brain) => void;
  onCreateSubBrain: () => void;
  onDeleteBrain: (brainId: string) => void;
  getNotesInBrain: (brainId: string) => string[];
  onCreateNoteInBrain: (title: string) => Promise<Note | null>;
}

const BrainDetail = ({
  brain,
  brainNotes,
  allNotes,
  noteLinks,
  looseNotes,
  childBrains,
  onBack,
  onUpdateBrain,
  onAddNote,
  onRemoveNote,
  onSelectNote,
  onSelectBrain,
  onCreateSubBrain,
  onDeleteBrain,
  getNotesInBrain,
  onCreateNoteInBrain,
}: BrainDetailProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(brain.name);
  const [showAddNotes, setShowAddNotes] = useState(false);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [viewMode, setViewMode] = useState<"content" | "graph">("content");

  const colorConfig = BRAIN_COLORS.find(c => c.name === brain.color) || BRAIN_COLORS[0];

  const handleSaveName = () => {
    if (editName.trim() && editName !== brain.name) {
      onUpdateBrain({ name: editName.trim() });
    }
    setIsEditing(false);
  };


  // Filter links to only show connections within this brain
  const brainNoteIds = new Set(brainNotes.map(n => n.id));
  const filteredLinks = noteLinks.filter(
    link => brainNoteIds.has(link.source_note_id) && brainNoteIds.has(link.target_note_id)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorConfig.dot}/20`}>
          <BrainIcon className={`w-5 h-5 ${colorConfig.text}`} />
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="max-w-xs"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <Button size="icon" variant="ghost" onClick={handleSaveName}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <h2 className="text-xl font-bold text-foreground">{brain.name}</h2>
            <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="h-7 w-7">
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Color picker */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {BRAIN_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => onUpdateBrain({ color: color.name })}
              className={`w-5 h-5 rounded-full transition-transform ${color.dot} ${
                brain.color === color.name ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stats & Controls */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {brainNotes.length} {brainNotes.length === 1 ? 'nota' : 'notas'} · 
          {childBrains.length} {childBrains.length === 1 ? 'sub-cérebro' : 'sub-cérebros'} · 
          {filteredLinks.length} conexões
        </p>

        <div className="flex gap-2">
          <Button
            variant={viewMode === "content" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("content")}
          >
            Conteúdo
          </Button>
          <Button
            variant={viewMode === "graph" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("graph")}
          >
            <Network className="w-4 h-4 mr-1" />
            Grafo
          </Button>
        </div>
      </div>

      {/* Add Notes Panel */}
      {showAddNotes && looseNotes.length > 0 && (
        <Card className="p-4 mb-4 border-dashed">
          <p className="text-sm text-muted-foreground mb-3">Notas disponíveis para adicionar:</p>
          <div className="flex flex-wrap gap-2">
            {looseNotes.map((note) => (
              <Badge
                key={note.id}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => {
                  onAddNote(note.id);
                  setShowAddNotes(false);
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                {note.title}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {showAddNotes && looseNotes.length === 0 && (
        <Card className="p-4 mb-4 border-dashed text-center text-muted-foreground">
          Todas as notas já estão em cérebros.
        </Card>
      )}

      {/* Content */}
      <Card className="flex-1 overflow-hidden">
        {viewMode === "graph" ? (
          <div className="h-full p-4">
            <NoteGraph
              notes={brainNotes}
              links={filteredLinks}
              onSelectNote={onSelectNote}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            {/* Sub-Brains Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Segundos Cérebros
                </h3>
                <Button variant="outline" size="sm" onClick={onCreateSubBrain}>
                  <Plus className="w-4 h-4 mr-1" />
                  Novo Sub-Cérebro
                </Button>
              </div>

              {childBrains.length === 0 ? (
                <Card className="p-6 border-dashed text-center">
                  <BrainIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Crie sub-cérebros para organizar melhor suas ideias
                  </p>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {childBrains.map((childBrain) => {
                    const childColor = BRAIN_COLORS.find(c => c.name === childBrain.color) || BRAIN_COLORS[0];
                    const childNoteCount = getNotesInBrain(childBrain.id).length;
                    
                    return (
                      <div
                        key={childBrain.id}
                        onClick={() => onSelectBrain(childBrain)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all group ${childColor.class} hover:shadow-md`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${childColor.dot}/20`}>
                          <BrainIcon className={`w-4 h-4 ${childColor.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{childBrain.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {childNoteCount} {childNoteCount === 1 ? 'nota' : 'notas'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBrain(childBrain.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Notas
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCreateNote(!showCreateNote);
                      setShowAddNotes(false);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Criar Nota
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddNotes(!showAddNotes);
                      setShowCreateNote(false);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Existente
                  </Button>
                </div>
              </div>

              {/* Create new note inline */}
              {showCreateNote && (
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Título da nova nota..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newNoteTitle.trim()) {
                        onCreateNoteInBrain(newNoteTitle.trim());
                        setNewNoteTitle("");
                        setShowCreateNote(false);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!newNoteTitle.trim()}
                    onClick={() => {
                      if (newNoteTitle.trim()) {
                        onCreateNoteInBrain(newNoteTitle.trim());
                        setNewNoteTitle("");
                        setShowCreateNote(false);
                      }
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreateNote(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )

              {brainNotes.length === 0 ? (
                <Card className="p-6 border-dashed text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma nota neste cérebro
                  </p>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {brainNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer group"
                      onClick={() => onSelectNote(note)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{note.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveNote(note.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 h-7 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BrainDetail;
