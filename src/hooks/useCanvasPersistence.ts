import { useEffect, useRef, useCallback, useState } from "react";
import { Editor, getSnapshot, loadSnapshot } from "tldraw";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const DOC_CACHE_KEY = "canvas_doc_cache";
const SESSION_CACHE_KEY = "canvas_session_cache";
const CACHE_TS_KEY = "canvas_cache_ts";
const CLOUD_SAVE_DELAY = 2000;
const LOCAL_SAVE_THROTTLE = 400;

function saveToLocalCache(document: any, session: any) {
  try {
    localStorage.setItem(DOC_CACHE_KEY, JSON.stringify(document));
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
  } catch {}
}

function loadFromLocalCache(): { document: any; session: any; ts: string | null } {
  try {
    const docRaw = localStorage.getItem(DOC_CACHE_KEY);
    const sessionRaw = localStorage.getItem(SESSION_CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (docRaw) {
      return {
        document: JSON.parse(docRaw),
        session: sessionRaw ? JSON.parse(sessionRaw) : undefined,
        ts,
      };
    }
  } catch {}
  return { document: null, session: null, ts: null };
}

function isValidDocument(d: any): boolean {
  return d && typeof d === "object" && "store" in d && "schema" in d;
}

function safeLoad(editor: Editor, document: any, session?: any) {
  try {
    const payload: any = { document };
    if (session) payload.session = session;
    loadSnapshot(editor.store, payload);
  } catch (e) {
    console.warn("Failed to load snapshot, trying without session", e);
    try {
      loadSnapshot(editor.store, { document });
    } catch (e2) {
      console.warn("Failed to load document snapshot, clearing cache", e2);
      try {
        localStorage.removeItem(DOC_CACHE_KEY);
        localStorage.removeItem(SESSION_CACHE_KEY);
        localStorage.removeItem(CACHE_TS_KEY);
      } catch {}
    }
  }
}

// Clean up old cache format on module load
try { localStorage.removeItem("canvas_local_cache"); localStorage.removeItem("canvas_local_cache_ts"); } catch {}

export function useCanvasPersistence(editor: Editor | null) {
  const { user } = useAuth();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const localCacheLoadedRef = useRef(false);

  // 1) Load from local cache IMMEDIATELY
  useEffect(() => {
    if (!editor || localCacheLoadedRef.current) return;
    const { document, session } = loadFromLocalCache();
    if (isValidDocument(document)) {
      safeLoad(editor, document, session);
      localCacheLoadedRef.current = true;
    }
  }, [editor]);

  // 2) Background cloud sync
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
            const cloudDoc = existing.content as any;
            if (isValidDocument(cloudDoc)) {
              safeLoad(editor, cloudDoc);
              saveToLocalCache(cloudDoc, undefined);
            }
          }
        } else {
          // Create new document
          const { document } = getSnapshot(editor.store);
          const serialized = JSON.parse(JSON.stringify(document));
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
      const { document, session } = getSnapshot(editor.store);
      const docSerialized = JSON.parse(JSON.stringify(document));
      const sessionSerialized = JSON.parse(JSON.stringify(session));
      saveToLocalCache(docSerialized, sessionSerialized);

      const { error } = await supabase
        .from("canvas_documents")
        .update({ content: docSerialized })
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
            const { document, session } = getSnapshot(editor.store);
            saveToLocalCache(
              JSON.parse(JSON.stringify(document)),
              JSON.parse(JSON.stringify(session))
            );
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
