/*
  # Fix Support Portal Real-time Access Issues

  This migration addresses the real-time subscription issues in the support portal by:
  
  1. **Enhanced RLS Policies**: Add policies that allow support agents to access all chat data
  2. **Support Agent Functions**: Create functions to properly identify support agents
  3. **Real-time Triggers**: Add triggers to ensure real-time events are properly broadcast
  4. **Cross-Restaurant Access**: Enable support agents to see chats from all restaurants

  ## Changes Made:
  1. New support agent identification functions
  2. Enhanced RLS policies for cross-restaurant access
  3. Real-time broadcast triggers
  4. Improved session context handling
*/

-- Create function to check if current user is a support agent
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current setting indicates this is a support agent session
  RETURN COALESCE(current_setting('app.current_agent_email', true), '') != '';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Create function to set support agent context (enhanced version)
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the agent email in the session
  PERFORM set_config('app.current_agent_email', agent_email, false);
  
  -- Log the context setting for debugging
  RAISE NOTICE 'Support agent context set for: %', agent_email;
END;
$$;

-- Enhanced RLS policies for chat_sessions to allow support agents cross-restaurant access
DROP POLICY IF EXISTS "Support agents can manage all chat sessions" ON chat_sessions;
CREATE POLICY "Support agents can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Enhanced RLS policies for chat_messages to allow support agents cross-restaurant access  
DROP POLICY IF EXISTS "Support agents can manage all chat messages" ON chat_messages;
CREATE POLICY "Support agents can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Enhanced RLS policies for chat_participants to allow support agents cross-restaurant access
DROP POLICY IF EXISTS "Support agents can manage all chat participants" ON chat_participants;
CREATE POLICY "Support agents can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Enhanced RLS policies for message_attachments to allow support agents cross-restaurant access
DROP POLICY IF EXISTS "Support agents can manage all message attachments" ON message_attachments;
CREATE POLICY "Support agents can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Create function to broadcast chat updates for real-time synchronization
CREATE OR REPLACE FUNCTION broadcast_chat_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast the change to all connected clients
  PERFORM pg_notify(
    'chat_update',
    json_build_object(
      'table', TG_TABLE_NAME,
      'type', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'session_id', COALESCE(NEW.session_id, OLD.session_id),
      'restaurant_id', COALESCE(NEW.restaurant_id, OLD.restaurant_id),
      'timestamp', extract(epoch from now())
    )::text
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add triggers for real-time broadcasting
DROP TRIGGER IF EXISTS chat_sessions_broadcast_trigger ON chat_sessions;
CREATE TRIGGER chat_sessions_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_chat_update();

DROP TRIGGER IF EXISTS chat_messages_broadcast_trigger ON chat_messages;
CREATE TRIGGER chat_messages_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_chat_update();

DROP TRIGGER IF EXISTS chat_participants_broadcast_trigger ON chat_participants;
CREATE TRIGGER chat_participants_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON chat_participants
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_chat_update();

-- Create function to get comprehensive chat statistics
CREATE OR REPLACE FUNCTION get_chat_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalSessions', (SELECT COUNT(*) FROM chat_sessions),
    'activeSessions', (SELECT COUNT(*) FROM chat_sessions WHERE status = 'active'),
    'resolvedToday', (
      SELECT COUNT(*) 
      FROM chat_sessions 
      WHERE status = 'resolved' 
      AND DATE(updated_at) = CURRENT_DATE
    ),
    'averageResponseTime', 0, -- Placeholder for future implementation
    'totalRestaurants', (
      SELECT COUNT(DISTINCT restaurant_id) 
      FROM chat_sessions
    ),
    'agentsOnline', (
      SELECT COUNT(DISTINCT user_id)
      FROM chat_participants
      WHERE user_type = 'support_agent'
      AND is_online = true
      AND last_seen_at > NOW() - INTERVAL '5 minutes'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;
GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_statistics() TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_restaurant_status_priority 
  ON chat_sessions(restaurant_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created_sender 
  ON chat_messages(session_id, created_at, sender_type);

CREATE INDEX IF NOT EXISTS idx_chat_participants_session_online 
  ON chat_participants(session_id, is_online, last_seen_at);

-- Add helpful comments
COMMENT ON FUNCTION is_support_agent() IS 'Checks if the current session user is a support agent';
COMMENT ON FUNCTION set_support_agent_context(text) IS 'Sets support agent context for cross-restaurant access';
COMMENT ON FUNCTION broadcast_chat_update() IS 'Broadcasts chat changes for real-time synchronization';
COMMENT ON FUNCTION get_chat_statistics() IS 'Returns comprehensive chat system statistics';