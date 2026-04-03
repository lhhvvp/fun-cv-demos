'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEditorStore } from '@/lib/store';
import ClipItem from './ClipItem';
import type { Track as TrackType, Asset, Clip } from '@/lib/types';

interface TrackProps {
  track: TrackType;
  zoom: number;
}

export default function Track({ track, zoom }: TrackProps) {
  const {
    currentProject,
    addClip,
    selectTrack,
    selectedTrackId,
    updateTrack,
    removeTrack,
  } = useEditorStore();

  const [isDragOver, setIsDragOver] = useState(false);

  const isSelected = selectedTrackId === track.id;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const assetData = e.dataTransfer.getData('application/json');
      if (!assetData) return;

      const asset: Asset = JSON.parse(assetData);

      // Validate asset type matches track type
      if (asset.type !== track.type) {
        alert(`Cannot add ${asset.type} to ${track.type} track`);
        return;
      }

      // Calculate drop position based on mouse position
      const trackRect = e.currentTarget.getBoundingClientRect();
      const relativeX = e.clientX - trackRect.left;
      const startTime = Math.max(0, relativeX / zoom);

      // Snap to grid (0.1 second intervals)
      const snappedTime = Math.round(startTime * 10) / 10;

      // Create new clip
      const newClip: Clip = {
        id: uuidv4(),
        assetId: asset.id,
        trackId: track.id,
        startTime: snappedTime,
        duration: asset.duration || 5,
        inPoint: 0,
        outPoint: asset.duration || 5,
      };

      addClip(newClip);
    } catch (error) {
      console.error('Failed to add clip:', error);
    }
  };

  const handleTrackClick = () => {
    selectTrack(track.id);
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTrack(track.id, { muted: !track.muted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    updateTrack(track.id, { volume });
  };

  const handleDeleteTrack = () => {
    if (confirm(`Delete track "${track.name}"?`)) {
      removeTrack(track.id);
    }
  };

  const trackIcon = track.type === 'video' ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div
      className={`flex border-b border-editor-border ${
        isSelected ? 'bg-editor-border' : ''
      }`}
      onClick={handleTrackClick}
    >
      {/* Track Header */}
      <div className="w-48 flex-shrink-0 bg-editor-panel border-r border-editor-border p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className={track.type === 'video' ? 'text-clip-video' : 'text-clip-audio'}>
            {trackIcon}
          </div>
          <span className="text-sm font-medium flex-1 truncate">{track.name}</span>
          <button
            onClick={handleDeleteTrack}
            className="text-gray-400 hover:text-red-400 text-xs"
            title="Delete track"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleMuteToggle}
            className={`text-xs px-2 py-1 rounded ${
              track.muted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            {track.muted ? 'M' : 'S'}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={track.volume || 1}
            onChange={handleVolumeChange}
            className="flex-1 h-1"
            disabled={track.muted}
            title="Volume"
          />

          <span className="text-xs text-gray-400 w-8">
            {Math.round((track.volume || 1) * 100)}%
          </span>
        </div>
      </div>

      {/* Track Content Area */}
      <div
        className={`flex-1 relative h-20 ${
          isDragOver ? 'bg-blue-900/30' : 'bg-track-bg'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Clips */}
        {track.clips.map((clip) => {
          const asset = currentProject?.assets.find(a => a.id === clip.assetId);
          if (!asset) return null;

          return (
            <ClipItem
              key={clip.id}
              clip={clip}
              asset={asset}
              zoom={zoom}
            />
          );
        })}

        {/* Drop hint */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center text-blue-300 text-sm pointer-events-none">
            Drop {track.type} here
          </div>
        )}
      </div>
    </div>
  );
}
