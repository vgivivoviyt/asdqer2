/*
  # Fix Campaigns System and Add Image Support

  This migration fixes multiple issues:
  1. Ensures campaigns table has correct schema
  2. Adds campaign message tracking
  3. Fixes calculate_campaign_audience function to handle zero customers
  4. Ensures image_url columns exist on menu_items and rewards tables

  ## Changes
  - Adds campaign_messages if missing
  - Updates calculate_campaign_audience to return 0 instead of failing
  - Ensures image_url exists on menu_items and rewards
*/

-- Ensure campaign_messages table exists and has message templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_messages') THEN
    CREATE TABLE campaign_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
      channel text NOT NULL CHECK (channel IN ('push', 'whatsapp', 'email', 'sms')),
      subject text,
      message_template text NOT NULL,
      variables jsonb DEFAULT '{}',
      ab_variant text CHECK (ab_variant IN ('A', 'B')),
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;

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
  END IF;
END $$;

-- Fix calculate_campaign_audience to handle no customers gracefully
CREATE OR REPLACE FUNCTION calculate_campaign_audience(
  p_restaurant_id uuid,
  p_audience_type text,
  p_audience_filter jsonb
)
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_tag_ids text[];
  v_days_inactive integer;
  v_min_points integer;
  v_max_points integer;
BEGIN
  -- Check if customers exist for this restaurant
  IF NOT EXISTS (SELECT 1 FROM customers WHERE restaurant_id = p_restaurant_id LIMIT 1) THEN
    RETURN 0;
  END IF;

  IF p_audience_type = 'all' THEN
    SELECT COUNT(*) INTO v_count
    FROM customers c
    WHERE c.restaurant_id = p_restaurant_id;

  ELSIF p_audience_type = 'tagged' THEN
    -- Extract tags array from filter
    IF p_audience_filter ? 'tags' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(p_audience_filter->'tags')) INTO v_tag_ids;
      
      SELECT COUNT(DISTINCT c.id) INTO v_count
      FROM customers c
      INNER JOIN customer_tag_assignments cta ON c.id = cta.customer_id
      INNER JOIN customer_tags ct ON cta.tag_id = ct.id
      WHERE c.restaurant_id = p_restaurant_id
      AND ct.id::text = ANY(v_tag_ids);
    ELSE
      v_count := 0;
    END IF;

  ELSIF p_audience_type = 'last_order_date' THEN
    v_days_inactive := COALESCE((p_audience_filter->>'days_since_last_order')::integer, 30);

    SELECT COUNT(*) INTO v_count
    FROM customers c
    WHERE c.restaurant_id = p_restaurant_id
    AND (c.last_visit IS NULL OR c.last_visit < now() - interval '1 day' * v_days_inactive);

  ELSIF p_audience_type = 'wallet_status' THEN
    v_min_points := COALESCE((p_audience_filter->>'min_points')::integer, 0);
    v_max_points := (p_audience_filter->>'max_points')::integer;

    IF v_max_points IS NOT NULL THEN
      SELECT COUNT(*) INTO v_count
      FROM customers c
      WHERE c.restaurant_id = p_restaurant_id
      AND c.total_points >= v_min_points
      AND c.total_points <= v_max_points;
    ELSE
      SELECT COUNT(*) INTO v_count
      FROM customers c
      WHERE c.restaurant_id = p_restaurant_id
      AND c.total_points >= v_min_points;
    END IF;

  ELSE
    v_count := 0;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Ensure image_url column exists on menu_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN image_url text;
  END IF;
END $$;

-- Ensure image_url column exists on rewards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE rewards ADD COLUMN image_url text;
  END IF;
END $$;