/**
 * API route for handling file uploads
 * POST /api/upload
 *
 * Accepts multipart/form-data with a file field
 * Returns the created Asset object
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveUploadedFile, getPublicUrl, getFileSize } from '@/lib/storage';
import { getMediaDuration, getVideoMetadata } from '@/lib/ffmpeg';
import type { Asset, ApiResponse } from '@/lib/types';

// Configure route segment to handle large files
export const maxDuration = 60; // Max execution time in seconds
export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No file provided',
      }, { status: 400 });
    }

    // Validate file type
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/mp3'];

    const isVideo = validVideoTypes.includes(file.type);
    const isAudio = validAudioTypes.includes(file.type);

    if (!isVideo && !isAudio) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid file type. Supported: MP4, WebM, MOV, AVI, MP3, WAV, AAC, OGG',
      }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save file
    const { filename, path, fullPath } = await saveUploadedFile(buffer, file.name);

    // Get file metadata
    let duration: number | undefined;
    let width: number | undefined;
    let height: number | undefined;

    try {
      if (isVideo) {
        const metadata = await getVideoMetadata(fullPath);
        duration = metadata.duration;
        width = metadata.width;
        height = metadata.height;
      } else if (isAudio) {
        duration = await getMediaDuration(fullPath);
      }
    } catch (error) {
      console.error('Failed to get media metadata:', error);
      // Continue without metadata
    }

    // Create asset object
    const asset: Asset = {
      id: uuidv4(),
      type: isVideo ? 'video' : 'audio',
      filename: file.name,
      path,
      url: getPublicUrl(path),
      duration,
      width,
      height,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<Asset>>({
      success: true,
      data: asset,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    }, { status: 500 });
  }
}
