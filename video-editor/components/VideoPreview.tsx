'use client';

import { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '@/lib/store';

export default function VideoPreview() {
  const {
    currentProject,
    playheadPosition,
    isPlaying,
  } = useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const renderLoopRef = useRef<number | null>(null);
  const lastDrawTimeRef = useRef<number>(0);

  // Find the active video clip at current playhead position
  const getActiveVideoClip = () => {
    if (!currentProject) return null;

    const videoTracks = currentProject.tracks.filter(t => t.type === 'video' && !t.muted);

    // Find the topmost video clip at playhead position
    for (const track of videoTracks) {
      for (const clip of track.clips) {
        if (
          playheadPosition >= clip.startTime &&
          playheadPosition < clip.startTime + clip.duration
        ) {
          const asset = currentProject.assets.find(a => a.id === clip.assetId);
          return { clip, asset };
        }
      }
    }

    return null;
  };

  // Draw frame to canvas
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeClip = getActiveVideoClip();

    if (!activeClip || !activeClip.asset) {
      return;
    }

    const video = videoRefs.current.get(activeClip.asset.id);

    if (!video || video.readyState < 2) {
      return;
    }

    // Draw video frame (scaled to fit)
    const scale = Math.min(
      canvas.width / video.videoWidth,
      canvas.height / video.videoHeight
    );

    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    ctx.drawImage(video, x, y, width, height);
  };

  // Continuous render loop - runs always, draws based on current state
  useEffect(() => {
    const render = () => {
      const now = performance.now();

      // Draw at ~30fps to reduce CPU usage
      if (now - lastDrawTimeRef.current > 33) {
        drawFrame();
        lastDrawTimeRef.current = now;
      }

      renderLoopRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (renderLoopRef.current !== null) {
        cancelAnimationFrame(renderLoopRef.current);
      }
    };
  }, []); // Empty deps - this runs once and continuously

  // Manage video elements and their playback state
  useEffect(() => {
    const activeClip = getActiveVideoClip();

    // Pause all videos first
    videoRefs.current.forEach(video => {
      if (!video.paused) {
        video.pause();
      }
    });

    if (!activeClip || !activeClip.asset) {
      return;
    }

    const { clip, asset } = activeClip;

    // Get or create video element for this asset
    let video = videoRefs.current.get(asset.id);

    if (!video) {
      video = document.createElement('video');
      video.src = asset.url;
      video.muted = true;
      video.preload = 'auto';
      video.playsInline = true;

      // Store the video element
      videoRefs.current.set(asset.id, video);

      // Wait for video to be loaded
      video.addEventListener('loadedmetadata', () => {
        console.log('Video loaded:', asset.filename);
      });

      video.addEventListener('error', (e) => {
        console.error('Video load error:', asset.filename, e);
      });
    }

    // Calculate time within the clip
    const relativeTime = playheadPosition - clip.startTime;
    const assetTime = clip.inPoint + relativeTime;

    // Update video currentTime
    const timeDiff = Math.abs(video.currentTime - assetTime);

    if (timeDiff > 0.05) {
      video.currentTime = assetTime;
    }

    // Control playback
    if (isPlaying) {
      // Make sure video is playing
      if (video.paused) {
        const playPromise = video.play();

        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.error('Play failed:', err);
          });
        }
      }
    } else {
      // Make sure video is paused
      if (!video.paused) {
        video.pause();
      }
    }
  }, [playheadPosition, isPlaying, currentProject]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center relative">
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="max-w-full max-h-full"
        style={{ aspectRatio: '16/9' }}
      />

      {/* Overlay info */}
      <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded text-xs">
        <div className="text-gray-300">
          Time: {formatTime(playheadPosition)}
        </div>
        {currentProject && (
          <div className="text-gray-400 mt-1">
            {currentProject.name}
          </div>
        )}
        <div className="text-gray-500 text-[10px] mt-1">
          {isPlaying ? 'Playing' : 'Paused'}
        </div>
      </div>

      {!currentProject && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <p>No project loaded</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);

  return `${mins}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
}
