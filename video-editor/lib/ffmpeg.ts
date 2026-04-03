/**
 * FFmpeg utilities for video rendering and export
 *
 * PREREQUISITES:
 * - FFmpeg must be installed on the server
 * - Install on Ubuntu/Debian: sudo apt-get install ffmpeg
 * - Install on macOS: brew install ffmpeg
 * - Install on Windows: Download from https://ffmpeg.org/download.html
 *
 * TODO for production:
 * - Implement queue system for export jobs (Bull, BullMQ)
 * - Add progress tracking via FFmpeg stderr parsing
 * - Implement job cancellation
 * - Add resource limits and timeout handling
 * - Consider using dedicated encoding servers
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getFullPath, getExportsDir } from './storage';
import type { Project, Track, Clip, ExportSettings } from './types';

/**
 * Default export settings
 */
const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  videoBitrate: '5000k',
  audioBitrate: '192k',
  fps: 30,
};

/**
 * Get media duration using ffprobe
 * @param filePath - Path to media file
 * @returns Duration in seconds
 */
export async function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        reject(new Error('Failed to get media duration'));
      }
    });

    ffprobe.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get video metadata using ffprobe
 * @param filePath - Path to video file
 * @returns Object with width, height, duration
 */
export async function getVideoMetadata(filePath: string): Promise<{
  width: number;
  height: number;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration',
      '-of', 'json',
      filePath,
    ]);

    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          const stream = data.streams[0];

          resolve({
            width: stream.width || 1920,
            height: stream.height || 1080,
            duration: parseFloat(stream.duration) || 0,
          });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Failed to get video metadata'));
      }
    });

    ffprobe.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Build FFmpeg filter complex for timeline rendering
 * This is the core function that translates our timeline into FFmpeg filters
 */
function buildFilterComplex(
  project: Project,
  videoTracks: Track[],
  audioTracks: Track[]
): { filterComplex: string; inputFiles: string[] } {
  const inputFiles: string[] = [];
  const filterParts: string[] = [];

  // Map of clip ID to input index
  const clipInputMap = new Map<string, number>();

  // Collect all unique assets used in clips and create input mappings
  const allClips: Clip[] = [];
  [...videoTracks, ...audioTracks].forEach(track => {
    allClips.push(...track.clips);
  });

  allClips.forEach(clip => {
    if (!clipInputMap.has(clip.id)) {
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (asset) {
        clipInputMap.set(clip.id, inputFiles.length);
        inputFiles.push(getFullPath(asset.path));
      }
    }
  });

  // Process video tracks
  const videoOutputs: string[] = [];

  videoTracks.forEach((track, trackIndex) => {
    if (track.clips.length === 0) return;

    // Sort clips by start time
    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

    sortedClips.forEach((clip, clipIndex) => {
      const inputIndex = clipInputMap.get(clip.id);
      if (inputIndex === undefined) return;

      const outputLabel = `v${trackIndex}_${clipIndex}`;

      // Trim the clip (setpts resets timestamps after trim)
      filterParts.push(
        `[${inputIndex}:v]trim=start=${clip.inPoint}:end=${clip.outPoint},setpts=PTS-STARTPTS,` +
        `setpts=PTS+${clip.startTime}/TB[${outputLabel}]`
      );

      videoOutputs.push(outputLabel);
    });
  });

  // Overlay all video clips
  let videoOutput = '';
  if (videoOutputs.length > 0) {
    // Create black background
    filterParts.push(`color=c=black:s=1920x1080:d=${project.duration || 60}[base]`);

    let currentOutput = 'base';
    videoOutputs.forEach((label, index) => {
      const nextOutput = index === videoOutputs.length - 1 ? 'vout' : `vtmp${index}`;
      filterParts.push(`[${currentOutput}][${label}]overlay=enable='between(t,0,${project.duration || 60})'[${nextOutput}]`);
      currentOutput = nextOutput;
    });

    videoOutput = '[vout]';
  }

  // Process audio tracks
  const audioOutputs: string[] = [];

  audioTracks.forEach((track, trackIndex) => {
    if (track.clips.length === 0 || track.muted) return;

    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

    sortedClips.forEach((clip, clipIndex) => {
      const inputIndex = clipInputMap.get(clip.id);
      if (inputIndex === undefined) return;

      const outputLabel = `a${trackIndex}_${clipIndex}`;

      // Trim audio and adjust delay
      filterParts.push(
        `[${inputIndex}:a]atrim=start=${clip.inPoint}:end=${clip.outPoint},asetpts=PTS-STARTPTS,` +
        `adelay=${clip.startTime * 1000}|${clip.startTime * 1000}[${outputLabel}]`
      );

      audioOutputs.push(outputLabel);
    });
  });

  // Mix all audio streams
  let audioOutput = '';
  if (audioOutputs.length > 0) {
    filterParts.push(`${audioOutputs.map(l => `[${l}]`).join('')}amix=inputs=${audioOutputs.length}[aout]`);
    audioOutput = '[aout]';
  }

  const filterComplex = filterParts.join(';');

  return { filterComplex, inputFiles };
}

