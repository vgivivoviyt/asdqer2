import { supabase } from '../lib/supabase';
import { supportSupabase } from '../lib/supportSupabase';

export interface ChatSession {
  id: string;
  restaurant_id: string;
  title: string;
  status: 'active' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by_user_id: string;
  assigned_agent_name?: string;
  assigned_agent_id?: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  restaurant?: {
    name: string;
    slug: string;
  };
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: 'restaurant_manager' | 'support_agent';
  sender_id: string;
  sender_name: string;
  message: string;
  message_type: 'text' | 'image' | 'file';
  has_attachments: boolean;
  is_system_message: boolean;
  created_at: string;
  attachments?: MessageAttachment[];
}

export interface ChatParticipant {
  id: string;
  session_id: string;
  user_type: 'restaurant_manager' | 'support_agent';
  user_id: string;
  user_name: string;
  joined_at: string;
  last_seen_at: string;
  is_online: boolean;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  created_at: string;
}

export interface CreateSessionData {
  restaurant_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by_user_id: string;
}

export interface CreateMessageData {
  session_id: string;
  sender_type: 'restaurant_manager' | 'support_agent';
  sender_id: string;
  sender_name: string;
  message: string;
  message_type?: 'text' | 'image' | 'file';
  has_attachments?: boolean;
  is_system_message?: boolean;
}

export interface CreateParticipantData {
  user_type: 'restaurant_manager' | 'support_agent';
  user_id: string;
  user_name: string;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface QuickResponse {
  id: string;
  title: string;
  message: string;
  category: string;
  is_active: boolean;
}

export class ChatService {
  // Set support agent context (updated for Supabase Auth)
  static async setSupportAgentContext(agentEmail: string) {
    try {
      if (!agentEmail) {
        console.warn("⚠️ [SUPPORT PORTAL] No agent email provided for context set");
        return;
      }

      console.log("🔐 [SUPPORT PORTAL] Setting support agent context for:", agentEmail);

      const { error } = await supabase.rpc("set_support_agent_context", {
        agent_email: agentEmail,
      });

      if (error) {
        console.error("❌ [SUPPORT PORTAL] Failed to set agent context:", error);
      } else {
        console.log("✅ [SUPPORT PORTAL] Agent context set");
      }
    } catch (err) {
      console.error("❌ [SUPPORT PORTAL] Error in setSupportAgentContext:", err);
    }
  }

