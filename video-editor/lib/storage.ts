/**
 * Storage utilities for handling files and project persistence
 *
 * TODO for production:
 * - Replace local file storage with cloud storage (S3, GCS, Azure Blob)
 * - Replace JSON file persistence with a proper database (PostgreSQL, MongoDB)
 * - Add proper authentication and authorization
 * - Implement file cleanup/garbage collection
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from './types';

// Base directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const EXPORTS_DIR = path.join(UPLOADS_DIR, 'exports');

/**
 * Initialize storage directories
 */
export async function initializeStorage(): Promise<void> {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    throw error;
  }
}

/**
 * Save an uploaded file to the uploads directory
 * @param file - File buffer
 * @param originalFilename - Original filename
 * @returns Object with filename and path
 */
export async function saveUploadedFile(
  file: Buffer,
  originalFilename: string
): Promise<{ filename: string; path: string; fullPath: string }> {
  await initializeStorage();

  // Generate unique filename
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const filename = `${basename}-${uuidv4()}${ext}`;
  const relativePath = path.join('uploads', filename);
  const fullPath = path.join(UPLOADS_DIR, filename);

  await fs.writeFile(fullPath, file);

  return {
    filename,
    path: relativePath,
    fullPath,
  };
}

/**
 * Get the full filesystem path for a relative path
 * @param relativePath - Relative path (e.g., "uploads/video-123.mp4")
 * @returns Full filesystem path
 */
export function getFullPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

/**
 * Get the public URL for accessing a file
 * @param relativePath - Relative path
 * @returns Public URL
 */
export function getPublicUrl(relativePath: string): string {
  // In development, serve from /api/media
  // TODO: In production, return CDN URL or signed S3 URL
  return `/api/media?path=${encodeURIComponent(relativePath)}`;
}

/**
 * Check if a file exists
 * @param relativePath - Relative path
 * @returns True if file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(getFullPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file
 * @param relativePath - Relative path
 */
export async function deleteFile(relativePath: string): Promise<void> {
  try {
    await fs.unlink(getFullPath(relativePath));
  } catch (error) {
    console.error('Failed to delete file:', relativePath, error);
  }
}

/**
 * Get file size in bytes
 * @param relativePath - Relative path
 * @returns File size in bytes
 */
export async function getFileSize(relativePath: string): Promise<number> {
  const stats = await fs.stat(getFullPath(relativePath));
  return stats.size;
}

// ==================== Project Persistence ====================

/**
 * Save a project to disk
 * @param project - Project to save
 */
export async function saveProject(project: Project): Promise<void> {
  await initializeStorage();

  const projectPath = path.join(PROJECTS_DIR, `${project.id}.json`);
  await fs.writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');
}

/**
 * Load a project from disk
 * @param projectId - Project ID
 * @returns Project or null if not found
 */
export async function loadProject(projectId: string): Promise<Project | null> {
  try {
    const projectPath = path.join(PROJECTS_DIR, `${projectId}.json`);
    const data = await fs.readFile(projectPath, 'utf-8');
    return JSON.parse(data) as Project;
  } catch (error) {
    console.error('Failed to load project:', projectId, error);
    return null;
  }
}

/**
 * List all projects
 * @returns Array of projects
 */
export async function listProjects(): Promise<Project[]> {
  await initializeStorage();

  try {
    const files = await fs.readdir(PROJECTS_DIR);
    const projects: Project[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(PROJECTS_DIR, file), 'utf-8');
        projects.push(JSON.parse(data));
      }
    }

    // Sort by updatedAt (most recent first)
    return projects.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('Failed to list projects:', error);
    return [];
  }
}

/**
 * Delete a project
 * @param projectId - Project ID
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    const projectPath = path.join(PROJECTS_DIR, `${projectId}.json`);
    await fs.unlink(projectPath);
  } catch (error) {
    console.error('Failed to delete project:', projectId, error);
  }
}

/**
 * Get the exports directory path
 */
export function getExportsDir(): string {
  return EXPORTS_DIR;
}

/**
 * Save export output
 * @param projectId - Project ID
 * @param buffer - Output file buffer
 * @returns Object with filename and path
 */
export async function saveExport(
  projectId: string,
  buffer: Buffer
): Promise<{ filename: string; path: string; fullPath: string }> {
  await initializeStorage();

  const filename = `export-${projectId}-${Date.now()}.mp4`;
  const relativePath = path.join('uploads', 'exports', filename);
  const fullPath = path.join(EXPORTS_DIR, filename);

  await fs.writeFile(fullPath, buffer);

  return {
    filename,
    path: relativePath,
    fullPath,
  };
}
