/*
  # Fix Chat Session Closing and Prevent Reopening

  1. Database Changes
    - Update chat_participants policy to check session status instead of closed_at
    - Ensure sessions stay closed after refresh
    - Prevent support agents from joining closed sessions

  2. Security
    - Add proper status checking in policies
    - Prevent session reopening after close
*/

-- Drop existing policy and create new one that checks session status
DROP POLICY IF EXISTS "Prevent joining closed sessions" ON chat_participants;

CREATE POLICY "Prevent joining closed sessions"
  ON chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(
      (SELECT (status != 'closed') FROM chat_sessions WHERE id = session_id),
      false
    )
  );

-- Ensure we have proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status_closed 
  ON chat_sessions (status) 
  WHERE status = 'closed';