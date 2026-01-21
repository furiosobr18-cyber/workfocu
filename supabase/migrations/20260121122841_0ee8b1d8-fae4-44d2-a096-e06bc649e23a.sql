-- Fix: Add access control to cleanup_old_security_logs function
-- Only service role (postgres) should be able to execute this function

CREATE OR REPLACE FUNCTION public.cleanup_old_security_logs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow execution by service role (postgres/superuser)
  -- Regular authenticated users cannot call this function
  IF current_user != 'postgres' AND NOT (SELECT usesuper FROM pg_user WHERE usename = current_user) THEN
    RAISE EXCEPTION 'Access denied: only service role can execute this function';
  END IF;

  DELETE FROM public.security_logs 
  WHERE created_at < now() - interval '30 days';
END;
$function$;

-- Revoke execute from public and authenticated, only allow postgres (service role)
REVOKE EXECUTE ON FUNCTION public.cleanup_old_security_logs() FROM public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_security_logs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_security_logs() FROM anon;