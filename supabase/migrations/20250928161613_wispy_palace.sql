/*
  # Fix Support Agent Authentication and Relationships

  1. Database Schema Updates
    - Add foreign key relationship between users and support_agents tables
    - Ensure proper constraints and indexes for support agent queries
    - Update RLS policies to work with the new relationship

  2. Data Integrity
    - Clean up any orphaned support_agents records
    - Ensure all support agents have corresponding users records

  3. Security
    - Update RLS policies to use the new FK relationship
    - Ensure support agents can only access their own data through proper joins
*/

-- First, clean up any orphaned support_agents records that don't have corresponding users
DELETE FROM support_agents 
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE id IS NOT NULL
);

-- Add foreign key constraint between support_agents and auth.users
DO $$
BEGIN
  -- Check if the foreign key constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'support_agents_id_fkey' 
    AND table_name = 'support_agents'
  ) THEN
    ALTER TABLE support_agents 
    ADD CONSTRAINT support_agents_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure the users table has proper support agent records
-- Insert missing users records for any support agents that exist
INSERT INTO users (id, email, role, user_metadata)
SELECT 
  sa.id,
  sa.email,
  'support',
  jsonb_build_object('name', sa.name, 'role', 'support')
FROM support_agents sa
LEFT JOIN users u ON u.id = sa.id
WHERE u.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  role = 'support',
  user_metadata = jsonb_build_object('name', EXCLUDED.user_metadata->>'name', 'role', 'support');

-- Update existing support agents to ensure they have the correct role in users table
UPDATE users 
SET 
  role = 'support',
  user_metadata = COALESCE(user_metadata, '{}'::jsonb) || jsonb_build_object('role', 'support')
WHERE id IN (SELECT id FROM support_agents);

-- Add index for better performance on support agent queries
CREATE INDEX IF NOT EXISTS idx_users_support_role 
ON users(role) WHERE role = 'support';

-- Add index for support agents email lookups
CREATE INDEX IF NOT EXISTS idx_support_agents_email_active 
ON support_agents(email, is_active) WHERE is_active = true;

-- Update RLS policies to work with the new FK relationship
DROP POLICY IF EXISTS "Support agents can read own profile" ON users;
CREATE POLICY "Support agents can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() AND 
    role = 'support' AND
    EXISTS (SELECT 1 FROM support_agents WHERE id = users.id AND is_active = true)
  );

-- Update support_agents policies to use the FK relationship
DROP POLICY IF EXISTS "Support agents can manage own profile" ON support_agents;
CREATE POLICY "Support agents can manage own profile"
  ON support_agents
  FOR ALL
  TO authenticated
  USING (
    id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE id = support_agents.id AND role = 'support')
  )
  WITH CHECK (
    id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE id = support_agents.id AND role = 'support')
  );

-- Create a function to get support agents with proper joins
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
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    sa.name,
    u.email,
    u.role,
    sa.is_active,
    sa.last_login_at,
    u.created_at,
    sa.updated_at
  FROM users u
  INNER JOIN support_agents sa ON u.id = sa.id
  WHERE u.role = 'support'
  ORDER BY u.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_support_agents_with_users() TO authenticated;