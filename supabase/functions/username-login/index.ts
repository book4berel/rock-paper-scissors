import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!projectUrl || !serviceRoleKey || !anonKey) {
    return respond({ error: "Authentication service is not configured." }, 500);
  }

  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[a-z0-9_-]{3,24}$/.test(username) || !password) {
      return respond({ error: "Incorrect username or password." }, 401);
    }

    const adminClient = createClient(projectUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (profileError || !profile) {
      return respond({ error: "Incorrect username or password." }, 401);
    }

    const { data: account, error: accountError } = await adminClient.auth.admin.getUserById(profile.id);
    if (accountError || !account.user?.email) {
      return respond({ error: "Incorrect username or password." }, 401);
    }

    const authClient = createClient(projectUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: account.user.email,
      password
    });
    if (error || !data.session) {
      return respond({ error: "Incorrect username or password." }, 401);
    }

    return respond({ session: data.session });
  } catch {
    return respond({ error: "Unable to sign in. Try again." }, 400);
  }
});
