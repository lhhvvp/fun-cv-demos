/**
 * Core TypeScript types for the video editor
 * These types define the data model for assets, clips, tracks, and projects
 */

export type AssetType = 'video' | 'audio';

/**
 * Represents a media file uploaded by the user
 */
export interface Asset {
  id: string;
  type: AssetType;
  filename: string;    // Original filename
  path: string;        // Server file path (relative to uploads/)
  url: string;         // Public URL to access the file
  duration?: number;   // Duration in seconds (for video/audio)
  width?: number;      // Video width (for video only)
  height?: number;     // Video height (for video only)
  size: number;        // File size in bytes
  createdAt: string;   // ISO timestamp
}

export type TrackType = 'video' | 'audio';

/**
 * Represents a clip on the timeline
 * A clip is a portion of an asset placed at a specific time
 */
export interface Clip {
  id: string;
  assetId: string;     // Reference to the source asset
  trackId: string;     // Which track this clip belongs to
  startTime: number;   // Where the clip starts on the timeline (seconds)
  duration: number;    // How long the clip is visible on timeline (seconds)
  inPoint: number;     // Trim point - where to start in the source asset (seconds)
  outPoint: number;    // Trim point - where to end in the source asset (seconds)
}

/**
 * Represents a track on the timeline
 * Tracks can be either video or audio and contain multiple clips
 */
export interface Track {
  id: string;
  type: TrackType;
  name: string;
  clips: Clip[];
  muted?: boolean;     // Whether the track is muted
  volume?: number;     // Track volume (0-1, default 1)
}

/**
 * Represents a complete video editing project
 */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: Asset[];
  tracks: Track[];
  duration?: number;   // Total project duration (derived from tracks)
  fps?: number;        // Frames per second (default 30)
}

/**
 * Export job status
 */
export type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Represents an export job
 */
export interface ExportJob {
  id: string;
  projectId: string;
  status: ExportStatus;
  progress: number;    // 0-100
  outputPath?: string; // Path to the exported file
  outputUrl?: string;  // Public URL to download
  error?: string;      // Error message if failed
  createdAt: string;
  completedAt?: string;
}

/**
 * Export settings
 */
export interface ExportSettings {
  format: 'mp4' | 'webm';
  videoCodec: 'h264' | 'vp9';
  audioCodec: 'aac' | 'opus';
  videoBitrate?: string; // e.g., "5000k"
  audioBitrate?: string; // e.g., "192k"
  resolution?: {
    width: number;
    height: number;
  };
  fps?: number;
}

/**
 * Editor state (managed by Zustand)
 */
export interface EditorState {
  // Current project
  currentProject: Project | null;

  // Playback state
  isPlaying: boolean;
  playheadPosition: number; // Current time in seconds

  // Selection state
  selectedClipId: string | null;
  selectedTrackId: string | null;

  // UI state
  zoom: number; // Timeline zoom level (pixels per second)

  // Actions
  setProject: (project: Project | null) => void;
  updateProject: (updates: Partial<Project>) => void;

  // Asset actions
  addAsset: (asset: Asset) => void;
  removeAsset: (assetId: string) => void;

  // Track actions
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // Clip actions
  addClip: (clip: Clip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  trimClip: (clipId: string, newInPoint: number, newOutPoint: number) => void;

  // Playback actions
  play: () => void;
  pause: () => void;
  seek: (time: number, keepPlaying?: boolean) => void;

  // Selection actions
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;

  // UI actions
  setZoom: (zoom: number) => void;
}

/**
 * Helper type for API responses
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
