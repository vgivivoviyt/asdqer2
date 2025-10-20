/*
  # Fix Support Portal Global Access (Safe Migration)

  This migration ensures support agents can see ALL restaurant chat sessions
  and interact with them properly, while maintaining security.

  ✅ Safe: We no longer drop `is_support_agent()` since policies depend on it.
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Support agents global read access" ON chat_sessions;
DROP POLICY IF EXISTS "Support agents global write access" ON chat_sessions;
DROP POLICY IF EXISTS "Support agents global message access" ON chat_messages;
DROP POLICY IF EXISTS "Support agents global participant access" ON chat_participants;

-- Drop/replace only functions that *need* changes
DROP FUNCTION IF EXISTS set_support_agent_context(text);
DROP FUNCTION IF EXISTS get_all_chat_sessions_for_support();
DROP FUNCTION IF EXISTS debug_support_agent_access();

-- ==========================================================
-- Policies
-- ==========================================================

CREATE POLICY "Support agents can view all sessions globally"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = chat_sessions.restaurant_id 
      AND r.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Support agents can manage all sessions globally"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = chat_sessions.restaurant_id 
      AND r.owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM restaurants r 
      WHERE r.id = chat_sessions.restaurant_id 
      AND r.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Support agents can view all messages globally"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_messages.session_id 
      AND r.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Support agents can manage all messages globally"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_messages.session_id 
      AND r.owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_messages.session_id 
      AND r.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Support agents can view all participants globally"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_participants.session_id 
      AND r.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Support agents can manage all participants globally"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_participants.session_id 
      AND r.owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    is_support_agent() OR
    is_super_admin() OR
    (EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_participants.session_id 
      AND r.owner_id = auth.uid()
    ))
  );

-- ==========================================================
-- Functions
-- ==========================================================

CREATE FUNCTION get_all_chat_sessions_for_support()
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  title text,
  status text,
  priority text,
  category text,
  created_by_user_id uuid,
  assigned_agent_name text,
  assigned_agent_id text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  restaurant_name text,
  restaurant_slug text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE 'get_all_chat_sessions_for_support called by user: %', auth.uid();
  
  RETURN QUERY
  SELECT 
    cs.id,
    cs.restaurant_id,
    cs.title,
    cs.status,
    cs.priority,
    cs.category,
    cs.created_by_user_id,
    cs.assigned_agent_name,
    cs.assigned_agent_id,
    cs.last_message_at,
    cs.created_at,
    cs.updated_at,
    r.name as restaurant_name,
    r.slug as restaurant_slug
  FROM chat_sessions cs
  LEFT JOIN restaurants r ON r.id = cs.restaurant_id
  ORDER BY cs.last_message_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_chat_sessions_for_support() TO authenticated;

CREATE FUNCTION set_support_agent_context(agent_email text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM support_agents 
    WHERE email = agent_email 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Support agent not found or inactive: %', agent_email;
  END IF;
  
  PERFORM set_config('app.current_agent_email', agent_email, true);
  
  RAISE NOTICE 'Support agent context set for: %', agent_email;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated;

CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  agent_email text;
  agent_exists boolean := false;
BEGIN
  agent_email := current_setting('app.current_agent_email', true);
  
  IF agent_email IS NOT NULL AND agent_email != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM support_agents 
      WHERE email = agent_email 
      AND is_active = true
    ) INTO agent_exists;
    
    IF agent_exists THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN is_super_admin();
END;
$$;

GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;

CREATE FUNCTION debug_support_agent_access()
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
  agent_email text;
  total_sessions int;
  agent_exists boolean;
BEGIN
  agent_email := current_setting('app.current_agent_email', true);
  
  SELECT EXISTS (
    SELECT 1 FROM support_agents 
    WHERE email = agent_email 
    AND is_active = true
  ) INTO agent_exists;
  
  SELECT COUNT(*) INTO total_sessions FROM chat_sessions;
  
  SELECT json_build_object(
    'current_user_id', auth.uid(),
    'agent_email_in_context', agent_email,
    'agent_exists_in_db', agent_exists,
    'is_support_agent_result', is_support_agent(),
    'is_super_admin_result', is_super_admin(),
    'total_sessions_in_db', total_sessions,
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_support_agent_access() TO authenticated;
