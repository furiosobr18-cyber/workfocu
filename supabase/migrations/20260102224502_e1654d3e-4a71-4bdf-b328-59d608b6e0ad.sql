-- Adicionar coluna para cérebros aninhados (parent_brain_id)
ALTER TABLE public.brains 
ADD COLUMN parent_brain_id uuid REFERENCES public.brains(id) ON DELETE CASCADE;