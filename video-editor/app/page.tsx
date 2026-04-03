'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/lib/store';
import { createEmptyProject } from '@/lib/store';
import MediaLibrary from '@/components/MediaLibrary';
import VideoPreview from '@/components/VideoPreview';
import Timeline from '@/components/Timeline';
import TransportControls from '@/components/TransportControls';
import type { Project } from '@/lib/types';

export default function EditorPage() {
  const { currentProject, setProject, updateProject } = useEditorStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Auto-save project when it changes
  useEffect(() => {
    if (!currentProject) return;

    const saveTimeout = setTimeout(async () => {
      try {
        await fetch('/api/projects', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(currentProject),
        });
      } catch (error) {
        console.error('Failed to save project:', error);
      }
    }, 1000); // Debounce save by 1 second

    return () => clearTimeout(saveTimeout);
  }, [currentProject]);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();

      if (result.success && result.data) {
        setProjects(result.data);

        // Auto-load the most recent project
        if (result.data.length > 0 && !currentProject) {
          setProject(result.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newProjectName }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setProject(result.data);
        setProjects([result.data, ...projects]);
        setShowProjectDialog(false);
        setNewProjectName('');
      } else {
        alert(result.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    }
  };

  const handleLoadProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects?id=${projectId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setProject(result.data);
      } else {
        alert(result.error || 'Failed to load project');
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      alert('Failed to load project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project?')) return;

    try {
      const response = await fetch(`/api/projects?id=${projectId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setProjects(projects.filter(p => p.id !== projectId));

        if (currentProject?.id === projectId) {
          setProject(null);
        }
      } else {
        alert(result.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-editor-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-editor-bg text-white overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-editor-panel border-b border-editor-border flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Video Editor</h1>
          {currentProject && (
            <span className="text-sm text-gray-400">
              {currentProject.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProjectDialog(!showProjectDialog)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Projects
          </button>
          <button
            onClick={() => {
              setNewProjectName('');
              setShowProjectDialog(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            New Project
          </button>
        </div>
      </div>

      {/* Projects Dialog */}
      {showProjectDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-editor-panel border border-editor-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Projects</h2>
              <button
                onClick={() => setShowProjectDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            {/* New Project Form */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="New project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                className="w-full px-3 py-2 bg-track-bg border border-editor-border rounded text-sm mb-2"
              />
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
              >
                Create Project
              </button>
            </div>

            {/* Projects List */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {projects.length === 0 && (
                <p className="text-center text-gray-400 py-4">No projects yet</p>
              )}

              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 bg-track-bg border rounded cursor-pointer hover:border-blue-500 transition-colors ${
                    currentProject?.id === project.id
                      ? 'border-blue-500'
                      : 'border-editor-border'
                  }`}
                  onClick={() => {
                    handleLoadProject(project.id);
                    setShowProjectDialog(false);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{project.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(project.updatedAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        {project.assets.length} assets, {project.tracks.length} tracks
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="ml-2 text-gray-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Media Library */}
        <div className="w-80 flex-shrink-0">
          <MediaLibrary />
        </div>

        {/* Center/Right - Preview and Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Preview */}
          <div className="h-1/2 border-b border-editor-border">
            <VideoPreview />
          </div>

          {/* Timeline */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Timeline />
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <TransportControls />
    </div>
  );
}
