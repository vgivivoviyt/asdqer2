/*
  # Fix Database Errors for Support System

  1. Database Issues
    - Fix triggers that reference non-existent session_id field
    - Update RLS policies for support agents
    - Fix set_support_agent_context function
    
  2. Security
    - Proper RLS policies for support agents
    - Enable support agents to insert messages
    - Allow cross-restaurant access for support agents
*/

-- First, let's check and fix any triggers that might be causing the session_id error
-- Drop and recreate the broadcast_chat_update function to fix field references
DROP FUNCTION IF EXISTS broadcast_chat_update() CASCADE;

CREATE OR REPLACE FUNCTION broadcast_chat_update()
RETURNS TRIGGER AS $$
BEGIN
  -- For chat_sessions table
  IF TG_TABLE_NAME = 'chat_sessions' THEN
    PERFORM pg_notify('chat_update', json_build_object(
      'type', 'session_update',
      'session_id', COALESCE(NEW.id, OLD.id),
      'restaurant_id', COALESCE(NEW.restaurant_id, OLD.restaurant_id),
      'operation', TG_OP
    )::text);
  END IF;
  
  -- For chat_messages table
  IF TG_TABLE_NAME = 'chat_messages' THEN
    PERFORM pg_notify('chat_update', json_build_object(
      'type', 'message_update',
      'session_id', COALESCE(NEW.session_id, OLD.session_id),
      'message_id', COALESCE(NEW.id, OLD.id),
      'operation', TG_OP
    )::text);
  END IF;
  
  -- For chat_participants table
  IF TG_TABLE_NAME = 'chat_participants' THEN
    PERFORM pg_notify('chat_update', json_build_object(
      'type', 'participant_update',
      'session_id', COALESCE(NEW.session_id, OLD.session_id),
      'participant_id', COALESCE(NEW.id, OLD.id),
      'operation', TG_OP
    )::text);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
DROP TRIGGER IF EXISTS chat_sessions_broadcast_trigger ON chat_sessions;
DROP TRIGGER IF EXISTS chat_messages_broadcast_trigger ON chat_messages;
DROP TRIGGER IF EXISTS chat_participants_broadcast_trigger ON chat_participants;

CREATE TRIGGER chat_sessions_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION broadcast_chat_update();

CREATE TRIGGER chat_messages_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION broadcast_chat_update();

CREATE TRIGGER chat_participants_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON chat_participants
  FOR EACH ROW EXECUTE FUNCTION broadcast_chat_update();

-- Fix the set_support_agent_context function
DROP FUNCTION IF EXISTS set_support_agent_context(text);

CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS json AS $$
DECLARE
  agent_record support_agents%ROWTYPE;
  result json;
BEGIN
  -- Find the support agent
  SELECT * INTO agent_record 
  FROM support_agents 
  WHERE email = agent_email AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Support agent not found or inactive'
    );
  END IF;
  
  -- Set session variables for this connection
  PERFORM set_config('app.current_agent_email', agent_email, true);
  PERFORM set_config('app.current_agent_id', agent_record.id::text, true);
  PERFORM set_config('app.current_agent_role', 'support_agent', true);
  
  result := json_build_object(
    'success', true,
    'agent_id', agent_record.id,
    'agent_email', agent_record.email,
    'agent_name', agent_record.name
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update the is_support_agent function
DROP FUNCTION IF EXISTS is_support_agent();

CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean AS $$
BEGIN
  -- Check if current session has support agent context set
  RETURN COALESCE(current_setting('app.current_agent_role', true), '') = 'support_agent';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for chat_sessions to allow support agents full access
DROP POLICY IF EXISTS "Support agents can manage all chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Service role can manage all chat sessions" ON chat_sessions;

CREATE POLICY "Support agents can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

CREATE POLICY "Service role can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for chat_messages to allow support agents full access
DROP POLICY IF EXISTS "Support agents can manage all chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Service role can manage all chat messages" ON chat_messages;

CREATE POLICY "Support agents can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

CREATE POLICY "Service role can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for chat_participants to allow support agents full access
DROP POLICY IF EXISTS "Support agents can manage all chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Service role can manage all chat participants" ON chat_participants;

CREATE POLICY "Support agents can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

CREATE POLICY "Service role can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for message_attachments to allow support agents full access
DROP POLICY IF EXISTS "Support agents can manage all message attachments" ON message_attachments;
DROP POLICY IF EXISTS "Service role can manage all message attachments" ON message_attachments;

CREATE POLICY "Support agents can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

CREATE POLICY "Service role can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure restaurants table allows support agents to read all restaurants
DROP POLICY IF EXISTS "Support agents can view all restaurants" ON restaurants;

CREATE POLICY "Support agents can view all restaurants"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create a function to test support agent context
CREATE OR REPLACE FUNCTION test_support_agent_context()
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'is_support_agent', is_support_agent(),
    'agent_email', current_setting('app.current_agent_email', true),
    'agent_id', current_setting('app.current_agent_id', true),
    'agent_role', current_setting('app.current_agent_role', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;