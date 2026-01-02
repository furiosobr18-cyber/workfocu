-- Criar tabela de cérebros (agrupamentos de notas)
CREATE TABLE public.brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Criar tabela de relacionamento entre notas e cérebros
CREATE TABLE public.brain_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_id uuid REFERENCES public.brains(id) ON DELETE CASCADE NOT NULL,
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brain_id, note_id)
);

-- Habilitar RLS
ALTER TABLE public.brains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_notes ENABLE ROW LEVEL SECURITY;

-- Políticas para brains
CREATE POLICY "Users can view their own brains"
ON public.brains FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own brains"
ON public.brains FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brains"
ON public.brains FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brains"
ON public.brains FOR DELETE
USING (auth.uid() = user_id);

-- Políticas para brain_notes
CREATE POLICY "Users can view their own brain_notes"
ON public.brain_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own brain_notes"
ON public.brain_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brain_notes"
ON public.brain_notes FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at em brains
CREATE TRIGGER update_brains_updated_at
BEFORE UPDATE ON public.brains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();