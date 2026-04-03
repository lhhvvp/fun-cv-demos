'use client';

import { useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEditorStore } from '@/lib/store';
import Track from './Track';

export default function Timeline() {
  const {
    currentProject,
    zoom,
    setZoom,
    playheadPosition,
    seek,
    addTrack,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  // Sync ruler scroll with timeline scroll
  useEffect(() => {
    const timeline = timelineRef.current;
    const ruler = rulerRef.current;

    if (!timeline || !ruler) return;

    const handleScroll = () => {
      ruler.scrollLeft = timeline.scrollLeft;
    };

    timeline.addEventListener('scroll', handleScroll);
    return () => timeline.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;

    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
    const time = x / zoom;

    seek(time);
  };

  const handleAddTrack = (type: 'video' | 'audio') => {
    const trackNumber = currentProject?.tracks.filter(t => t.type === type).length || 0;

    addTrack({
      id: uuidv4(),
      type,
      name: `${type === 'video' ? 'Video' : 'Audio'} ${trackNumber + 1}`,
      clips: [],
      volume: 1,
      muted: false,
    });
  };

  const handleZoomIn = () => setZoom(zoom * 1.2);
  const handleZoomOut = () => setZoom(zoom / 1.2);

  // Calculate timeline width based on project duration
  const timelineWidth = (currentProject?.duration || 60) * zoom;

  // Generate ruler marks
  const renderRuler = () => {
    const duration = currentProject?.duration || 60;
    const marks = [];

    for (let i = 0; i <= duration; i++) {
      const isMajor = i % 5 === 0;

      marks.push(
        <div
          key={i}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${i * zoom}px` }}
        >
          <div
            className={`${
              isMajor ? 'h-4 bg-gray-400' : 'h-2 bg-gray-600'
            } w-px`}
          />
          {isMajor && (
            <span className="text-xs text-gray-400 mt-1">
              {Math.floor(i / 60)}:{(i % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      );
    }

    return marks;
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-timeline-bg text-gray-400">
        <p>No project loaded</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-timeline-bg">
      {/* Timeline Controls */}
      <div className="h-10 bg-editor-panel border-b border-editor-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Timeline</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-gray-400 w-16 text-center">
            {zoom.toFixed(0)}px/s
          </span>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title="Zoom in"
          >
            +
          </button>

          <div className="w-px h-6 bg-editor-border mx-2" />

          <button
            onClick={() => handleAddTrack('video')}
            className="px-3 py-1 text-xs bg-clip-video hover:bg-clip-video/80 rounded"
          >
            + Video Track
          </button>
          <button
            onClick={() => handleAddTrack('audio')}
            className="px-3 py-1 text-xs bg-clip-audio hover:bg-clip-audio/80 rounded"
          >
            + Audio Track
          </button>
        </div>
      </div>

      {/* Timeline Ruler */}
      <div className="relative">
        <div className="flex">
          {/* Ruler header spacer */}
          <div className="w-48 flex-shrink-0 h-12 bg-editor-panel border-r border-editor-border" />

          {/* Ruler */}
          <div
            ref={rulerRef}
            className="flex-1 h-12 bg-editor-panel overflow-x-hidden cursor-pointer relative"
            onClick={handleRulerClick}
          >
            <div
              className="relative h-full"
              style={{ width: `${timelineWidth}px` }}
            >
              {renderRuler()}
            </div>
          </div>
        </div>

        {/* Playhead (absolute positioned over everything) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-playhead pointer-events-none z-10"
          style={{ left: `${48 * 4 + playheadPosition * zoom}px` }} // 48px = track header width (in rem equivalent)
        >
          <div className="absolute -left-1.5 top-0 w-3 h-3 bg-playhead" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
        </div>
      </div>

      {/* Tracks Container */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-auto timeline-scroll"
      >
        <div style={{ minWidth: `${timelineWidth + 192}px` }}> {/* 192px = 48rem (track header width) */}
          {currentProject.tracks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p>Add a track to get started</p>
            </div>
          ) : (
            currentProject.tracks.map((track) => (
              <Track key={track.id} track={track} zoom={zoom} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
