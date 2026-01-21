import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://id-preview--96bb0f33-bb8a-4e3b-bb68-7fe910560fd1.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

// Function to get CORS headers with origin validation
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface SecurityLogRequest {
  event_type: 'login_attempt' | 'login_success' | 'login_failure' | 'signup' | 'password_reset' | 'logout';
  email_hash?: string;
  user_agent?: string;
  ip_hint?: string;
  metadata?: Record<string, unknown>;
}

// Validate event_type is one of the allowed values
function isValidEventType(type: string): type is SecurityLogRequest['event_type'] {
  return ['login_attempt', 'login_success', 'login_failure', 'signup', 'password_reset', 'logout'].includes(type);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log("Security log request rejected: Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create client with user's auth token to verify their identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log("Security log request rejected: Invalid token", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate request body size (max 10KB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10240) {
      return new Response(
        JSON.stringify({ error: "Request too large" }),
        {
          status: 413,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const body: SecurityLogRequest = await req.json();
    const { event_type, email_hash, user_agent, ip_hint, metadata } = body;

    // Validate event_type
    if (!event_type || !isValidEventType(event_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid event_type" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

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
        console.log(`Rate limit exceeded for authenticated user`);
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
        email_hash: email_hash?.substring(0, 100), // Limit hash length
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
