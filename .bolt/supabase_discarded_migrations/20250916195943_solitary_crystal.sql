/*
  # Support Agent Authentication Functions (Corrected)

  1. Drop old functions safely
  2. Create secure authentication + management functions
  3. Grant execution to correct roles
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop old function first (prevents 42P13 error)
DROP FUNCTION IF EXISTS authenticate_support_agent(TEXT, TEXT);

-- Function to authenticate support agents
CREATE FUNCTION authenticate_support_agent(
  agent_email TEXT,
  agent_password TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_record RECORD;
BEGIN
  -- Verify credentials
  SELECT sa.* INTO agent_record
  FROM support_agents sa
  WHERE sa.email = agent_email
    AND sa.is_active = true
    AND sa.password_hash = crypt(agent_password, sa.password_hash);

  IF agent_record.id IS NULL THEN
    -- Invalid credentials
    RETURN;
  END IF;

  -- Return safe agent data
  RETURN QUERY
  SELECT 
    agent_record.id,
    agent_record.name,
    agent_record.email,
    agent_record.role,
    agent_record.is_active,
    agent_record.last_login_at,
    agent_record.created_at;
END;
$$;

-- Function to create support agents with hashed passwords
CREATE OR REPLACE FUNCTION create_support_agent(
  agent_name TEXT,
  agent_email TEXT,
  agent_password TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_agent_id UUID;
BEGIN
  -- Prevent duplicates
  IF EXISTS (SELECT 1 FROM support_agents WHERE email = agent_email) THEN
    RAISE EXCEPTION 'Support agent with email % already exists', agent_email;
  END IF;

  -- Insert agent
  INSERT INTO support_agents (name, email, password_hash, role, is_active)
  VALUES (
    agent_name,
    agent_email,
    crypt(agent_password, gen_salt('bf')),
    'support_agent',
    true
  )
  RETURNING support_agents.id INTO new_agent_id;

  RETURN QUERY
  SELECT 
    sa.id,
    sa.name,
    sa.email,
    sa.role,
    sa.is_active,
    sa.created_at
  FROM support_agents sa
  WHERE sa.id = new_agent_id;
END;
$$;

-- Optional: set support agent context
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM support_agents
    WHERE email = agent_email AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive support agent: %', agent_email;
  END IF;

  PERFORM set_config('app.current_agent_email', agent_email, true);
  RETURN true;
END;
$$;

-- =============== Statistics Functions ===============

CREATE OR REPLACE FUNCTION get_chat_statistics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_sessions INTEGER;
  active_sessions INTEGER;
  resolved_today INTEGER;
  total_restaurants INTEGER;
  agents_online INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_sessions FROM chat_sessions;
  SELECT COUNT(*) INTO active_sessions FROM chat_sessions WHERE status = 'active';
  SELECT COUNT(*) INTO resolved_today FROM chat_sessions WHERE status = 'resolved' AND DATE(updated_at) = CURRENT_DATE;
  SELECT COUNT(DISTINCT restaurant_id) INTO total_restaurants FROM chat_sessions;
  SELECT COUNT(*) INTO agents_online FROM support_agents WHERE is_active = true;

  result := json_build_object(
    'totalSessions', total_sessions,
    'activeSessions', active_sessions,
    'resolvedToday', resolved_today,
    'averageResponseTime', 0,
    'totalRestaurants', total_restaurants,
    'agentsOnline', agents_online
  );

  RETURN result;
END;
$$;

-- Example: grant execution permissions
GRANT EXECUTE ON FUNCTION authenticate_support_agent(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_support_agent(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_support_agent_context(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_chat_statistics() TO authenticated, service_role;
