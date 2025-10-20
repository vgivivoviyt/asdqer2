/*
  # Add Super Admin Access to Starter Pack Orders

  ## Summary
  This migration updates RLS policies for starter_pack_orders to allow super admins to view and manage all orders from all restaurants.

  ## Changes Made
  
  1. **Update RLS Policy**
     - Modify existing policy to allow super admins to access all orders
     - Users can still only manage their own orders
     - Super admins can view/manage all orders regardless of user_id
  
  2. **Security**
     - Maintains user privacy for regular users
     - Grants super admins full visibility across all restaurants
     - Uses existing `is_super_admin()` function for access control
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own starter pack orders" ON starter_pack_orders;

-- Create new policy allowing users to see their own orders OR super admins to see all
CREATE POLICY "Users can manage their own orders, super admins can see all"
ON starter_pack_orders
FOR ALL
TO public
USING (
  auth.uid() = user_id OR is_super_admin()
)
WITH CHECK (
  auth.uid() = user_id OR is_super_admin()
);

-- Add comment for documentation
COMMENT ON POLICY "Users can manage their own orders, super admins can see all" ON starter_pack_orders IS 'Allows users to manage their own starter pack orders, while super admins can view and manage all orders across all restaurants';
