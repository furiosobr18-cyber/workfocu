-- Create security logs table for audit trail
CREATE TABLE public.security_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  email_hash TEXT,
  user_agent TEXT,
  ip_hint TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from edge function)
-- No public access to security logs
CREATE POLICY "Service role only" 
ON public.security_logs 
FOR ALL 
USING (false);

-- Create index for rate limiting queries
CREATE INDEX idx_security_logs_email_hash_created 
ON public.security_logs(email_hash, created_at DESC);

CREATE INDEX idx_security_logs_event_type 
ON public.security_logs(event_type);

-- Auto-delete old logs after 30 days (cleanup function)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.security_logs 
  WHERE created_at < now() - interval '30 days';
END;
$$;