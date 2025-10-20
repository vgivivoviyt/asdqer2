
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supportSupabase as supabase } from '../lib/supportSupabase';
import { ChatService, SupportAgent } from '../services/chatService';

interface SupportAuthContextType {
  agent: SupportAgent | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const SupportAuthContext = createContext<SupportAuthContextType | undefined>(undefined);

export const useSupportAuth = () => {
  const context = useContext(SupportAuthContext);
  if (context === undefined) {
    throw new Error('useSupportAuth must be used within a SupportAuthProvider');
  }
  return context;
};

export const SupportAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agent, setAgent] = useState<SupportAgent | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const agentData = localStorage.getItem('support_agent_data');
        const loginTime = localStorage.getItem('support_agent_login_time');

        if (agentData && loginTime) {
          const loginDate = new Date(loginTime);
          const now = new Date();
          const hoursSinceLogin =
            (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLogin < 24) {
            const parsedAgent: SupportAgent = JSON.parse(agentData);

            if (parsedAgent?.email) {
              setAgent(parsedAgent);
              console.log('🔐 [SUPPORT AUTH] Restored agent session:', parsedAgent.email);

              // Restore DB context
              await ChatService.setSupportAgentContext(parsedAgent.email);
            } else {
              console.warn('⚠️ [SUPPORT AUTH] Stored agent data invalid, clearing...');
              localStorage.removeItem('support_agent_data');
              localStorage.removeItem('support_agent_login_time');
            }
          } else {
            console.log('⏰ [SUPPORT AUTH] Session expired, clearing...');
            localStorage.removeItem('support_agent_data');
            localStorage.removeItem('support_agent_login_time');
          }
        }
      } catch (error) {
        console.error('❌ [SUPPORT AUTH] Error restoring session:', error);
        localStorage.removeItem('support_agent_data');
        localStorage.removeItem('support_agent_login_time');
      } finally {
        setLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 [SUPPORT AUTH] Starting Supabase Auth for:', email);

      // Use Supabase Auth for authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('❌ [SUPPORT AUTH] Supabase Auth error:', authError);
        if (authError.message === 'Invalid login credentials') {
          return { error: 'Invalid email or password. Please check your credentials.' };
        }
        return { error: authError.message };
      }

      if (!authData.user) {
        console.log('❌ [SUPPORT AUTH] No user returned from auth');
        return { error: 'Authentication failed' };
      }

      console.log('🔐 [SUPPORT AUTH] Supabase Auth successful:', authData.user.id);

      // Verify this is a support agent using the proper FK relationship
      console.log('🔍 [SUPPORT AUTH] Verifying support agent status...');
      
      // Check both auth metadata and database record
      const metadataRole = authData.user.user_metadata?.role;
      const appMetadataRole = authData.user.app_metadata?.role;
      
      console.log('🔍 [SUPPORT AUTH] Auth metadata roles:', {
        userMetadataRole: metadataRole,
        appMetadataRole: appMetadataRole
      });
      
      // Get user and support agent data using the new public.users FK relationship
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id, 
          email, 
          role, 
          user_metadata,
          support_agents!inner (
            name,
            is_active,
            last_login_at
          )
        `)
        .eq('id', authData.user.id)
        .eq('role', 'support')
        .maybeSingle();

      if (userError || !userData) {
        console.error('❌ [SUPPORT AUTH] User is not a support agent or public.users FK relationship missing:', userError);
        await supabase.auth.signOut(); // Sign out if not a support agent
        return { error: 'Access denied - not a support agent or account not properly configured. Please contact your administrator.' };
      }

      console.log('✅ [SUPPORT AUTH] Support agent verified via public.users FK relationship');
      
      // Extract support agent data from the joined query
      const agentData = userData.support_agents;

      if (!agentData || !agentData.is_active) {
        console.error('❌ [SUPPORT AUTH] Agent not found or inactive');
        await supabase.auth.signOut();
        return { error: 'Account inactive or not found' };
      }

      const authenticatedAgent: SupportAgent = {
        id: userData.id,
        name: agentData.name || userData.user_metadata?.name || 'Support Agent',
        email: userData.email,
        role: 'support_agent',
        is_active: agentData.is_active,
        created_at: authData.user.created_at,
        updated_at: agentData.last_login_at || new Date().toISOString(),
        password_hash: '' // Not needed for auth users
      };
      
      console.log('✅ [SUPPORT AUTH] Agent authenticated via Supabase Auth:', {
        id: authenticatedAgent.id,
        name: authenticatedAgent.name,
        email: authenticatedAgent.email
      });

      // Update last login time
      await supabase
        .from('support_agents')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', authenticatedAgent.id);
      setAgent(authenticatedAgent);
      localStorage.setItem('support_agent_data', JSON.stringify(authenticatedAgent));
      localStorage.setItem('support_agent_login_time', new Date().toISOString());

      // Set database context for RLS
      await ChatService.setSupportAgentContext(authenticatedAgent.email);

      return { error: null };
    } catch (err: any) {
      console.error('❌ [SUPPORT AUTH] Sign in error:', err);
      return { error: err.message || 'Authentication failed' };
    }
  };

  const signOut = () => {
    console.log('🔐 [SUPPORT AUTH] Signing out agent:', agent?.email);
    // Sign out from Supabase Auth
    supabase.auth.signOut();
    setAgent(null);
    localStorage.removeItem('support_agent_data');
    localStorage.removeItem('support_agent_login_time');
  };

  const value = {
    agent,
    loading,
    signIn,
    signOut,
  };

  return (
    <SupportAuthContext.Provider value={value}>
      {children}
    </SupportAuthContext.Provider>
  );
};
