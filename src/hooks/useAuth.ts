import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Singleton auth store — one listener for the whole app
let authUser: User | null = null;
let authSession: Session | null = null;
let authLoading = true;
let listeners = new Set<() => void>();
let initialized = false;

function notify() {
  listeners.forEach(l => l());
}

function initAuth() {
  if (initialized) return;
  initialized = true;

  // Try sync cache first for instant state
  try {
    const cached = localStorage.getItem('sb-auth-cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      authUser = parsed.user ?? null;
      authSession = parsed.session ?? null;
    }
  } catch {}

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      authSession = session;
      authUser = session?.user ?? null;
      authLoading = false;
      try {
        if (session) {
          localStorage.setItem('sb-auth-cache', JSON.stringify({ user: session.user, session }));
        } else {
          localStorage.removeItem('sb-auth-cache');
        }
      } catch {}
      notify();
    }
  );

  supabase.auth.getSession().then(({ data: { session } }) => {
    authSession = session;
    authUser = session?.user ?? null;
    authLoading = false;
    try {
      if (session) {
        localStorage.setItem('sb-auth-cache', JSON.stringify({ user: session.user, session }));
      }
    } catch {}
    notify();
  });

  // Cleanup not needed for singleton, but store ref
  void subscription;
}

function subscribe(cb: () => void) {
  initAuth();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return { user: authUser, session: authSession, loading: authLoading };
}

// Use a stable ref to avoid re-renders when snapshot object is the same
let lastSnapshot = getSnapshot();
function getStableSnapshot() {
  const next = getSnapshot();
  if (
    next.user === lastSnapshot.user &&
    next.session === lastSnapshot.session &&
    next.loading === lastSnapshot.loading
  ) {
    return lastSnapshot;
  }
  lastSnapshot = next;
  return next;
}

export const useAuth = () => {
  const snap = useSyncExternalStore(subscribe, getStableSnapshot);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('sb-auth-cache');
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
    return { data, error };
  }, []);

  return {
    user: snap.user,
    session: snap.session,
    loading: snap.loading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle
  };
};
