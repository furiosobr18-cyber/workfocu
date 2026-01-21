-- Fix color validation to accept predefined color names instead of hex format
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
  
  -- Validate color format (predefined color names)
  IF TG_TABLE_NAME IN ('notes', 'brains') AND NEW.color IS NOT NULL THEN
    IF NEW.color NOT IN ('default', 'blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'red', 'yellow') THEN
      RAISE EXCEPTION 'Invalid color. Must be one of: default, blue, green, purple, orange, pink, cyan, red, yellow';
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