import { useEffect, useRef, useCallback, useState } from "react";
import { Editor, TLRecord, createTLStore, defaultShapeUtils, SerializedStore, StoreSnapshot } from "tldraw";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface CanvasDocument {
  id: string;
  user_id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
}

export function useCanvasPersistence(editor: Editor | null) {
  const { user } = useAuth();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);

  // Load or create canvas document
  useEffect(() => {
    if (!user || !editor) return;

    const loadOrCreate = async () => {
      isLoadingRef.current = true;

      try {
        // Try to get existing canvas for this user
        const { data: existing, error } = await supabase
          .from("canvas_documents")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (existing && !error) {
          setDocumentId(existing.id);
          
          // Load content into editor
          if (existing.content) {
            try {
              const snapshot = existing.content as StoreSnapshot<TLRecord>;
              editor.store.loadSnapshot(snapshot);
            } catch (e) {
              console.warn("Failed to load canvas snapshot:", e);
            }
          }
        } else {
          // Create new document
          const { data: newDoc, error: createError } = await supabase
            .from("canvas_documents")
            .insert({
              user_id: user.id,
              name: "Meu Canvas",
              content: editor.store.getSnapshot(),
            })
            .select()
            .single();

          if (newDoc && !createError) {
            setDocumentId(newDoc.id);
          }
        }
      } catch (e) {
        console.error("Error loading canvas:", e);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadOrCreate();
  }, [user, editor]);

  // Auto-save on changes
  const saveToCloud = useCallback(async () => {
    if (!editor || !documentId || !user || isLoadingRef.current) return;

    setIsSaving(true);
    try {
      const snapshot = editor.store.getSnapshot();
      
      const { error } = await supabase
        .from("canvas_documents")
        .update({ content: snapshot })
        .eq("id", documentId)
        .eq("user_id", user.id);

      if (!error) {
        setLastSaved(new Date());
      }
    } catch (e) {
      console.error("Error saving canvas:", e);
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentId, user]);

  // Listen for changes and debounce save
  useEffect(() => {
    if (!editor || !documentId) return;

    const unsub = editor.store.listen(() => {
      if (isLoadingRef.current) return;

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save by 2 seconds
      saveTimeoutRef.current = setTimeout(() => {
        saveToCloud();
      }, 2000);
    });

    return () => {
      unsub();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, documentId, saveToCloud]);

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (!editor) return;
    editor.undo();
  }, [editor]);

  const redo = useCallback(() => {
    if (!editor) return;
    editor.redo();
  }, [editor]);

  const canUndo = editor?.getCanUndo() ?? false;
  const canRedo = editor?.getCanRedo() ?? false;

  return {
    documentId,
    isSaving,
    lastSaved,
    undo,
    redo,
    canUndo,
    canRedo,
    saveNow: saveToCloud,
  };
}
