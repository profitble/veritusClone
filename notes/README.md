# Argon Labs - Project Documentation

## Overview

Argon Labs is a Next.js 16 application for identity generation and management using AI-powered image processing. The platform enables users to collect media from Instagram, generate enhanced identity images using Seedream (Wavespeed), and create anchor images using Google Gemini's NanoBanana Pro.

## Tech Stack

- **Framework**: Next.js 16.1.0 (App Router)
- **React**: 19.2.0
- **TypeScript**: 5.7
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI primitives (shadcn/ui)
- **Animations**: Framer Motion 12.23.26
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI Services**:
  - Google Gemini API (NanoBanana Pro for anchor generation)
  - Wavespeed API (Seedream v4.5 for image enhancement)
- **Video Processing**: FFmpeg (client-side frame extraction)
- **Notifications**: Sonner (toast notifications)
- **Package Manager**: pnpm 9.0.0

## Project Structure

```
landing/
├── app/
│   ├── api/                    # API routes
│   │   ├── anchor/generate/   # Anchor generation endpoint
│   │   ├── instagram/         # Instagram scraping (analyze, reels)
│   │   ├── media/             # Media management (proxy, upload)
│   │   ├── video/proxy/       # Video proxying
│   │   └── wavespeed/         # Seedream image enhancement
│   ├── dashboard/             # Dashboard pages
│   │   ├── collect/           # Media collection page
│   │   ├── identity/          # Identity management page
│   │   ├── anchors/           # Anchors page (placeholder)
│   │   ├── assembly/          # Assembly page (placeholder)
│   │   ├── generate/          # Generate page (placeholder)
│   │   └── settings/          # Settings page (placeholder)
│   └── landing/               # Marketing landing page
├── components/
│   ├── dashboard/             # Dashboard-specific components
│   │   ├── collect/          # Collection page components
│   │   ├── identity-card.tsx # Profile card component
│   │   └── expanded-panel.tsx # Expanded image panel
│   ├── ui/                    # Reusable UI components
│   └── landing/               # Landing page components
├── lib/                       # Utility libraries
│   ├── nano-banana.ts        # Google Gemini client
│   ├── wavespeed.ts          # Seedream/Wavespeed client
│   ├── cloudflare.ts         # R2 storage utilities
│   ├── supabase.ts           # Supabase client config
│   ├── gemini.ts             # Gemini API utilities
│   └── videoExtractor.ts     # FFmpeg video frame extraction
├── contexts/                  # React contexts
│   └── processing-context.tsx # Processing state management
├── hooks/                     # Custom React hooks
│   ├── use-polling.ts        # Polling hook (legacy)
│   └── use-mobile.tsx        # Mobile detection hook
└── supabase/functions/       # Supabase Edge Functions
    ├── media/                # Media management
    ├── media-upload/         # File upload handler
    ├── media-frames/         # Frame extraction handler
    ├── media-reels/          # Reel management
    └── identities/           # Identity management
```

## Core Features

### 1. Media Collection (`/dashboard/collect`)

**Purpose**: Collect and curate photos/videos from Instagram or local uploads for identity generation.

**Features**:
- Instagram profile URL input with validation
- Automatic scraping of Instagram photos and reels
- Google Gemini AI analysis of photos (zoom/visibility scoring)
- Video frame extraction using FFmpeg (client-side)
- Drag-and-drop file uploads (JPG, PNG, HEIC)
- Final selection panel for curated photos
- Auto-redirect to identity page after Seedream generation
- Auto-clear collection after successful submission

**Workflow**:
1. User enters Instagram profile URL or uploads photos
2. System scrapes Instagram content (photos + reels)
3. Gemini analyzes photos for quality (zoom/visibility scores)
4. User selects final photos for identity generation
5. User submits → Seedream generation starts
6. Collection auto-clears and redirects to identity page

### 2. Identity Management (`/dashboard/identity`)

**Purpose**: View and manage generated identities (Seedream and Anchor images).

**Features**:
- Grouped display by Instagram username
- Three image types:
  - **Seedream** (`src: 'sd'`): Enhanced images from Wavespeed API
  - **Anchor** (`src: 'anc'`): Generated anchor images from NanoBanana Pro
  - **Variant** (`src: 'var'`): Generated variant images from primary anchor
- Real-time progress updates via Supabase subscriptions
- Progressive image display (images appear as they complete)
- Expandable cards showing all images in horizontal scroll
- Delete photo/profile functionality (profile deletion is UI-only)
- Anchor generation (one-time, no regeneration)
- Primary selection and automatic variant generation
- Fixed layouts: 10 cards for anchors, 6 cards for variants (1 primary + 5 variants)

**Key Behaviors**:
- **Anchor mode**: When anchor images exist, only anchors are shown (seedream hidden)
  - Progress tracking: "X/10 done processing..." during generation
  - Main card shows first completed anchor image
  - Gray placeholder on profile card during anchor generation
