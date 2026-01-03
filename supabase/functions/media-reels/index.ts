import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { url, thumbnail_url, caption, instagram_id, source } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if video already exists
    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('url', url)
      .eq('type', 'video')
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ id: existing.id }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get current max display_order
    const { data: maxOrderData } = await supabase
      .from('media_items')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const displayOrder = maxOrderData?.display_order ? maxOrderData.display_order + 1 : 1;

    // Create new video record
    const { data, error } = await supabase
      .from('media_items')
      .insert({
        type: 'video',
        source: source || 'upload',
        url,
        thumbnail_url,
        caption,
        instagram_id,
        display_order: displayOrder,
      })
      .select('id')
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ id: data.id }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[ERROR] Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

