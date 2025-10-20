/*
  # Migrate Support Agents to Supabase Auth (Fixed for Supabase Permissions)

  This migration will:
  - Add `role` column to users table
  - Create index for role-based queries
  - Create helper functions for support agent auth (in public schema)
  - Update quick_responses policies
  - Add policies for support_agents and users
*/

-- 1. Add role column if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'restaurant_owner';

-- 2. Create index for support role queries (safe check)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role = 'support';
  END IF;
END $$;

-- 3. Helper function: get role from JWT (in public schema)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'role'),
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'authenticated'
  );
$$;

-- 4. Helper function: check if support agent (in public schema)
CREATE OR REPLACE FUNCTION public.is_support_agent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_auth_role() = 'support'
     OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'support'
     OR EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() AND role = 'support'
       );
$$;

-- 5. Update quick_responses policies
DROP POLICY IF EXISTS "Support agents can read quick responses" ON quick_responses;
DROP POLICY IF EXISTS "Support agents can read all quick responses" ON quick_responses;

CREATE POLICY "Support agents can read quick responses"
ON quick_responses
FOR SELECT
TO authenticated
USING (
  public.is_support_agent() OR 
  public.get_auth_role() = 'support' OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'support'
);

-- 6. Function: create support agent via Supabase Auth
CREATE OR REPLACE FUNCTION public.create_support_agent_auth(
  agent_name text,
  agent_email text,
  agent_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  result json;
BEGIN
  -- Insert into users table with support role
  INSERT INTO users (email, role, user_metadata)
  VALUES (
    agent_email,
    'support',
    jsonb_build_object('name', agent_name, 'role', 'support')
  )
  RETURNING id INTO new_user_id;
  
  -- Insert into support_agents for backward compatibility
  INSERT INTO support_agents (id, name, email, role, is_active)
  VALUES (new_user_id, agent_name, agent_email, 'support_agent', true)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = now();
  
  result := json_build_object(
    'id', new_user_id,
    'name', agent_name,
    'email', agent_email,
    'role', 'support',
    'is_active', true,
    'created_at', now()
  );
  
  RETURN result;
END;
$$;

-- 7. Function: authenticate support agent
CREATE OR REPLACE FUNCTION public.authenticate_support_agent_auth(
  agent_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agent_record record;
  result json;
BEGIN
  SELECT u.id, u.email, u.user_metadata->>'name' as name, u.role, u.created_at, u.updated_at
  INTO agent_record
  FROM users u
  WHERE u.email = agent_email 
    AND u.role = 'support'
    AND EXISTS (
      SELECT 1 FROM support_agents sa 
      WHERE sa.email = agent_email AND sa.is_active = true
    );
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  UPDATE support_agents 
  SET last_login_at = now(), updated_at = now()
  WHERE email = agent_email;
  
  result := json_build_object(
    'id', agent_record.id,
    'name', agent_record.name,
    'email', agent_record.email,
    'role', agent_record.role,
    'is_active', true,
    'created_at', agent_record.created_at,
    'updated_at', agent_record.updated_at
  );
  
  RETURN result;
END;
$$;

-- 8. Function: set support agent context
CREATE OR REPLACE FUNCTION public.set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u
    JOIN support_agents sa ON sa.email = u.email
    WHERE u.email = agent_email 
      AND u.role = 'support'
      AND sa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Support agent not found or inactive: %', agent_email;
  END IF;
  
  PERFORM set_config('app.current_agent_email', agent_email, true);
  PERFORM set_config('app.is_support_agent', 'true', true);
END;
$$;

-- 9. Update support_agents policies
DROP POLICY IF EXISTS "Support agents can manage own profile" ON support_agents;

CREATE POLICY "Support agents can manage own profile"
ON support_agents
FOR ALL
TO authenticated
USING (
  email = (auth.jwt() ->> 'email') 
  AND (public.get_auth_role() = 'support' OR public.is_support_agent())
)
WITH CHECK (
  email = (auth.jwt() ->> 'email') 
  AND (public.get_auth_role() = 'support' OR public.is_support_agent())
);

-- 10. Add users policy (support agents can read own profile)
DROP POLICY IF EXISTS "Support agents can read own profile" ON users;

CREATE POLICY "Support agents can read own profile"
ON users
FOR SELECT
TO authenticated
USING (
  id = auth.uid() AND role = 'support'
);

-- 11. Grant permissions
GRANT EXECUTE ON FUNCTION public.create_support_agent_auth TO service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_support_agent_auth TO service_role;
GRANT EXECUTE ON FUNCTION public.set_support_agent_context TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support_agent TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role TO authenticated;
