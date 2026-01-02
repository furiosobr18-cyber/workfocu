import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SecurityLogRequest {
  event_type: 'login_attempt' | 'login_success' | 'login_failure' | 'signup' | 'password_reset' | 'logout';
  email_hash?: string;
  user_agent?: string;
  ip_hint?: string;
  metadata?: Record<string, unknown>;
}

// Simple hash function for email (for logging without exposing actual email)
function hashEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SecurityLogRequest = await req.json();
    const { event_type, email_hash, user_agent, ip_hint, metadata } = body;

    // Rate limiting check - max 10 attempts per email hash per minute
    if (email_hash && (event_type === 'login_attempt' || event_type === 'login_failure')) {
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      
      const { count } = await supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('email_hash', email_hash)
        .in('event_type', ['login_attempt', 'login_failure'])
        .gte('created_at', oneMinuteAgo);

      if (count && count >= 10) {
        console.log(`Rate limit exceeded for hash: ${email_hash}`);
        return new Response(
          JSON.stringify({ 
            error: "Too many attempts", 
            rate_limited: true,
            retry_after: 60 
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Log the security event
    const { error: logError } = await supabase
      .from('security_logs')
      .insert({
        event_type,
        email_hash,
        user_agent: user_agent?.substring(0, 500),
        ip_hint: ip_hint?.substring(0, 50),
        metadata,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error("Error logging security event:", logError);
    } else {
      console.log(`Security event logged: ${event_type}`);
    }

    return new Response(
      JSON.stringify({ success: true, rate_limited: false }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in security-log function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
