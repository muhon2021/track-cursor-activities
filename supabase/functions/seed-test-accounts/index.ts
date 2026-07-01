import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEST_ACCOUNTS = [
  { email: 'ceo@collabai.software', password: 'Demo@123', agencyRole: 'owner', appRole: 'admin', isEosUser: true },
  { email: 'demo@collabai.software', password: 'Demo@123', agencyRole: 'pm', appRole: 'user', isEosUser: false },
  { email: 'ic@collabai.software', password: 'Demo@123', agencyRole: 'ic', appRole: 'user', isEosUser: false },
  { email: 'bd@collabai.software', password: 'Demo@123', agencyRole: 'bd', appRole: 'user', isEosUser: false },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify caller is admin
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: Array<{ email: string; status: string; userId?: string; error?: string }> = []

    for (const acct of TEST_ACCOUNTS) {
      try {
        // Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existing = existingUsers?.users?.find((u: { email?: string }) => u.email === acct.email)

        let userId: string

        if (existing) {
          userId = existing.id
          // Update password in case it changed
          await supabase.auth.admin.updateUserById(userId, { password: acct.password })
          results.push({ email: acct.email, status: 'exists', userId })
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: acct.email,
            password: acct.password,
            email_confirm: true,
            user_metadata: { full_name: acct.email.split('@')[0].replace(/\./g, ' ').replace(/^./, c => c.toUpperCase()) },
          })
          if (createError) throw createError
          userId = newUser.user.id
          results.push({ email: acct.email, status: 'created', userId })
        }

        // Ensure profile exists
        await supabase.from('profiles').upsert({
          id: userId,
          email: acct.email,
          full_name: acct.email.split('@')[0].replace(/\./g, ' ').replace(/^./, c => c.toUpperCase()),
        }, { onConflict: 'id' })

        // Set agency role preference
        await supabase.from('user_role_preferences').upsert({
          user_id: userId,
          role: acct.appRole,
          agency_role: acct.agencyRole,
          is_eos_user: acct.isEosUser,
        }, { onConflict: 'user_id,role' })

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        results.push({ email: acct.email, status: 'error', error: message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('seed-test-accounts error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
