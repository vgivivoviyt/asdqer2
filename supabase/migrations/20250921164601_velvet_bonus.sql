/*
  # Create Service Role Bypass for Support Portal

  This migration creates a function that support agents can call
  to bypass RLS and fetch all sessions using service role privileges.
*/

-- Function to get all chat sessions for support agents (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_chat_sessions_for_support()
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  title text,
  status text,
  priority text,
  category text,
  created_by_user_id uuid,
  assigned_agent_name text,
  assigned_agent_id text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  restaurant_name text,
  restaurant_slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller is a support agent
  IF NOT is_support_agent() THEN
    RAISE EXCEPTION 'Access denied: Only support agents can access this function';
  END IF;
  
  -- Return all chat sessions with restaurant info
  RETURN QUERY
  SELECT 
    cs.id,
    cs.restaurant_id,
    cs.title,
    cs.status,
    cs.priority,
    cs.category,
    cs.created_by_user_id,
    cs.assigned_agent_name,
    cs.assigned_agent_id,
    cs.last_message_at,
    cs.created_at,
    cs.updated_at,
    r.name as restaurant_name,
    r.slug as restaurant_slug
  FROM chat_sessions cs
  LEFT JOIN restaurants r ON r.id = cs.restaurant_id
  ORDER BY cs.last_message_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_chat_sessions_for_support() TO authenticated;

-- Function to get session count by restaurant for debugging
CREATE OR REPLACE FUNCTION debug_session_count_by_restaurant()
RETURNS TABLE (
  restaurant_name text,
  session_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller is a support agent
  IF NOT is_support_agent() THEN
    RAISE EXCEPTION 'Access denied: Only support agents can access this function';
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE(r.name, 'Unknown Restaurant') as restaurant_name,
    COUNT(cs.id) as session_count
  FROM chat_sessions cs
  LEFT JOIN restaurants r ON r.id = cs.restaurant_id
  GROUP BY r.name
  ORDER BY session_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_session_count_by_restaurant() TO authenticated;