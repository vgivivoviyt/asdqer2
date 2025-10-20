import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CampaignRequest {
  campaignId: string;
  testMode?: boolean;
  testPhoneNumber?: string;
  testEmail?: string;
}

interface ProviderConfig {
  channel: string;
  provider: string;
  api_key_encrypted: string;
  config_json: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { campaignId, testMode = false, testPhoneNumber, testEmail }: CampaignRequest = await req.json();

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        restaurant:restaurants!inner(
          id,
          name,
          owner_id
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.restaurant.owner_id !== user.id) {
      throw new Error('Unauthorized to send this campaign');
    }

    const { data: messages } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId);

    if (!messages || messages.length === 0) {
      throw new Error('No messages found for campaign');
    }

    let targetCustomers = [];
    
    if (testMode) {
      const { data: testCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', campaign.restaurant_id)
        .limit(1)
        .single();
      
      if (testCustomer) {
        targetCustomers = [{
          ...testCustomer,
          phone: testPhoneNumber || testCustomer.phone,
          email: testEmail || testCustomer.email,
        }];
      }
    } else {
      targetCustomers = await calculateAudience(supabase, campaign);
    }

    const { data: providerConfig } = await supabase
      .from('channel_provider_configs')
      .select('*')
      .eq('restaurant_id', campaign.restaurant_id)
      .eq('channel', campaign.primary_channel)
      .eq('is_enabled', true)
      .single();

    if (!providerConfig) {
      throw new Error(`No provider configured for ${campaign.primary_channel}`);
    }

    const results = {
      total: targetCustomers.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const customer of targetCustomers) {
      try {
        const { data: consent } = await supabase
          .from('customer_consent')
          .select('*')
          .eq('customer_id', customer.id)
          .eq('restaurant_id', campaign.restaurant_id)
          .single();

        const hasConsent = consent && consent[campaign.primary_channel] === true;
        
        if (!hasConsent && !testMode) {
          results.skipped++;
          continue;
        }

        const message = messages[0];
        const personalizedMessage = personalizeMessage(
          message.message_template,
          customer,
          message.variables
        );

        const sendResult = await sendMessage(
          campaign.primary_channel,
          providerConfig,
          customer,
          personalizedMessage,
          message.subject
        );

        if (sendResult.success) {
          results.sent++;
          
          await supabase.from('campaign_sends').insert({
            campaign_id: campaignId,
            customer_id: customer.id,
            channel: campaign.primary_channel,
            status: 'delivered',
            sent_at: new Date().toISOString(),
          });
        } else {
          results.failed++;
          
          await supabase.from('campaign_sends').insert({
            campaign_id: campaignId,
            customer_id: customer.id,
            channel: campaign.primary_channel,
            status: 'failed',
            error_message: sendResult.error,
            sent_at: new Date().toISOString(),
          });
        }
      } catch (error: any) {
        console.error(`Error sending to customer ${customer.id}:`, error);
        results.failed++;
      }
    }

    if (!testMode) {
      await supabase
        .from('campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      await supabase.from('campaign_metrics').upsert({
        campaign_id: campaignId,
        total_targeted: results.total,
        total_sent: results.sent,
        total_failed: results.failed,
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        testMode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Campaign send error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send campaign',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function calculateAudience(supabase: any, campaign: any) {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('restaurant_id', campaign.restaurant_id);

  if (campaign.audience_type === 'tagged' && campaign.audience_filter.tags) {
    query = query.in('id', 
      supabase
        .from('customer_tag_assignments')
        .select('customer_id')
        .in('tag_id', campaign.audience_filter.tags)
    );
  } else if (campaign.audience_type === 'last_order_date') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (campaign.audience_filter.days_since_last_order || 30));
    query = query.lt('last_order_date', cutoffDate.toISOString());
  } else if (campaign.audience_type === 'wallet_status') {
    if (campaign.audience_filter.min_points) {
      query = query.gte('points_balance', campaign.audience_filter.min_points);
    }
    if (campaign.audience_filter.max_points) {
      query = query.lte('points_balance', campaign.audience_filter.max_points);
    }
  }

  const { data } = await query;
  return data || [];
}

function personalizeMessage(template: string, customer: any, variables: any) {
  let message = template;
  message = message.replace(/\{\{name\}\}/g, customer.name || 'Customer');
  message = message.replace(/\{\{points\}\}/g, customer.points_balance?.toString() || '0');
  
  Object.keys(variables).forEach(key => {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), variables[key]);
  });
  
  return message;
}

async function sendMessage(
  channel: string,
  providerConfig: ProviderConfig,
  customer: any,
  message: string,
  subject?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (channel === 'whatsapp') {
      return await sendWhatsApp(providerConfig, customer.phone, message);
    } else if (channel === 'sms') {
      return await sendSMS(providerConfig, customer.phone, message);
    } else if (channel === 'email') {
      return await sendEmail(providerConfig, customer.email, subject || 'Message from restaurant', message);
    } else if (channel === 'push') {
      return { success: true };
    }
    
    return { success: false, error: 'Unsupported channel' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendWhatsApp(config: ProviderConfig, to: string, message: string) {
  if (config.provider === 'twilio') {
    const accountSid = config.config_json.accountSid;
    const authToken = config.api_key_encrypted;
    const from = config.config_json.phoneNumber;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${from}`,
          To: `whatsapp:${to}`,
          Body: message,
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  }
  
  return { success: false, error: 'Provider not supported' };
}

async function sendSMS(config: ProviderConfig, to: string, message: string) {
  if (config.provider === 'twilio') {
    const accountSid = config.config_json.accountSid;
    const authToken = config.api_key_encrypted;
    const from = config.config_json.phoneNumber;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: from,
          To: to,
          Body: message,
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  }
  
  return { success: false, error: 'Provider not supported' };
}

async function sendEmail(config: ProviderConfig, to: string, subject: string, message: string) {
  if (config.provider === 'sendgrid') {
    const apiKey = config.api_key_encrypted;
    const from = config.config_json.fromEmail;
    const fromName = config.config_json.fromName;

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: fromName },
        subject: subject,
        content: [{ type: 'text/plain', value: message }],
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  }
  
  return { success: false, error: 'Provider not supported' };
}
