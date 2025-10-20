/*
  # Fix Support Agent RLS Policies for Global Access

  1. Security Updates
    - Enhanced RLS policies for support agents to access all restaurants
    - Added service role bypass functions
    - Fixed context setting for support agents

  2. Functions
    - Enhanced support agent authentication
    - Added global session access functions
    - Fixed message sending permissions

  3. Policies
    - Support agents can view/manage all chat sessions
    - Support agents can send messages to any session
    - Enhanced debugging and logging
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Support agents can view all sessions globally" ON chat_sessions;
DROP POLICY IF EXISTS "Support agents can manage all sessions globally" ON chat_sessions;
DROP POLICY IF EXISTS "Support agents can view all messages globally" ON chat_messages;
DROP POLICY IF EXISTS "Support agents can manage all messages globally" ON chat_messages;
DROP POLICY IF EXISTS "Support agents can view all participants globally" ON chat_participants;
DROP POLICY IF EXISTS "Support agents can manage all participants globally" ON chat_participants;

-- Create comprehensive support agent policies for chat_sessions
CREATE POLICY "Support agents global session access"
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

-- Create comprehensive support agent policies for chat_messages
CREATE POLICY "Support agents global message access"
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

-- Create comprehensive support agent policies for chat_participants
CREATE POLICY "Support agents global participant access"
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

-- Drop old versions of functions before recreating
DROP FUNCTION IF EXISTS set_support_agent_context(text);
DROP FUNCTION IF EXISTS get_all_chat_sessions_for_support();

-- Enhanced support agent context function
CREATE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_record support_agents%ROWTYPE;
BEGIN
  -- Validate agent exists and is active
  SELECT * INTO agent_record
  FROM support_agents
  WHERE email = agent_email AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support agent not found or inactive: %', agent_email;
  END IF;
  
  -- Set context for RLS policies
  PERFORM set_config('app.current_support_agent_email', agent_email, true);
  PERFORM set_config('app.current_support_agent_id', agent_record.id::text, true);
  PERFORM set_config('app.is_support_agent', 'true', true);
  
  -- Log successful context setting
  RAISE NOTICE 'Support agent context set for: % (ID: %)', agent_email, agent_record.id;
END;
$$;

-- Enhanced is_support_agent function
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_email text;
  agent_exists boolean := false;
BEGIN
  -- Check if context is set
  agent_email := current_setting('app.current_support_agent_email', true);
  
  IF agent_email IS NOT NULL AND agent_email != '' THEN
    -- Verify agent exists and is active
    SELECT EXISTS(
      SELECT 1 FROM support_agents 
      WHERE email = agent_email AND is_active = true
    ) INTO agent_exists;
    
    IF agent_exists THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Fallback: check if user is super admin
  RETURN is_super_admin();
END;
$$;

-- Service role bypass function for support agents
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function bypasses RLS to get all sessions for support agents
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_chat_sessions_for_support() TO authenticated;
