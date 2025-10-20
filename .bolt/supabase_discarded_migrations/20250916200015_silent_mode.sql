/*
  # Create Quick Responses Data

  1. Sample Data
    - Common support responses for different categories
    - Professional and helpful messages
    - Categorized for easy filtering

  2. Categories
    - General support responses
    - Technical issue responses
    - Billing related responses
    - Feature request responses
*/

-- Insert sample quick responses
INSERT INTO quick_responses (title, message, category, is_active) VALUES
  (
    'Welcome Message',
    'Hello! Thank you for contacting VOYA support. I''m here to help you with any questions about your loyalty program. How can I assist you today?',
    'general',
    true
  ),
  (
    'Investigating Issue',
    'I''m looking into this issue for you right now. Please give me a moment to check your account and system logs.',
    'general',
    true
  ),
  (
    'Issue Resolved',
    'Great! I''ve resolved the issue for you. Please try again and let me know if you need any further assistance.',
    'general',
    true
  ),
  (
    'Technical Support',
    'I understand you''re experiencing a technical issue. Let me help you troubleshoot this step by step.',
    'technical',
    true
  ),
  (
    'Billing Question',
    'I''d be happy to help you with your billing question. Let me review your subscription details.',
    'billing',
    true
  ),
  (
    'Feature Request',
    'Thank you for your feature suggestion! I''ve noted this request and will forward it to our development team for consideration.',
    'feature_request',
    true
  ),
  (
    'Account Setup Help',
    'I''ll guide you through setting up your loyalty program. Let''s start with the basics and get you up and running.',
    'general',
    true
  ),
  (
    'Customer Data Question',
    'I can help you with customer data management. What specific aspect would you like assistance with?',
    'general',
    true
  ),
  (
    'Closing Message',
    'Is there anything else I can help you with today? If not, I''ll close this chat. You can always start a new chat if you need further assistance.',
    'general',
    true
  ),
  (
    'Escalation',
    'I''m escalating this to our senior support team for specialized assistance. They''ll be in touch within 24 hours.',
    'general',
    true
  )
ON CONFLICT (title) DO NOTHING;