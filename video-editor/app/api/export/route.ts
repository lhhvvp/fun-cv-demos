/**
 * API route for exporting projects to video
 * POST /api/export - Start an export job
 * GET /api/export?id=xxx - Check export status
 *
 * TODO for production:
 * - Implement job queue (Bull/BullMQ)
 * - Store job status in database
 * - Add WebSocket for real-time progress updates
 * - Implement job cancellation
 * - Add cleanup for old export files
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { exportProject, checkFFmpegInstalled } from '@/lib/ffmpeg';
import { getPublicUrl } from '@/lib/storage';
import type { Project, ExportJob, ExportSettings, ApiResponse } from '@/lib/types';

// Configure route segment for long-running exports
export const maxDuration = 300; // 5 minutes max for export
export const dynamic = 'force-dynamic';

// In-memory job storage (TODO: replace with database)
const exportJobs = new Map<string, ExportJob>();

/**
 * POST - Start export job
 */
export async function POST(request: NextRequest) {
  try {
    // Check if FFmpeg is installed
    const ffmpegInstalled = await checkFFmpegInstalled();
    if (!ffmpegInstalled) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'FFmpeg is not installed on the server. Please install FFmpeg to use export functionality.',
      }, { status: 500 });
    }

    const body = await request.json();
    const project: Project = body.project;
    const settings: Partial<ExportSettings> = body.settings || {};

    if (!project || !project.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid project data',
      }, { status: 400 });
    }

    // Validate that project has clips
    const hasClips = project.tracks.some(track => track.clips.length > 0);
    if (!hasClips) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Project has no clips to export',
      }, { status: 400 });
    }

    // Create export job
    const job: ExportJob = {
      id: uuidv4(),
      projectId: project.id,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
    };

    exportJobs.set(job.id, job);

    // Start export in background
    exportProject(
      project,
      settings,
      (progress) => {
        // Update job progress
        const currentJob = exportJobs.get(job.id);
        if (currentJob) {
          currentJob.progress = Math.round(progress);
          exportJobs.set(job.id, currentJob);
        }
      }
    )
      .then((outputPath) => {
        // Export completed
        const currentJob = exportJobs.get(job.id);
        if (currentJob) {
          currentJob.status = 'completed';
          currentJob.progress = 100;
          currentJob.outputPath = outputPath;
          currentJob.outputUrl = getPublicUrl(outputPath);
          currentJob.completedAt = new Date().toISOString();
          exportJobs.set(job.id, currentJob);
        }
      })
      .catch((error) => {
        // Export failed
        const currentJob = exportJobs.get(job.id);
        if (currentJob) {
          currentJob.status = 'failed';
          currentJob.error = error instanceof Error ? error.message : 'Export failed';
          exportJobs.set(job.id, currentJob);
        }
        console.error('Export failed:', error);
      });

    return NextResponse.json<ApiResponse<ExportJob>>({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Failed to start export:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start export',
    }, { status: 500 });
  }
}

/**
 * GET - Check export status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Job ID is required',
      }, { status: 400 });
    }

    const job = exportJobs.get(jobId);

    if (!job) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Export job not found',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<ExportJob>>({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Failed to get export status:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get export status',
    }, { status: 500 });
  }
}
