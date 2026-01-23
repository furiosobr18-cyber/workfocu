-- Fix 1: Add UPDATE policy to note_links table
CREATE POLICY "Users can update their own note links"
ON public.note_links FOR UPDATE
USING (auth.uid() = user_id);

-- Fix 2: Remove conflicting RLS policy on security_logs
DROP POLICY IF EXISTS "Service role only" ON public.security_logs;