import { supabase } from '../lib/supabase';

export interface DeliveryAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  emirate: string;
  contactNumber: string;
}

export interface StarterPackOrder {
  id: string;
  user_id: string;
  restaurant_id?: string;
  restaurant_name?: string;
  order_status: 'pending' | 'received' | 'preparing' | 'configuring' | 'out_for_delivery' | 'delivered';
  includes_tablet: boolean;
  tablet_cost: number;
  base_pack_cost: number;
  total_cost: number;
  payment_status: 'pending' | 'completed' | 'failed';
  stripe_payment_intent_id?: string;
  estimated_delivery?: string;
  delivered_at?: string;
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_emirate?: string;
  delivery_contact_number?: string;
  proof_of_delivery_url?: string;
  is_first_free_order?: boolean;
  status_timestamps?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export class StarterPackService {
  private static readonly STARTER_PACK_FIRST_ORDER_COST = 0;
  private static readonly STARTER_PACK_SUBSEQUENT_COST = 50;
  private static readonly TABLET_COST = 499;

  static async createOrder(
    userId: string,
    includesTablet: boolean,
    deliveryAddress: DeliveryAddress,
    restaurantId?: string
  ): Promise<StarterPackOrder> {
    try {
      const isFirstOrder = await this.isFirstOrder(userId);
      const hasActivePaidSubscription = await this.hasActivePaidSubscription(userId);

      const basePackCost = (isFirstOrder && hasActivePaidSubscription)
        ? this.STARTER_PACK_FIRST_ORDER_COST
        : this.STARTER_PACK_SUBSEQUENT_COST;
      const tabletCost = includesTablet ? this.TABLET_COST : 0;
      const totalCost = basePackCost + tabletCost;

      let restaurantName = 'Unknown Restaurant';
      if (restaurantId) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', restaurantId)
          .maybeSingle();
        if (restaurant) restaurantName = restaurant.name;
      } else {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id, name')
          .eq('owner_id', userId)
          .maybeSingle();
        if (restaurant) {
          restaurantId = restaurant.id;
          restaurantName = restaurant.name;
        }
      }

      const estimatedDelivery = this.calculateEstimatedDeliveryDate(new Date());
      const needsPayment = totalCost > 0;

      const { data, error } = await supabase
        .from('starter_pack_orders')
        .insert({
          user_id: userId,
          restaurant_id: restaurantId || null,
          restaurant_name: restaurantName,
          includes_tablet: includesTablet,
          tablet_cost: tabletCost,
          base_pack_cost: basePackCost,
          total_cost: totalCost,
          order_status: 'received',
          payment_status: needsPayment ? 'pending' : 'completed',
          is_first_free_order: isFirstOrder && hasActivePaidSubscription && basePackCost === 0,
          estimated_delivery: estimatedDelivery.toISOString(),
          delivery_address_line1: deliveryAddress.addressLine1,
          delivery_address_line2: deliveryAddress.addressLine2,
          delivery_city: deliveryAddress.city,
          delivery_emirate: deliveryAddress.emirate,
          delivery_contact_number: deliveryAddress.contactNumber,
          status_timestamps: JSON.stringify({ received: new Date().toISOString() })
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating starter pack order:', error);
      throw error;
    }
  }

  static async updateOrderPaymentStatus(
    orderId: string,
    paymentIntentId: string,
    status: 'completed' | 'failed'
  ): Promise<void> {
    try {
      const updateData: any = {
        payment_status: status,
        stripe_payment_intent_id: paymentIntentId
      };

      if (status === 'completed') {
        updateData.order_status = 'received';
      }

      const { error } = await supabase
        .from('starter_pack_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating order payment status:', error);
      throw error;
    }
  }

  static async getUserOrders(userId: string): Promise<StarterPackOrder[]> {
    try {
      const { data, error } = await supabase
        .from('starter_pack_orders')
        .select('*')
        .eq('user_id', userId)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching user orders:', error);
      throw error;
    }
  }

  static async getOrderById(orderId: string): Promise<StarterPackOrder | null> {
    try {
      const { data, error } = await supabase
        .from('starter_pack_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

 static async updateOrderStatus(
  orderId: string,
  status: 'pending' | 'received' | 'preparing' | 'configuring' | 'out_for_delivery' | 'delivered'
): Promise<void> {
  try {
    const { data: order } = await supabase
      .from('starter_pack_orders')
      .select('status_timestamps')
      .eq('id', orderId)
      .maybeSingle();

    // ✅ Fix: ensure it's parsed from string → object
    let timestamps: Record<string, string> = {};

    if (order?.status_timestamps) {
      if (typeof order.status_timestamps === 'string') {
        try {
          timestamps = JSON.parse(order.status_timestamps);
        } catch {
          console.warn('Invalid JSON in status_timestamps, resetting to empty object');
          timestamps = {};
        }
      } else {
        timestamps = order.status_timestamps;
      }
    }

    // ✅ Add the new timestamp
    timestamps[status] = new Date().toISOString();

    const updateData: any = {
      order_status: status,
      status_timestamps: timestamps, // Supabase will handle JSON object fine if column type is json/jsonb
    };

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('starter_pack_orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) throw error;
  } catch (error: any) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

  static async getAllOrders(): Promise<StarterPackOrder[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_all_starter_pack_orders_admin');

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching all orders:', error);
      throw error;
    }
  }

  static async calculateTotalCost(userId: string, includesTablet: boolean): Promise<number> {
    const isFirstOrder = await this.isFirstOrder(userId);
    const hasActivePaidSubscription = await this.hasActivePaidSubscription(userId);

    const basePackCost = (isFirstOrder && hasActivePaidSubscription)
      ? this.STARTER_PACK_FIRST_ORDER_COST
      : this.STARTER_PACK_SUBSEQUENT_COST;
    const tabletCost = includesTablet ? this.TABLET_COST : 0;

    return basePackCost + tabletCost;
  }

  static calculateTotalCostSync(isFirstOrder: boolean, hasActivePaidSubscription: boolean, includesTablet: boolean): number {
    const basePackCost = (isFirstOrder && hasActivePaidSubscription)
      ? this.STARTER_PACK_FIRST_ORDER_COST
      : this.STARTER_PACK_SUBSEQUENT_COST;
    const tabletCost = includesTablet ? this.TABLET_COST : 0;
    return basePackCost + tabletCost;
  }

  static getTabletCost(): number {
    return this.TABLET_COST;
  }

  static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      received: 'Order Received',
      preparing: 'Preparing',
      configuring: 'Configuring',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered'
    };
    return labels[status] || status;
  }

  static getStatusIndex(status: string): number {
    const statuses = ['pending', 'received', 'preparing', 'configuring', 'out_for_delivery', 'delivered'];
    return statuses.indexOf(status);
  }

  static async uploadProofOfDelivery(
    orderId: string,
    file: File
  ): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('starter-pack-deliveries')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('starter-pack-deliveries')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('starter_pack_orders')
        .update({ proof_of_delivery_url: data.publicUrl })
        .eq('id', orderId);

      if (updateError) throw updateError;

      return data.publicUrl;
    } catch (error: any) {
      console.error('Error uploading proof of delivery:', error);
      throw error;
    }
  }

  static calculateEstimatedDeliveryDate(orderDate: Date): Date {
    const order = new Date(orderDate);
    let deliveryDate = new Date(order);

    const orderHour = order.getHours();

    if (orderHour >= 17) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      deliveryDate.setHours(10, 0, 0, 0);
    } else {
      deliveryDate.setHours(orderHour + 9, 0, 0, 0);
    }

    while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      deliveryDate.setHours(10, 0, 0, 0);
    }

    return deliveryDate;
  }

