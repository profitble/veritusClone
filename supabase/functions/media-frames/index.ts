import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Helper to upload to R2
async function uploadToR2(blob: Blob, fileName: string, env: any): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('npm:@aws-sdk/client-s3@3');
  
  const buffer = await blob.arrayBuffer();
  
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  await s3Client.send(new PutObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: fileName,
    Body: new Uint8Array(buffer),
    ContentType: 'image/png',
  }));

  return `${env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`;
}

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
    
    // Get R2 environment variables
    const env = {
      CLOUDFLARE_R2_PUBLIC_URL: Deno.env.get('CLOUDFLARE_R2_PUBLIC_URL') || '',
      CLOUDFLARE_R2_ACCOUNT_ID: Deno.env.get('CLOUDFLARE_R2_ACCOUNT_ID') || '',
      CLOUDFLARE_R2_BUCKET_NAME: Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME') || '',
      CLOUDFLARE_R2_ACCESS_KEY_ID: Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
    };

    // Parse request body
    const body = await req.json();
    const { frames, parentVideoId } = body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No frames provided' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!parentVideoId) {
      return new Response(
        JSON.stringify({ error: 'parentVideoId is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get current max display_order
    const { data: maxOrderData } = await supabase
      .from('media_items')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const startOrder = maxOrderData?.display_order ? maxOrderData.display_order + 1 : 1;

    const frameUrls: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frameDataUrl = frames[i];
      try {
        // Convert data URL to Blob
        let blob: Blob;
        if (frameDataUrl.startsWith('data:')) {
          // Parse data URL directly (data:image/png;base64,...)
          const commaIndex = frameDataUrl.indexOf(',');
          if (commaIndex === -1) {
            throw new Error('Invalid data URL format');
          }
          const base64Data = frameDataUrl.substring(commaIndex + 1);
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          blob = new Blob([bytes], { type: 'image/png' });
        } else {
          // Fallback to fetch for regular URLs
          const response = await fetch(frameDataUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
          }
          blob = await response.blob();
        }

        // Upload to R2
        const cloudflareUrl = await uploadToR2(blob, `frame_${crypto.randomUUID()}.png`, env);

        // Save to DB - check for errors
        const { error: insertError } = await supabase.from('media_items').insert({
          type: 'frame',
          source: 'extracted',
          url: cloudflareUrl,
          parent_video_id: parentVideoId,
          display_order: startOrder + i,
        });

        if (insertError) {
          console.error(`[ERROR] Failed to insert frame ${i + 1}:`, insertError);
          errors.push(`Frame ${i + 1}: ${insertError.message}`);
          throw insertError;
        }

        frameUrls.push(cloudflareUrl);
      } catch (error: any) {
        console.error(`[ERROR] Failed to save frame ${i + 1}:`, error);
        errors.push(`Frame ${i + 1}: ${error.message || error.toString()}`);
        // Continue with other frames even if one fails
      }
    }

    return new Response(
      JSON.stringify({ 
        urls: frameUrls,
        successCount: frameUrls.length,
        totalCount: frames.length,
        errors: errors.length > 0 ? errors : undefined
      }),
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

