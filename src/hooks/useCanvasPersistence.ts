import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCanvasStore, CanvasSnapshot } from "./useCanvasStore";

const CACHE_KEY = "canvas_v2_cache";
const CACHE_TS_KEY = "canvas_v2_cache_ts";
const CLOUD_SAVE_DELAY = 2000;
const LOCAL_SAVE_THROTTLE = 400;

function saveToLocalCache(snapshot: CanvasSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
  } catch {}
}

function loadFromLocalCache(): { snapshot: CanvasSnapshot | null; ts: string | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2) return { snapshot: parsed, ts };
    }
  } catch {}
  return { snapshot: null, ts: null };
}

export function useCanvasPersistence(store: ReturnType<typeof useCanvasStore>) {
  const { user } = useAuth();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const localLoadedRef = useRef(false);

  // 1) Instant load from local cache
  useEffect(() => {
    if (localLoadedRef.current) return;
    const { snapshot } = loadFromLocalCache();
    if (snapshot) {
      store.loadSnapshot(snapshot);
      localLoadedRef.current = true;
    }
  }, [store]);

  // 2) Background cloud sync
  useEffect(() => {
    if (!user) return;

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
            const content = existing.content as any;
            if (content && content.version === 2) {
              store.loadSnapshot(content as CanvasSnapshot);
              saveToLocalCache(content as CanvasSnapshot);
            }
          }
        } else {
          const snapshot = store.getSnapshot();
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
  }, [user, store]);

  const saveToCloud = useCallback(async () => {
    if (!documentId || !user || isLoadingRef.current) return;

    setIsSaving(true);
    try {
      const snapshot = store.getSnapshot();
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
  }, [documentId, user, store]);

  const scheduleSave = useCallback(() => {
    if (!documentId || isLoadingRef.current) return;

    if (!localSaveTimeoutRef.current) {
      localSaveTimeoutRef.current = setTimeout(() => {
        localSaveTimeoutRef.current = null;
        try { saveToLocalCache(store.getSnapshot()); } catch {}
      }, LOCAL_SAVE_THROTTLE);
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveToCloud, CLOUD_SAVE_DELAY);
  }, [documentId, saveToCloud, store]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    };
  }, []);

  return { documentId, isSaving, lastSaved, saveNow: saveToCloud, scheduleSave };
}
