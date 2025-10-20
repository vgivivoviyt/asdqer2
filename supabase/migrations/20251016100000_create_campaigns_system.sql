/*
  # Campaigns System - Core Tables and Infrastructure

  ## Overview
  Complete promotional campaigns system for restaurants to send targeted marketing messages
  through multiple channels (Push, WhatsApp, Email, SMS) with promo code generation,
  audience segmentation, and comprehensive tracking.

  ## New Tables

  ### 1. `customer_tags`
  Tags for customer segmentation (VIP, Inactive, etc.)
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants)
  - `name` (text, tag name like "VIP", "Inactive")
  - `color` (text, hex color for UI display)
  - `created_at` (timestamp)

  ### 2. `customer_tag_assignments`
  Many-to-many relationship between customers and tags
  - `id` (uuid, primary key)
  - `customer_id` (uuid, references customers)
  - `tag_id` (uuid, references customer_tags)
  - `assigned_at` (timestamp)

  ### 3. `customer_consent`
  Channel-specific marketing consent for customers
  - `id` (uuid, primary key)
  - `customer_id` (uuid, references customers)
  - `restaurant_id` (uuid, references restaurants)
  - `push_notifications` (boolean, consent for push)
  - `whatsapp` (boolean, consent for WhatsApp)
  - `email` (boolean, consent for email)
  - `sms` (boolean, consent for SMS)
  - `consent_date` (timestamp, when consent was given)
  - `updated_at` (timestamp)

  ### 4. `campaigns`
  Main campaigns table
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants)
  - `name` (text, campaign name)
  - `description` (text, optional campaign description)
  - `type` (text, one_time | scheduled | recurring | ab_test)
  - `status` (text, draft | scheduled | sending | sent | cancelled | paused)
  - `primary_channel` (text, push | whatsapp | email | sms)
  - `fallback_channel` (text, optional fallback channel)
  - `audience_type` (text, all | tagged | custom_filter | location_radius | last_order_date)
  - `audience_filter` (jsonb, filter criteria for targeting)
  - `estimated_audience_size` (integer, calculated audience count)
  - `scheduled_at` (timestamp, when to send)
  - `recurring_config` (jsonb, for recurring campaigns)
  - `ab_test_config` (jsonb, for A/B test configuration)
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
  - `sent_at` (timestamp, when campaign was sent)

  ### 5. `campaign_messages`
  Message templates for each campaign/channel
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, references campaigns)
  - `channel` (text, push | whatsapp | email | sms)
  - `subject` (text, for email)
  - `message_template` (text, message with variable placeholders)
  - `variables` (jsonb, available variables: customer_name, restaurant_name, promo_code, etc.)
  - `ab_variant` (text, optional: A | B for A/B tests)
  - `created_at` (timestamp)

  ### 6. `promo_codes`
  Generated promotional codes
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, references campaigns, optional)
  - `restaurant_id` (uuid, references restaurants)
  - `code` (text, unique promo code)
  - `discount_type` (text, percentage | fixed_amount)
  - `discount_value` (decimal, percentage or amount)
  - `min_spend` (decimal, optional minimum spend requirement)
  - `max_uses` (integer, optional usage limit)
  - `max_uses_per_customer` (integer, default 1)
  - `total_uses` (integer, usage counter)
  - `order_type` (text, all | eats_only | delivery_only)
  - `valid_from` (timestamp)
  - `valid_until` (timestamp)
  - `is_active` (boolean, default true)
  - `created_at` (timestamp)

  ### 7. `promo_code_redemptions`
  Track promo code usage
  - `id` (uuid, primary key)
  - `promo_code_id` (uuid, references promo_codes)
  - `customer_id` (uuid, references customers)
  - `restaurant_id` (uuid, references restaurants)
  - `order_amount` (decimal)
  - `discount_applied` (decimal)
  - `redeemed_at` (timestamp)

  ### 8. `campaign_sends`
  Individual send records per customer
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, references campaigns)
  - `customer_id` (uuid, references customers)
  - `channel_used` (text, actual channel used for send)
  - `status` (text, pending | sent | failed | bounced)
  - `sent_at` (timestamp)
  - `delivered_at` (timestamp, for delivery confirmations)
  - `opened_at` (timestamp, for email opens)
  - `clicked_at` (timestamp, for link clicks)
  - `error_message` (text, for failed sends)
  - `promo_code_assigned` (text, the specific promo code sent)
  - `ab_variant` (text, which variant was sent in A/B test)

  ### 9. `campaign_metrics`
  Aggregated campaign performance metrics
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, references campaigns)
  - `total_targeted` (integer)
  - `total_sent` (integer)
  - `total_delivered` (integer)
  - `total_failed` (integer)
  - `total_bounced` (integer)
  - `total_opened` (integer, email opens)
  - `total_clicked` (integer, link clicks)
  - `total_conversions` (integer, orders placed)
  - `total_redemptions` (integer, promo codes used)
  - `total_revenue_generated` (decimal)
  - `cost_per_send` (decimal, optional)
  - `roi` (decimal, calculated return on investment)
  - `updated_at` (timestamp)

  ### 10. `campaign_audit_log`
  Activity log for compliance and debugging
  - `id` (uuid, primary key)
  - `campaign_id` (uuid, references campaigns)
  - `action` (text, created | edited | scheduled | sent | cancelled | paused | resumed)
  - `performed_by` (uuid, references auth.users)
  - `changes` (jsonb, what changed)
  - `timestamp` (timestamp)

  ## Security
  - Enable RLS on all tables
  - Restaurant-scoped policies for all campaign data
  - Audit log is read-only for non-super-admin users

  ## Functions
  - Generate unique promo codes
  - Calculate campaign audience size
  - Update campaign metrics
  - Validate promo code redemption
*/

