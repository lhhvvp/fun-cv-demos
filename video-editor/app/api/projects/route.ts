/**
 * API routes for project management
 *
 * GET /api/projects - List all projects
 * POST /api/projects - Create a new project
 * PUT /api/projects - Update a project
 * DELETE /api/projects?id=xxx - Delete a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
} from '@/lib/storage';
import type { Project, ApiResponse } from '@/lib/types';

/**
 * GET - List all projects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');

    // If ID provided, return single project
    if (projectId) {
      const project = await loadProject(projectId);

      if (!project) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Project not found',
        }, { status: 404 });
      }

      return NextResponse.json<ApiResponse<Project>>({
        success: true,
        data: project,
      });
    }

    // Otherwise, list all projects
    const projects = await listProjects();

    return NextResponse.json<ApiResponse<Project[]>>({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list projects',
    }, { status: 500 });
  }
}

/**
 * POST - Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Project name is required',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    const project: Project = {
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

    await saveProject(project);

    return NextResponse.json<ApiResponse<Project>>({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project',
    }, { status: 500 });
  }
}

/**
 * PUT - Update a project
 */
export async function PUT(request: NextRequest) {
  try {
    const project: Project = await request.json();

    if (!project.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Project ID is required',
      }, { status: 400 });
    }

    // Update timestamp
    project.updatedAt = new Date().toISOString();

    await saveProject(project);

    return NextResponse.json<ApiResponse<Project>>({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update project',
    }, { status: 500 });
  }
}

/**
 * DELETE - Delete a project
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');

    if (!projectId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Project ID is required',
      }, { status: 400 });
    }

    await deleteProject(projectId);

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete project',
    }, { status: 500 });
  }
}
