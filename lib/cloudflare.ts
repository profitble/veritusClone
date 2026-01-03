import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToR2(file: File | Blob, fileName?: string): Promise<string> {
  const key = fileName || `${uuidv4()}.${file.type.split('/')[1] || 'bin'}`;
  const buffer = await file.arrayBuffer();

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: file.type,
  }));

  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(url: string): Promise<void> {
  // Extract key from R2 URL: https://{account}.r2.cloudflarestorage.com/{bucket}/{key}
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
  if (!url.startsWith(publicUrl)) {
    // Not an R2 URL, skip deletion
    return;
  }

  const key = url.replace(publicUrl + '/', '');
  
  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
  }));
}

