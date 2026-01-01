-- Create note_links table for connecting notes
CREATE TABLE public.note_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_note_id, target_note_id)
);

-- Enable RLS
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own note links" ON public.note_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own note links" ON public.note_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own note links" ON public.note_links FOR DELETE USING (auth.uid() = user_id);

-- Add color column to notes for visual distinction
ALTER TABLE public.notes ADD COLUMN color TEXT DEFAULT 'default';