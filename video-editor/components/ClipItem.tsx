'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/lib/store';
import type { Clip, Asset } from '@/lib/types';

interface ClipItemProps {
  clip: Clip;
  asset: Asset;
  zoom: number; // pixels per second
}

export default function ClipItem({ clip, asset, zoom }: ClipItemProps) {
  const {
    selectedClipId,
    selectClip,
    updateClip,
    removeClip,
    moveClip,
  } = useEditorStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, time: 0 });

  const clipRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedClipId === clip.id;

  // Calculate clip position and width
  const left = clip.startTime * zoom;
  const width = clip.duration * zoom;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // Don't start drag if clicking on resize handles
    if ((e.target as HTMLElement).classList.contains('clip-handle')) {
      return;
    }

    selectClip(clip.id);
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      time: clip.startTime,
    });
  };

  const handleResizeLeftStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
    setIsResizingLeft(true);
    setDragStart({
      x: e.clientX,
      time: clip.inPoint,
    });
  };

  const handleResizeRightStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
    setIsResizingRight(true);
    setDragStart({
      x: e.clientX,
      time: clip.outPoint,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaTime = deltaX / zoom;
        const newStartTime = Math.max(0, dragStart.time + deltaTime);

        // Snap to grid (0.1 second intervals)
        const snappedTime = Math.round(newStartTime * 10) / 10;

        if (snappedTime !== clip.startTime) {
          moveClip(clip.id, snappedTime);
        }
      } else if (isResizingLeft) {
        const deltaX = e.clientX - dragStart.x;
        const deltaTime = deltaX / zoom;
        const newInPoint = Math.max(0, Math.min(dragStart.time + deltaTime, clip.outPoint - 0.1));

        // Snap to grid
        const snappedInPoint = Math.round(newInPoint * 10) / 10;

        if (snappedInPoint !== clip.inPoint) {
          const newDuration = clip.outPoint - snappedInPoint;
          const newStartTime = clip.startTime + (snappedInPoint - clip.inPoint);

          updateClip(clip.id, {
            inPoint: snappedInPoint,
            duration: newDuration,
            startTime: newStartTime,
          });
        }
      } else if (isResizingRight) {
        const deltaX = e.clientX - dragStart.x;
        const deltaTime = deltaX / zoom;
        const maxOutPoint = asset.duration || clip.outPoint;
        const newOutPoint = Math.max(clip.inPoint + 0.1, Math.min(dragStart.time + deltaTime, maxOutPoint));

        // Snap to grid
        const snappedOutPoint = Math.round(newOutPoint * 10) / 10;

        if (snappedOutPoint !== clip.outPoint) {
          const newDuration = snappedOutPoint - clip.inPoint;

          updateClip(clip.id, {
            outPoint: snappedOutPoint,
            duration: newDuration,
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isDragging || isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isDragging ? 'grabbing' : 'ew-resize';
      document.body.classList.add('no-select');

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.classList.remove('no-select');
      };
    }
  }, [isDragging, isResizingLeft, isResizingRight, dragStart, zoom, clip, updateClip, moveClip, asset.duration]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this clip?')) {
      removeClip(clip.id);
    }
  };

  const bgColor = asset.type === 'video' ? 'bg-clip-video' : 'bg-clip-audio';

  return (
    <div
      ref={clipRef}
      className={`clip-item absolute h-full rounded cursor-move ${bgColor} ${
        isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-track-bg' : ''
      }`}
      style={{
        left: `${left}px`,
        width: `${Math.max(width, 20)}px`, // Minimum width for visibility
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Left resize handle */}
      <div
        className="clip-handle absolute left-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-white/60"
        onMouseDown={handleResizeLeftStart}
      />

      {/* Clip content */}
      <div className="h-full flex items-center justify-between px-2 text-xs overflow-hidden">
        <span className="truncate font-medium">{asset.filename}</span>
        {isSelected && (
          <button
            onClick={handleDelete}
            className="ml-1 hover:text-red-300 flex-shrink-0"
            title="Delete clip"
          >
            ×
          </button>
        )}
      </div>

      {/* Right resize handle */}
      <div
        className="clip-handle absolute right-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-white/60"
        onMouseDown={handleResizeRightStart}
      />

      {/* Waveform/thumbnail placeholder */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  );
}
