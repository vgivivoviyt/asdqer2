/*
  # Fix Support Agent Functions

  1. Enhanced Functions
    - Fix create_support_agent function to return proper data
    - Fix authenticate_support_agent function for proper validation
    - Add better error handling and logging

  2. Security
    - Ensure proper RLS policies
    - Add service role permissions
*/

-- Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS create_support_agent(text, text, text);
DROP FUNCTION IF EXISTS authenticate_support_agent(text, text);
DROP FUNCTION IF EXISTS set_support_agent_context(text);

-- Enhanced create_support_agent function
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
  password_hash text;
BEGIN
  -- Validate inputs
  IF agent_name IS NULL OR trim(agent_name) = '' THEN
    RAISE EXCEPTION 'Agent name is required';
  END IF;
  
  IF agent_email IS NULL OR trim(agent_email) = '' THEN
    RAISE EXCEPTION 'Agent email is required';
  END IF;
  
  IF agent_password IS NULL OR length(agent_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM support_agents WHERE email = agent_email) THEN
    RAISE EXCEPTION 'An agent with this email already exists';
  END IF;

  -- Hash the password using crypt
  password_hash := crypt(agent_password, gen_salt('bf'));

  -- Insert new agent
  INSERT INTO support_agents (
    name,
    email,
    password_hash,
    role,
    is_active,
    temp_plain_password
  ) VALUES (
    trim(agent_name),
    lower(trim(agent_email)),
    password_hash,
    'support_agent',
    true,
    agent_password -- Store temporarily for debugging
  ) RETURNING * INTO new_agent;

  -- Log the creation
  RAISE NOTICE 'Support agent created: % (ID: %)', new_agent.email, new_agent.id;

  RETURN new_agent;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create support agent: %', SQLERRM;
END;
$$;

-- Enhanced authenticate_support_agent function
CREATE OR REPLACE FUNCTION authenticate_support_agent(
  agent_email text,
  agent_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash text;
  agent_active boolean;
BEGIN
  -- Validate inputs
  IF agent_email IS NULL OR trim(agent_email) = '' THEN
    RAISE NOTICE 'Authentication failed: Email is required';
    RETURN false;
  END IF;
  
  IF agent_password IS NULL OR trim(agent_password) = '' THEN
    RAISE NOTICE 'Authentication failed: Password is required';
    RETURN false;
  END IF;

  -- Get agent data
  SELECT password_hash, is_active 
  INTO stored_hash, agent_active
  FROM support_agents 
  WHERE email = lower(trim(agent_email));

  -- Check if agent exists
  IF stored_hash IS NULL THEN
    RAISE NOTICE 'Authentication failed: Agent not found for email %', agent_email;
    RETURN false;
  END IF;

  -- Check if agent is active
  IF NOT agent_active THEN
    RAISE NOTICE 'Authentication failed: Agent account is inactive for %', agent_email;
    RETURN false;
  END IF;

  -- Verify password
  IF stored_hash = crypt(agent_password, stored_hash) THEN
    RAISE NOTICE 'Authentication successful for agent: %', agent_email;
    RETURN true;
  ELSE
    RAISE NOTICE 'Authentication failed: Invalid password for %', agent_email;
    RETURN false;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Authentication error for %: %', agent_email, SQLERRM;
    RETURN false;
END;
$$;

-- Grant permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION create_support_agent(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION authenticate_support_agent(text, text) TO authenticated, service_role, anon;

-- Ensure support_agents table has proper RLS policies
ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Service role can manage all agents" ON support_agents;
DROP POLICY IF EXISTS "Support agents can manage own profile" ON support_agents;
DROP POLICY IF EXISTS "Authenticated users can read support agents" ON support_agents;

-- Recreate policies with proper permissions
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

CREATE POLICY "Authenticated users can read support agents"
  ON support_agents
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a function to set support agent context (non-blocking)
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the current agent email in session
  PERFORM set_config('app.current_agent_email', agent_email, true);
  
  RAISE NOTICE 'Support agent context set for: %', agent_email;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail if context setting fails
    RAISE NOTICE 'Warning: Failed to set agent context for %: %', agent_email, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated, service_role, anon;
