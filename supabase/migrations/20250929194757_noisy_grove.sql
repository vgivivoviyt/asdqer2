/*
  # Prevent Support Agents from Joining Closed Chat Sessions

  1. Security Enhancement
    - Add policy to prevent joining closed chat sessions
    - Ensures closed sessions remain closed
    - Prevents support agents from re-opening resolved chats

  2. Policy Details
    - Applies to INSERT operations on chat_participants table
    - Checks if the target session is still open (closed_at IS NULL)
    - Only allows joining sessions that haven't been closed
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Prevent joining closed sessions" ON chat_participants;

-- Create new policy to prevent joining closed sessions
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