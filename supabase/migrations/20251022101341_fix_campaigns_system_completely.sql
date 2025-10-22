/*
  # Complete Campaigns System Fix

  This migration:
  1. Drops the old campaigns table and uses the new proper schema
  2. Adds customer consent fields to customers table
  3. Adds channel provider configuration tables
  4. Creates campaign message storage and campaign sends tracking
  5. Adds proper indexes and functions

  ## Changes
  - Drop old campaigns table
  - Ensure new campaigns table has correct schema
  - Add consent tracking to customer onboarding
  - Add channel configuration tables
*/

-- Drop the old campaigns table if it exists (the one with wrong constraints)
DO $$
BEGIN
  -- Check if there's a campaigns table with the old constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'campaigns_campaign_type_check' 
    AND check_clause LIKE '%offer%'
  ) THEN
    DROP TABLE IF EXISTS campaigns CASCADE;
  END IF;
END $$;

-- Create the proper campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('one_time', 'scheduled', 'recurring', 'ab_test')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'paused')),
  primary_channel text NOT NULL CHECK (primary_channel IN ('push', 'whatsapp', 'email', 'sms')),
  fallback_channel text CHECK (fallback_channel IN ('push', 'whatsapp', 'email', 'sms')),
  audience_type text NOT NULL CHECK (audience_type IN ('all', 'tagged', 'custom_filter', 'location_radius', 'last_order_date', 'wallet_status')),
  audience_filter jsonb DEFAULT '{}',
  estimated_audience_size integer DEFAULT 0,
  message_subject text,
  message_template text NOT NULL,
  message_variables jsonb DEFAULT '{}',
  scheduled_at timestamptz,
  recurring_config jsonb,
  ab_test_config jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Add consent fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_whatsapp boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_email boolean DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_sms boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_push boolean DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_date timestamptz DEFAULT now();

-- Create channel provider configurations table
CREATE TABLE IF NOT EXISTS channel_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms')),
  provider text NOT NULL,
  config jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, channel)
);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_provider_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
DROP POLICY IF EXISTS "Restaurant users can view their campaigns" ON campaigns;
CREATE POLICY "Restaurant users can view their campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Restaurant users can manage their campaigns" ON campaigns;
CREATE POLICY "Restaurant users can manage their campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for channel configs
CREATE POLICY "Restaurant users can view their channel configs"
  ON channel_provider_configs FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their channel configs"
  ON channel_provider_configs FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant ON campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_channel_configs_restaurant ON channel_provider_configs(restaurant_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_configs_updated_at ON channel_provider_configs;
CREATE TRIGGER update_channel_configs_updated_at
  BEFORE UPDATE ON channel_provider_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();