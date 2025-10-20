/*
  # Redesign Support System as Live Chat

  1. New Tables
    - `chat_sessions` - Live chat sessions between restaurants and support
    - `chat_messages` - Real-time messages with file upload support
    - `chat_participants` - Track who's in each chat session
    - `message_attachments` - File attachments for messages

  2. Security
    - Enable RLS on all new tables
    - Add policies for restaurant managers and super admins
    - Secure file upload handling

  3. Changes
    - Keep existing support tables for backward compatibility
    - Add new live chat functionality
    - Real-time subscriptions for instant messaging
*/

-- Create chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Support Chat',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category text NOT NULL DEFAULT 'general',
  created_by_user_id uuid NOT NULL,
  assigned_admin_name text,
  assigned_admin_id text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('restaurant_manager', 'super_admin')),
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  has_attachments boolean DEFAULT false,
  is_system_message boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create chat participants table
CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('restaurant_manager', 'super_admin')),
  user_id text NOT NULL,
  user_name text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  is_online boolean DEFAULT true,
  UNIQUE(session_id, user_id)
);

-- Create message attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_url text NOT NULL,
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Chat sessions policies
CREATE POLICY "Restaurant managers can manage own chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = chat_sessions.restaurant_id AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = chat_sessions.restaurant_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Service role can manage all chat sessions"
  ON chat_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Chat messages policies
CREATE POLICY "Restaurant managers can manage messages for own sessions"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_sessions cs
    JOIN restaurants r ON r.id = cs.restaurant_id
    WHERE cs.id = chat_messages.session_id AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_sessions cs
    JOIN restaurants r ON r.id = cs.restaurant_id
    WHERE cs.id = chat_messages.session_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Service role can manage all chat messages"
  ON chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Chat participants policies
CREATE POLICY "Restaurant managers can manage participants for own sessions"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_sessions cs
    JOIN restaurants r ON r.id = cs.restaurant_id
    WHERE cs.id = chat_participants.session_id AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_sessions cs
    JOIN restaurants r ON r.id = cs.restaurant_id
    WHERE cs.id = chat_participants.session_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Service role can manage all chat participants"
  ON chat_participants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Message attachments policies
CREATE POLICY "Restaurant managers can manage attachments for own sessions"
  ON message_attachments
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_sessions cs ON cs.id = cm.session_id
    JOIN restaurants r ON r.id = cs.restaurant_id
    WHERE cm.id = message_attachments.message_id AND r.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_sessions cs ON cs.id = cm.session_id
    JOIN restaurants r ON r.id = cs.restaurant_id
    WHERE cm.id = message_attachments.message_id AND r.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Service role can manage all message attachments"
  ON message_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_restaurant_status ON chat_sessions(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message ON chat_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_session_online ON chat_participants(session_id, is_online);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);

-- Create triggers for updated_at
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_last_message_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_session_last_message();

-- Function to update participant last_seen_at
CREATE OR REPLACE FUNCTION update_participant_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_participants 
  SET last_seen_at = now()
  WHERE session_id = NEW.session_id AND user_id = NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_participant_last_seen_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_participant_last_seen();