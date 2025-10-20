/*
  # Channel Provider Configuration Storage

  1. New Tables
    - `channel_provider_configs`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `channel` (text: whatsapp, email, sms)
      - `provider` (text: twilio, sendgrid, mailgun, etc.)
      - `is_enabled` (boolean)
      - `api_key_encrypted` (text, encrypted API keys)
      - `config_json` (jsonb, additional provider-specific config)
      - `last_tested_at` (timestamptz, nullable)
      - `test_status` (text: success, failed, pending, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `channel_provider_configs` table
    - Add policies for restaurant owners to manage their own configs
    - Encrypt sensitive data at rest
    
  3. Indexes
    - Index on restaurant_id and channel for fast lookups
    - Unique constraint on restaurant_id + channel combination

  4. Notes
    - API keys should be encrypted using pgcrypto
    - Only store minimal necessary information
    - Audit access to sensitive fields
*/

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create channel provider configs table
CREATE TABLE IF NOT EXISTS channel_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'push')),
  provider text NOT NULL,
  is_enabled boolean DEFAULT false,
  api_key_encrypted text,
  config_json jsonb DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  test_status text CHECK (test_status IN ('success', 'failed', 'pending')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, channel)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_channel_configs_restaurant 
  ON channel_provider_configs(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_channel_configs_channel 
  ON channel_provider_configs(restaurant_id, channel);

-- Enable RLS
ALTER TABLE channel_provider_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant owners can view their own configs
CREATE POLICY "Restaurant owners can view own channel configs"
  ON channel_provider_configs
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Policy: Restaurant owners can insert their own configs
CREATE POLICY "Restaurant owners can insert own channel configs"
  ON channel_provider_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Policy: Restaurant owners can update their own configs
CREATE POLICY "Restaurant owners can update own channel configs"
  ON channel_provider_configs
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Policy: Restaurant owners can delete their own configs
CREATE POLICY "Restaurant owners can delete own channel configs"
  ON channel_provider_configs
  FOR DELETE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_channel_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_channel_config_timestamp
  BEFORE UPDATE ON channel_provider_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_channel_config_updated_at();

-- Helper function to encrypt API keys
CREATE OR REPLACE FUNCTION encrypt_api_key(api_key text, encryption_key text)
RETURNS text AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(api_key, encryption_key),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to decrypt API keys
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key text, encryption_key text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_key
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
