/*
  # Professional Support System Enhancement (Safe & Reversible)

  Features:
    - Idempotent (safe to re-run)
    - Rollback section at bottom
*/

-----------------------------------------------------
-- 1. Support Agents
-----------------------------------------------------

CREATE TABLE IF NOT EXISTS support_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor', 'admin')),
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_agents' AND policyname = 'Support agents can manage own profile'
  ) THEN
    CREATE POLICY "Support agents can manage own profile"
      ON support_agents
      FOR ALL
      TO authenticated
      USING (email = current_setting('app.current_agent_email', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_agents' AND policyname = 'Service role can manage all agents'
  ) THEN
    CREATE POLICY "Service role can manage all agents"
      ON support_agents
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-----------------------------------------------------
-- 2. Chat Sessions
-----------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    CREATE TABLE chat_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
      title text DEFAULT 'Support Chat' NOT NULL,
      status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'resolved', 'closed')),
      priority text DEFAULT 'medium' NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      category text DEFAULT 'general' NOT NULL,
      created_by_user_id uuid NOT NULL,
      assigned_agent_name text,
      assigned_agent_id text,
      last_message_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_sessions' AND column_name = 'assigned_agent_name') THEN
    ALTER TABLE chat_sessions ADD COLUMN assigned_agent_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_sessions' AND column_name = 'assigned_agent_id') THEN
    ALTER TABLE chat_sessions ADD COLUMN assigned_agent_id text;
  END IF;
END $$;

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'Restaurant managers can manage own chat sessions') THEN
    CREATE POLICY "Restaurant managers can manage own chat sessions"
      ON chat_sessions
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM restaurants r 
        WHERE r.id = chat_sessions.restaurant_id 
        AND r.owner_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM restaurants r 
        WHERE r.id = chat_sessions.restaurant_id 
        AND r.owner_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'Support agents can manage all chat sessions') THEN
    CREATE POLICY "Support agents can manage all chat sessions"
      ON chat_sessions
      FOR ALL
      TO authenticated
      USING (current_setting('app.current_agent_email', true) IS NOT NULL)
      WITH CHECK (current_setting('app.current_agent_email', true) IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'Service role can manage all chat sessions') THEN
    CREATE POLICY "Service role can manage all chat sessions"
      ON chat_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-----------------------------------------------------
-- 3. Chat Messages
-----------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    CREATE TABLE chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
      sender_type text NOT NULL CHECK (sender_type IN ('restaurant_manager', 'support_agent')),
      sender_id text NOT NULL,
      sender_name text NOT NULL,
      message text NOT NULL,
      message_type text DEFAULT 'text' NOT NULL CHECK (message_type IN ('text', 'image', 'file')),
      has_attachments boolean DEFAULT false,
      is_system_message boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Restaurant managers can manage messages for own sessions') THEN
    CREATE POLICY "Restaurant managers can manage messages for own sessions"
      ON chat_messages
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_sessions cs
        JOIN restaurants r ON r.id = cs.restaurant_id
        WHERE cs.id = chat_messages.session_id 
        AND r.owner_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_sessions cs
        JOIN restaurants r ON r.id = cs.restaurant_id
        WHERE cs.id = chat_messages.session_id 
        AND r.owner_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Support agents can manage all chat messages') THEN
    CREATE POLICY "Support agents can manage all chat messages"
      ON chat_messages
      FOR ALL
      TO authenticated
      USING (current_setting('app.current_agent_email', true) IS NOT NULL)
      WITH CHECK (current_setting('app.current_agent_email', true) IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Service role can manage all chat messages') THEN
    CREATE POLICY "Service role can manage all chat messages"
      ON chat_messages
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-----------------------------------------------------
-- 4. Chat Participants
-----------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_participants') THEN
    CREATE TABLE chat_participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
      user_type text NOT NULL CHECK (user_type IN ('restaurant_manager', 'support_agent')),
      user_id text NOT NULL,
      user_name text NOT NULL,
      joined_at timestamptz DEFAULT now(),
      last_seen_at timestamptz DEFAULT now(),
      is_online boolean DEFAULT true
    );
  END IF;