  // Get all chat sessions (for support agents - sees ALL restaurants)
  static async getAllChatSessions(): Promise<ChatSession[]> {
  try {
    console.log('🔍 [SUPPORT PORTAL] Fetching ALL chat sessions across ALL restaurants');
    
    // Try using the service role bypass function first
    console.log('🔍 [SUPPORT PORTAL] Trying service role bypass function...');
    const { data: bypassData, error: bypassError } = await supabase.rpc('get_all_chat_sessions_for_support');
    
    if (!bypassError && bypassData) {
      console.log('✅ [SUPPORT PORTAL] Service role bypass successful:', {
        totalSessions: bypassData.length,
        restaurants: [...new Set(bypassData.map((s: any) => s.restaurant_name))].filter(Boolean)
      });
      
      // Transform and filter out closed sessions
      const transformedData = bypassData
        .filter((session: any) => session.status !== 'closed')
        .map((session: any) => ({
          ...session,
          restaurant: session.restaurant_name ? {
            name: session.restaurant_name,
            slug: session.restaurant_slug
          } : null,
          participants: session.chat_participants || []
        }));

      return transformedData;
    }
    
    console.warn('⚠️ [SUPPORT PORTAL] Service role bypass failed, trying direct query:', bypassError);
    
    // Fallback to direct query
    console.log('🔍 [SUPPORT PORTAL] Executing direct chat sessions query...');
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        restaurant:restaurants(name, slug),
        chat_participants (
          id,
          user_id,
          user_name,
          user_type,
          is_online,
          joined_at
        )
      `)
      // .neq('status', 'closed')   // 👈 exclude closed 
     .eq('is_active', true)   // ✅ only fetch active sessions
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('❌ [SUPPORT PORTAL] Error fetching all chat sessions:', error);
      throw error;
    }
    
    const breakdown = data?.reduce((acc, session) => {
      const restaurantName = session.restaurant?.name || 'Unknown Restaurant';
      acc[restaurantName] = (acc[restaurantName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log('✅ [SUPPORT PORTAL] Successfully fetched ALL chat sessions:', {
      totalSessions: data?.length || 0,
      uniqueRestaurants: Object.keys(breakdown).length,
      sessionsByRestaurant: breakdown,
      sampleSessions: data?.slice(0, 3).map(s => ({
        id: s.id,
        title: s.title,
        restaurant: s.restaurant?.name,
        status: s.status
      })) || []
    });
    
    return data || [];
  } catch (error: any) {
    console.error('❌ [SUPPORT PORTAL] Critical error fetching all chat sessions:', error);
    return [];
  }
}


  // Get chat sessions for a specific restaurant (for restaurant managers)
  static async getRestaurantChatSessions(restaurantId: string): Promise<ChatSession[]> {
  try {
    console.log('🔍 Fetching chat sessions for restaurant:', restaurantId);

    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        restaurant:restaurants(name, slug)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false});

    if (error) {
      console.error('❌ Error fetching restaurant chat sessions:', error);
      throw error;
    }
    
    console.log('✅ Fetched restaurant chat sessions:', data?.length || 0);
    return data || [];
  } catch (error: any) {
    console.error('Error fetching restaurant chat sessions:', error);
    return [];
  }
}


  // Create a new chat session
  static async createChatSession(sessionData: CreateSessionData): Promise<ChatSession> {
    console.log('📝 Creating new chat session:', sessionData.title);
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(sessionData)
      .select(`
        *,
        restaurant:restaurants(name, slug)
      `)
      .single();

    if (error) {
      console.error('❌ Error creating chat session:', error);
      throw error;
    }
    
    console.log('✅ Chat session created successfully:', data.id);
    return data;
  }

  // Update chat session
  static async updateChatSession(
    sessionId: string,
    updates: Partial<ChatSession>
  ): Promise<ChatSession | null> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select(`
          *,
          restaurant:restaurants(name, slug)
        `)
        .single();

      if (error) {
        console.error('❌ Error updating chat session:', error);
        throw error;
      }
      
      return data;
    } catch (error: any) {
      console.error('Error updating chat session:', error);
      return null;
    }
  }

  // Close chat session

  // Close chat session
// Close chat session
static async closeChatSession(sessionId: string, agentName: string, agentId?: string): Promise<void> {
  try {
    console.log("🔒 Closing chat session:", sessionId);

    // Update session status and store who closed it
    const { error } = await supabase
      .from("chat_sessions")
      .update({
        status: "closed",                  // mark as closed
        is_active: false,                  // ✅ force inactive
        closed_at: new Date().toISOString(), // ✅ record close time
        closed_by: agentName,              // optional: who closed
        assigned_agent_name: agentName,
        assigned_agent_id: agentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) throw error;

    // Send system message
    await this.sendMessage({
      session_id: sessionId,
      sender_type: "support_agent",
      sender_id: agentId || "system",
      sender_name: "System",
      message: `Chat closed by ${agentName}. Thank you for contacting support!`,
      is_system_message: true,
    });

    console.log("✅ Chat session closed successfully");
  } catch (error) {
    console.error("❌ Error closing chat session:", error);
    throw error;
  }
}

  // Assign agent to session
  static async assignAgentToSession(
    sessionId: string,
    agentName: string,
    agentId: string
  ): Promise<void> {
    console.log('👤 Assigning agent to session:', { sessionId, agentName, agentId });
    
    const { error } = await supabase
      .from('chat_sessions')
      .update({
        assigned_agent_name: agentName,
        assigned_agent_id: agentId,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ Error assigning agent:', error);
      throw error;
    }
    
    console.log('✅ Agent assigned successfully');
  }

  // Get messages for a chat session
  // Get messages for a chat session
static async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    console.log("📨 Fetching messages for session:", sessionId);

    // 🔐 Try bypass function (support agents)
    try {
      const { data: bypassData, error: bypassError } = await supabase.rpc(
        "get_all_chat_messages_for_support",
        { p_session_id: sessionId }
      );

      if (!bypassError && bypassData) {
        console.log(
          "✅ [SUPPORT PORTAL] Messages loaded via bypass:",
          bypassData.length
        );
        return bypassData;
      }
      console.warn("⚠️ Bypass message load failed:", bypassError);
    } catch (err) {
      console.error("❌ Bypass RPC error (messages):", err);
    }

    // 🔄 Fallback for restaurant managers
    const { data, error } = await supabase
      .from("chat_messages")
      .select(`
        *,
        attachments:message_attachments(*)
      `)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Error fetching messages:", error);
      throw error;
    }

    console.log("✅ Fetched messages:", data?.length || 0);
    return data || [];
  } catch (error: any) {
    console.error("Error fetching chat messages:", error);
    return [];
  }
}


  // Send a message with real-time handling
  static async sendMessage(messageData: CreateMessageData): Promise<ChatMessage> {
  console.log('📤 Sending message:', {
  sessionId: messageData.session_id,
  senderType: messageData.sender_type,
  senderName: messageData.sender_name,
  messageLength: messageData.message?.length || 0, // ✅ safe
  isSystem: messageData.is_system_message
});

  // 🔐 If this is a support agent
  if (messageData.sender_type === 'support_agent') {
    console.log('🔐 [SUPPORT PORTAL] Setting support agent context before sending message...');

    const agentEmail = messageData.sender_name;
    await this.setSupportAgentContext(agentEmail);

    try {
      console.log('🔐 [SUPPORT PORTAL] Attempting service role message insert...');

      const { data: bypassData, error: bypassError } = await supabase.rpc(
        'send_message_with_attachments_as_support_agent',
        {
          p_session_id: messageData.session_id,
          p_sender_id: messageData.sender_id,
          p_sender_name: messageData.sender_name,
          p_message: messageData.message,
          p_message_type: messageData.message_type || 'text',
          p_has_attachments: messageData.has_attachments || false,
          p_is_system_message: messageData.is_system_message || false,
          // ✅ FIX 1: Pass raw array, not string
          p_attachments: messageData.attachments || []
        }
      );

if (!bypassError && bypassData && bypassData.length > 0) {
  const msg = bypassData[0]; // grab the first returned row
  console.log('✅ [SUPPORT PORTAL] Message sent via RPC:', msg.id);
  return msg;
}


      // ✅ FIX 2: Stop support agents from falling back
      console.error('❌ Support agent RPC failed, not allowed to fallback:', bypassError);
      throw bypassError;
    } catch (err) {
      console.error('❌ Bypass RPC error:', err);
      throw err;
    }
  }

  // 🔄 Fallback ONLY for restaurant managers
  const messageToInsert = {
    session_id: messageData.session_id,
    sender_type: messageData.sender_type,
    sender_id: messageData.sender_id,
    sender_name: messageData.sender_name,
    message: messageData.message,
    message_type: messageData.message_type || 'text',
    has_attachments: messageData.has_attachments || false,
    is_system_message: messageData.is_system_message || false
  };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(messageToInsert)
    .select(`
      *,
      attachments:message_attachments(*)
    `)
    .single();

  if (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }

  console.log('✅ Message sent successfully (restaurant manager):', data.id);
  return data;
}

  // Upload file attachment
  static async uploadAttachment(
    file: File,
    messageId: string
  ): Promise<MessageAttachment> {
    try {
      console.log('📎 Uploading attachment:', file.name, file.size);

      // Validate file type (only images and screenshots)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only image files are allowed');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Upload to Supabase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // Create attachment record
      const { data: attachment, error: attachmentError } = await supabase
        .from('message_attachments')
        .insert({
          message_id: messageId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: urlData.publicUrl,
          thumbnail_url: urlData.publicUrl // For images, use same URL as thumbnail
        })
        .select()
        .single();

      if (attachmentError) {
        throw new Error(`Failed to create attachment record: ${attachmentError.message}`);
      }

      console.log('✅ Attachment uploaded successfully:', attachment.id);
      return attachment;
    } catch (error: any) {
      console.error('❌ Error uploading attachment:', error);
      throw error;
    }
  }

  // Get participants for a chat session
  static async getChatParticipants(sessionId: string): Promise<ChatParticipant[]> {
    try {
      console.log('👥 Fetching participants for session:', sessionId);
      
      const { data, error } = await supabase
        .from('chat_participants')
        .select('*')
        .eq('session_id', sessionId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching participants:', error);
        throw error;
      }
      
      console.log('✅ Fetched participants:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('Error fetching chat participants:', error);
      return [];
    }
  }

  // Add participant to session
 // Add participant to session (via secure RPC)
static async addParticipant(
  sessionId: string,
  participantData: CreateParticipantData
): Promise<ChatParticipant> {
  console.log('👤 Adding participant to session:', {
    sessionId,
    userType: participantData.user_type,
    userName: participantData.user_name,
    userId: participantData.user_id
  });

  if (!['restaurant_manager', 'support_agent'].includes(participantData.user_type)) {
    throw new Error(`Invalid user_type: ${participantData.user_type}`);
  }

  // 🔑 Use secure RPC to bypass RLS and handle conflicts
  const { data, error } = await supabase.rpc(
    'add_support_agent_to_session',
    {
      p_session_id: sessionId,
      p_agent_id: participantData.user_id,
      p_agent_name: participantData.user_name,
    }
  );

  if (error) {
    console.error('❌ Error adding participant via RPC:', error);
    throw error;
  }

  console.log('✅ Participant added successfully via RPC:', data.id);
  return data as ChatParticipant;
}

  // Update participant status
  static async updateParticipantStatus(
    sessionId: string,
    userId: string,
    isOnline: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_participants')
        .update({
          is_online: isOnline,
          last_seen_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error updating participant status:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Error updating participant status:', error);
    }
  }

  // Real-time subscriptions
  static subscribeToAllSessions(callback: (payload: any) => void) {
    console.log('🔌 [SUPPORT PORTAL] Setting up global sessions subscription for ALL restaurants');
    
    const channel = supabase
      .channel('all_chat_sessions')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_sessions' }, 
        (payload) => {
          console.log('🔄 [SUPPORT PORTAL REALTIME] Sessions update:', {
            eventType: payload.eventType,
            sessionId: payload.new?.id || payload.old?.id,
            restaurantId: payload.new?.restaurant_id || payload.old?.restaurant_id,
            restaurantName: payload.new?.restaurant?.name || 'Unknown',
            status: payload.new?.status || payload.old?.status,
            title: payload.new?.title || payload.old?.title
          });
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 [SUPPORT PORTAL REALTIME] Global sessions subscription status:', status);
      });

    return channel;
  }

  static subscribeToMessages(sessionId: string, callback: (payload: any) => void) {
    console.log('🔌 [REALTIME] Setting up messages subscription for session:', sessionId);
    
    const channel = supabase
      .channel(`chat_messages_${sessionId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        }, 
        async (payload) => {
          console.log('📨 [REALTIME] Message update:', {
            eventType: payload.eventType,
            messageId: payload.new?.id || payload.old?.id,
            senderType: payload.new?.sender_type || payload.old?.sender_type
          });
          
          // If this is a new image message, resolve the file URL
          if (payload.eventType === 'INSERT' && payload.new) {
            let message = payload.new;
            
            // Check if message has attachments and fetch them
            if (message.has_attachments) {
              try {
                const { data: attachments, error: attachError } = await supabase
                  .from('message_attachments')
                  .select('*')
                  .eq('message_id', message.id);
                
                if (!attachError && attachments) {
                  message.attachments = attachments;
                  console.log('📎 Attached file URLs to realtime message:', attachments.length);
                }
              } catch (attachError) {
                console.warn('⚠️ Failed to fetch attachments for realtime message:', attachError);
              }
            }
            
            callback({ ...payload, new: message });
          } else {
            callback(payload);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Messages subscription status:', status);
      });

    return channel;
  }

  static subscribeToParticipants(sessionId: string, callback: (payload: any) => void) {
    console.log('🔌 [REALTIME] Setting up participants subscription for session:', sessionId);
    
    const channel = supabase
      .channel(`chat_participants_${sessionId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_participants',
          filter: `session_id=eq.${sessionId}`
        }, 
        (payload) => {
          console.log('👥 [REALTIME] Participants update:', {
            eventType: payload.eventType,
            participantId: payload.new?.id || payload.old?.id,
            userType: payload.new?.user_type || payload.old?.user_type,
            isOnline: payload.new?.is_online
          });
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Participants subscription status:', status);
      });

    return channel;
  }

  // Get chat statistics
  static async getChatStats(): Promise<any> {
    try {
      console.log('📊 Fetching chat statistics');
      
      const { data, error } = await supabase.rpc('get_chat_statistics');

      if (error) throw error;

      console.log('✅ Chat statistics loaded:', data);
      return data || {
        totalSessions: 0,
        activeSessions: 0,
        resolvedToday: 0,
        averageResponseTime: 0,
        totalRestaurants: 0,
        agentsOnline: 0
      };
    } catch (error: any) {
      console.error('Error fetching chat stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        resolvedToday: 0,
        averageResponseTime: 0,
        totalRestaurants: 0,
        agentsOnline: 0
      };
    }
  }

  // Support Agent Management
  static async createSupportAgent(agentData: {
    name: string;
    email: string;
    password: string;
  }): Promise<SupportAgent> {
    try {
      console.log('👤 Creating support agent via Supabase Auth:', agentData.email);
      
      // Call the new edge function that uses Supabase Auth Admin API
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-support-agent-auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: agentData.name,
          email: agentData.email,
          password: agentData.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create support agent');
      }

      const data = await response.json();
      console.log('✅ Support agent created successfully via Supabase Auth:', data.id);
      return data;
    } catch (error: any) {
      console.error('Error creating support agent:', error);
      throw error;
    }
  }

static async getSupportAgents(): Promise<SupportAgent[]> {
  try {
    console.log('👥 Fetching support agents using public.users FK relationship...');

    // Try direct query first
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        created_at,
        updated_at,
        support_agents!inner (
          name,
          is_active,
          last_login_at,
          updated_at
        )
      `)
      .eq('role', 'support')
      .order('created_at', { ascending: false });

    if (!error && data) {
      console.log('✅ Support agents fetched via direct FK join:', data.length);

      return data.map((user: any) => ({
        id: user.id,
        name: user.support_agents.name || 'Unknown',
        email: user.email,
        role: 'support_agent',
        is_active: user.support_agents.is_active,
        last_login_at: user.support_agents.last_login_at,
        created_at: user.created_at,
        updated_at: user.support_agents.updated_at,
        password_hash: '' // Not needed for auth users
      }));
    }

    // 🔄 Fallback to RPC if direct query fails
    console.warn('⚠️ Direct query failed, falling back to RPC:', error);

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_support_agents_with_users');

    if (rpcError) {
      console.error('❌ Error fetching support agents via RPC:', rpcError);
      throw rpcError;
    }

    console.log('✅ Support agents fetched via RPC function:', rpcData?.length || 0);

    return (rpcData || []).map((agent: any) => ({
      id: agent.id,
      name: agent.name || 'Unknown',
      email: agent.email,
      role: 'support_agent',
      is_active: agent.is_active,
      last_login_at: agent.last_login_at,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
      password_hash: '' // Not needed for auth users
    }));
  } catch (error: any) {
    console.error('Error fetching support agents:', error);
    return [];
  }
} // 👈 don’t forget this



