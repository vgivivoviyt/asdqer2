import { createClient } from "npm:@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateAgentRequest {
  name: string;
  email: string;
  password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { name, email, password }: CreateAgentRequest = await req.json();

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    console.log('👤 Creating support agent via Supabase Auth:', email);

    // Create user in Supabase Auth with proper support role in both metadata fields
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name,
        role: 'support'
      },
      app_metadata: {
        role: 'support'
      },
      email_confirm: true // Auto-confirm email for support agents
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log('✅ Auth user created:', authUser.user.id);

    // Insert into public.users table with support role (this will be synced automatically by trigger)
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        role: 'support',
        user_metadata: {
          name,
          role: 'support'
        }
      });

    if (usersError && usersError.code !== '23505') {
      console.error('❌ Error inserting into users table:', usersError);
      throw new Error(`Failed to create user record: ${usersError.message}`);
    }

    console.log('✅ Public users record created');

    // Insert into support_agents table (now with FK to public.users)
    const { error: agentsError } = await supabaseAdmin
      .from('support_agents')
      .insert({
        id: authUser.user.id,
        name,
        email,
        role: 'support_agent',
        is_active: true
      });

    if (agentsError) {
      console.error('❌ Error inserting into support_agents table:', agentsError);
      // Clean up auth user if support_agents insertion fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create support agent record: ${agentsError.message}`);
    }

    console.log('✅ Support agent created successfully via Supabase Auth');

    return new Response(
      JSON.stringify({
        id: authUser.user.id,
        name,
        email,
        role: 'support_agent',
        is_active: true,
        created_at: authUser.user.created_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error creating support agent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});