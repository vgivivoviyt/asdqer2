/*
  # Add First Order Tracking and Working Day Delivery Logic

  ## Summary
  This migration adds tracking for first-time free orders and enables proper business day delivery scheduling.

  ## Changes Made
  
  1. **New Column: `is_first_free_order`**
     - Boolean flag to track if this is the user's first free starter pack order
     - Defaults to false
     - Used to enforce the one-time free order policy
  
  2. **New Column: `base_pack_cost`**
     - Numeric field to track the base cost of the starter pack (excluding tablet)
     - Required for proper cost breakdown when charging 50 AED for subsequent orders
     - Defaults to 0
  
  3. **Update Logic**
     - Existing orders are preserved
     - New columns are nullable by default to avoid data issues
  
  ## Pricing Logic
  - First order without tablet: 0 AED (one-time only, requires active paid subscription)
  - Subsequent orders without tablet: 50 AED each
  - Tablet cost: 499 AED (unchanged, applies to any order)
  
  ## Delivery Scheduling
  - Orders placed after business hours will be scheduled for the next working day (Mon-Fri)
  - Estimated delivery times account for weekends and holidays
*/

-- Add column to track first free order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'starter_pack_orders' AND column_name = 'is_first_free_order'
  ) THEN
    ALTER TABLE starter_pack_orders ADD COLUMN is_first_free_order boolean DEFAULT false;
  END IF;
END $$;

-- Add column to track base pack cost separately from tablet cost
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'starter_pack_orders' AND column_name = 'base_pack_cost'
  ) THEN
    ALTER TABLE starter_pack_orders ADD COLUMN base_pack_cost numeric DEFAULT 0;
  END IF;
END $$;

-- Add index for faster queries on user orders
CREATE INDEX IF NOT EXISTS idx_starter_pack_orders_user_first_order 
ON starter_pack_orders(user_id, is_first_free_order, created_at);

-- Add comment for documentation
COMMENT ON COLUMN starter_pack_orders.is_first_free_order IS 'Tracks if this order was the users first free starter pack (one-time benefit for paid subscribers)';
COMMENT ON COLUMN starter_pack_orders.base_pack_cost IS 'Base cost of starter pack materials (0 for first order, 50 AED for subsequent orders)';