-- 1. Customer Tags Table
CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- 2. Customer Tag Assignments Table
CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES customer_tags(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, tag_id)
);

-- 3. Customer Consent Table
CREATE TABLE IF NOT EXISTS customer_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  push_notifications boolean DEFAULT true,
  whatsapp boolean DEFAULT false,
  email boolean DEFAULT true,
  sms boolean DEFAULT false,
  consent_date timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, restaurant_id)
);

-- 4. Campaigns Table
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
  scheduled_at timestamptz,
  recurring_config jsonb,
  ab_test_config jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- 5. Campaign Messages Table
CREATE TABLE IF NOT EXISTS campaign_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push', 'whatsapp', 'email', 'sms')),
  subject text,
  message_template text NOT NULL,
  variables jsonb DEFAULT '{}',
  ab_variant text CHECK (ab_variant IN ('A', 'B')),
  created_at timestamptz DEFAULT now()
);

-- 6. Promo Codes Table
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value decimal(10,2) NOT NULL,
  min_spend decimal(10,2) DEFAULT 0,
  max_uses integer,
  max_uses_per_customer integer DEFAULT 1,
  total_uses integer DEFAULT 0,
  order_type text DEFAULT 'all' CHECK (order_type IN ('all', 'eats_only', 'delivery_only')),
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, code)
);

-- 7. Promo Code Redemptions Table
CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  order_amount decimal(10,2) NOT NULL,
  discount_applied decimal(10,2) NOT NULL,
  redeemed_at timestamptz DEFAULT now()
);

-- 8. Campaign Sends Table
CREATE TABLE IF NOT EXISTS campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  channel_used text NOT NULL CHECK (channel_used IN ('push', 'whatsapp', 'email', 'sms')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  promo_code_assigned text,
  ab_variant text CHECK (ab_variant IN ('A', 'B'))
);

-- 9. Campaign Metrics Table
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_targeted integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_failed integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  total_redemptions integer DEFAULT 0,
  total_revenue_generated decimal(10,2) DEFAULT 0,
  cost_per_send decimal(10,2) DEFAULT 0,
  roi decimal(10,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 10. Campaign Audit Log Table
CREATE TABLE IF NOT EXISTS campaign_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'edited', 'scheduled', 'sent', 'cancelled', 'paused', 'resumed', 'preview')),
  performed_by uuid REFERENCES auth.users(id),
  changes jsonb DEFAULT '{}',
  timestamp timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_tags
CREATE POLICY "Restaurant users can view their customer tags"
  ON customer_tags FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their customer tags"
  ON customer_tags FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for customer_tag_assignments
