/*
  # Create Support Agents Table and Functions

  1. New Tables
    - `support_agents`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `email` (text, unique, not null)
      - `password_hash` (text, not null)
      - `role` (text, default 'support_agent')
      - `is_active` (boolean, default true)
      - `last_login_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. New Tables
    - `quick_responses`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `message` (text, not null)
      - `category` (text, not null)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on both tables
    - Add policies for service role access
    - Add authentication functions

  4. Functions
    - `authenticate_support_agent` - Authenticate support agents
    - `create_support_agent` - Create new support agents with password hashing
    - `hash_password` - Utility function for password hashing
    - `verify_password` - Utility function for password verification
*/

-- Create support agents table
CREATE TABLE IF NOT EXISTS support_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'support_agent' CHECK (role = 'support_agent'),
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quick responses table
CREATE TABLE IF NOT EXISTS quick_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_agents
CREATE POLICY "Service role can manage all agents"
  ON support_agents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Support agents can manage own profile"
  ON support_agents
  FOR ALL
  TO authenticated
  USING (email = current_setting('app.current_agent_email', true))
  WITH CHECK (email = current_setting('app.current_agent_email', true));

-- RLS Policies for quick_responses
CREATE POLICY "Service role can manage quick responses"
  ON quick_responses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Support agents can read quick responses"
  ON quick_responses
  FOR SELECT
  TO authenticated
  USING (is_support_agent());

-- Password hashing function
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple hash for demo - in production use proper bcrypt
  RETURN encode(digest(password || 'voya_salt_2025', 'sha256'), 'hex');
END;
$$;

-- Password verification function
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN hash_password(password) = hash;
END;
$$;

-- Create support agent function
CREATE OR REPLACE FUNCTION create_support_agent(
  agent_name text,
  agent_email text,
  agent_password text
)
RETURNS support_agents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_agent support_agents;
BEGIN
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM support_agents WHERE email = agent_email) THEN
    RAISE EXCEPTION 'Support agent with this email already exists';
  END IF;

  -- Insert new agent
  INSERT INTO support_agents (name, email, password_hash)
  VALUES (agent_name, agent_email, hash_password(agent_password))
  RETURNING * INTO new_agent;

  RETURN new_agent;
END;
$$;

-- Authenticate support agent function
CREATE OR REPLACE FUNCTION authenticate_support_agent(
  agent_email text,
  agent_password text
)
RETURNS support_agents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_record support_agents;
BEGIN
  -- Find agent by email
  SELECT * INTO agent_record
  FROM support_agents
  WHERE email = agent_email AND is_active = true;

  -- Check if agent exists and password is correct
  IF agent_record IS NULL THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  IF NOT verify_password(agent_password, agent_record.password_hash) THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  -- Return agent data (without password hash)
  RETURN agent_record;
END;
$$;

-- Insert default quick responses
INSERT INTO quick_responses (title, message, category) VALUES
  ('Welcome Message', 'Hello! Thank you for contacting VOYA support. How can I help you today?', 'greeting'),
  ('Checking Issue', 'I''m looking into this issue for you. Please give me a moment to investigate.', 'general'),
  ('Need More Info', 'Could you please provide more details about the issue you''re experiencing?', 'general'),
  ('Technical Issue', 'I understand you''re experiencing a technical issue. Let me help you resolve this.', 'technical'),
  ('Billing Question', 'I''ll be happy to help you with your billing question. Let me review your account.', 'billing'),
  ('Feature Request', 'Thank you for your feature suggestion! I''ll make sure to pass this along to our development team.', 'feature'),
  ('Issue Resolved', 'Great! I''m glad we were able to resolve this issue for you. Is there anything else I can help with?', 'resolution'),
  ('Closing Chat', 'Thank you for contacting VOYA support. If you need any further assistance, please don''t hesitate to reach out!', 'closing')
ON CONFLICT DO NOTHING;

-- Update triggers
CREATE TRIGGER update_support_agents_updated_at
  BEFORE UPDATE ON support_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_agents_email ON support_agents(email);
CREATE INDEX IF NOT EXISTS idx_support_agents_active ON support_agents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_quick_responses_category ON quick_responses(category, is_active);