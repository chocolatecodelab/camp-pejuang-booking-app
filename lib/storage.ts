// ============================================================
// Supabase Storage helpers
// ============================================================

import { supabaseAdmin } from '@/lib/supabase/server';

const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const CAMP_ASSETS_BUCKET = 'camp-assets';

/**
 * Upload payment proof to private bucket.
 * Returns the file path within the bucket.
 */
export async function uploadPaymentProof(
  bookingId: string,
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const timestamp = Date.now();
  const filePath = `${bookingId}/${timestamp}-${fileName}`;

  let { error } = await supabaseAdmin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(filePath, file, {
      contentType,
      upsert: false,
    });

  // Self-healing: Auto-create bucket if not found
  if (error && error.message.includes('Bucket not found')) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(PAYMENT_PROOFS_BUCKET, {
      public: false, // Private bucket for security
      fileSizeLimit: 5 * 1024 * 1024,
    });

    if (!createError) {
      const retry = await supabaseAdmin.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .upload(filePath, file, {
          contentType,
          upsert: false,
        });
      error = retry.error;
    }
  }

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`);
  }

  return filePath;
}

/**
 * Generate a temporary signed URL for admin to view payment proof.
 * URL expires after the specified seconds (default 5 minutes).
 */
export async function getPaymentProofSignedUrl(
  filePath: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Gagal generate signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Upload camp/room photo to public bucket.
 * Returns the public URL.
 */
export async function uploadCampAsset(
  campId: string,
  subPath: string, // e.g. "cover.jpg" or "rooms/{roomId}/1.jpg"
  file: Buffer,
  contentType: string
): Promise<string> {
  const filePath = `${campId}/${subPath}`;

  let { error } = await supabaseAdmin.storage
    .from(CAMP_ASSETS_BUCKET)
    .upload(filePath, file, {
      contentType,
      upsert: true,
    });

  // Self-healing: Auto-create bucket if not found
  if (error && error.message.includes('Bucket not found')) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(CAMP_ASSETS_BUCKET, {
      public: true, // Public bucket for assets
    });

    if (!createError) {
      const retry = await supabaseAdmin.storage
        .from(CAMP_ASSETS_BUCKET)
        .upload(filePath, file, {
          contentType,
          upsert: true,
        });
      error = retry.error;
    }
  }

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(CAMP_ASSETS_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Delete a file from storage.
 */
export async function deleteStorageFile(
  bucket: string,
  filePath: string
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    console.error(`Delete file gagal: ${error.message}`);
  }
}
