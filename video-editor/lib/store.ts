/**
 * Zustand store for managing editor state
 * This is the single source of truth for the application state
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  EditorState,
  Project,
  Asset,
  Track,
  Clip,
} from './types';

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  currentProject: null,
  isPlaying: false,
  playheadPosition: 0,
  selectedClipId: null,
  selectedTrackId: null,
  zoom: 50, // 50 pixels per second

  // Project actions
  setProject: (project: Project | null) => {
    set({
      currentProject: project,
      playheadPosition: 0,
      selectedClipId: null,
      selectedTrackId: null,
    });
  },

  updateProject: (updates: Partial<Project>) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  // Asset actions
  addAsset: (asset: Asset) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        assets: [...current.assets, asset],
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeAsset: (assetId: string) => {
    const current = get().currentProject;
    if (!current) return;

    // Remove asset and all clips using this asset
    const updatedTracks = current.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.assetId !== assetId),
    }));

    set({
      currentProject: {
        ...current,
        assets: current.assets.filter(a => a.id !== assetId),
        tracks: updatedTracks,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  // Track actions
  addTrack: (track: Track) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: [...current.tracks, track],
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeTrack: (trackId: string) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: current.tracks.filter(t => t.id !== trackId),
        updatedAt: new Date().toISOString(),
      },
      selectedTrackId: get().selectedTrackId === trackId ? null : get().selectedTrackId,
    });
  },

  updateTrack: (trackId: string, updates: Partial<Track>) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: current.tracks.map(track =>
          track.id === trackId ? { ...track, ...updates } : track
        ),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  // Clip actions
  addClip: (clip: Clip) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: current.tracks.map(track =>
          track.id === clip.trackId
            ? { ...track, clips: [...track.clips, clip] }
            : track
        ),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeClip: (clipId: string) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: current.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(c => c.id !== clipId),
        })),
        updatedAt: new Date().toISOString(),
      },
      selectedClipId: get().selectedClipId === clipId ? null : get().selectedClipId,
    });
  },

  updateClip: (clipId: string, updates: Partial<Clip>) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: current.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          ),
        })),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => {
    const current = get().currentProject;
    if (!current) return;

    // Find the clip
    let targetClip: Clip | null = null;
    let sourceTrackId: string | null = null;

    for (const track of current.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        targetClip = clip;
        sourceTrackId = track.id;
        break;
      }
    }

    if (!targetClip || !sourceTrackId) return;

    const finalTrackId = newTrackId || sourceTrackId;

    // Update tracks
    const updatedTracks = current.tracks.map(track => {
      if (track.id === sourceTrackId) {
        // Remove clip from source track
        return {
          ...track,
          clips: track.clips.filter(c => c.id !== clipId),
        };
      }
      return track;
    }).map(track => {
      if (track.id === finalTrackId) {
        // Add clip to target track with new position
        return {
          ...track,
          clips: [
            ...track.clips,
            {
              ...targetClip,
              trackId: finalTrackId,
              startTime: Math.max(0, newStartTime),
            },
          ],
        };
      }
      return track;
    });

    set({
      currentProject: {
        ...current,
        tracks: updatedTracks,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  trimClip: (clipId: string, newInPoint: number, newOutPoint: number) => {
    const current = get().currentProject;
    if (!current) return;

    set({
      currentProject: {
        ...current,
        tracks: current.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            if (clip.id === clipId) {
              const newDuration = newOutPoint - newInPoint;
              return {
                ...clip,
                inPoint: newInPoint,
                outPoint: newOutPoint,
                duration: newDuration,
              };
            }
            return clip;
          }),
        })),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  // Playback actions
  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  seek: (time: number, keepPlaying: boolean = false) => {
    const current = get().currentProject;
    const maxDuration = current?.duration || 60;

    set({
      playheadPosition: Math.max(0, Math.min(time, maxDuration)),
      isPlaying: keepPlaying ? get().isPlaying : false, // Only pause if not keepPlaying
    });
  },

  // Selection actions
  selectClip: (clipId: string | null) => set({ selectedClipId: clipId }),

  selectTrack: (trackId: string | null) => set({ selectedTrackId: trackId }),

  // UI actions
  setZoom: (zoom: number) => set({ zoom: Math.max(10, Math.min(200, zoom)) }),
}));

/**
 * Helper function to create a new empty project
 */
export function createEmptyProject(name: string = 'Untitled Project'): Project {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
    tracks: [
      {
        id: uuidv4(),
        type: 'video',
        name: 'Video 1',
        clips: [],
        volume: 1,
        muted: false,
      },
      {
        id: uuidv4(),
        type: 'audio',
        name: 'Audio 1',
        clips: [],
        volume: 1,
        muted: false,
      },
    ],
    duration: 60,
    fps: 30,
  };
}
