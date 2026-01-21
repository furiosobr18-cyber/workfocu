-- First drop the existing triggers
DROP TRIGGER validate_notes_input ON public.notes;
DROP TRIGGER validate_brains_input ON public.brains;
DROP TRIGGER validate_tasks_input ON public.tasks;
DROP TRIGGER validate_calendar_events_input ON public.calendar_events;
DROP TRIGGER validate_pomodoro_sessions_input ON public.pomodoro_sessions;

-- Create table-specific validation function for notes
CREATE OR REPLACE FUNCTION public.validate_notes_input()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.title IS NOT NULL AND char_length(NEW.title) > 500 THEN
    RAISE EXCEPTION 'Title exceeds maximum length of 500 characters';
  END IF;
  IF NEW.content IS NOT NULL AND char_length(NEW.content) > 100000 THEN
    RAISE EXCEPTION 'Content exceeds maximum length of 100000 characters';
  END IF;
  IF NEW.color IS NOT NULL AND NEW.color NOT IN ('default', 'blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'red', 'yellow') THEN
    RAISE EXCEPTION 'Invalid color. Must be one of: default, blue, green, purple, orange, pink, cyan, red, yellow';
  END IF;
  RETURN NEW;
END; $$;

-- Create table-specific validation function for brains
CREATE OR REPLACE FUNCTION public.validate_brains_input()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.name IS NOT NULL AND char_length(NEW.name) > 500 THEN
    RAISE EXCEPTION 'Name exceeds maximum length of 500 characters';
  END IF;
  IF NEW.color IS NOT NULL AND NEW.color NOT IN ('default', 'blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'red', 'yellow') THEN
    RAISE EXCEPTION 'Invalid color. Must be one of: default, blue, green, purple, orange, pink, cyan, red, yellow';
  END IF;
  RETURN NEW;
END; $$;

-- Create table-specific validation function for tasks
CREATE OR REPLACE FUNCTION public.validate_tasks_input()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.title IS NOT NULL AND char_length(NEW.title) > 500 THEN
    RAISE EXCEPTION 'Title exceeds maximum length of 500 characters';
  END IF;
  IF NEW.description IS NOT NULL AND char_length(NEW.description) > 10000 THEN
    RAISE EXCEPTION 'Description exceeds maximum length of 10000 characters';
  END IF;
  RETURN NEW;
END; $$;

-- Create table-specific validation function for calendar_events
CREATE OR REPLACE FUNCTION public.validate_calendar_events_input()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.title IS NOT NULL AND char_length(NEW.title) > 500 THEN
    RAISE EXCEPTION 'Title exceeds maximum length of 500 characters';
  END IF;
  IF NEW.description IS NOT NULL AND char_length(NEW.description) > 10000 THEN
    RAISE EXCEPTION 'Description exceeds maximum length of 10000 characters';
  END IF;
  RETURN NEW;
END; $$;

-- Create table-specific validation function for pomodoro_sessions
CREATE OR REPLACE FUNCTION public.validate_pomodoro_sessions_input()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.session_type NOT IN ('work', 'short_break', 'long_break') THEN
    RAISE EXCEPTION 'Invalid session type';
  END IF;
  IF NEW.duration_minutes < 1 OR NEW.duration_minutes > 120 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 120 minutes';
  END IF;
  RETURN NEW;
END; $$;

-- Create triggers with table-specific functions
CREATE TRIGGER validate_notes_input BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION validate_notes_input();

CREATE TRIGGER validate_brains_input BEFORE INSERT OR UPDATE ON public.brains
  FOR EACH ROW EXECUTE FUNCTION validate_brains_input();

CREATE TRIGGER validate_tasks_input BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION validate_tasks_input();

CREATE TRIGGER validate_calendar_events_input BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION validate_calendar_events_input();

CREATE TRIGGER validate_pomodoro_sessions_input BEFORE INSERT OR UPDATE ON public.pomodoro_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_pomodoro_sessions_input();

-- Drop the old generic function (no longer needed)
DROP FUNCTION IF EXISTS public.validate_input_lengths();