import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Plus, Search, Filter, Clock, CheckCircle,
  AlertCircle, User, Send, X, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Tag, Calendar, Users, Settings, 
  MessageCircle, Phone, Mail, FileText, Zap, Star,
  Paperclip, Upload, Eye, Download, Building, Crown,
  Image, Camera, Smile, MoreVertical, Copy, Archive,
  UserX, Shield, Activity, Wifi, WifiOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ChatService, ChatSession, ChatMessage, ChatParticipant, QuickResponse } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';

const SupportUI: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [activeSessionsTab, setActiveSessionsTab] = useState<'active' | 'archived'>('active');
  const [newSessionData, setNewSessionData] = useState({
    title: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: 'general'
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [showCloseChatModal, setShowCloseChatModal] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  
  // Real-time state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSeen, setLastSeen] = useState<Date>(new Date());
  
  // Refs for subscriptions and auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionsSubscriptionRef = useRef<any>(null);
  const messagesSubscriptionRef = useRef<any>(null);
  const participantsSubscriptionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { user, restaurant } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('connected');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Heartbeat for presence
  useEffect(() => {
    if (selectedSession && user) {
      // Update presence every 30 seconds
      heartbeatIntervalRef.current = setInterval(() => {
        ChatService.updateParticipantStatus(selectedSession.id, user.id, true);
        setLastSeen(new Date());
      }, 30000);

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        // Mark as offline when leaving
        if (selectedSession && user) {
          ChatService.updateParticipantStatus(selectedSession.id, user.id, false);
        }
      };
    }
  }, [selectedSession, user]);

  useEffect(() => {
    if (restaurant) {
      fetchSessions();
      fetchQuickResponses();
      setupGlobalSubscriptions();
    }
    
    return () => {
      cleanupAllSubscriptions();
    };
  }, [restaurant]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages();
      fetchParticipants();
      setupSessionSubscriptions();
      
      // Mark participant as online
      if (user) {
        ChatService.updateParticipantStatus(selectedSession.id, user.id, true);
      }
    } else {
      cleanupSessionSubscriptions();
    }
  }, [selectedSession]);

  const cleanupAllSubscriptions = () => {
    cleanupGlobalSubscriptions();
    cleanupSessionSubscriptions();
  };

  const cleanupGlobalSubscriptions = () => {
    if (sessionsSubscriptionRef.current) {
      try {
        sessionsSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing from sessions:', err);
      }
      sessionsSubscriptionRef.current = null;
    }
  };

  const cleanupSessionSubscriptions = () => {
    if (messagesSubscriptionRef.current) {
      try {
        messagesSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing from messages:', err);
      }
      messagesSubscriptionRef.current = null;
    }

    if (participantsSubscriptionRef.current) {
      try {
        participantsSubscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing from participants:', err);
      }
      participantsSubscriptionRef.current = null;
    }
  };

  const setupGlobalSubscriptions = () => {
    if (!restaurant) return;
    
    cleanupGlobalSubscriptions();
    setConnectionStatus('connecting');
    
    console.log('🔌 Setting up real-time sessions subscription');
    
    try {
      sessionsSubscriptionRef.current = ChatService.subscribeToAllSessions((payload) => {
        console.log('🔄 Sessions real-time update:', payload);
        setConnectionStatus('connected');
        
        if (payload.eventType === 'INSERT' && payload.new) {
          // Only add sessions for this restaurant
          if (payload.new.restaurant_id === restaurant.id) {
            setSessions(prev => {
              const exists = prev.some(session => session.id === payload.new.id);
              if (exists) return prev;
              
              return [payload.new, ...prev].sort((a, b) => 
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
              );
            });
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedSession = payload.new;

          // If session is closed or inactive, remove it from active list
          if (updatedSession.status === 'closed' || updatedSession.is_active === false) {
            setSessions(prev => prev.filter(session => session.id !== updatedSession.id));

            // Clear selected session immediately if it's the one being closed
            if (selectedSession?.id === updatedSession.id) {
              setSelectedSession(null);
              setShowCloseChatModal(false);
            }
          } else {
            setSessions(prev => prev.map(session =>
              session.id === updatedSession.id ? updatedSession : session
            ));

            // Update selected session if it's the one being updated and still active
            if (selectedSession?.id === updatedSession.id) {
              setSelectedSession(updatedSession);
            }
          }
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setSessions(prev => prev.filter(session => session.id !== payload.old.id));

          // Clear selected session if it was deleted
          if (selectedSession?.id === payload.old.id) {
            setSelectedSession(null);
          }
        }
      });
      
      console.log('✅ Real-time sessions subscription established');
    } catch (err) {
      console.error('❌ Failed to setup real-time subscriptions:', err);
      setConnectionStatus('disconnected');
    }
  };

  const setupSessionSubscriptions = () => {
    if (!selectedSession) return;
    
    cleanupSessionSubscriptions();
    
    console.log('🔌 [REALTIME] Setting up session subscriptions for:', selectedSession.id);
    
    try {
      // Messages subscription
      messagesSubscriptionRef.current = ChatService.subscribeToMessages(
        selectedSession.id,
        (payload) => {
          console.log('📨 [REALTIME] Message update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === payload.new.id);
              if (exists) return prev;
              
              const newMessages = [...prev, payload.new].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              
              setTimeout(() => scrollToBottom(), 100);
              return newMessages;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setMessages(prev => prev.map(msg => 
              msg.id === payload.new.id ? payload.new : msg
            ));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      );

      // Participants subscription
      participantsSubscriptionRef.current = ChatService.subscribeToParticipants(
        selectedSession.id,
        (payload) => {
          console.log('👥 [REALTIME] Participants update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            setParticipants(prev => {
              const exists = prev.some(p => p.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setParticipants(prev => prev.map(p => 
              p.id === payload.new.id ? payload.new : p
            ));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      );
      
      console.log('✅ Session subscriptions established');
    } catch (err) {
      console.error('❌ Failed to setup session subscriptions:', err);
    }
  };

  const fetchSessions = async () => {
    if (!restaurant) return;
    
    try {
      setLoading(true);
      setConnectionStatus('connecting');
      const sessionsData = await ChatService.getRestaurantChatSessions(restaurant.id);
      setSessions(sessionsData);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedSession) return;
    
    try {
      console.log('📨 Fetching messages for session:', selectedSession.id);
      const messagesData = await ChatService.getChatMessages(selectedSession.id);
      
      const sortedMessages = messagesData.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      setMessages(sortedMessages);
      console.log('✅ Messages loaded:', sortedMessages.length);
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
    }
  };

  const fetchParticipants = async () => {
    if (!selectedSession) return;
    
    try {
      const participantsData = await ChatService.getChatParticipants(selectedSession.id);
      setParticipants(participantsData);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const fetchQuickResponses = async () => {
    try {
      const responses = await ChatService.getQuickResponses();
      setQuickResponses(responses);
    } catch (error) {
      console.error('Error fetching quick responses:', error);
    }
  };

  const handleCreateSession = async () => {
    if (!restaurant || !user) return;

    try {
      setCreateLoading(true);
      
      if (!newSessionData.title.trim()) {
        alert('Please enter a chat title');
        return;
      }

      const session = await ChatService.createChatSession({
        restaurant_id: restaurant.id,
        title: newSessionData.title,
        priority: newSessionData.priority,
        category: newSessionData.category,
        created_by_user_id: user.id
      });

      // Add restaurant manager as participant
      await ChatService.addParticipant(session.id, {
        user_type: 'restaurant_manager',
        user_id: user.id,
        user_name: user.email?.split('@')[0] || 'Restaurant Manager'
      });

      setNewSessionData({
        title: '',
        priority: 'medium',
        category: 'general'
      });
      setShowCreateSession(false);
      setSelectedSession(session);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create chat session');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedSession || !user || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Optimistic message
    const optimisticMessage: ChatMessage = {
      id: tempId,
      session_id: selectedSession.id,
      sender_type: 'restaurant_manager',
      sender_id: user.id,
      sender_name: user.email?.split('@')[0] || 'Restaurant Manager',
      message: messageText,
      message_type: 'text',
      has_attachments: false,
      is_system_message: false,
      created_at: new Date().toISOString()
    };

    // Add optimistic message to UI
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setSendingMessage(true);
    scrollToBottom();

    try {
      const sentMessage = await ChatService.sendMessage({
        session_id: selectedSession.id,
        sender_type: 'restaurant_manager',
        sender_id: user.id,
        sender_name: user.email?.split('@')[0] || 'Restaurant Manager',
        message: messageText
      });

      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? sentMessage : msg
      ));

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error and restore text
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!selectedSession || !user || files.length === 0) return;

    setUploadingFiles(true);
    try {
      for (const file of Array.from(files)) {
        // Validate file type (only images)
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File ${file.name} is not supported. Only images are allowed.`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large. Maximum size is 5MB.`);
        }

        // Create optimistic message for immediate UI feedback
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMessage: ChatMessage = {
          id: tempId,
          session_id: selectedSession.id,
          sender_type: 'restaurant_manager',
          sender_id: user.id,
          sender_name: user.email?.split('@')[0] || 'Restaurant Manager',
          message: `📷 Shared an image: ${file.name}`,
          message_type: 'image',
          has_attachments: true,
          is_system_message: false,
          created_at: new Date().toISOString()
        };

        // Add optimistic message to UI immediately
        setMessages(prev => [...prev, optimisticMessage]);
        scrollToBottom();

        try {
          // Create actual message
          const message = await ChatService.sendMessage({
            session_id: selectedSession.id,
            sender_type: 'restaurant_manager',
            sender_id: user.id,
            sender_name: user.email?.split('@')[0] || 'Restaurant Manager',
            message: `📷 Shared an image: ${file.name}`,
            message_type: 'image',
            has_attachments: true
          });

          // Upload attachment
          const attachment = await ChatService.uploadAttachment(file, message.id);

          // Update the optimistic message with real data and attachment
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...message, attachments: [attachment] }
              : msg
          ));
        } catch (err) {
          // Remove optimistic message on error
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          throw err;
        }
      }
    } catch (err: any) {
      console.error('Error uploading files:', err);
      alert(err.message || 'Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
        
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleQuickResponse = (response: QuickResponse) => {
    console.log('⚡ Using quick response:', response.title);
    setNewMessage(prev => {
      // If there's already text, add the response on a new line
      const separator = prev.trim() ? '\n\n' : '';
      return prev + separator + response.message;
    });
    setShowQuickResponses(false);
    
    // Focus the input field
    setTimeout(() => {
      const messageInput = document.querySelector('input[placeholder="Type your message..."]') as HTMLInputElement;
      if (messageInput) {
        messageInput.focus();
        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
      }
    }, 100);
  };

  const handleCloseChat = async () => {
    if (!selectedSession || !user) return;

    try {
      setClosingChat(true);
      await ChatService.closeChatSession(
        selectedSession.id, 
        user.email?.split('@')[0] || 'Restaurant Manager'
      );
      
      setShowCloseChatModal(false);
      // Don't clear selected session immediately - let real-time update handle it
    } catch (error) {
      console.error('Error closing chat:', error);
      alert('Failed to close chat');
    } finally {
      setClosingChat(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'resolved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || session.priority === priorityFilter;
    const matchesTab = activeSessionsTab === 'active' 
      ? session.status !== 'closed' 
      : session.status === 'closed';
    
    return matchesSearch && matchesStatus && matchesPriority && matchesTab;
  });

  const activeSessions = sessions.filter(s => s.status === 'active');
  const sessionsWithAgent = sessions.filter(s => s.assigned_agent_name);
  const archivedSessions = sessions.filter(s => s.status === 'closed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Support</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-600">Real-time chat with our support team</p>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500 capitalize">{connectionStatus}</span>
            {!isOnline && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-green-500" />
              <span>{activeSessions.length} active</span>
            </div>
          </div>
          <button
            onClick={fetchSessions}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowCreateSession(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            Start New Chat
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
        {/* Sessions Sidebar */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col">
          {/* Sessions Tab Toggle */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveSessionsTab('active')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeSessionsTab === 'active'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({sessions.filter(s => s.status !== 'closed').length})
              </button>
              <button
                onClick={() => setActiveSessionsTab('archived')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeSessionsTab === 'archived'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Archived ({archivedSessions.length})
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
              >
                <option value="all">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-gray-500">Loading chats...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-4 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No chat sessions found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const hasAgent = session.assigned_agent_name;
                  
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedSession?.id === session.id ? 'bg-gradient-to-r from-[#E6A85C]/10 via-[#E85A9B]/10 to-[#D946EF]/10 border-r-2 border-[#E6A85C]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm truncate">
                            {session.title}
                          </h3>
                          {hasAgent && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              Agent: {session.assigned_agent_name}
                            </p>
                          )}
                          {session.status === 'closed' && (
                            <p className="text-xs text-gray-500 font-medium mt-1">
                              Chat closed
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(session.status)}`}>
                            {session.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(session.priority)}`}>
                          {session.priority}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(session.last_message_at)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl flex flex-col">
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-lg flex items-center justify-center text-white font-bold">
                      {restaurant?.name?.[0] || 'R'}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">{selectedSession.title}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(selectedSession.status)}`}>
                          {selectedSession.status}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(selectedSession.priority)}`}>
                          {selectedSession.priority}
                        </span>
                        {selectedSession.assigned_agent_name && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                            Agent: {selectedSession.assigned_agent_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Participants */}
                    <div className="flex items-center gap-2">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                            participant.user_type === 'support_agent'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            participant.is_online ? 'bg-green-500' : 'bg-gray-400'
                          }`}></div>
                          {participant.user_name}
                        </div>
                      ))}
                    </div>
                    
                    {/* Chat Actions */}
                    {selectedSession.status === 'active' && (
                      <button
                        onClick={() => setShowCloseChatModal(true)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                      >
                        Close Chat
                      </button>
                    )}
                    
                    <button
                      onClick={fetchMessages}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Refresh Messages"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedSession(null);
                        cleanupSessionSubscriptions();
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Closed Notice */}
              {selectedSession.status === 'closed' && (
                <div className="p-4 bg-gray-100 border-b border-gray-200">
                  <div className="flex items-center gap-3 text-center justify-center">
                    <Archive className="h-5 w-5 text-gray-500" />
                    <span className="text-gray-700 font-medium">This chat has been closed</span>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
              >
                {dragOver && (
                  <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center">
                      <Upload className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                      <p className="text-blue-700 font-medium">Drop images to upload</p>
                    </div>
                  </div>
                )}

                {messages.map((message) => {
                  const isPending = message.id.startsWith('temp_');

                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_type === 'restaurant_manager' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md ${
                          message.sender_type === 'restaurant_manager'
                            ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white'
                            : 'bg-white border border-gray-200'
                        } rounded-2xl px-4 py-3 shadow-sm ${isPending ? 'opacity-70' : ''}`}
                      >
                        {message.is_system_message ? (
                          <p className="text-center text-xs text-gray-500 italic">
                            {message.message}
                          </p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs font-medium ${
                                  message.sender_type === 'restaurant_manager' ? 'text-white/80' : 'text-gray-600'
                                }`}
                              >
                                {message.sender_name}
                              </span>
                              <span
                                className={`text-xs ${
                                  message.sender_type === 'restaurant_manager' ? 'text-white/60' : 'text-gray-400'
                                }`}
                              >
                                {formatTime(message.created_at)}
                              </span>
                              {isPending && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                            </div>
                            <p className="text-sm leading-relaxed">{message.message}</p>

                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment) => (
                                  <div key={attachment.id} className="bg-white/10 rounded-lg p-2">
                                    {attachment.file_type.startsWith('image/') ? (
                                      <div className="space-y-2">
                                        <button
                                          onClick={() => {
                                            setPreviewImageUrl(attachment.file_url);
                                            setShowImagePreview(true);
                                          }}
                                          className="block max-w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                        >
                                          <img
                                          src={attachment.file_url}
                                          alt={attachment.file_name}
                                            className="max-w-full h-auto rounded-lg"
                                          style={{ maxHeight: '200px' }}
                                          onError={(e) => {
                                            console.error('❌ Failed to load image:', attachment.file_url);
                                            e.currentTarget.style.display = 'none';
                                          }}
                                          />
                                        </button>
                                        <p className="text-xs opacity-75">{attachment.file_name}</p>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <Paperclip className="h-4 w-4" />
                                        <span className="text-xs">{attachment.file_name}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedSession.status !== 'closed' && (
                <div className="p-4 border-t border-gray-200">
                  {/* Quick Responses */}
                  {showQuickResponses && quickResponses.length > 0 && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Quick Responses</span>
                        <button
                          onClick={() => setShowQuickResponses(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {quickResponses.filter(r => r.is_active).slice(0, 5).map((response) => (
                          <button
                            key={response.id}
                            onClick={() => handleQuickResponse(response)}
                            className="w-full text-left p-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 hover:border-gray-200"
                          >
                            <div className="font-medium text-gray-900 mb-1">{response.title}</div>
                            <div className="text-xs text-gray-600 line-clamp-2">{response.message}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFiles}
                      className="p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Upload image"
                    >
                      {uploadingFiles ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => setShowQuickResponses(!showQuickResponses)}
                      className={`p-3 rounded-lg transition-colors ${
                        showQuickResponses 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Quick responses"
                      style={{ display: 'none' }} // Hide quick responses for restaurant managers
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                    
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !sendingMessage) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                      disabled={sendingMessage}
                    />
                    
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Chat Session</h3>
                <p className="text-gray-500 max-w-sm">
                  Choose a chat session to start or continue the conversation with our support team
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto">
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <MessageSquare className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">
                      {activeSessions.length}
                    </p>
                    <p className="text-xs text-gray-600">Active Chats</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">
                      {sessionsWithAgent.length}
                    </p>
                    <p className="text-xs text-gray-600">With Agent</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Start New Chat</h3>
              <button
                onClick={() => setShowCreateSession(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chat Title *
                </label>
                <input
                  type="text"
                  value={newSessionData.title}
                  onChange={(e) => setNewSessionData({ ...newSessionData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  placeholder="e.g., Help with loyalty program setup"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={newSessionData.priority}
                    onChange={(e) => setNewSessionData({ ...newSessionData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newSessionData.category}
                    onChange={(e) => setNewSessionData({ ...newSessionData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                  >
                    <option value="general">General</option>
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateSession(false)}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={createLoading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Start Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Chat Modal */}
      {showCloseChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Close Chat</h3>
              <button
                onClick={() => setShowCloseChatModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 mb-1">Close this chat?</p>
                    <p className="text-yellow-800 text-sm">
                      This will mark the chat as closed and notify the support team. 
                      You can always start a new chat if you need further assistance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCloseChatModal(false)}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Keep Open
              </button>
              <button
                onClick={handleCloseChat}
                disabled={closingChat}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {closingChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Close Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowImagePreview(false)}
              className="absolute top-4 right-4 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={() => setShowImagePreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
 
export default SupportUI;