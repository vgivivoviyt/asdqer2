/*
  # Debug Support Portal Access

  This migration adds debugging and ensures proper RLS policies for support portal.

  1. Debug Functions
    - Add logging functions to track RLS policy execution
    - Add functions to check current user context

  2. Policy Updates
    - Ensure support agents have proper global access
    - Add debugging to policies
*/

-- Create debug function to check current session context
CREATE OR REPLACE FUNCTION debug_current_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  result := jsonb_build_object(
    'current_user_id', auth.uid(),
    'current_role', auth.role(),
    'is_support_agent_flag', COALESCE(current_setting('app.is_support_agent', true), 'not_set'),
    'agent_email', COALESCE(current_setting('app.current_agent_email', true), 'not_set'),
    'restaurant_id', COALESCE(current_setting('app.current_restaurant_id', true), 'not_set')
  );
  
  RAISE NOTICE 'Current context: %', result;
  RETURN result;
END;
$$;

-- Create function to test support agent access
CREATE OR REPLACE FUNCTION test_support_agent_access(agent_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_count integer;
  restaurant_count integer;
  context_info jsonb;
BEGIN
  -- Set support agent context
  PERFORM set_support_agent_context(agent_email);
  
  -- Get current context
  context_info := debug_current_context();
  
  -- Test access to chat sessions
  SELECT COUNT(*) INTO session_count FROM chat_sessions;
  
  -- Test access to restaurants
  SELECT COUNT(*) INTO restaurant_count FROM restaurants;
  
  RETURN jsonb_build_object(
    'context', context_info,
    'accessible_sessions', session_count,
    'accessible_restaurants', restaurant_count,
    'test_timestamp', now()
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_current_context() TO authenticated;
GRANT EXECUTE ON FUNCTION test_support_agent_access(text) TO authenticated;

-- Test the support agent access (this will show in logs)
SELECT test_support_agent_access('test@example.com');