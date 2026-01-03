import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Helper to delete from R2 using AWS Signature V4
async function deleteFromR2(url: string, env: any): Promise<void> {
  const publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL || '';
  if (!url.startsWith(publicUrl)) {
    // Not an R2 URL, skip deletion
    return;
  }

  const key = url.replace(publicUrl + '/', '');
  const bucketName = env.CLOUDFLARE_R2_BUCKET_NAME;
  const endpoint = `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  
  // Use AWS SDK for Deno-compatible approach
  // Import AWS SDK functions dynamically
  try {
    // Use the AWS SDK v3 for S3 operations
    const { S3Client, DeleteObjectCommand } = await import('npm:@aws-sdk/client-s3@3');
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
  } catch (error) {
    console.error(`[ERROR] Failed to delete R2 file ${url}:`, error);
    // Continue even if deletion fails
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
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

    if (req.method === 'GET') {
      // GET: Fetch all media items
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: corsHeaders }
      );
    }

    if (req.method === 'DELETE') {
      // DELETE: Delete all media items and their R2 files
      
      // Fetch all media items first to get URLs for R2 deletion
      const { data: mediaItems, error: fetchError } = await supabase
        .from('media_items')
        .select('url, source');

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Delete files from R2 (only for uploaded/extracted items, not Instagram URLs)
      if (mediaItems) {
        for (const item of mediaItems) {
          // Only delete from R2 if it's not an Instagram URL
          if (item.source !== 'instagram' && item.url) {
            try {
              await deleteFromR2(item.url, env);
            } catch (error: any) {
              console.error(`[ERROR] Failed to delete R2 file ${item.url}:`, error);
              // Continue with other deletions even if one fails
            }
          }
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('media_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using neq to match all rows)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[ERROR] Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

