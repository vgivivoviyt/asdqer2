/*
  # Debug Support Agent Access

  This migration helps debug why support agents can't see all restaurant sessions.
  It creates functions to test and verify support agent access.
*/

-- Function to check if current user is a support agent
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if there's a support agent context set
  DECLARE
    agent_email text;
  BEGIN
    agent_email := current_setting('app.current_agent_email', true);
    
    IF agent_email IS NOT NULL AND agent_email != '' THEN
      -- Check if this email exists in support_agents and is active
      RETURN EXISTS (
        SELECT 1 FROM support_agents 
        WHERE email = agent_email AND is_active = true
      );
    END IF;
    
    -- Fallback: check if current auth user has super admin privileges
    RETURN EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    );
  END;
END;
$$;

-- Function to set support agent context
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the agent exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM support_agents 
    WHERE email = agent_email AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Support agent not found or inactive: %', agent_email;
  END IF;
  
  -- Set the context
  PERFORM set_config('app.current_agent_email', agent_email, false);
  
  -- Log the context setting
  RAISE NOTICE 'Support agent context set for: %', agent_email;
END;
$$;

-- Function to test support agent access
CREATE OR REPLACE FUNCTION test_support_agent_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  agent_email text;
  is_agent boolean;
  session_count integer;
BEGIN
  -- Get current context
  agent_email := current_setting('app.current_agent_email', true);
  is_agent := is_support_agent();
  
  -- Count accessible sessions
  SELECT COUNT(*) INTO session_count
  FROM chat_sessions;
  
  result := jsonb_build_object(
    'agent_email', COALESCE(agent_email, 'not_set'),
    'is_support_agent', is_agent,
    'accessible_sessions', session_count,
    'auth_uid', auth.uid(),
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;
GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated;
GRANT EXECUTE ON FUNCTION test_support_agent_access() TO authenticated;