- **Variant mode**: When variants exist and primary is set, only primary + variants shown
  - Progress tracking: "X/5 done processing..." (primary doesn't count)
  - Shows "6 photos" when complete (1 primary + 5 variants)
  - Main card shows primary image (always visible)
  - Expanded panel shows 5 variant cards (no three dots menu on variants)
  - Profile card shows only trash button (no dropdown menu)
  - 9 non-primary anchors hidden in UI (remain in database)
- Images replace placeholders left-to-right as they complete
- Real-time updates via Supabase postgres_changes subscription
- State persists on page refresh (variant generation state restored)

### 3. Anchor Generation (`/api/anchor/generate`)

**Purpose**: Generate 10 anchor images using Google Gemini's NanoBanana Pro.

**Process**:
1. Validates Instagram username and reference image URLs
2. Checks for in-progress generation (prevents duplicates)
3. Fetches seedream images as references
4. Creates 10 identity records with `gen_st: 'gen'`
5. Generates images sequentially (5 with left angle, 5 with right angle)
6. Uploads each image to Cloudflare R2
7. Updates database per-image (`status: 'completed'`, `generated_image_url`)
8. Marks batch complete (`gen_st: 'done'`) after all 10 finish

**Image Specifications**:
- Dimensions: 2160x3840 pixels (9:16 aspect ratio, 4K)
- Style: Amateur phone selfie, chest-up to waist portrait
- Lighting: Soft natural daylight
- Background: Plain real-world surface
- Mutations: Camera angle variations (15° left/right)

**Limitations**:
- One-time generation per profile (no regeneration)
- Requires existing seedream images as references
- Sequential processing (not parallel)

## Database Schema

### `identities` Table

Stores all generated identity images (Seedream, Anchor, and Variant).

**Key Fields**:
- `id`: UUID primary key
- `instagram_username`: Instagram handle (nullable)
- `name`: Display name (e.g., "Anchor 1 - Jan 15, 2025")
- `source_photos`: Array of reference image URLs
- `generated_image_url`: R2 URL of generated image
- `status`: `'processing' | 'completed' | 'failed'`
- `src`: `'sd'` (Seedream), `'anc'` (Anchor), or `'var'` (Variant)
- `gen_st`: `'gen'` (generating) | `'done'` (complete) | `null`
- `gen_id`: UUID linking batch (10 anchors or 5 variants)
- `is_primary`: Boolean flag indicating primary anchor image
- `created_at`, `updated_at`: Timestamps

### `media_items` Table

Stores collected media (photos, videos, frames) before identity generation.

**Key Fields**:
- `id`: UUID primary key
- `type`: `'photo' | 'video' | 'frame'`
- `source`: `'instagram' | 'upload'`
- `url`: R2 URL or Instagram URL
- `instagram_username`: Instagram handle (nullable)
- `display_order`: Sort order
- `parent_video_id`: For frames extracted from videos

## API Endpoints

### `/api/wavespeed` (POST)
Generates Seedream-enhanced images from reference photos.
- Input: `{ photos: string[], instagram_username?: string }`
- Output: `{ success: boolean, total: number, ... }`
- Creates identities with `src: 'sd'`

### `/api/anchor/generate` (POST)
Generates 10 anchor images using NanoBanana Pro.
- Input: `{ instagram_username: string, referenceImageUrls: string[] }`
- Output: `{ success: boolean, generationId: string, total: 10, completed: number, failed: number }`
- Creates identities with `src: 'anc'`

### `/api/anchor/variants` (POST)
Generates 5 variant images from a primary anchor using NanoBanana Pro.
- Input: `{ instagram_username: string, primaryImageUrl: string }`
- Output: `{ success: boolean, generationId: string, total: 5, completed: number, failed: number }`
- Creates identities with `src: 'var'`
- Automatically triggered when primary is set

### `/api/instagram/analyze` (POST)
Scrapes Instagram profile photos.
- Input: `{ profileUrl: string }`
- Output: Streaming JSON with photos and Gemini analysis

### `/api/instagram/reels` (POST)
Scrapes Instagram reels.
- Input: `{ profileUrl: string }`
- Output: Streaming JSON with reels

### `/api/media/proxy` (GET)
Proxies R2 URLs for Next.js Image component compatibility.
- Query: `?url=<encoded_r2_url>`
- Returns: Streamed image data

## Real-Time Updates

The identity page uses Supabase real-time subscriptions to receive instant updates when:
- New identity records are created (`INSERT`)
- Identity status changes (`UPDATE`)
- Images are deleted (`DELETE`)

**Implementation**:
- Uses `useRef` to persist channel across React Strict Mode double-mounts
- Falls back to polling (2s interval) during active generation if real-time fails
- Optimistic UI updates for instant feedback

## Image Storage

**Cloudflare R2**:
- S3-compatible object storage
- All generated images stored in R2
- URLs proxied through `/api/media/proxy` for Next.js Image component
- Direct `<img>` tags used for proxied URLs (query strings not supported by Next.js Image)

## Key Components

### `IdentityCard`
Displays profile card with:
- Main image (prioritizes completed anchor images, shows primary in variant state)
- Username and photo count (shows "6 photos" in variant state when complete)
- Progress indicator during generation ("X/10" for anchors, "X/5" for variants)
- Menu varies by state:
  - **Anchor mode**: Dropdown menu (Delete profile, Make primary)
  - **Seedream mode**: Dropdown menu (Delete photo, Delete profile, Generate anchor)
  - **Variant mode**: Trash button only (UI-only profile deletion)
- Expand/collapse functionality

### `ExpandedPanel`
Horizontal scroll panel showing all images:
- Fixed slot-based layout (10 slots for anchors, 5 slots for variants)
- Progressive display (completed images + placeholders)
- Menu varies by state:
  - **Anchor mode**: Three dots menu (Make primary)
  - **Seedream mode**: Trash icon (Delete photo)
  - **Variant mode**: No menu (variants have no actions)

### `ConfirmationDialog`
Reusable confirmation dialog for destructive actions:
- Delete photo confirmation
- Delete profile confirmation
- Generate anchor confirmation

## State Management

**Local State** (React `useState`):
- `identities`: All identity records
- `generatingAnchor`: Set of usernames currently generating anchors
- `anchorGenerationProgress`: Progress tracking per username
- `generatingVariants`: Set of usernames currently generating variants
- `variantGenerationProgress`: Progress tracking per username (excludes primary)
- `primaryImages`: Map of username → primary identity ID
- `expandedUsername`: Currently expanded card
- `deletingPhotoId`, `deletingUsername`: Deletion states

**Context** (`ProcessingContext`):
- `getGroupProcessing`: Checks if a group is processing

**Real-Time** (Supabase):
- Postgres changes subscription for instant updates
- Polling fallback during active generation

## Recent Changes

### Completed Features
- ✅ Anchor generation (10 images per profile)
- ✅ Primary selection (user selects master anchor image)
- ✅ Variant generation (5 variants automatically generated from primary)
- ✅ Progressive image display (left-to-right replacement)
- ✅ Real-time updates via Supabase subscriptions
- ✅ Fixed layouts: 10 cards for anchors, 6 cards for variants
- ✅ Gray placeholder on profile card during generation
- ✅ One-time anchor generation (regenerate removed)
- ✅ Auto-redirect after Seedream generation
- ✅ Auto-clear collection after submission
- ✅ Refresh persistence (generation state survives page reload)
- ✅ Variant state UI (progress counter excludes primary, shows "6 photos" when done)
- ✅ UI-only profile deletion (removes from UI, not database)

### Technical Improvements
- ✅ Streaming image proxy for faster loading
- ✅ useRef-based real-time subscription (fixes React Strict Mode issues)
- ✅ Slot-based image layout (prevents wrong replacement order)
- ✅ Main candidate selection (prioritizes completed anchors)
- ✅ Primary image lookup from full identity list (not filtered)
- ✅ Separated variant generation state from anchor generation state
- ✅ Variant state detection (variants exist + primary set)

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-side)
- `CLOUDFLARE_R2_ACCESS_KEY_ID`: R2 access key
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 secret key
- `CLOUDFLARE_R2_BUCKET_NAME`: R2 bucket name
- `CLOUDFLARE_R2_ENDPOINT`: R2 endpoint URL
- `GOOGLE_GEMINI_API_KEY`: Google Gemini API key
- `WAVESPEED_API_KEY`: Wavespeed/Seedream API key

## Development

**Start Development Server**:
```bash
pnpm dev
```

**Build for Production**:
```bash
pnpm build
```

**Start Production Server**:
```bash
pnpm start
```

## Known Limitations

1. **Anchor Regeneration**: Removed - can only generate once per profile
2. **Parallel Processing**: Anchor images generated sequentially (not parallel)
3. **Image Loading**: R2 URLs must be proxied for Next.js Image component
4. **Real-Time**: May fall back to polling in some edge cases
5. **Video Processing**: Client-side only (requires FFmpeg in browser)

## Future Enhancements

- [ ] Parallel anchor image generation
- [ ] Batch operations (delete multiple photos)
- [ ] Image editing/cropping
- [ ] Export functionality
- [ ] Analytics dashboard
- [ ] Cost tracking integration
- [ ] Multi-user support
- [ ] API rate limiting
- [ ] Image caching strategy

## Notes

- The project uses Next.js 16 App Router with React Server Components where possible
- Client components marked with `'use client'` directive
- Supabase Edge Functions handle media uploads and management
- All image generation is asynchronous (background processing)
- Real-time subscriptions ensure UI stays in sync with database

