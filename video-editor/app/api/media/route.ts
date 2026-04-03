/**
 * API route for serving media files
 * GET /api/media?path=uploads/video-xxx.mp4
 *
 * In production, this should be replaced with:
 * - Direct S3/GCS signed URLs
 * - CDN for better performance
 * - Proper caching headers
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getFullPath, fileExists } from '@/lib/storage';

// Configure route segment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return new NextResponse('Path parameter is required', { status: 400 });
    }

    // Security: prevent directory traversal
    if (relativePath.includes('..')) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    // Check if file exists
    const exists = await fileExists(relativePath);
    if (!exists) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Read file
    const fullPath = getFullPath(relativePath);
    const fileBuffer = await fs.readFile(fullPath);

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Failed to serve media:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