CREATE POLICY "Restaurant users can view tag assignments"
  ON customer_tag_assignments FOR SELECT
  TO authenticated
  USING (customer_id IN (
    SELECT id FROM customers WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Restaurant users can manage tag assignments"
  ON customer_tag_assignments FOR ALL
  TO authenticated
  USING (customer_id IN (
    SELECT id FROM customers WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for customer_consent
CREATE POLICY "Restaurant users can view customer consent"
  ON customer_consent FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage customer consent"
  ON customer_consent FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for campaigns
CREATE POLICY "Restaurant users can view their campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for campaign_messages
CREATE POLICY "Restaurant users can view campaign messages"
  ON campaign_messages FOR SELECT
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Restaurant users can manage campaign messages"
  ON campaign_messages FOR ALL
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for promo_codes
CREATE POLICY "Restaurant users can view their promo codes"
  ON promo_codes FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage their promo codes"
  ON promo_codes FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for promo_code_redemptions
CREATE POLICY "Restaurant users can view redemptions"
  ON promo_code_redemptions FOR SELECT
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

CREATE POLICY "Restaurant users can manage redemptions"
  ON promo_code_redemptions FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
    UNION
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
  ));

-- RLS Policies for campaign_sends
CREATE POLICY "Restaurant users can view campaign sends"
  ON campaign_sends FOR SELECT
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Restaurant users can manage campaign sends"
  ON campaign_sends FOR ALL
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for campaign_metrics
CREATE POLICY "Restaurant users can view campaign metrics"
  ON campaign_metrics FOR SELECT
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Restaurant users can manage campaign metrics"
  ON campaign_metrics FOR ALL
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for campaign_audit_log (read-only)
CREATE POLICY "Restaurant users can view campaign audit log"
  ON campaign_audit_log FOR SELECT
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
      UNION
      SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "System can insert audit log entries"
  ON campaign_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_tags_restaurant ON customer_tags(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_customer ON customer_tag_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_tag ON customer_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_customer_consent_customer ON customer_consent(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_consent_restaurant ON customer_consent(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant ON campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_restaurant ON promo_codes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(restaurant_id, code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_valid ON promo_codes(is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_promo ON promo_code_redemptions(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_customer ON promo_code_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_customer ON campaign_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_status ON campaign_sends(status);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_log_campaign ON campaign_audit_log(campaign_id);

-- Triggers for updated_at
CREATE TRIGGER update_customer_consent_updated_at
  BEFORE UPDATE ON customer_consent
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_metrics_updated_at
  BEFORE UPDATE ON campaign_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate unique promo code
CREATE OR REPLACE FUNCTION generate_promo_code(
  p_restaurant_id uuid,
  p_prefix text DEFAULT 'PROMO'
)
RETURNS text AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := p_prefix || '-' || upper(substring(md5(random()::text) from 1 for 8));

    SELECT EXISTS(
      SELECT 1 FROM promo_codes
      WHERE restaurant_id = p_restaurant_id AND code = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate campaign audience size
CREATE OR REPLACE FUNCTION calculate_campaign_audience(
  p_restaurant_id uuid,
  p_audience_type text,
  p_audience_filter jsonb
)
RETURNS integer AS $$
DECLARE
  v_count integer;
  v_tag_ids uuid[];
  v_days_inactive integer;
  v_min_points integer;
BEGIN
  IF p_audience_type = 'all' THEN
    SELECT COUNT(*) INTO v_count
    FROM customers c
    INNER JOIN customer_consent cc ON c.id = cc.customer_id
    WHERE c.restaurant_id = p_restaurant_id;

  ELSIF p_audience_type = 'tagged' THEN
    v_tag_ids := ARRAY(SELECT jsonb_array_elements_text(p_audience_filter->'tag_ids')::uuid);

    SELECT COUNT(DISTINCT c.id) INTO v_count
    FROM customers c
    INNER JOIN customer_consent cc ON c.id = cc.customer_id
    INNER JOIN customer_tag_assignments cta ON c.id = cta.customer_id
    WHERE c.restaurant_id = p_restaurant_id
    AND cta.tag_id = ANY(v_tag_ids);

  ELSIF p_audience_type = 'last_order_date' THEN
    v_days_inactive := (p_audience_filter->>'days_inactive')::integer;

    SELECT COUNT(*) INTO v_count
    FROM customers c
    INNER JOIN customer_consent cc ON c.id = cc.customer_id
    WHERE c.restaurant_id = p_restaurant_id
    AND (c.last_visit IS NULL OR c.last_visit < now() - interval '1 day' * v_days_inactive);

  ELSIF p_audience_type = 'wallet_status' THEN
    v_min_points := (p_audience_filter->>'min_points')::integer;

    SELECT COUNT(*) INTO v_count
    FROM customers c
    INNER JOIN customer_consent cc ON c.id = cc.customer_id
    WHERE c.restaurant_id = p_restaurant_id
    AND c.total_points >= v_min_points;

  ELSE
    v_count := 0;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Validate and apply promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_code text,
  p_order_amount decimal
)
RETURNS jsonb AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_customer_uses integer;
  v_discount decimal;
  v_result jsonb;
BEGIN
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE restaurant_id = p_restaurant_id
  AND code = p_code
  AND is_active = true
  AND valid_from <= now()
  AND valid_until >= now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired promo code');
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.total_uses >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code usage limit reached');
  END IF;

  SELECT COUNT(*) INTO v_customer_uses
  FROM promo_code_redemptions
  WHERE promo_code_id = v_promo.id
  AND customer_id = p_customer_id;

  IF v_customer_uses >= v_promo.max_uses_per_customer THEN
    RETURN jsonb_build_object('valid', false, 'error', 'You have already used this promo code');
  END IF;

  IF p_order_amount < v_promo.min_spend THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Minimum spend of ' || v_promo.min_spend || ' required'
    );
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount := p_order_amount * (v_promo.discount_value / 100);
  ELSE
    v_discount := v_promo.discount_value;
  END IF;

  v_result := jsonb_build_object(
    'valid', true,
    'promo_code_id', v_promo.id,
    'discount_amount', v_discount,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'order_type', v_promo.order_type
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Record promo code redemption
CREATE OR REPLACE FUNCTION redeem_promo_code(
  p_promo_code_id uuid,
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_order_amount decimal,
  p_discount_applied decimal
)
RETURNS uuid AS $$
DECLARE
  v_redemption_id uuid;
BEGIN
  INSERT INTO promo_code_redemptions (
    promo_code_id, customer_id, restaurant_id, order_amount, discount_applied
  ) VALUES (
    p_promo_code_id, p_customer_id, p_restaurant_id, p_order_amount, p_discount_applied
  ) RETURNING id INTO v_redemption_id;

  UPDATE promo_codes
  SET total_uses = total_uses + 1
  WHERE id = p_promo_code_id;

  RETURN v_redemption_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update campaign metrics (called by triggers or background jobs)
CREATE OR REPLACE FUNCTION update_campaign_metrics_for_campaign(p_campaign_id uuid)
RETURNS void AS $$
DECLARE
  v_metrics record;
BEGIN
  SELECT
    COUNT(*) as targeted,
    COUNT(*) FILTER (WHERE status = 'sent' OR status = 'delivered') as sent,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked
  INTO v_metrics
  FROM campaign_sends
  WHERE campaign_id = p_campaign_id;

  INSERT INTO campaign_metrics (
    campaign_id,
    total_targeted,
    total_sent,
    total_delivered,
    total_failed,
    total_bounced,
    total_opened,
    total_clicked
  ) VALUES (
    p_campaign_id,
    v_metrics.targeted,
    v_metrics.sent,
    v_metrics.delivered,
    v_metrics.failed,
    v_metrics.bounced,
    v_metrics.opened,
    v_metrics.clicked
  )
  ON CONFLICT (campaign_id) DO UPDATE SET
    total_targeted = v_metrics.targeted,
    total_sent = v_metrics.sent,
    total_delivered = v_metrics.delivered,
    total_failed = v_metrics.failed,
    total_bounced = v_metrics.bounced,
    total_opened = v_metrics.opened,
    total_clicked = v_metrics.clicked,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
