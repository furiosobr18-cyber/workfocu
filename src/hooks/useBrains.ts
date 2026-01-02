import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Brain {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  parent_brain_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrainNote {
  id: string;
  brain_id: string;
  note_id: string;
  user_id: string;
  created_at: string;
}

export const BRAIN_COLORS = [
  { name: 'blue', class: 'bg-blue-500/20 border-blue-500/40', dot: 'bg-blue-500', text: 'text-blue-400' },
  { name: 'green', class: 'bg-green-500/20 border-green-500/40', dot: 'bg-green-500', text: 'text-green-400' },
  { name: 'purple', class: 'bg-purple-500/20 border-purple-500/40', dot: 'bg-purple-500', text: 'text-purple-400' },
  { name: 'orange', class: 'bg-orange-500/20 border-orange-500/40', dot: 'bg-orange-500', text: 'text-orange-400' },
  { name: 'pink', class: 'bg-pink-500/20 border-pink-500/40', dot: 'bg-pink-500', text: 'text-pink-400' },
  { name: 'cyan', class: 'bg-cyan-500/20 border-cyan-500/40', dot: 'bg-cyan-500', text: 'text-cyan-400' },
];

export const useBrains = (userId: string | undefined) => {
  const [brains, setBrains] = useState<Brain[]>([]);
  const [brainNotes, setBrainNotes] = useState<BrainNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrains = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('brains')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: "Erro", description: "Não foi possível carregar os cérebros.", variant: "destructive" });
      return;
    }

    setBrains((data || []) as Brain[]);
  }, [userId]);

  const fetchBrainNotes = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('brain_notes')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error("Error fetching brain_notes:", error);
      return;
    }

    setBrainNotes(data || []);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      Promise.all([fetchBrains(), fetchBrainNotes()]).finally(() => setLoading(false));
    }
  }, [userId, fetchBrains, fetchBrainNotes]);

  const createBrain = async (
    name: string, 
    noteIds: string[], 
    color: string = 'blue',
    parentBrainId: string | null = null
  ) => {
    if (!userId || !name.trim()) return null;

    const insertData: { user_id: string; name: string; color: string; parent_brain_id?: string } = {
      user_id: userId,
      name: name.trim(),
      color
    };

    if (parentBrainId) {
      insertData.parent_brain_id = parentBrainId;
    }

    const { data: brainData, error: brainError } = await supabase
      .from('brains')
      .insert(insertData)
      .select()
      .single();

    if (brainError || !brainData) {
      toast({ title: "Erro", description: "Não foi possível criar o cérebro.", variant: "destructive" });
      return null;
    }

    // Add notes to brain
    if (noteIds.length > 0) {
      const brainNotesInsert = noteIds.map(noteId => ({
        brain_id: brainData.id,
        note_id: noteId,
        user_id: userId
      }));

      const { data: notesData, error: notesError } = await supabase
        .from('brain_notes')
        .insert(brainNotesInsert)
        .select();

      if (notesError) {
        console.error("Error adding notes to brain:", notesError);
      } else if (notesData) {
        setBrainNotes(prev => [...prev, ...notesData]);
      }
    }

    setBrains(prev => [brainData as Brain, ...prev]);
    toast({ 
      title: parentBrainId ? "Segundo Cérebro criado!" : "Cérebro criado!", 
      description: `"${name}" foi criado${noteIds.length > 0 ? ` com ${noteIds.length} nota(s)` : ''}.` 
    });
    return brainData as Brain;
  };

  const updateBrain = async (brainId: string, updates: Partial<Pick<Brain, 'name' | 'color'>>) => {
    const { error } = await supabase
      .from('brains')
      .update(updates)
      .eq('id', brainId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar o cérebro.", variant: "destructive" });
      return false;
    }

    setBrains(prev => prev.map(b => b.id === brainId ? { ...b, ...updates } : b));
    return true;
  };

  const deleteBrain = async (brainId: string) => {
    const { error } = await supabase
      .from('brains')
      .delete()
      .eq('id', brainId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir o cérebro.", variant: "destructive" });
      return false;
    }

    // Also remove child brains from state
    setBrains(prev => prev.filter(b => b.id !== brainId && b.parent_brain_id !== brainId));
    setBrainNotes(prev => prev.filter(bn => bn.brain_id !== brainId));
    toast({ title: "Cérebro excluído" });
    return true;
  };

  const addNoteToBrain = async (brainId: string, noteId: string) => {
    if (!userId) return false;

    // Check if already exists
    const exists = brainNotes.some(bn => bn.brain_id === brainId && bn.note_id === noteId);
    if (exists) {
      toast({ title: "Nota já está no cérebro", variant: "destructive" });
      return false;
    }

    const { data, error } = await supabase
      .from('brain_notes')
      .insert({ brain_id: brainId, note_id: noteId, user_id: userId })
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: "Não foi possível adicionar a nota.", variant: "destructive" });
      return false;
    }

    setBrainNotes(prev => [...prev, data]);
    toast({ title: "Nota adicionada ao cérebro!" });
    return true;
  };

  const removeNoteFromBrain = async (brainId: string, noteId: string) => {
    const { error } = await supabase
      .from('brain_notes')
      .delete()
      .eq('brain_id', brainId)
      .eq('note_id', noteId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível remover a nota.", variant: "destructive" });
      return false;
    }

    setBrainNotes(prev => prev.filter(bn => !(bn.brain_id === brainId && bn.note_id === noteId)));
    toast({ title: "Nota removida do cérebro" });
    return true;
  };

  const getNotesInBrain = (brainId: string): string[] => {
    return brainNotes.filter(bn => bn.brain_id === brainId).map(bn => bn.note_id);
  };

  const getBrainForNote = (noteId: string): Brain | undefined => {
    const brainNote = brainNotes.find(bn => bn.note_id === noteId);
    if (!brainNote) return undefined;
    return brains.find(b => b.id === brainNote.brain_id);
  };

  const getLooseNoteIds = (allNoteIds: string[]): string[] => {
    const notesInBrains = new Set(brainNotes.map(bn => bn.note_id));
    return allNoteIds.filter(id => !notesInBrains.has(id));
  };

  const getBrainColor = (color: string | null) => {
    return BRAIN_COLORS.find(c => c.name === color) || BRAIN_COLORS[0];
  };

  // Get root-level brains (no parent)
  const getRootBrains = (): Brain[] => {
    return brains.filter(b => !b.parent_brain_id);
  };

  // Get child brains of a specific brain
  const getChildBrains = (parentBrainId: string): Brain[] => {
    return brains.filter(b => b.parent_brain_id === parentBrainId);
  };

  return {
    brains,
    brainNotes,
    loading,
    createBrain,
    updateBrain,
    deleteBrain,
    addNoteToBrain,
    removeNoteFromBrain,
    getNotesInBrain,
    getBrainForNote,
    getLooseNoteIds,
    getBrainColor,
    getRootBrains,
    getChildBrains,
    refetch: () => Promise.all([fetchBrains(), fetchBrainNotes()])
  };
};
