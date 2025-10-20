/*
  # Enhance Chat System for Real-time Updates

  1. Storage
    - Create storage bucket for chat attachments
    - Set up proper policies for file uploads

  2. Functions
    - Enhanced chat statistics function
    - Support agent context functions
    - File upload handling

  3. Indexes
    - Optimize queries for real-time performance
    - Add indexes for chat filtering and sorting

  4. Policies
    - Update RLS policies for support agents
    - Add policies for file attachments
*/

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat attachments
CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can view chat attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Service role can manage chat attachments"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'chat-attachments');

-- Enhanced chat statistics function
CREATE OR REPLACE FUNCTION get_chat_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  total_sessions int;
  active_sessions int;
  resolved_today int;
  total_restaurants int;
  agents_online int;
BEGIN
  -- Get total sessions
  SELECT COUNT(*) INTO total_sessions FROM chat_sessions;
  
  -- Get active sessions
  SELECT COUNT(*) INTO active_sessions FROM chat_sessions WHERE status = 'active';
  
  -- Get resolved today
  SELECT COUNT(*) INTO resolved_today 
  FROM chat_sessions 
  WHERE status = 'resolved' 
    AND DATE(updated_at) = CURRENT_DATE;
  
  -- Get total restaurants with chat sessions
  SELECT COUNT(DISTINCT restaurant_id) INTO total_restaurants FROM chat_sessions;
  
  -- Get agents online (simplified - count active agents)
  SELECT COUNT(*) INTO agents_online FROM support_agents WHERE is_active = true;

  result := json_build_object(
    'totalSessions', total_sessions,
    'activeSessions', active_sessions,
    'resolvedToday', resolved_today,
    'averageResponseTime', 0, -- Placeholder
    'totalRestaurants', total_restaurants,
    'agentsOnline', agents_online
  );

  RETURN result;
END;
$$;

-- Support agent context functions
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the current agent email in session
  PERFORM set_config('app.current_agent_email', agent_email, true);
END;
$$;

CREATE OR REPLACE FUNCTION test_support_agent_context()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN current_setting('app.current_agent_email', true);
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
BEGIN
  -- Get current agent email from session
  agent_email := current_setting('app.current_agent_email', true);
  
  IF agent_email IS NULL OR agent_email = '' THEN
    RETURN false;
  END IF;

  -- Check if agent exists and is active
  RETURN EXISTS (
    SELECT 1 FROM support_agents 
    WHERE email = agent_email AND is_active = true
  );
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_restaurant_status_updated 
  ON chat_sessions(restaurant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_assigned_agent 
  ON chat_sessions(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created_type 
  ON chat_messages(session_id, created_at, message_type);

CREATE INDEX IF NOT EXISTS idx_chat_participants_session_online 
  ON chat_participants(session_id, is_online, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_type 
  ON message_attachments(message_id, file_type);

-- Update message attachments policies for support agents
CREATE POLICY "Support agents can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat sessions policies for support agents  
CREATE POLICY "Support agents can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat messages policies for support agents
CREATE POLICY "Support agents can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat participants policies for support agents
CREATE POLICY "Support agents can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());