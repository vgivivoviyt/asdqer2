/*
  # Populate Quick Responses

  1. Sample Data
    - Add comprehensive quick response templates
    - Organize by category for easy access
    - Include common support scenarios

  2. Categories
    - General greetings and closings
    - Technical support responses
    - Billing and subscription help
    - Feature explanations
*/

-- Clear existing quick responses to avoid duplicates
DELETE FROM quick_responses;

-- Insert comprehensive quick response templates
INSERT INTO quick_responses (title, message, category, is_active) VALUES
-- General responses
('Welcome Greeting', 'Hello! Thank you for contacting VOYA support. I''m here to help you with any questions about your loyalty program. How can I assist you today?', 'general', true),
('Thank You', 'Thank you for contacting VOYA support. Is there anything else I can help you with today?', 'general', true),
('Closing Message', 'Thank you for using VOYA! If you have any other questions, please don''t hesitate to reach out. Have a great day!', 'general', true),
('Escalation', 'I understand your concern. Let me escalate this to our technical team for a more detailed review. You should hear back within 24 hours.', 'general', true),

-- Technical support
('Login Issues', 'I can help you with login issues. Please try clearing your browser cache and cookies, then attempt to log in again. If the issue persists, I can reset your password.', 'technical', true),
('Password Reset', 'I can help you reset your password. Please check your email for a password reset link. If you don''t see it, please check your spam folder.', 'technical', true),
('Browser Compatibility', 'For the best experience, we recommend using the latest version of Chrome, Firefox, Safari, or Edge. Please ensure your browser is up to date.', 'technical', true),
('Mobile Issues', 'If you''re experiencing issues on mobile, please try refreshing the page or using a desktop browser. Our mobile experience is optimized for the latest mobile browsers.', 'technical', true),

-- Billing and subscriptions
('Billing Question', 'I''d be happy to help with your billing question. Your subscription details and payment history are available in your dashboard under the Billing section.', 'billing', true),
('Subscription Status', 'I can check your subscription status for you. Your current plan and billing information are displayed in your account dashboard.', 'billing', true),
('Upgrade Help', 'I can help you upgrade your plan. You can upgrade at any time from your dashboard, and you''ll only pay the prorated difference for the current billing period.', 'billing', true),
('Cancellation', 'I understand you''d like to cancel your subscription. You can cancel anytime from your billing settings, and you''ll retain access until the end of your current billing period.', 'billing', true),

-- Feature explanations
('Loyalty Program Setup', 'Setting up your loyalty program is easy! Start by configuring your point values in the Loyalty Config section, then create rewards that your customers can redeem.', 'features', true),
('QR Code Usage', 'Your customers can earn points by showing their QR code to your staff during checkout. Staff can scan the code or enter the customer''s email to award points.', 'features', true),
('Branch Management', 'You can add multiple branches in the Branch Management section. Each branch gets its own staff password and can track separate analytics.', 'features', true),
('Analytics Explanation', 'Your analytics dashboard shows customer growth, reward redemptions, and ROI analysis. Use these insights to optimize your loyalty program performance.', 'features', true),

-- Customer support
('Customer Not Found', 'If a customer isn''t found in your system, they may need to sign up for your loyalty program first. They can do this by visiting your customer wallet page.', 'customer_support', true),
('Points Not Showing', 'If points aren''t showing up immediately, please refresh the page. Points are usually processed instantly, but there may be a brief delay during high traffic.', 'customer_support', true),
('Reward Redemption', 'Customers can redeem rewards from their wallet page or by asking staff to process the redemption. Make sure the customer has enough points and meets any tier requirements.', 'customer_support', true),

-- Troubleshooting
('Data Not Loading', 'If data isn''t loading properly, please try refreshing the page. If the issue persists, it may be a temporary connectivity issue. Please try again in a few minutes.', 'troubleshooting', true),
('Sync Issues', 'If you''re seeing sync issues between devices, please ensure you''re logged into the same account on all devices. Data should sync automatically within a few seconds.', 'troubleshooting', true),
('Performance Issues', 'If you''re experiencing slow performance, please try clearing your browser cache or using an incognito/private browsing window. This often resolves performance issues.', 'troubleshooting', true);

-- Verify the data was inserted
SELECT 
  category,
  COUNT(*) as response_count
FROM quick_responses 
WHERE is_active = true
GROUP BY category
ORDER BY category;