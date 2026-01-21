-- Step 2: Add UPDATE policy for brain_notes
CREATE POLICY "Users can update their own brain_notes"
ON public.brain_notes FOR UPDATE
USING (auth.uid() = user_id);

-- Step 3: Fix pomodoro_sessions - add explicit policies to prevent modifications (data immutability)
CREATE POLICY "Users cannot update pomodoro_sessions"
ON public.pomodoro_sessions FOR UPDATE
USING (false);

CREATE POLICY "Users cannot delete pomodoro_sessions"
ON public.pomodoro_sessions FOR DELETE
USING (false);

-- Step 4: Fix security_logs policy - allow service role access
DROP POLICY IF EXISTS "No public access to security logs" ON public.security_logs;

CREATE POLICY "Service role can manage security logs"
ON public.security_logs FOR ALL
USING (auth.role() = 'service_role');

-- Step 5: Add server-side validation triggers
CREATE OR REPLACE FUNCTION public.validate_input_lengths()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate title length (for tables with title column)
  IF TG_TABLE_NAME IN ('tasks', 'notes', 'calendar_events') AND NEW.title IS NOT NULL THEN
    IF char_length(NEW.title) > 500 THEN
      RAISE EXCEPTION 'Title exceeds maximum length of 500 characters';
    END IF;
  END IF;
  
  -- Validate name length (for brains table)
  IF TG_TABLE_NAME = 'brains' AND NEW.name IS NOT NULL THEN
    IF char_length(NEW.name) > 500 THEN
      RAISE EXCEPTION 'Name exceeds maximum length of 500 characters';
    END IF;
  END IF;
  
  -- Validate content length (for notes)
  IF TG_TABLE_NAME = 'notes' AND NEW.content IS NOT NULL THEN
    IF char_length(NEW.content) > 100000 THEN
      RAISE EXCEPTION 'Content exceeds maximum length of 100000 characters';
    END IF;
  END IF;
  
  -- Validate description length
  IF TG_TABLE_NAME IN ('tasks', 'calendar_events') AND NEW.description IS NOT NULL THEN
    IF char_length(NEW.description) > 10000 THEN
      RAISE EXCEPTION 'Description exceeds maximum length of 10000 characters';
    END IF;
  END IF;
  
  -- Validate color format (hex color or null)
  IF TG_TABLE_NAME IN ('notes', 'brains') AND NEW.color IS NOT NULL THEN
    IF NEW.color !~ '^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'Invalid color format. Must be hex color (e.g., #FF0000)';
    END IF;
  END IF;
  
  -- Validate pomodoro session type
  IF TG_TABLE_NAME = 'pomodoro_sessions' THEN
    IF NEW.session_type NOT IN ('work', 'short_break', 'long_break') THEN
      RAISE EXCEPTION 'Invalid session type';
    END IF;
    IF NEW.duration_minutes < 1 OR NEW.duration_minutes > 120 THEN
      RAISE EXCEPTION 'Duration must be between 1 and 120 minutes';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation triggers to all relevant tables
CREATE TRIGGER validate_tasks_input
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_input_lengths();

CREATE TRIGGER validate_notes_input
  BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.validate_input_lengths();

CREATE TRIGGER validate_brains_input
  BEFORE INSERT OR UPDATE ON public.brains
  FOR EACH ROW EXECUTE FUNCTION public.validate_input_lengths();

CREATE TRIGGER validate_calendar_events_input
  BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_input_lengths();

CREATE TRIGGER validate_pomodoro_sessions_input
  BEFORE INSERT OR UPDATE ON public.pomodoro_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_input_lengths();