  static async updateSupportAgent(
    agentId: string,
    updates: Partial<Pick<SupportAgent, 'name' | 'is_active'>>
  ): Promise<void> {
    try {
      console.log('🔄 Updating support agent:', agentId, updates);
      
      // Update support_agents table
      const { error } = await supabase
        .from('support_agents')
        .update(updates)
        .eq('id', agentId);

      if (error) {
        console.error('❌ Error updating support agent:', error);
        throw error;
      }

      // Also update users table if name is being changed
      if (updates.name) {
        console.log('📝 Updating user metadata with new name...');
        const { error: usersError } = await supabase
          .from('users')
          .update({
            user_metadata: { 
              name: updates.name, 
              role: 'support' 
            }
          })
          .eq('id', agentId)
          .eq('role', 'support');

        if (usersError) {
          console.error('❌ Error updating users table:', usersError);
          throw new Error(`Failed to update user metadata: ${usersError.message}`);
        }
      }

      console.log('✅ Support agent updated successfully');
    } catch (error: any) {
      console.error('Error updating support agent:', error);
      throw error;
    }
  }

  static async deleteSupportAgent(agentId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting support agent via Supabase Auth:', agentId);
      
      // Call the new edge function that uses Supabase Auth Admin API
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-support-agent-auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete support agent');
      }

