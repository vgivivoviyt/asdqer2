/*
  # Fix Chat Sessions Visibility and Image Handling

  1. Updates
    - Ensure closed chat sessions remain visible (is_active = true)
    - Fix image attachment handling in real-time messages
    - Add proper system messages for agent assignments

  2. Functions
    - Update close chat function to keep sessions visible
    - Enhance message handling for attachments
*/

-- Update the close chat session function to keep sessions visible
CREATE OR REPLACE FUNCTION close_chat_session_keep_visible(
  p_session_id uuid,
  p_agent_name text,
  p_agent_id text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Update session status but keep it visible
  UPDATE chat_sessions 
  SET 
    status = 'closed',
    is_active = true,  -- Keep visible in archived tab
    closed_at = now(),
    closed_by = p_agent_name,
    assigned_agent_name = p_agent_name,
    assigned_agent_id = p_agent_id,
    updated_at = now()
  WHERE id = p_session_id;
  
  -- Add system message about closure
  INSERT INTO chat_messages (
    session_id,
    sender_type,
    sender_id,
    sender_name,
    message,
    is_system_message
  ) VALUES (
    p_session_id,
    'support_agent',
    COALESCE(p_agent_id, 'system'),
    'System',
    'Chat closed by ' || p_agent_name || '. Thank you for contacting support!',
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle agent assignment with system message
CREATE OR REPLACE FUNCTION assign_agent_with_notification(
  p_session_id uuid,
  p_agent_name text,
  p_agent_id text
) RETURNS void AS $$
BEGIN
  -- Update session with agent assignment
  UPDATE chat_sessions 
  SET 
    assigned_agent_name = p_agent_name,
    assigned_agent_id = p_agent_id,
    status = 'active',
    updated_at = now()
  WHERE id = p_session_id;
  
  -- Add system message about agent joining
  INSERT INTO chat_messages (
    session_id,
    sender_type,
    sender_id,
    sender_name,
    message,
    is_system_message
  ) VALUES (
    p_session_id,
    'support_agent',
    p_agent_id,
    'System',
    p_agent_name || ' has joined the chat and will assist you.',
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced message sending function with attachment support
CREATE OR REPLACE FUNCTION send_message_with_attachments_as_support_agent(
  p_session_id uuid,
  p_sender_id text,
  p_sender_name text,
  p_message text,
  p_message_type text DEFAULT 'text',
  p_has_attachments boolean DEFAULT false,
  p_is_system_message boolean DEFAULT false,
  p_attachments jsonb DEFAULT '[]'::jsonb
) RETURNS TABLE(
  id uuid,
  session_id uuid,
  sender_type text,
  sender_id text,
  sender_name text,
  message text,
  message_type text,
  has_attachments boolean,
  is_system_message boolean,
  created_at timestamptz,
  attachments jsonb
) AS $$
DECLARE
  v_message_id uuid;
  v_attachment jsonb;
BEGIN
  -- Insert the message
  INSERT INTO chat_messages (
    session_id,
    sender_type,
    sender_id,
    sender_name,
    message,
    message_type,
    has_attachments,
    is_system_message
  ) VALUES (
    p_session_id,
    'support_agent',
    p_sender_id,
    p_sender_name,
    p_message,
    p_message_type,
    p_has_attachments,
    p_is_system_message
  ) RETURNING chat_messages.id INTO v_message_id;
  
  -- Insert attachments if provided
  IF p_has_attachments AND jsonb_array_length(p_attachments) > 0 THEN
    FOR v_attachment IN SELECT * FROM jsonb_array_elements(p_attachments)
    LOOP
      INSERT INTO message_attachments (
        message_id,
        file_name,
        file_type,
        file_size,
        file_url,
        thumbnail_url
      ) VALUES (
        v_message_id,
        v_attachment->>'file_name',
        v_attachment->>'file_type',
        (v_attachment->>'file_size')::integer,
        v_attachment->>'file_url',
        v_attachment->>'thumbnail_url'
      );
    END LOOP;
  END IF;
  
  -- Return the message with attachments
  RETURN QUERY
  SELECT 
    m.id,
    m.session_id,
    m.sender_type,
    m.sender_id,
    m.sender_name,
    m.message,
    m.message_type,
    m.has_attachments,
    m.is_system_message,
    m.created_at,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'file_type', a.file_type,
          'file_size', a.file_size,
          'file_url', a.file_url,
          'thumbnail_url', a.thumbnail_url
        )
      ) FROM message_attachments a WHERE a.message_id = m.id),
      '[]'::jsonb
    ) as attachments
  FROM chat_messages m
  WHERE m.id = v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;