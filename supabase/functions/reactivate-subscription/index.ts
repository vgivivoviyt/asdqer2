import Stripe from "npm:stripe@18.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { subscriptionId, paymentMethodId } = await req.json();

    if (!subscriptionId || !paymentMethodId) {
      throw new Error('Subscription ID and payment method ID are required');
    }

    console.log('🔄 Reactivating subscription:', {
      subscriptionId,
      paymentMethodId: paymentMethodId.substring(0, 10) + '...',
      userId: user.id
    });

    // Get current subscription from database
    const { data: currentSub, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (subError || !currentSub) {
      throw new Error('Subscription not found');
    }

    console.log('📋 Current subscription status:', {
      status: currentSub.status,
      planType: currentSub.plan_type,
      stripeSubscriptionId: currentSub.stripe_subscription_id,
      currentPeriodEnd: currentSub.current_period_end
    });

    // If there's a Stripe subscription ID, update it to resume auto-renewal
    if (currentSub.stripe_subscription_id) {
      console.log('🔄 Updating Stripe subscription to resume auto-renewal...');
      
      // Update the Stripe subscription to resume auto-renewal
      await stripe.subscriptions.update(currentSub.stripe_subscription_id, {
        cancel_at_period_end: false,
        default_payment_method: paymentMethodId,
        metadata: {
          user_id: user.id,
          plan_type: currentSub.plan_type,
          reactivated_at: new Date().toISOString()
        }
      });

      console.log('✅ Stripe subscription updated to resume auto-renewal');
    } else {
      console.log('💰 No Stripe subscription found, creating new subscription for future renewal...');
      
      // Get price ID for the plan type
      const priceMap = {
        monthly: Deno.env.get('STRIPE_MONTHLY_PRICE_ID'),
        semiannual: Deno.env.get('STRIPE_SEMIANNUAL_PRICE_ID'),
        annual: Deno.env.get('STRIPE_ANNUAL_PRICE_ID')
      };

      const priceId = priceMap[currentSub.plan_type as keyof typeof priceMap];
      if (!priceId) {
        throw new Error(`Price ID not configured for plan: ${currentSub.plan_type}`);
      }

      // Create new subscription that starts at the end of current period
      const newSubscription = await stripe.subscriptions.create({
        customer: currentSub.stripe_customer_id,
        items: [{ price: priceId }],
        trial_end: Math.floor(new Date(currentSub.current_period_end).getTime() / 1000),
        default_payment_method: paymentMethodId,
        metadata: {
          user_id: user.id,
          plan_type: currentSub.plan_type,
          reactivated_at: new Date().toISOString()
        }
      });

      console.log('✅ New subscription created for future renewal:', newSubscription.id);

      // Update our database with the new Stripe subscription ID
      await supabaseClient
        .from('subscriptions')
        .update({ 
          stripe_subscription_id: newSubscription.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);
    }

    // Update subscription status to active (but keep current period)
    const { error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({ 
        status: 'active',
        cancel_at_period_end: false,
        scheduled_payment_method_id: paymentMethodId,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Error updating subscription status:', updateError);
      throw new Error('Failed to update subscription status');
    }

    console.log('✅ Subscription reactivated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription reactivated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error reactivating subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});