      console.log('✅ Support agent deleted successfully');
    } catch (error: any) {
      console.error('Error deleting support agent:', error);
      throw error;
    }
  }

  // Quick Responses
// inside chatService.ts (where other static methods live)
static async getQuickResponses(): Promise<QuickResponse[]> {
  try {
    console.log('⚡ [SUPPORT PORTAL] Fetching quick responses via RPC (service role bypass)...');

    // Use the support client that can call RPCs; if you use `supabase` or `supportSupabase` elsewhere,
    // import the same instance at top of file.
    const { data, error } = await supportSupabase.rpc('get_all_quick_responses');

    if (error) {
      console.error('❌ Error fetching quick responses via RPC:', error);
      return [];
    }

    // `data` should be an array of quick_responses
    console.log('📋 [SUPPORT PORTAL] Quick responses data (RPC):', data);
    return (data as QuickResponse[]) || [];
  } catch (err: any) {
    console.error('❌ Unexpected error in getQuickResponses RPC:', err);
    return [];
  }
}


  static cleanupSubscription(subscription: any): void {
    if (subscription && typeof subscription.unsubscribe === 'function') {
      try {
        subscription.unsubscribe();
        console.log('🧹 Subscription cleaned up successfully');
      } catch (error) {
        console.warn('⚠️ Error cleaning up subscription:', error);
      }
    }
  }
}

export default ChatService;
