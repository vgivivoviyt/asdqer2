import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
// ⚠️ IMPORTANT: Pick ONE client and stick to it everywhere in your app
import { supabase } from '../lib/supabase'; 
// If this is the support portal, instead do:
// import { supportSupabase as supabase } from '../lib/supportSupabase';

import { SubscriptionService } from '../services/subscriptionService';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  settings: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurant: Restaurant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata: {
    firstName: string;
    lastName: string;
    restaurantName: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (err) {
        console.error('💥 Error in initSession:', err);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setRestaurant(null);
      return;
    }

    // Skip restaurant if support agent
    const role = user.user_metadata?.role ?? user.app_metadata?.role ?? null;
    if (role === 'support') {
      setRestaurant(null);
      return;
    }

    fetchRestaurant(user.id);
  }, [user]);

  // 🔄 subscription updates without reload
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      if (user) {
        setTimeout(() => {
          SubscriptionService.createSubscription(user.id, 'refresh')
            .catch(console.warn);
        }, 1000);
      }
    };
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, [user]);

  const fetchRestaurant = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, settings')
        .eq('owner_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching restaurant:', error);
        return createDefaultRestaurant(userId);
      }

      if (data) {
        setRestaurant(data);
      } else {
        createDefaultRestaurant(userId);
      }
    } catch (err) {
      console.error('💥 Error in fetchRestaurant:', err);
      createDefaultRestaurant(userId);
    }
  };

  const createDefaultRestaurant = async (userId: string) => {
    try {
      const { data: existing } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      if (existing) {
        setRestaurant(existing);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const restaurantName = user?.user_metadata?.restaurant_name || 'My Restaurant';
      const slug = `${restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 8)}`;

      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .insert({
          name: restaurantName,
          owner_id: userId,
          slug,
          settings: {
            points_per_dollar: 1,
            referral_bonus: 50,
            pointValueAED: 0.05,
            blanketMode: { enabled: true, type: 'manual', manualSettings: { pointsPerAED: 0.1 } },
            tier_thresholds: { silver: 500, gold: 1000 },
            loyalty_program: {
              name: 'Loyalty Program',
              description: 'Earn points with every purchase and redeem for rewards!'
            }
          }
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating restaurant:', error);
        return;
      }

      setRestaurant(restaurant);
    } catch (err) {
      console.error('💥 Error creating default restaurant:', err);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === 'Invalid login credentials') {
          return { error: 'Incorrect email or password. Please try again.' };
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    metadata: { firstName: string; lastName: string; restaurantName: string }
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: metadata.firstName, last_name: metadata.lastName, restaurant_name: metadata.restaurantName } }
      });
      if (error) return { error: error.message };

      if (data.user) {
        setTimeout(() => {
          SubscriptionService.createSubscription(data.user!.id, 'trial').catch(console.warn);
        }, 100);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setRestaurant(null);
    const { error } = await supabase.auth.signOut();
    if (error) console.error('❌ Supabase sign out error:', error);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const value = { user, session, restaurant, loading, signIn, signUp, signOut, resetPassword };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
