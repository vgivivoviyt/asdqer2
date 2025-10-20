/*
  Fix Support Agent Foreign Key Relationship
  - Uses auth.users.raw_user_meta_data / raw_app_meta_data (Supabase)
  - Removes invalid "FROM" inside ON CONFLICT DO UPDATE
  - Ensures sync triggers, RLS, indexes, and FK updated
*/

-- 1) Trigger function to sync auth.users -> public.users
CREATE OR REPLACE FUNCTION sync_auth_users()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    user_metadata,
    role,
    is_super_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
    COALESCE(NEW.raw_user_meta_data->>'role', COALESCE(NEW.raw_app_meta_data->>'role', 'restaurant_owner')),
    COALESCE((NEW.raw_app_meta_data->>'is_super_admin')::boolean, false),
    NEW.created_at,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    user_metadata = EXCLUDED.user_metadata,
    role = COALESCE(EXCLUDED.user_metadata->>'role', 'restaurant_owner'),
    is_super_admin = COALESCE((EXCLUDED.user_metadata->>'is_super_admin')::boolean, false),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Create trigger
DROP TRIGGER IF EXISTS sync_auth_users_trigger ON auth.users;
CREATE TRIGGER sync_auth_users_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_users();

-- 3) Bulk-sync existing auth.users -> public.users (fixing raw_* names)
INSERT INTO public.users (
  id, email, user_metadata, role, is_super_admin, created_at, updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data, '{}'::jsonb) AS user_metadata,
  COALESCE(au.raw_user_meta_data->>'role', COALESCE(au.raw_app_meta_data->>'role', 'restaurant_owner')) AS role,
  COALESCE((au.raw_app_meta_data->>'is_super_admin')::boolean, false) AS is_super_admin,
  au.created_at,
  NOW()
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  user_metadata = EXCLUDED.user_metadata,
  role = COALESCE(EXCLUDED.user_metadata->>'role', 'restaurant_owner'),
  is_super_admin = COALESCE((EXCLUDED.user_metadata->>'is_super_admin')::boolean, false),
  updated_at = NOW();

-- 4) Drop existing FK constraint (if any) that pointed to auth.users
ALTER TABLE support_agents DROP CONSTRAINT IF EXISTS support_agents_id_fkey;

-- 5) Add FK constraint to public.users
ALTER TABLE support_agents
ADD CONSTRAINT support_agents_id_fkey
FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 6) Remove orphaned support_agents that don't map to a support user in public.users
DELETE FROM support_agents
WHERE id NOT IN (SELECT id FROM public.users WHERE role = 'support');

-- 7) Update support_agents role check (if you want the role value on support_agents to be 'support_agent')
ALTER TABLE support_agents DROP CONSTRAINT IF EXISTS support_agents_role_check;
ALTER TABLE support_agents
ADD CONSTRAINT support_agents_role_check
CHECK (role = 'support_agent');

-- 8) RLS policy fixes (non-recursive, refer to users table in same schema)
-- Drop problematic policies (if they exist)
DROP POLICY IF EXISTS "Support agents can read own profile" ON users;
DROP POLICY IF EXISTS "Support agents can manage own profile" ON users;

-- Add safe policies for reading/updating own user profile (use whatever role value your public.users uses)
CREATE POLICY "Support agents can read own user profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    AND role = 'support'
  );

CREATE POLICY "Support agents can update own user profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND role = 'support'
  )
  WITH CHECK (
    id = auth.uid()
    AND role = 'support'
  );

-- support_agents-specific policies
DROP POLICY IF EXISTS "Support agents can manage own profile" ON support_agents;

CREATE POLICY "Support agents can read own support profile"
  ON support_agents
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Support agents can update own support profile"
  ON support_agents
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 9) RPC to return support agents joined to public.users
CREATE OR REPLACE FUNCTION get_support_agents_with_users()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  is_active boolean,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    sa.name,
    u.email,
    u.role,
    sa.is_active,
    sa.last_login_at,
    u.created_at,
    sa.updated_at
  FROM public.users u
  INNER JOIN support_agents sa ON sa.id = u.id
  WHERE u.role = 'support'
  ORDER BY sa.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_support_agents_with_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_support_agents_with_users() TO service_role;

-- 10) Helper to check support agent (non-recursive)
CREATE OR REPLACE FUNCTION is_support_agent()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'support'
  );
$$;

GRANT EXECUTE ON FUNCTION is_support_agent() TO authenticated;
GRANT EXECUTE ON FUNCTION is_support_agent() TO service_role;

-- 11) Support agent context setter for RLS
CREATE OR REPLACE FUNCTION set_support_agent_context(agent_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_support_agent_email', agent_email, true);
  PERFORM set_config('app.is_support_agent_session', 'true', true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_support_agent_context(text) TO service_role;

-- 12) Useful indexes
CREATE INDEX IF NOT EXISTS idx_users_role_support ON users(role) WHERE role = 'support';
CREATE INDEX IF NOT EXISTS idx_support_agents_active ON support_agents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_support_agents_email_active ON support_agents(id, is_active) WHERE is_active = true;

-- 13) Ensure all existing support_agents have public.users rows
INSERT INTO public.users (id, email, role, user_metadata, created_at, updated_at)
SELECT
  sa.id,
  sa.email,
  'support',
  jsonb_build_object('name', sa.name, 'role', 'support'),
  sa.created_at,
  NOW()
FROM support_agents sa
WHERE sa.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO UPDATE
SET
  role = 'support',
  user_metadata = EXCLUDED.user_metadata,
  updated_at = NOW();
