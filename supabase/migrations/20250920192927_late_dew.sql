/*
  # Fix Support Portal RLS Policies

  This migration ensures support agents can see ALL restaurant chat sessions,
  not just sessions from one restaurant.

  1. Security Updates
    - Update RLS policies to allow support agents global access
    - Add proper support agent context function
    - Ensure support agents can view all restaurants' sessions

  2. Functions
    - Create/update support agent context function
    - Add helper functions for support agent identification
*/

-- Create or replace the support agent context function
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the agent email in the session for RLS policies
  PERFORM set_config('app.current_agent_email', agent_email, true);
  
  -- Also set a flag indicating this is a support agent session
  PERFORM set_config('app.is_support_agent', 'true', true);
  
  -- Log the context setting
  RAISE NOTICE 'Support agent context set for: %', agent_email;
END;
$$;

-- Create helper function to check if current user is a support agent
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the support agent flag is set in the session
  RETURN COALESCE(current_setting('app.is_support_agent', true)::boolean, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Update chat_sessions RLS policies to allow support agents global access
DROP POLICY IF EXISTS "Support agents can view all chat sessions" ON chat_sessions;
CREATE POLICY "Support agents can view all chat sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

DROP POLICY IF EXISTS "Support agents can manage all chat sessions" ON chat_sessions;
CREATE POLICY "Support agents can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat_messages RLS policies
DROP POLICY IF EXISTS "Support agents can view all chat messages" ON chat_messages;
CREATE POLICY "Support agents can view all chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

DROP POLICY IF EXISTS "Support agents can manage all chat messages" ON chat_messages;
CREATE POLICY "Support agents can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat_participants RLS policies
DROP POLICY IF EXISTS "Support agents can view all chat participants" ON chat_participants;
CREATE POLICY "Support agents can view all chat participants"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

DROP POLICY IF EXISTS "Support agents can manage all chat participants" ON chat_participants;
CREATE POLICY "Support agents can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update message_attachments RLS policies
DROP POLICY IF EXISTS "Support agents can view all message attachments" ON message_attachments;
CREATE POLICY "Support agents can view all message attachments"
  ON message_attachments
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

DROP POLICY IF EXISTS "Support agents can manage all message attachments" ON message_attachments;
CREATE POLICY "Support agents can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Ensure support agents can view restaurants table for session context
DROP POLICY IF EXISTS "Support agents can view all restaurants" ON restaurants;
CREATE POLICY "Support agents can view all restaurants"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;

-- Test the functions
DO $$
BEGIN
  -- Test setting support agent context
  PERFORM set_support_agent_context('test@example.com');
  
  -- Test checking if user is support agent
  IF is_support_agent() THEN
    RAISE NOTICE 'Support agent context test: SUCCESS';
  ELSE
    RAISE NOTICE 'Support agent context test: FAILED';
  END IF;
  
  -- Reset context
  PERFORM set_config('app.current_agent_email', '', true);
  PERFORM set_config('app.is_support_agent', 'false', true);
END;
$$;