  static calculateEstimatedDelivery(orderDate: string): Date {
    return this.calculateEstimatedDeliveryDate(new Date(orderDate));
  }

  static isDelayed(orderDate: string, currentStatus: string, estimatedDelivery: string): boolean {
    if (currentStatus === 'delivered' || currentStatus === 'out_for_delivery') {
      return false;
    }
    const now = new Date();
    const eta = new Date(estimatedDelivery);
    return now > eta;
  }

  static getDelayMessage(estimatedDelivery: string): string {
    const now = new Date();
    const eta = new Date(estimatedDelivery);
    const delayHours = Math.floor((now.getTime() - eta.getTime()) / (1000 * 60 * 60));

    if (delayHours < 1) {
      return 'Your order is slightly delayed. We apologize for the inconvenience.';
    } else if (delayHours < 3) {
      return `Your order is delayed by approximately ${delayHours} hour${delayHours > 1 ? 's' : ''}. Our team is working to get it to you as soon as possible.`;
    } else {
      return `We sincerely apologize for the delay. Your order is taking longer than expected. Please contact support for more information.`;
    }
  }

  static async isFirstOrder(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('starter_pack_orders')
        .select('id')
        .eq('user_id', userId)
        .eq('payment_status', 'completed')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return !data;
    } catch (error: any) {
      console.error('Error checking first order:', error);
      return false;
    }
  }

  static async hasActivePaidSubscription(userId: string): Promise<boolean> {
    try { 
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan_type, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data?.plan_type !== 'trial';
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }

  static getBasePackCost(): number {
    return this.STARTER_PACK_SUBSEQUENT_COST;
  }
}
 