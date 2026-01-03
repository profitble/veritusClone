import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Helper to upload to R2
async function uploadToR2(file: File, fileName: string | undefined, env: any): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('npm:@aws-sdk/client-s3@3');
  const { randomUUID } = await import('npm:uuid@10');
  
  const key = fileName || `${randomUUID()}.${file.type.split('/')[1] || 'bin'}`;
  const buffer = await file.arrayBuffer();
  
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
    Key: key,
    Body: new Uint8Array(buffer),
    ContentType: file.type,
  }));

  return `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
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

    // Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Upload to R2
    const url = await uploadToR2(file, undefined, env);

    // Get current max display_order
    const { data: maxOrderData } = await supabase
      .from('media_items')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const displayOrder = maxOrderData?.display_order ? maxOrderData.display_order + 1 : 1;

    // Insert into database
    await supabase.from('media_items').insert({
      type: file.type.startsWith('video') ? 'video' : 'photo',
      source: 'upload',
      url,
      display_order: displayOrder,
    });

    return new Response(
      JSON.stringify({ url }),
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

