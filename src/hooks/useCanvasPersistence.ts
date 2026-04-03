import { useEffect, useRef, useCallback, useState } from "react";
import { Editor, TLRecord, StoreSnapshot, loadSnapshot } from "tldraw";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const CACHE_KEY = "canvas_local_cache";
const CACHE_TS_KEY = "canvas_local_cache_ts";
const CLOUD_SAVE_DELAY = 2000;
const LOCAL_SAVE_THROTTLE = 400;

function saveToLocalCache(snapshot: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
  } catch {}
}

function loadFromLocalCache(): { snapshot: any; ts: string | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (raw) return { snapshot: JSON.parse(raw), ts };
  } catch {}
  return { snapshot: null, ts: null };
}

function isValidSnapshot(s: any): boolean {
  return s && typeof s === "object" && "store" in s && "schema" in s;
}

function safeLoadSnapshot(editor: Editor, snapshot: any) {
  try {
    loadSnapshot(editor.store, snapshot);
  } catch (e) {
    console.warn("Failed to load snapshot, clearing cache", e);
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TS_KEY);
    } catch {}
  }
}

export function useCanvasPersistence(editor: Editor | null) {
  const { user } = useAuth();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const localCacheLoadedRef = useRef(false);

  // 1) Load from local cache IMMEDIATELY — zero delay
  useEffect(() => {
    if (!editor || localCacheLoadedRef.current) return;
    const { snapshot } = loadFromLocalCache();
    if (isValidSnapshot(snapshot)) {
      safeLoadSnapshot(editor, snapshot);
      localCacheLoadedRef.current = true;
    }
  }, [editor]);

  // 2) Background cloud sync — only overwrite if cloud is newer
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
          const { ts: localTs } = loadFromLocalCache();
          const cloudNewer = !localTs || new Date(existing.updated_at) > new Date(localTs);

          if (cloudNewer && existing.content) {
            const snapshot = existing.content as unknown as StoreSnapshot<TLRecord>;
            if (isValidSnapshot(snapshot)) {
              try {
                editor.store.loadSnapshot(snapshot);
                saveToLocalCache(snapshot);
              } catch {}
            }
          }
        } else {
          // Create new document
          const snapshot = editor.store.getSnapshot();
          const serialized = JSON.parse(JSON.stringify(snapshot));
          const { data: newDoc, error: createError } = await supabase
            .from("canvas_documents")
            .insert([{ user_id: user.id, name: "Meu Canvas", content: serialized }])
            .select("id")
            .single();

          if (newDoc && !createError) setDocumentId(newDoc.id);
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

  // Listen for changes — throttled local + debounced cloud
  useEffect(() => {
    if (!editor || !documentId) return;

    const unsub = editor.store.listen(() => {
      if (isLoadingRef.current) return;

      if (!localSaveTimeoutRef.current) {
        localSaveTimeoutRef.current = setTimeout(() => {
          localSaveTimeoutRef.current = null;
          try {
            const snapshot = editor.store.getSnapshot();
            saveToLocalCache(JSON.parse(JSON.stringify(snapshot)));
          } catch {}
        }, LOCAL_SAVE_THROTTLE);
      }

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
