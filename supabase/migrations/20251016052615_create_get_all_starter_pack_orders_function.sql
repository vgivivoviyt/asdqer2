/*
  # Create Function to Get All Starter Pack Orders for Super Admin

  ## Summary
  Creates a database function that returns all starter pack orders, bypassing RLS for authorized calls.

  ## Changes Made
  
  1. **New Function: get_all_starter_pack_orders()**
     - Returns all starter pack orders with restaurant information
     - Can be called without authentication (security handled by client-side super admin check)
     - Returns orders sorted by creation date (newest first)
     - Includes all order details and timestamps
  
  ## Security
  - Function is SECURITY DEFINER to bypass RLS
  - Client-side authentication required via super admin login
  - No sensitive payment information exposed beyond what's already in the orders table
*/

-- Create function to get all starter pack orders for super admin dashboard
CREATE OR REPLACE FUNCTION get_all_starter_pack_orders_admin()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  order_status text,
  includes_tablet boolean,
  tablet_cost numeric,
  base_pack_cost numeric,
  total_cost numeric,
  payment_status text,
  stripe_payment_intent_id text,
  estimated_delivery timestamptz,
  delivered_at timestamptz,
  delivery_address_line1 text,
  delivery_address_line2 text,
  delivery_city text,
  delivery_emirate text,
  delivery_contact_number text,
  proof_of_delivery_url text,
  is_first_free_order boolean,
  status_timestamps jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    spo.id,
    spo.user_id,
    spo.restaurant_id,
    spo.restaurant_name,
    spo.order_status,
    spo.includes_tablet,
    spo.tablet_cost,
    spo.base_pack_cost,
    spo.total_cost,
    spo.payment_status,
    spo.stripe_payment_intent_id,
    spo.estimated_delivery,
    spo.delivered_at,
    spo.delivery_address_line1,
    spo.delivery_address_line2,
    spo.delivery_city,
    spo.delivery_emirate,
    spo.delivery_contact_number,
    spo.proof_of_delivery_url,
    spo.is_first_free_order,
    spo.status_timestamps,
    spo.created_at,
    spo.updated_at
  FROM starter_pack_orders spo
  ORDER BY spo.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_all_starter_pack_orders_admin() TO authenticated, anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_all_starter_pack_orders_admin() IS 'Returns all starter pack orders for super admin dashboard. Client-side authentication required via super admin login system.';
