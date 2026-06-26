import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Production-safe file upload for React Native + Supabase Storage.
 *
 * Works with:
 * - file:// URIs
 * - content:// URIs
 * - Android + iOS
 */
export async function uploadFileToSupabase(params: {
  fileUri: string;
  bucket: string;
  path: string;
  mimeType: string;
  upsert?: boolean;
}): Promise<UploadResult> {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(params.fileUri, {
      encoding: 'base64',
    });

    // Decode base64 → Uint8Array
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);

    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(params.bucket)
      .upload(params.path, bytes, {
        contentType: params.mimeType,
        upsert: params.upsert ?? false,
      });

    if (error || !data) {
      return {
        url: null,
        error: error?.message ?? 'Upload failed.',
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(params.bucket)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      error: null,
    };

  } catch (err: any) {
    return {
      url: null,
      error: err?.message ?? 'Could not read or upload file.',
    };
  }
}

/** Detect MIME type from URI */
export function mimeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';

  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'gif') return 'image/gif';

  return 'image/jpeg';
}