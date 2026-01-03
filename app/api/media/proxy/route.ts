import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Extract key from R2 URL
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
    if (!url.startsWith(publicUrl)) {
      // Not an R2 URL, proxy it directly
      const response = await fetch(url);
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
      }
      const blob = await response.blob();
      return new NextResponse(blob, {
        headers: {
          'Content-Type': blob.type || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Extract key from R2 URL
    const key = url.replace(publicUrl + '/', '');

    // Fetch from R2
    const command = new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Stream the response directly instead of buffering
    const body = response.Body;
    
    let readableStream: ReadableStream<Uint8Array>;
    
    if (body instanceof Readable) {
      // Node.js Readable stream - convert to Web ReadableStream
      readableStream = new ReadableStream({
        async start(controller) {
          try {
      for await (const chunk of body) {
              controller.enqueue(new Uint8Array(Buffer.from(chunk)));
      }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    } else if (body && typeof body === 'object' && 'getReader' in body) {
      // Already a ReadableStream - use directly
      readableStream = body as unknown as ReadableStream<Uint8Array>;
      } else {
      // Fallback: buffer and convert (slower but safe)
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as any) {
          chunks.push(Buffer.from(chunk));
        }
    const buffer = Buffer.concat(chunks);
    return new NextResponse(buffer, {
        headers: {
          'Content-Type': response.ContentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return new NextResponse(readableStream as any, {
      headers: {
        'Content-Type': response.ContentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[ERROR] Failed to proxy image:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}

