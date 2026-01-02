import { supabase } from "@/integrations/supabase/client";

interface SecurityLogParams {
  event_type: 'login_attempt' | 'login_success' | 'login_failure' | 'signup' | 'password_reset' | 'logout';
  email?: string;
  metadata?: Record<string, unknown>;
}

// Simple hash function - not cryptographic, just for obscuring email in logs
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function logSecurityEvent({ event_type, email, metadata }: SecurityLogParams): Promise<{ rate_limited: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('security-log', {
      body: {
        event_type,
        email_hash: email ? hashString(email.toLowerCase().trim()) : undefined,
        user_agent: navigator.userAgent,
        metadata,
      },
    });

    if (error) {
      console.error('Security log error:', error);
      return { rate_limited: false };
    }

    return { rate_limited: data?.rate_limited || false };
  } catch (error) {
    console.error('Security log error:', error);
    return { rate_limited: false };
  }
}

export async function checkRateLimit(email: string): Promise<boolean> {
  const { rate_limited } = await logSecurityEvent({
    event_type: 'login_attempt',
    email,
  });
  return rate_limited;
}
