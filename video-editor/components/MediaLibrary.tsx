'use client';

import { useRef, useState } from 'react';
import { useEditorStore } from '@/lib/store';
import type { Asset } from '@/lib/types';

export default function MediaLibrary() {
  const { currentProject, addAsset } = useEditorStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success && result.data) {
          addAsset(result.data as Asset);
        } else {
          console.error('Upload failed:', result.error);
          alert(`Failed to upload ${file.name}: ${result.error}`);
        }

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragStart = (asset: Asset, e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="h-full flex flex-col bg-editor-panel border-r border-editor-border">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <h2 className="text-lg font-semibold mb-3">Media Library</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !currentProject}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
        >
          {uploading ? `Uploading... ${uploadProgress.toFixed(0)}%` : 'Upload Media'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Assets List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {!currentProject && (
          <div className="text-center text-gray-400 mt-8">
            <p>No project loaded</p>
          </div>
        )}

        {currentProject && currentProject.assets.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="mb-2">No media files yet</p>
            <p className="text-sm">Upload videos or audio files to get started</p>
          </div>
        )}

        {currentProject?.assets.map((asset) => (
          <div
            key={asset.id}
            draggable
            onDragStart={(e) => handleDragStart(asset, e)}
            className="bg-track-bg border border-editor-border rounded p-3 cursor-move hover:border-blue-500 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${
                asset.type === 'video' ? 'bg-clip-video' : 'bg-clip-audio'
              }`}>
                {asset.type === 'video' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={asset.filename}>
                  {asset.filename}
                </p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>{formatDuration(asset.duration)}</span>
                  <span>{formatFileSize(asset.size)}</span>
                  {asset.width && asset.height && (
                    <span>{asset.width}×{asset.height}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
