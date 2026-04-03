# Video Editor - Web-Based Video Editing Application

A production-ready, web-based video editing application built with Next.js, React, TypeScript, and FFmpeg. Features a multi-track timeline, real-time preview, drag-and-drop interface, and server-side video export.

## Features

### Core Editing
- **Multi-track timeline** - Separate video and audio tracks
- **Drag and drop** - Add media from library to timeline
- **Trim clips** - Resize clips by dragging edges
- **Move clips** - Reposition clips on timeline
- **Real-time preview** - See your edits instantly
- **Grid snapping** - Automatic alignment to 0.1s intervals

### Media Management
- **Upload support** - Videos (MP4, WebM, MOV, AVI) and audio (MP3, WAV, AAC, OGG)
- **Media library** - Browse and manage uploaded assets
- **Automatic metadata** - Duration, dimensions, file size extraction

### Playback
- **Play/Pause/Stop** - Standard transport controls
- **Scrubbing** - Click timeline ruler to jump to any position
- **Playhead tracking** - Visual indicator of current position

### Export
- **FFmpeg rendering** - Server-side video composition
- **Progress tracking** - Real-time export progress
- **H.264 + AAC** - Industry-standard MP4 output
- **Download** - One-click download of exported videos

### Project Management
- **Create/Load/Delete** - Manage multiple projects
- **Auto-save** - Projects saved automatically
- **JSON storage** - File-based persistence (easy to migrate to DB)

## Prerequisites

### Required
- **Node.js** - v18 or higher
- **npm** or **yarn** - Package manager
- **FFmpeg** - For video export functionality

### FFmpeg Installation

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

**Verify installation:**
```bash
ffmpeg -version
```

## Getting Started

### 1. Installation

```bash
# Navigate to the project directory
cd video-editor

# Install dependencies
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Create Your First Project

1. Click **"New Project"** in the top bar
2. Enter a project name and click **"Create Project"**
3. Upload video/audio files using **"Upload Media"** in the left panel
4. Drag media files from the library onto the timeline tracks
5. Edit clips by dragging to move, or dragging edges to trim
6. Click **Play** to preview your edit
7. Click **"Export Video"** to render the final MP4

## Project Structure

```
video-editor/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── upload/route.ts      # File upload endpoint
│   │   ├── projects/route.ts    # Project CRUD operations
│   │   ├── export/route.ts      # Video export with FFmpeg
│   │   └── media/route.ts       # Serve uploaded media files
│   ├── page.tsx                 # Main editor page
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── MediaLibrary.tsx         # Media upload and library
│   ├── Timeline.tsx             # Timeline with ruler and tracks
│   ├── Track.tsx                # Individual track with drag-drop
│   ├── ClipItem.tsx             # Draggable/trimmable clip
│   ├── VideoPreview.tsx         # Real-time video preview
│   └── TransportControls.tsx    # Playback and export controls
├── lib/                         # Utilities and core logic
│   ├── types.ts                 # TypeScript type definitions
│   ├── store.ts                 # Zustand state management
│   ├── storage.ts               # File and project persistence
│   └── ffmpeg.ts                # FFmpeg integration
├── uploads/                     # User-uploaded media (gitignored)
├── data/                        # Project JSON files (gitignored)
└── public/                      # Static assets
```

## Architecture

### Frontend
- **Next.js 14** - App Router for routing and SSR
- **React 18** - Component-based UI
- **TypeScript** - Type safety
- **Zustand** - Lightweight state management
- **Tailwind CSS** - Utility-first styling

### Backend
- **Next.js API Routes** - RESTful API endpoints
- **FFmpeg** - Video processing and export
- **File System** - Simple file-based storage (easy to migrate)

### Data Flow
1. User uploads media → Stored in `/uploads`
2. Metadata extracted via FFmpeg → Added to project
3. User edits timeline → State managed by Zustand
4. Project changes → Auto-saved to `/data/projects`
5. Export triggered → FFmpeg renders timeline → MP4 output

## Key Concepts

### Clips vs Assets
- **Asset** - A media file in the library (video or audio)
- **Clip** - An instance of an asset placed on the timeline
- One asset can have multiple clips (reusable)

### Timeline Coordinates
- **startTime** - Where the clip starts on the timeline (seconds)
- **duration** - How long the clip appears (seconds)
- **inPoint/outPoint** - Trim points within the source asset (seconds)

### Tracks
- **Video tracks** - Only accept video assets
- **Audio tracks** - Only accept audio assets
- Each track can have multiple clips
- Clips on same track cannot overlap (enforced by UI)

## Customization

### Change Export Settings

Edit `lib/ffmpeg.ts`:

```typescript
const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  videoBitrate: '5000k',  // Increase for better quality
  audioBitrate: '192k',
  fps: 30,
};
```

### Add Video Transitions

Modify FFmpeg filter complex in `lib/ffmpeg.ts` to add crossfades, wipes, etc.

### Change Timeline Zoom Range

Edit `lib/store.ts`:

```typescript
setZoom: (zoom: number) => set({
  zoom: Math.max(10, Math.min(200, zoom)) // Min/max pixels per second
}),
```

## Production Deployment

### Recommended Upgrades

1. **Database** - Replace JSON files with PostgreSQL/MongoDB
   - Update `lib/storage.ts` to use database queries
   - Store projects, assets, and export jobs

2. **Cloud Storage** - Replace local files with S3/GCS
   - Update upload handler to use cloud SDK
   - Return signed URLs for media access

3. **Queue System** - Add Bull/BullMQ for exports
   - Handle multiple concurrent exports
   - Better error handling and retries

4. **Authentication** - Add user accounts
   - Next-Auth or Auth0
   - User-specific projects and media

5. **WebSockets** - Real-time export progress
   - Socket.io for live updates
   - Collaborative editing features

6. **CDN** - Serve media via CDN
   - CloudFront, Cloudflare, etc.
   - Faster media loading

### Environment Variables

Create `.env.local` for production:

```env
# Database (if using)
DATABASE_URL=postgresql://...

