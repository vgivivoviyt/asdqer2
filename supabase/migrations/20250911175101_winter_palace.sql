/*
  # Fix Support System Authentication and Real-Time Messaging

  1. Database Schema Updates
    - Fix chat_participants constraint to allow 'support_agent' user type
    - Update RLS policies to properly handle support agents vs restaurant managers
    - Add proper support agent authentication system

  2. Real-Time Messaging
    - Optimize triggers for instant message delivery
    - Fix subscription handling for real-time updates
    - Ensure messages appear instantly on both sides

  3. Professional Support Portal
    - Separate support agents from restaurant managers
    - Allow support agents to see all restaurant chats
    - Professional authentication and session management
*/

-- Fix the chat_participants constraint to allow support_agent
ALTER TABLE chat_participants DROP CONSTRAINT IF EXISTS chat_participants_user_type_check;
ALTER TABLE chat_participants ADD CONSTRAINT chat_participants_user_type_check 
  CHECK (user_type = ANY (ARRAY['restaurant_manager'::text, 'support_agent'::text]));

-- Fix the chat_messages constraint to allow support_agent
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_type_check 
  CHECK (sender_type = ANY (ARRAY['restaurant_manager'::text, 'support_agent'::text]));

-- Create support_agents table if it doesn't exist
CREATE TABLE IF NOT EXISTS support_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'agent'::text CHECK (role = ANY (ARRAY['agent'::text, 'supervisor'::text, 'admin'::text])),
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on support_agents
ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;

-- Support agents can manage their own profile
CREATE POLICY "Support agents can manage own profile" ON support_agents
  FOR ALL TO authenticated
  USING (email = current_setting('app.current_agent_email', true))
  WITH CHECK (email = current_setting('app.current_agent_email', true));

-- Service role can manage all agents
CREATE POLICY "Service role can manage all agents" ON support_agents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if current user is a support agent
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current_agent_email is set (for support portal)
  IF current_setting('app.current_agent_email', true) IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM support_agents 
      WHERE email = current_setting('app.current_agent_email', true) 
      AND is_active = true
    );
  END IF;
  
  -- Check if authenticated user is in support_agents table
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM support_agents sa
      JOIN auth.users u ON u.email = sa.email
      WHERE u.id = auth.uid() AND sa.is_active = true
    );
  END IF;
  
  RETURN false;
END;
$$;

-- Update chat_sessions policies for support agents
DROP POLICY IF EXISTS "Support agents can manage all chat sessions" ON chat_sessions;
CREATE POLICY "Support agents can manage all chat sessions" ON chat_sessions
  FOR ALL TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat_messages policies for support agents  
DROP POLICY IF EXISTS "Support agents can manage all chat messages" ON chat_messages;
CREATE POLICY "Support agents can manage all chat messages" ON chat_messages
  FOR ALL TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update chat_participants policies for support agents
DROP POLICY IF EXISTS "Support agents can manage all chat participants" ON chat_participants;
CREATE POLICY "Support agents can manage all chat participants" ON chat_participants
  FOR ALL TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Update message_attachments policies for support agents
DROP POLICY IF EXISTS "Support agents can manage all message attachments" ON message_attachments;
CREATE POLICY "Support agents can manage all message attachments" ON message_attachments
  FOR ALL TO authenticated
  USING (is_support_agent())
  WITH CHECK (is_support_agent());

-- Function to set support agent context
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the current agent email for this session
  PERFORM set_config('app.current_agent_email', agent_email, true);
END;
$$;

-- Insert sample support agents for testing
INSERT INTO support_agents (name, email, password_hash, role) VALUES
  ('Sarah Johnson', 'support@voya.com', 'hashed_password_demo', 'admin'),
  ('Mike Chen', 'mike@voya.com', 'hashed_password_demo', 'agent'),
  ('Lisa Rodriguez', 'lisa@voya.com', 'hashed_password_demo', 'supervisor')
ON CONFLICT (email) DO NOTHING;

-- Optimize triggers for real-time performance
CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update session's last_message_at timestamp
  UPDATE chat_sessions 
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_participant_last_seen()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update participant's last_seen_at when they send a message
  UPDATE chat_participants 
  SET last_seen_at = NEW.created_at,
      is_online = true
  WHERE session_id = NEW.session_id 
    AND user_id = NEW.sender_id;
  
  RETURN NEW;
END;
$$;