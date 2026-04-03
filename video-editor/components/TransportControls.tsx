'use client';

import { useEffect, useState, useRef } from 'react';
import { useEditorStore } from '@/lib/store';
import type { ExportJob } from '@/lib/types';

export default function TransportControls() {
  const {
    currentProject,
    isPlaying,
    playheadPosition,
    play,
    pause,
    seek,
  } = useEditorStore();

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'completed' | 'error'>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Playback loop - update playhead position when playing
  useEffect(() => {
    if (!isPlaying || !currentProject) {
      // Clean up animation frame if stopped
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Reset timing on play start
    lastUpdateTimeRef.current = performance.now();
    const maxDuration = currentProject.duration || 60;

    const updatePlayhead = (timestamp: number) => {
      const deltaTime = (timestamp - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = timestamp;

      const newPosition = playheadPosition + deltaTime;

      if (newPosition >= maxDuration) {
        pause();
        seek(maxDuration);
        return;
      }

      seek(newPosition, true); // Pass true to keep playing during playback
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, currentProject]); // Removed playheadPosition from deps

  // Poll export status
  useEffect(() => {
    if (!currentJobId || exportStatus === 'completed' || exportStatus === 'error') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/export?id=${currentJobId}`);
        const result = await response.json();

        if (result.success && result.data) {
          const job: ExportJob = result.data;

          setExportProgress(job.progress);

          if (job.status === 'completed') {
            setExportStatus('completed');
            setExportUrl(job.outputUrl || null);
            setCurrentJobId(null);
          } else if (job.status === 'failed') {
            setExportStatus('error');
            setExportError(job.error || 'Export failed');
            setCurrentJobId(null);
          }
        }
      } catch (error) {
        console.error('Failed to check export status:', error);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [currentJobId, exportStatus]);

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleStop = () => {
    pause();
    seek(0);
  };

  const handleExport = async () => {
    if (!currentProject) {
      alert('No project to export');
      return;
    }

    // Validate project has clips
    const hasClips = currentProject.tracks.some(track => track.clips.length > 0);
    if (!hasClips) {
      alert('Project has no clips to export');
      return;
    }

    setExportStatus('exporting');
    setExportProgress(0);
    setExportUrl(null);
    setExportError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: currentProject,
          settings: {
            format: 'mp4',
            videoCodec: 'h264',
            audioCodec: 'aac',
            videoBitrate: '5000k',
            audioBitrate: '192k',
            fps: 30,
          },
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setCurrentJobId(result.data.id);
      } else {
        setExportStatus('error');
        setExportError(result.error || 'Failed to start export');
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setExportError(error instanceof Error ? error.message : 'Export failed');
    }
  };

  const handleDownload = () => {
    if (exportUrl) {
      const a = document.createElement('a');
      a.href = exportUrl;
      a.download = `${currentProject?.name || 'export'}.mp4`;
      a.click();
    }
  };

  const handleResetExport = () => {
    setExportStatus('idle');
    setExportProgress(0);
    setExportUrl(null);
    setExportError(null);
    setCurrentJobId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-16 bg-editor-panel border-t border-editor-border flex items-center justify-between px-6">
      {/* Playback Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleStop}
          disabled={!currentProject}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title="Stop"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <rect x="5" y="5" width="10" height="10" />
          </svg>
        </button>

        <button
          onClick={handlePlayPause}
          disabled={!currentProject}
          className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 4h3v12H6V4zm5 0h3v12h-3V4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 4l10 6-10 6V4z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div className="text-sm font-mono">
          {formatTime(playheadPosition)} / {formatTime(currentProject?.duration || 0)}
        </div>
      </div>

      {/* Export Controls */}
      <div className="flex items-center gap-3">
        {exportStatus === 'idle' && (
          <button
            onClick={handleExport}
            disabled={!currentProject}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
          >
            Export Video
          </button>
        )}

        {exportStatus === 'exporting' && (
          <div className="flex items-center gap-3">
            <div className="w-48 h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">
              Exporting... {exportProgress.toFixed(0)}%
            </span>
          </div>
        )}

        {exportStatus === 'completed' && exportUrl && (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-500">Export complete!</span>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
            >
              Download
            </button>
            <button
              onClick={handleResetExport}
              className="px-3 py-2 text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {exportStatus === 'error' && (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-500">{exportError || 'Export failed'}</span>
            <button
              onClick={handleResetExport}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