# Cloud Storage (if using)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...

# Authentication (if using)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-domain.com
```

### Build for Production

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
npx vercel
```

**Note:** Vercel has execution time limits. For production exports, consider:
- Using a dedicated server (AWS EC2, DigitalOcean)
- Background worker for FFmpeg processing
- Separate encoding service

## Troubleshooting

### FFmpeg Not Found
**Error:** `FFmpeg is not installed on the server`

**Solution:** Install FFmpeg (see Prerequisites) and ensure it's in PATH

### Large File Upload Fails
**Error:** Upload times out or fails

**Solution:**
- Increase Next.js body size limit in `next.config.js`
- Consider chunked uploads for files > 100MB
- Use direct S3 uploads for very large files

### Export Hangs
**Error:** Export progress stops

**Solution:**
- Check FFmpeg logs in terminal
- Verify all media files are accessible
- Ensure clips don't reference invalid time ranges

### Preview Not Showing
**Error:** Black screen in preview

**Solution:**
- Check browser console for errors
- Verify media URLs are accessible
- Ensure video codec is browser-compatible (H.264 recommended)

## Browser Compatibility

- **Chrome/Edge** - Full support ✅
- **Firefox** - Full support ✅
- **Safari** - Full support ✅ (requires H.264 video)

## License

MIT License - Feel free to use in your projects

## Contributing

This is a production-ready base. Suggested improvements:

- [ ] Undo/Redo functionality
- [ ] Keyboard shortcuts
- [ ] Video effects and filters
- [ ] Text/title overlays
- [ ] Audio mixing and effects
- [ ] Transition effects
- [ ] Collaborative editing
- [ ] Cloud rendering
- [ ] Mobile responsive UI
- [ ] Thumbnail generation

## Support

For issues or questions:
- Check the troubleshooting section
- Review the code comments (extensively documented)
- Search GitHub issues
- Open a new issue with details

---

Built with ❤️ using Next.js, React, and FFmpeg
