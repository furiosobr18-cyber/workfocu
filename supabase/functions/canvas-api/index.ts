import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateApiKey(apiKey: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const keyHash = await hashKey(apiKey);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, permissions, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) return null;

  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyData = await authenticateApiKey(apiKey);
    if (!keyData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = keyData.user_id;
    const permissions = keyData.permissions as string[];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected: /canvas-api/documents or /canvas-api/documents/:id
    const resource = pathParts[1]; // "documents"
    const resourceId = pathParts[2]; // optional UUID

    if (resource !== "documents") {
      return new Response(
        JSON.stringify({ error: "Unknown resource. Use /canvas-api/documents" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET - List or get single document
    if (req.method === "GET") {
      if (!permissions.includes("canvas:read")) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions: canvas:read required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (resourceId) {
        const { data, error } = await supabase
          .from("canvas_documents")
          .select("*")
          .eq("id", resourceId)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: "Document not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("canvas_documents")
        .select("id, name, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Create document
    if (req.method === "POST") {
      if (!permissions.includes("canvas:write")) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions: canvas:write required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { data, error } = await supabase
        .from("canvas_documents")
        .insert({
          user_id: userId,
          name: body.name || "Untitled Canvas",
          content: body.content || null,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT - Update document
    if (req.method === "PUT" || req.method === "PATCH") {
      if (!permissions.includes("canvas:write")) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions: canvas:write required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!resourceId) {
        return new Response(
          JSON.stringify({ error: "Document ID required: /canvas-api/documents/:id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.content !== undefined) updateData.content = body.content;

      const { data, error } = await supabase
        .from("canvas_documents")
        .update(updateData)
        .eq("id", resourceId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Document not found or update failed" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE
    if (req.method === "DELETE") {
      if (!permissions.includes("canvas:delete")) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions: canvas:delete required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!resourceId) {
        return new Response(
          JSON.stringify({ error: "Document ID required: /canvas-api/documents/:id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("canvas_documents")
        .delete()
        .eq("id", resourceId)
        .eq("user_id", userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("canvas-api error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
