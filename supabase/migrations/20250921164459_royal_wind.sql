/*
  # Fix Chat Sessions RLS for Support Portal

  This migration completely fixes the RLS policies for chat sessions
  to ensure support agents can see ALL restaurant sessions.
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Support agents can view all chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Support agents can stream chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Support agents can manage all chat sessions" ON chat_sessions;

-- Create comprehensive support agent policies
CREATE POLICY "Support agents global read access"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is a support agent (via context or super admin)
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Support agents global write access"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user is a support agent (via context or super admin)
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  )
  WITH CHECK (
    -- Allow if user is a support agent (via context or super admin)
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Fix chat messages RLS for support agents
DROP POLICY IF EXISTS "Support agents can view all chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Support agents can stream chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Support agents can manage all chat messages" ON chat_messages;

CREATE POLICY "Support agents global message access"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user is a support agent
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    ) OR
    -- Allow restaurant managers for their own sessions
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_messages.session_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Allow if user is a support agent
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    ) OR
    -- Allow restaurant managers for their own sessions
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_messages.session_id AND r.owner_id = auth.uid()
    )
  );

-- Fix chat participants RLS for support agents
DROP POLICY IF EXISTS "Support agents can view all chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Support agents can stream chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Support agents can manage all chat participants" ON chat_participants;

CREATE POLICY "Support agents global participant access"
  ON chat_participants
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user is a support agent
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    ) OR
    -- Allow restaurant managers for their own sessions
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_participants.session_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Allow if user is a support agent
    is_support_agent() OR
    -- Allow if user is super admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_super_admin = true
    ) OR
    -- Allow restaurant managers for their own sessions
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      JOIN restaurants r ON r.id = cs.restaurant_id
      WHERE cs.id = chat_participants.session_id AND r.owner_id = auth.uid()
    )
  );