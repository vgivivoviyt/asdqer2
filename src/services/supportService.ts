import { supabase } from '../lib/supabase';

export interface SupportTicket {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by_user_id: string;
  assigned_to_admin?: string;
  created_at: string;
  updated_at: string;
  restaurant?: {
    name: string;
    slug: string;
  };
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'restaurant_manager' | 'super_admin';
  sender_id: string;
  message: string;
  created_at: string;
}

export interface CreateTicketData {
  restaurant_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by_user_id: string;
}

export interface CreateMessageData {
  ticket_id: string;
  sender_type: 'restaurant_manager' | 'super_admin';
  sender_id: string;
  message: string;
}

export class SupportService {
  // Get all tickets (for super admin)
  static async getAllTickets(): Promise<SupportTicket[]> {
    try {
      console.log('🔍 Fetching all tickets for super admin');
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          restaurant:restaurants(name, slug)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all tickets:', error);
        throw error;
      }
      
      console.log('✅ Fetched tickets for super admin:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('Error fetching all tickets:', error);
      return [];
    }
  }

  // Get tickets for a specific restaurant
  static async getRestaurantTickets(restaurantId: string): Promise<SupportTicket[]> {
    try {
      console.log('🔍 Fetching tickets for restaurant:', restaurantId);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching restaurant tickets:', error);
        throw error;
      }
      
      console.log('✅ Fetched restaurant tickets:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('Error fetching restaurant tickets:', error);
      return [];
    }
  }

  // Create a new ticket
  static async createTicket(ticketData: CreateTicketData): Promise<SupportTicket> {
    console.log('📝 Creating new ticket:', ticketData.title);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating ticket:', error);
      throw error;
    }
    
    console.log('✅ Ticket created successfully:', data.id);
    return data;
  }

  // Update ticket status
  static async updateTicketStatus(
    ticketId: string, 
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
    assignedToAdmin?: string
  ): Promise<void> {
    console.log('🔄 Updating ticket status:', { ticketId, status, assignedToAdmin });
    const updates: any = { status };
    if (assignedToAdmin !== undefined) {
      updates.assigned_to_admin = assignedToAdmin;
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) {
      console.error('❌ Error updating ticket status:', error);
      throw error;
    }
    
    console.log('✅ Ticket status updated successfully');
  }

  // Get messages for a ticket
  static async getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
    try {
      console.log('📨 Fetching messages for ticket:', ticketId);
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching messages:', error);
        throw error;
      }
      
      console.log('✅ Fetched messages:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('Error fetching ticket messages:', error);
      return [];
    }
  }

  // Send a message
  static async sendMessage(messageData: CreateMessageData): Promise<SupportMessage> {
    console.log('📤 Sending message:', {
      ticketId: messageData.ticket_id,
      senderType: messageData.sender_type,
      messageLength: messageData.message.length
    });
    
    // Validate sender_type
    if (!['restaurant_manager', 'super_admin'].includes(messageData.sender_type)) {
      throw new Error('Invalid sender type');
    }

    const { data, error } = await supabase
      .from('support_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
    
    console.log('✅ Message sent successfully:', data.id);
    return data;
  }

  // Get ticket statistics
  static async getTicketStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  }> {
    try {
      console.log('📊 Fetching ticket statistics');
      const { data, error } = await supabase
        .from('support_tickets')
        .select('status');

      if (error) {
        console.error('❌ Error fetching ticket stats:', error);
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        open: data?.filter(t => t.status === 'open').length || 0,
        inProgress: data?.filter(t => t.status === 'in_progress').length || 0,
        resolved: data?.filter(t => t.status === 'resolved').length || 0,
        closed: data?.filter(t => t.status === 'closed').length || 0,
      };

      console.log('✅ Ticket stats calculated:', stats);
      return stats;
    } catch (error: any) {
      console.error('Error fetching ticket stats:', error);
      return { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 };
    }
  }

  // Subscribe to real-time updates for tickets
  static subscribeToTickets(callback: (payload: any) => void) {
    console.log('🔌 Setting up tickets subscription');
    return supabase
      .channel('support_tickets')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'support_tickets' }, 
        (payload) => {
          console.log('🎫 Tickets subscription update:', payload);
          callback(payload);
        }
      )
      .subscribe();
  }

  // Subscribe to real-time updates for messages
  static subscribeToMessages(ticketId: string, callback: (payload: any) => void) {
    console.log('🔌 Setting up messages subscription for ticket:', ticketId);
    return supabase
      .channel(`support_messages_${ticketId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`
        }, 
        (payload) => {
          console.log('📨 Messages subscription update:', payload);
          callback(payload);
        }
      )
      .subscribe();
  }

  // Subscribe to all messages (for super admin)
  static subscribeToAllMessages(callback: (payload: any) => void) {
    console.log('🔌 Setting up global messages subscription for super admin');
    return supabase
      .channel('all_support_messages')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'support_messages' }, 
        (payload) => {
          console.log('📨 Global messages subscription update:', payload);
          callback(payload);
        }
      )
      .subscribe();
  }
} 