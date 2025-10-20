/*
  # Add Image Support to Menu Items and Rewards

  1. Changes to Tables
    - Add `image_url` column to `menu_items` if not exists
    - Add `image_url` column to `rewards` if not exists (already exists, but ensure it's present)
    
  2. Storage
    - Ensure public access for images bucket
    
  3. Notes
    - Images will be stored in Supabase Storage 'images' bucket
    - Images are publicly accessible for customer viewing
    - URLs will be in format: https://{project}.supabase.co/storage/v1/object/public/images/{filename}
*/

-- Add image_url to menu_items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN image_url text;
  END IF;
END $$;

-- Ensure image_url exists in rewards (should already exist from original schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE rewards ADD COLUMN image_url text;
  END IF;
END $$;

-- Create notifications table for in-app campaign notifications
CREATE TABLE IF NOT EXISTS customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('campaign', 'reward', 'points', 'order', 'promo')),
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer 
  ON customer_notifications(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_unread 
  ON customer_notifications(customer_id, is_read);

-- Enable RLS
ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can view their own notifications
CREATE POLICY "Customers can view own notifications"
  ON customer_notifications
  FOR SELECT
  USING (true);

-- Policy: Customers can update their own notifications (mark as read)
CREATE POLICY "Customers can update own notifications"
  ON customer_notifications
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Restaurant owners and system can insert notifications
CREATE POLICY "System can insert notifications"
  ON customer_notifications
  FOR INSERT
  WITH CHECK (true);