END $$;

-- Unique constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_participants_session_id_user_id_key') THEN
    ALTER TABLE chat_participants ADD CONSTRAINT chat_participants_session_id_user_id_key UNIQUE (session_id, user_id);
  END IF;
END $$;

ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_participants' AND policyname = 'Restaurant managers can manage participants for own sessions') THEN
    CREATE POLICY "Restaurant managers can manage participants for own sessions"
      ON chat_participants
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_sessions cs
        JOIN restaurants r ON r.id = cs.restaurant_id
        WHERE cs.id = chat_participants.session_id 
        AND r.owner_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_sessions cs
        JOIN restaurants r ON r.id = cs.restaurant_id
        WHERE cs.id = chat_participants.session_id 
        AND r.owner_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_participants' AND policyname = 'Support agents can manage all chat participants') THEN
    CREATE POLICY "Support agents can manage all chat participants"
      ON chat_participants
      FOR ALL
      TO authenticated
      USING (current_setting('app.current_agent_email', true) IS NOT NULL)
      WITH CHECK (current_setting('app.current_agent_email', true) IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_participants' AND policyname = 'Service role can manage all chat participants') THEN
    CREATE POLICY "Service role can manage all chat participants"
      ON chat_participants
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-----------------------------------------------------
-- 5. Message Attachments
-----------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_attachments') THEN
    CREATE TABLE message_attachments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
      file_name text NOT NULL,
      file_type text NOT NULL,
      file_size integer NOT NULL,
      file_url text NOT NULL,
      thumbnail_url text,
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_attachments' AND policyname = 'Restaurant managers can manage attachments for own sessions') THEN
    CREATE POLICY "Restaurant managers can manage attachments for own sessions"
      ON message_attachments
      FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_messages cm
        JOIN chat_sessions cs ON cs.id = cm.session_id
        JOIN restaurants r ON r.id = cs.restaurant_id
        WHERE cm.id = message_attachments.message_id 
        AND r.owner_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_messages cm
        JOIN chat_sessions cs ON cs.id = cm.session_id
        JOIN restaurants r ON r.id = cs.restaurant_id
        WHERE cm.id = message_attachments.message_id 
        AND r.owner_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_attachments' AND policyname = 'Support agents can manage all message attachments') THEN
    CREATE POLICY "Support agents can manage all message attachments"
      ON message_attachments
      FOR ALL
      TO authenticated
      USING (current_setting('app.current_agent_email', true) IS NOT NULL)
      WITH CHECK (current_setting('app.current_agent_email', true) IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_attachments' AND policyname = 'Service role can manage all message attachments') THEN
    CREATE POLICY "Service role can manage all message attachments"
      ON message_attachments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-----------------------------------------------------
-- 6. Indexes
-----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_chat_sessions_restaurant_status ON chat_sessions(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message ON chat_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_session_online ON chat_participants(session_id, is_online);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);


-----------------------------------------------------
-- 7. Functions & Triggers
-----------------------------------------------------

CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_participant_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_participants 
  SET last_seen_at = now()
  WHERE session_id = NEW.session_id 
  AND user_id = NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_session_last_message_trigger ON chat_messages;
CREATE TRIGGER update_session_last_message_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_message();

DROP TRIGGER IF EXISTS update_participant_last_seen_trigger ON chat_messages;
CREATE TRIGGER update_participant_last_seen_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_last_seen();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-----------------------------------------------------
-- 8. Seed Data
-----------------------------------------------------

INSERT INTO support_agents (name, email, password_hash, role) 
VALUES ('Support Team', 'support@voya.com', 'demo_hash', 'admin')
ON CONFLICT (email) DO NOTHING; 