CREATE TABLE public.canvas_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Canvas',
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.canvas_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own canvas documents"
ON public.canvas_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own canvas documents"
ON public.canvas_documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvas documents"
ON public.canvas_documents FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvas documents"
ON public.canvas_documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_canvas_documents_updated_at
BEFORE UPDATE ON public.canvas_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();