/**
 * Export project to video file
 * @param project - Project to export
 * @param settings - Export settings
 * @param onProgress - Progress callback (0-100)
 * @returns Path to exported file
 */
export async function exportProject(
  project: Project,
  settings: Partial<ExportSettings> = {},
  onProgress?: (progress: number) => void
): Promise<string> {
  const exportSettings = { ...DEFAULT_EXPORT_SETTINGS, ...settings };

  // Separate video and audio tracks
  const videoTracks = project.tracks.filter(t => t.type === 'video');
  const audioTracks = project.tracks.filter(t => t.type === 'audio');

  // Build filter complex
  const { filterComplex, inputFiles } = buildFilterComplex(project, videoTracks, audioTracks);

  // If no clips, create a simple black video
  if (inputFiles.length === 0) {
    throw new Error('Project has no clips to export');
  }

  // Output file path
  const outputFilename = `export-${project.id}-${Date.now()}.${exportSettings.format}`;
  const outputPath = path.join(getExportsDir(), outputFilename);

  // Build FFmpeg command
  const args: string[] = [];

  // Add input files
  inputFiles.forEach(file => {
    args.push('-i', file);
  });

  // Add filter complex
  if (filterComplex) {
    args.push('-filter_complex', filterComplex);
  }

  // Map outputs
  args.push('-map', '[vout]');
  if (audioTracks.some(t => t.clips.length > 0 && !t.muted)) {
    args.push('-map', '[aout]');
  }

  // Video codec settings
  args.push(
    '-c:v', exportSettings.videoCodec === 'h264' ? 'libx264' : 'libvpx-vp9',
    '-b:v', exportSettings.videoBitrate!,
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p'
  );

  // Audio codec settings (if audio exists)
  if (audioTracks.some(t => t.clips.length > 0 && !t.muted)) {
    args.push(
      '-c:a', exportSettings.audioCodec === 'aac' ? 'aac' : 'libopus',
      '-b:a', exportSettings.audioBitrate!
    );
  }

  // Frame rate
  args.push('-r', String(exportSettings.fps || 30));

  // Duration
  args.push('-t', String(project.duration || 60));

  // Output file
  args.push('-y', outputPath);

  console.log('FFmpeg command:', 'ffmpeg', args.join(' '));

  // Execute FFmpeg
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();

      // Parse progress from stderr
      // FFmpeg outputs progress like: frame= 123 fps=30 ...
      const match = stderr.match(/frame=\s*(\d+)/);
      if (match && onProgress) {
        const currentFrame = parseInt(match[1]);
        const totalFrames = (project.duration || 60) * (exportSettings.fps || 30);
        const progress = Math.min(100, (currentFrame / totalFrames) * 100);
        onProgress(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        console.error('FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Check if FFmpeg is installed
 * @returns True if FFmpeg is available
 */
export async function checkFFmpegInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}
