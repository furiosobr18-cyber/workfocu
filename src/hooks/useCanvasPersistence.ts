import { useEffect, useRef, useCallback, useState } from "react";
import { Editor, TLRecord, StoreSnapshot } from "tldraw";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const CACHE_KEY = "canvas_local_cache";
const CLOUD_SAVE_DELAY = 2000;
const LOCAL_SAVE_THROTTLE = 500;

function saveToLocalCache(snapshot: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // quota exceeded
  }
}

function loadFromLocalCache(): any | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function useCanvasPersistence(editor: Editor | null) {
  const { user } = useAuth();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);

  // Load from local cache IMMEDIATELY for zero-delay
  useEffect(() => {
    if (!editor) return;
    const cached = loadFromLocalCache();
    if (cached && typeof cached === "object" && "store" in cached && "schema" in cached) {
      try {
        editor.store.loadSnapshot(cached);
      } catch {}
    }
  }, [editor]);

  // Load or create canvas document from cloud
  useEffect(() => {
    if (!user || !editor) return;

    const loadOrCreate = async () => {
      isLoadingRef.current = true;
      try {
        const { data: existing, error } = await supabase
          .from("canvas_documents")
          .select("id, content, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (existing && !error) {
          setDocumentId(existing.id);
          if (existing.content) {
            try {
              const snapshot = existing.content as unknown as StoreSnapshot<TLRecord>;
              if (snapshot && typeof snapshot === "object" && "store" in snapshot && "schema" in snapshot) {
                editor.store.loadSnapshot(snapshot);
                saveToLocalCache(snapshot);
              }
            } catch (e) {
              console.warn("Failed to load canvas snapshot:", e);
            }
          }
        } else {
          const snapshot = editor.store.getSnapshot();
          const serialized = JSON.parse(JSON.stringify(snapshot));
          const { data: newDoc, error: createError } = await supabase
            .from("canvas_documents")
            .insert([{ user_id: user.id, name: "Meu Canvas", content: serialized }])
            .select("id")
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

  const saveToCloud = useCallback(async () => {
    if (!editor || !documentId || !user || isLoadingRef.current) return;

    setIsSaving(true);
    try {
      const snapshot = editor.store.getSnapshot();
      const serialized = JSON.parse(JSON.stringify(snapshot));
      saveToLocalCache(serialized);

      const { error } = await supabase
        .from("canvas_documents")
        .update({ content: serialized })
        .eq("id", documentId)
        .eq("user_id", user.id);

      if (!error) setLastSaved(new Date());
    } catch (e) {
      console.error("Error saving canvas:", e);
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentId, user]);

  // Throttled local + debounced cloud save on changes
  useEffect(() => {
    if (!editor || !documentId) return;

    const unsub = editor.store.listen(() => {
      if (isLoadingRef.current) return;

      // Throttled local cache save
      if (!localSaveTimeoutRef.current) {
        localSaveTimeoutRef.current = setTimeout(() => {
          localSaveTimeoutRef.current = null;
          try {
            const snapshot = editor.store.getSnapshot();
            saveToLocalCache(JSON.parse(JSON.stringify(snapshot)));
          } catch {}
        }, LOCAL_SAVE_THROTTLE);
      }

      // Debounced cloud save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveToCloud, CLOUD_SAVE_DELAY);
    });

    return () => {
      unsub();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    };
  }, [editor, documentId, saveToCloud]);

  const undo = useCallback(() => editor?.undo(), [editor]);
  const redo = useCallback(() => editor?.redo(), [editor]);

  return {
    documentId,
    isSaving,
    lastSaved,
    undo,
    redo,
    canUndo: editor?.getCanUndo() ?? false,
    canRedo: editor?.getCanRedo() ?? false,
    saveNow: saveToCloud,
  };
}
