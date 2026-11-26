import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
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
    return respond({ error: "Account management is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return respond({ error: "Sign in as an admin to continue." }, 401);
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const authClient = createClient(projectUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return respond({ error: "Sign in as an admin to continue." }, 401);
    }
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (profileError || profile.role !== "admin") {
      return respond({ error: "Admin access is required." }, 403);
    }

    const body = await request.json();
    if (body.action === "list") {
      const { data: accounts, error } = await adminClient
        .from("profiles")
        .select("id, username, created_at")
        .eq("role", "player")
        .order("username");
      if (error) {
        return respond({ error: "Player accounts could not be loaded." }, 500);
      }
      return respond({ accounts });
    }

    if (body.action === "reset-password") {
      const accountId = typeof body.accountId === "string" ? body.accountId : "";
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (!/^[0-9a-f-]{36}$/i.test(accountId) || newPassword.length < 8) {
        return respond({ error: "Provide a valid player account and a password of at least 8 characters." }, 400);
      }
      const { data: target, error: targetError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", accountId)
        .single();
      if (targetError || target.role !== "player") {
        return respond({ error: "That player account could not be found." }, 404);
      }
      const { error } = await adminClient.auth.admin.updateUserById(accountId, {
        password: newPassword
      });
      if (error) {
        return respond({ error: "The password could not be reset." }, 500);
      }
      return respond({ success: true });
    }

    return respond({ error: "Unknown account-management action." }, 400);
  } catch {
    return respond({ error: "Account management failed. Try again." }, 400);
  }
});
