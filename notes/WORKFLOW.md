# Complete Workflow Diagram

## End-to-End Flow: Instagram Link → Anchor Images

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    STEP 1: INPUT                                    │
│                          /dashboard/collect Page (Frontend)                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User enters Instagram URL
                                    │ e.g., "https://www.instagram.com/username/"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          VALIDATION & PREPARATION                                   │
│  • Validate URL format (instagramProfileUrlSchema)                                 │
│  • Extract username: "username"                                                     │
│  • Check if identity already exists in database                                    │
│  • Set state: analyzing = true, clear previous mediaItems                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Parallel API calls
                                    ├──────────────────────┬──────────────────────────┐
                                    ▼                      ▼                          ▼
┌─────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
│   STEP 2A: PARSE INSTAGRAM PHOTOS       │  │   STEP 2B: PARSE INSTAGRAM REELS         │
│   POST /api/instagram/analyze            │  │   POST /api/instagram/reels              │
│   { profileUrl }                         │  │   { profileUrl }                         │
└─────────────────────────────────────────┘  └──────────────────────────────────────────┘
              │                                          │
              │ Streaming Response (Server-Sent Events)  │ Streaming Response
              │                                          │
              │ ┌────────────────────────────────────┐ │ ┌────────────────────────────┐
              │ │ For each photo:                    │ │ │ For each reel:             │
              │ │ 1. Fetch from Instagram            │ │ │ 1. Fetch video URL         │
              │ │ 2. Send to Google Gemini API       │ │ │ 2. Extract thumbnail      │
              │ │    - Analyze zoom_score            │ │ │ 3. Get caption            │
              │ │    - Analyze visibility_score      │ │ │ 4. Stream to frontend     │
              │ │    - Get decision (yes/no)         │ │ │                            │
              │ │    - Get explanation               │ │ │                            │
              │ │ 3. Stream to frontend:            │ │ │                            │
              │ │    { type: 'log', step, message } │ │ │                            │
              │ │    { type: 'progress', batch... } │ │ │                            │
              │ │    { type: 'complete', photos[] }  │ │ │                            │
              │ └────────────────────────────────────┘ │ └────────────────────────────┘
              │                                          │
              ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 2C: PROCESS STREAMING DATA                            │
│  Frontend: handleInstagramAnalyze()                                                 │
│  • Read streaming responses (ReadableStream)                                        │
│  • Parse JSON lines (newline-delimited)                                             │
│  • Update UI state:                                                                 │
│    - logs[]: Progress messages                                                     │
│    - progress: Batch analysis progress                                             │
│    - currentStep: Current processing step                                          │
│  • Transform to MediaItem[]:                                                       │
│    {                                                                                │
│      id: photo.id,                                                                 │
│      type: 'photo' | 'video',                                                      │
│      source: 'instagram',                                                           │
│      url: photo.url,                                                                │
│      thumbnail: photo.thumbnail,                                                   │
│      caption: photo.caption,                                                       │
│      geminiResult: { zoom_score, visibility_score, decision, explanation },       │
│      metadata: { instagramId }                                                     │
│    }                                                                                │
│  • Save to database: media_items table                                              │
│  • setMediaItems(allMediaItems)                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Display photos/videos in MediaGrid
                                    │ User can:
                                    │  - Click photos to add to final selection
                                    │  - Click videos to extract frames
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 3A: VIDEO FRAME EXTRACTION (Optional)                      │
│  User clicks video → VideoInspectorSheet opens                                      │
│  User clicks "Extract Frames"                                                      │
│  • extractFramesFromVideo(videoUrl) - FFmpeg client-side                           │
│  • Extract frames as blob URLs                                                      │
│  • Convert blobs to base64 data URLs                                                │
│  • POST /api/media/frames (Supabase Edge Function)                                  │
│    { frames: [base64...], parentVideoId }                                           │
│  • Upload frames to R2, save to media_items table                                  │
│  • Frames appear in MediaGrid with type: 'frame'                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User selects photos/frames
                                    │ Adds to finalSelection[]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 3B: FINAL SELECTION                                   │
│  FinalSelectionPanel displays selected items                                       │
│  • User can remove items from selection                                            │
│  • Shows count: "X photos selected"                                                │
│  • User clicks "Generate Identity" button                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ handleSubmit()
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 4A: PREPARE SEEDREAM REQUEST                              │
│  • Filter finalSelection: photos + frames only                                      │
│  • Check for duplicate identities (if username exists)                             │
│  • Convert images to base64:                                                        │
│    - Blob URLs → base64 via FileReader                                             │
│    - External URLs → keep as-is                                                     │
│  • Build request body:                                                              │
│    {                                                                                │
│      photos: [base64_or_url, ...],                                                  │
│      instagram_username: "username" (optional)                                      │
│    }                                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /api/wavespeed
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 4B: SEEDREAM GENERATION (Backend)                           │
│  POST /api/wavespeed                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Validate input (photos array, check API key)                               │ │
│  │ 2. Check for duplicate identities                                             │ │
│  │ 3. For each photo:                                                            │ │
│  │    a. Detect image dimensions (image-size library)                            │ │
│  │    b. Calculate output size (maintain aspect ratio, round to 8)              │ │
│  │    c. Convert to base64 (if URL, fetch via proxy)                              │ │
│  │    d. Call Wavespeed API (Seedream v4.5):                                      │ │
│  │       POST https://api.wavespeed.ai/v1/seedream                               │ │
│  │       {                                                                         │ │
│  │         prompt: PROMPT (detailed enhancement instructions),                    │ │
│  │         image: base64_image,                                                   │ │
│  │         output_size: "3072*3840" (calculated)                                  │ │
│  │       }                                                                         │ │
│  │    e. Receive enhanced image (base64)                                          │ │
│  │    f. Upload to Cloudflare R2:                                                 │ │
│  │       uploadToR2(imageBuffer, `seedream_${uuid}.jpg`)                          │ │
│  │    g. Create identity record in Supabase:                                      │ │
│  │       INSERT INTO identities {                                                 │ │
│  │         name: "Seedream - Jan 15, 2025",                                       │ │
│  │         source_photos: [original_urls...],                                     │ │
│  │         generated_image_url: r2_url,                                           │ │
│  │         status: 'completed',                                                    │ │
│  │         src: 'sd',                                                              │ │
│  │         instagram_username: "username"                                         │ │
│  │       }                                                                         │ │
│  │ 4. Return response:                                                             │ │
│  │    { success: true, total: N, completed: N, failed: 0 }                      │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Response received
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 4C: POST-SEEDREAM CLEANUP & REDIRECT                       │
│  Frontend: handleSubmit() success handler                                           │
│  • Clear collection from database:                                                  │
│    DELETE /api/media (Supabase Edge Function)                                       │
│  • Clear local state:                                                              │
│    - setMediaItems([])                                                             │
│    - setFinalSelection([])                                                         │
│    - setInstagramUrl('')                                                           │
│    - setInstagramUsername(null)                                                    │
│  • Show toast: "Identity creation started! Your collection has been cleared."      │
│  • Redirect to /dashboard/identity (if not already there)                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Router.push('/dashboard/identity')
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 5: IDENTITY PAGE DISPLAY                             │
│  /dashboard/identity Page                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Fetch identities from Supabase:                                            │ │
│  │    SELECT * FROM identities ORDER BY created_at DESC                         │ │
│  │                                                                                │ │
│  │ 2. Set up real-time subscription:                                              │ │
│  │    supabase.channel('identities-changes')                                     │ │
│  │      .on('postgres_changes', { table: 'identities' })                        │ │
│  │      .subscribe()                                                              │ │
│  │    • Listen for INSERT, UPDATE, DELETE events                                 │ │
│  │    • Update identities state in real-time                                      │ │
│  │                                                                                │ │
│  │ 3. Group identities by instagram_username:                                    │ │
│  │    groupedIdentities() → GroupedIdentity[]                                    │ │
│  │    • Filter logic:                                                             │ │
│  │      - If variants exist AND primary is set: show only primary + variants     │ │
│  │      - If anchor images exist (src='anc'): show only anchors                  │ │
│  │      - Otherwise: show seedream images (src='sd' or null)                    │ │
│  │    • Select mainCandidate:                                                    │ │
│  │      1. First completed anchor (if exists)                                    │ │
│  │      2. First image with generated_image_url                                  │ │
│  │      3. First identity (fallback)                                             │ │
│  │                                                                                │ │
│  │ 4. Render IdentityCard for each group:                                        │ │
│  │    • Profile image (mainCandidate.generated_image_url)                        │ │
│  │    • Username: @username                                                       │ │
│  │    • Photo count: X photos                                                     │ │
│  │    • Dropdown menu:                                                           │ │
│  │      - Delete photo                                                            │ │
│  │      - Delete profile                                                          │ │
│  │      - Generate anchor (only if no anchor exists)                             │ │
│  │                                                                                │ │
│  │ 5. ExpandedPanel (when card expanded):                                         │ │
│  │    • Horizontal scroll of all images                                           │ │
│  │    • Fixed 10-slot layout for anchors                                          │ │
│  │    • Progressive display (completed + placeholders)                           │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User clicks "Generate anchor" in dropdown
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 6A: ANCHOR GENERATION INITIATION                            │
│  Frontend: handleGenerateAnchor(username)                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Check if already generating (generatingAnchor.has(username))              │ │
│  │ 2. Get all seedream images for username:                                      │ │
│  │    identities.filter(                                                         │ │
│  │      instagram_username === username &&                                        │ │
│  │      (src === 'sd' || !src) &&                                                │ │
│  │      generated_image_url &&                                                    │ │
│  │      status === 'completed'                                                    │ │
│  │    ).map(id => id.generated_image_url)                                        │ │
│  │ 3. Set optimistic state:                                                      │ │
│  │    - setGeneratingAnchor(prev => prev.add(username))                          │ │
│  │    - setAnchorGenerationProgress({ [username]: { total: 10, completed: 0 } }) │ │
│  │ 4. Auto-expand card if not expanded                                            │ │
│  │ 5. POST /api/anchor/generate                                                  │ │
│  │    {                                                                           │ │
│  │      instagram_username: "username",                                           │ │
│  │      referenceImageUrls: [seedream_urls...]                                   │ │
│  │    }                                                                           │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /api/anchor/generate
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 6B: ANCHOR GENERATION (Backend)                            │
│  POST /api/anchor/generate                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Validate input (username, referenceImageUrls)                              │ │
│  │ 2. Check for in-progress generation:                                          │ │
│  │    SELECT id FROM identities                                                  │ │
│  │    WHERE instagram_username = ? AND gen_st = 'gen'                            │ │
│  │    → If exists, return 409 error                                               │ │
│  │                                                                                │ │
│  │ 3. Fetch seedream images:                                                     │ │
│  │    SELECT * FROM identities                                                   │ │
│  │    WHERE instagram_username = ? AND src = 'sd'                                │ │
│  │    → Verify referenceImageUrls match seedream URLs                            │ │
│  │                                                                                │ │
│  │ 4. Generate batch ID: generationId = randomUUID()                             │ │
│  │                                                                                │ │
│  │ 5. Create 10 identity records (parallel):                                     │ │
│  │    FOR i = 0 to 9:                                                            │ │
│  │      INSERT INTO identities {                                                 │ │
│  │        name: "Anchor {i+1} - Jan 15, 2025",                                  │ │
│  │        source_photos: referenceImageUrls,                                     │ │
│  │        generated_image_url: null,                                             │ │
│  │        status: 'processing',                                                  │ │
│  │        src: 'anc',                                                             │ │
│  │        gen_st: 'gen',                                                          │ │
│  │        gen_id: generationId,                                                   │ │
│  │        instagram_username: username                                            │ │
│  │      }                                                                         │ │
│  │                                                                                │ │
│  │ 6. Generate images sequentially (NOT parallel):                              │ │
│  │    FOR i = 0 to 9:                                                            │ │
│  │      a. Select mutation:                                                      │ │
│  │         - Images 0-4: "camera rotated 15° left"                              │ │
│  │         - Images 5-9: "camera rotated 15° right"                             │ │
│  │      b. Build prompt:                                                          │ │
│  │         basePrompt.replace('{mutation}', mutation.mutation)                   │ │
│  │         (Detailed portrait instructions: 2160x3840, 9:16, phone selfie...)    │ │
│  │      c. Call Google Gemini API (NanoBanana Pro):                              │ │
│  │         client.generateImage(prompt, referenceImageUrls, mutation)             │ │
│  │         → Returns base64 image                                                 │ │
│  │      d. Upload to R2:                                                          │ │
│  │         uploadToR2(imageBuffer, `anchor_${id}_${mutation}_${i+1}.jpg`)        │ │
│  │         → Returns R2 URL                                                       │ │
│  │      e. Update database (with retry logic):                                    │ │
│  │         UPDATE identities SET                                                  │ │
│  │           generated_image_url = r2_url,                                       │ │
│  │           status = 'completed',                                                │ │
│  │           updated_at = NOW()                                                   │ │
│  │         WHERE id = identity_id                                                 │ │
│  │      f. If error:                                                              │ │
│  │         UPDATE identities SET status = 'failed'                                │ │
│  │                                                                                │ │
│  │ 7. Mark batch complete:                                                       │ │
│  │    UPDATE identities SET                                                       │ │
│  │      gen_st = 'done',                                                          │ │
│  │      updated_at = NOW()                                                        │ │
│  │    WHERE gen_id = generationId                                                 │ │
│  │                                                                                │ │
│  │ 8. Return response:                                                            │ │
│  │    { success: true, generationId, total: 10, completed: N, failed: M }       │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Real-time updates via Supabase subscription
                                    │ Each UPDATE triggers postgres_changes event
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 6C: PROGRESSIVE IMAGE DISPLAY                              │
│  Frontend: Real-time subscription handler                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Receive UPDATE event:                                                     │ │
│  │    payload.new = {                                                           │ │
│  │      id: identity_id,                                                         │ │
│  │      generated_image_url: r2_url,                                            │ │
│  │      status: 'completed',                                                     │ │
│  │      gen_st: 'gen' (or 'done' when complete)                                  │ │
│  │    }                                                                          │ │
│  │                                                                                │ │
│  │ 2. Update identities state:                                                   │ │
│  │    setIdentities(prev => {                                                    │ │
│  │      const updated = [...prev]                                                │ │
│  │      const index = updated.findIndex(id => id.id === payload.new.id)         │ │
│  │      updated[index] = { ...updated[index], ...payload.new }                   │ │
│  │      return [...updated]                                                       │ │
│  │    })                                                                          │ │
│  │                                                                                │ │
│  │ 3. Progress tracking useEffect:                                                │ │
│  │    • Count anchor identities with gen_st='gen'                                │ │
│  │    • Count completed: status='completed' && generated_image_url              │ │
│  │    • Update anchorGenerationProgress                                          │ │
│  │    • Check if all 10 complete → remove from generatingAnchor                  │ │
│  │                                                                                │ │
│  │ 4. ExpandedPanel updates:                                                     │ │
│  │    • Fixed 10-slot layout                                                     │ │
│  │    • Fill slots left-to-right:                                                │ │
│  │      - Completed images first (sorted chronologically)                        │ │
│  │      - Placeholders for remaining slots                                       │ │
│  │    • As images complete, they replace placeholders                           │ │
│  │                                                                                │ │
│  │ 5. Main card updates:                                                         │ │
│  │    • When first image completes, mainCandidate updates                        │ │
│  │    • Profile image switches from gray placeholder to actual image             │ │
│  │    • Progress text: "X/10 done processing..."                                 │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ All 10 images complete
                                    │ gen_st = 'done' for all
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 6D: GENERATION COMPLETE                                │
│  • generatingAnchor.delete(username)                                               │
│  • Progress text disappears                                                         │
│  • All 10 images visible in ExpandedPanel                                           │
│  • Main card shows first completed anchor image                                     │
│  • Only anchor images shown (seedream hidden)                                       │
│  • "Generate anchor" menu item hidden (already exists)                              │
│  • UI changes: Trash icons replaced with three-dot menus                            │
│  • Menu options: "Delete profile" and "Make primary"                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User clicks three dots → "Make primary"
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 7A: PRIMARY SELECTION INITIATION                            │
│  Frontend: handleSelectPrimary(identityId, username)                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. User clicks "Make primary" on anchor image (main card or expanded panel) │ │
│  │ 2. Confirmation dialog appears: "Make Primary?"                               │ │
│  │ 3. User confirms                                                              │ │
│  │ 4. Find identity by ID to get generated_image_url                             │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User confirms in dialog
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 7B: OPTIMISTIC UI UPDATE                                   │
│  Frontend: handleSelectPrimary() - Immediate UI changes                            │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Update local state (optimistic update):                                    │ │
│  │    setPrimaryImages(prev => ({ ...prev, [username]: identityId }))          │ │
│  │                                                                                │ │
│  │ 2. Filter logic immediately hides 9 non-primary anchors:                    │ │
│  │    - Filtering logic detects primaryId is set                                │ │
│  │    - Shows only: primary anchor + variants (if any)                          │ │
│  │    - 9 non-primary anchors disappear from UI immediately                     │ │
│  │                                                                                │ │
│  │ 3. Primary anchor moves to profile image position:                           │ │
│  │    - mainCandidate updates to show primary image                             │ │
│  │    - Profile image on main card shows primary anchor                         │ │
│  │                                                                                │ │
│  │ 4. Set variant generation state (optimistic):                                │ │
│  │    setGeneratingVariants(prev => prev.add(username))                         │ │
│  │    setVariantGenerationProgress({ [username]: { total: 5, completed: 0 } }) │ │
│  │                                                                                │ │
│  │ 5. ExpandedPanel shows:                                                       │ │
│  │    - Primary anchor (with actual image, not grey)                            │ │
│  │    - 5 grey placeholder cards (processing state)                             │ │
│  │    - Total: 6 cards visible (1 primary + 5 variant placeholders)            │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Optimistic UI update complete
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 7C: PRIMARY SELECTION (Backend)                            │
│  Frontend: handleSelectPrimary() continues                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Clear previous primary for username:                                       │ │
│  │    UPDATE identities SET is_primary = false                                  │ │
│  │    WHERE instagram_username = ? AND is_primary = true                        │ │
│  │                                                                                │ │
│  │ 2. Set new primary in database:                                               │ │
│  │    UPDATE identities SET is_primary = true                                   │ │
│  │    WHERE id = identityId                                                      │ │
│  │                                                                                │ │
│  │ 3. Note: 9 non-primary anchors remain in database (hidden in UI)             │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Primary saved to database
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 7D: VARIANT GENERATION TRIGGER                             │
│  Frontend: handleSelectPrimary() continues                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. After primary is set, automatically trigger variant generation:          │ │
│  │    POST /api/anchor/variants                                                  │ │
│  │    {                                                                          │ │
│  │      instagram_username: "username",                                         │ │
│  │      primaryImageUrl: identity.generated_image_url                           │ │
│  │    }                                                                          │ │
│  │                                                                                │ │
│  │ 2. Show toast: "Primary set! Generating variants..."                        │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /api/variants/generate
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 8A: VARIANT GENERATION (Backend)                          │
│  POST /api/variants/generate                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Validate input (username, primaryImageUrl)                                │ │
│  │                                                                                │ │
│  │ 2. Generate batch ID: generationId = randomUUID()                           │ │
│  │                                                                                │ │
│  │ 3. Create 5 variant identity records:                                        │ │
│  │    FOR i = 0 to 4:                                                            │ │
│  │      INSERT INTO identities {                                                 │ │
│  │        name: "Variant {i+1} - Jan 15, 2025",                                │ │
│  │        source_photos: [primaryImageUrl],                                      │ │
│  │        generated_image_url: null,                                             │ │
│  │        status: 'processing',                                                  │ │
│  │        src: 'var',                                                            │ │
│  │        gen_st: 'gen',                                                          │ │
│  │        gen_id: generationId,                                                   │ │
│  │        instagram_username: username                                           │ │
│  │      }                                                                         │ │
│  │                                                                                │ │
│  │ 4. Define 5 mutations (one per variant):                                     │ │
│  │    - angle-left: slight 15-20° camera yaw left                               │ │
│  │    - angle-right: slight 15-20° camera yaw right                             │ │
│  │    - light-left: soft natural light from camera-left                         │ │
│  │    - light-right: soft natural light from camera-right                        │ │
│  │    - distance-medium: medium chest-up portrait distance                       │ │
│  │                                                                                │ │
│  │ 5. Generate variants sequentially:                                            │ │
│  │    FOR each mutation:                                                          │ │
│  │      a. Build prompt:                                                          │ │
│  │         "Keep facial features exactly consistent. Same person, same face.      │ │
│  │          Change only: {mutation}. Neutral expression, natural skin texture."  │ │
│  │      b. Call Google Gemini API (NanoBanana Pro):                              │ │
│  │         client.generateImage(prompt, [primaryImageUrl], mutation)            │ │
│  │         → Returns base64 image                                                │ │
│  │      c. Upload to R2:                                                          │ │
│  │         uploadToR2(imageBuffer, `variant_${id}_${mutation.id}.jpg`)          │ │
│  │      d. Update database:                                                       │ │
│  │         UPDATE identities SET                                                 │ │
│  │           generated_image_url = r2_url,                                       │ │
│  │           status = 'completed'                                                │ │
│  │         WHERE id = variant_id                                                  │ │
│  │                                                                                │ │
│  │ 6. Mark batch complete:                                                       │ │
│  │    UPDATE identities SET gen_st = 'done'                                     │ │
│  │    WHERE gen_id = generationId                                                │ │
│  │                                                                                │ │
│  │ 7. Return response:                                                            │ │
│  │    { success: true, generationId, total: 5, completed: N, failed: M }         │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Real-time updates via Supabase subscription
                                    │ Each UPDATE triggers postgres_changes event
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    STEP 8B: VARIANT DISPLAY (Progressive)                          │
│  Frontend: Real-time subscription handler                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Variants appear progressively as they complete (left to right):          │ │
│  │    - Same behavior as anchor generation (10 anchors → 5 variants)            │ │
│  │    - Each variant UPDATE event triggers UI update                            │ │
│  │    - Grey placeholder → actual image (left to right)                         │ │
│  │                                                                                │ │
│  │ 2. ExpandedPanel displays:                                                    │ │
│  │    - Primary anchor (always visible with actual image)                       │ │
│  │    - 5 variant slots (fill progressively from left to right)                 │ │
│  │    - Fixed 6-card layout (1 primary + 5 variants)                           │ │
│  │                                                                                │ │
│  │ 3. Main card:                                                                 │ │
│  │    - Primary image remains visible throughout                                │ │
│  │    - Shows progress: "X/5 done processing..." (primary doesn't count)      │ │
│  │    - Shows "6 photos" when all variants complete (1 primary + 5 variants)   │ │
│  │    - Only trash button visible (no dropdown menu in variant state)          │ │
│  │                                                                                │ │
│  │ 4. Progress tracking:                                                         │ │
│  │    - Count only variants (exclude primary): status='completed' && src='var' │ │
│  │    - Update variantGenerationProgress                                        │ │
│  │    - When all 5 complete → remove from generatingVariants                    │ │
│  │                                                                                │ │
│  │ 5. Variant cards in ExpandedPanel:                                           │ │
│  │    - No three dots menu (variants have no actions)                           │ │
│  │    - Only show images (no menu buttons)                                       │ │
│  │                                                                                │ │
│  │ 6. Note: 9 non-primary anchors remain in database but hidden in UI          │ │
│  │    - Filtering logic: hasVariants && primaryId → show only primary + variants│ │
│  │                                                                                │ │
│  │ Note: Variants (src='var') are controlled offshoots of the primary anchor     │ │
│  │ They maintain the same person's identity but with different:                 │ │
│  │   - Camera angles (left/right)                                                │ │
│  │   - Lighting directions (left/right)                                          │ │
│  │   - Camera distances (close/medium)                                           │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ All 5 variants complete
                                    │ gen_st = 'done' for all
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STEP 8C: VARIANT GENERATION COMPLETE                       │
│  • generatingVariants.delete(username)                                              │
│  • Progress text changes to "6 photos" (1 primary + 5 variants)                    │
│  • All 6 images visible in ExpandedPanel (1 primary + 5 variants)                  │
│  • Main card shows primary image                                                    │
│  • Only primary + variants shown (9 non-primary anchors hidden)                    │
│  • Total visible: 6 cards (1 primary anchor + 5 variants)                          │
│  • Variant cards have no three dots menu (no actions available)                    │
│  • Profile card shows only trash button (UI-only deletion)                         │
└─────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════
                              DATA FLOW SUMMARY
═══════════════════════════════════════════════════════════════════════════════════════

Instagram URL
    │
    ├─→ Extract username
    │
    ├─→ Scrape photos (Instagram API/Scraper)
    │   └─→ Gemini analysis (zoom/visibility scores)
    │
    ├─→ Scrape reels (Instagram API/Scraper)
    │   └─→ Extract frames (FFmpeg client-side)
    │
    └─→ User selection (finalSelection[])
        │
        └─→ Seedream API (Wavespeed)
            └─→ Enhanced images → R2 → identities table (src='sd')
                │
                └─→ Identity page displays seedream images
                    │
                    └─→ User clicks "Generate anchor"
                        │
                        └─→ NanoBanana Pro (Google Gemini)
                            └─→ 10 anchor images → R2 → identities table (src='anc')
                                │
                                └─→ Identity page displays anchor images (seedream hidden)
                    │
                    └─→ User clicks "Make primary" on an anchor image
                        │
                        └─→ Primary saved to database (is_primary=true)
                            │
                            └─→ NanoBanana Pro (Google Gemini)
                                └─→ 5 variant images → R2 → identities table (src='var')
                                    │
                                    └─→ Variants displayed alongside anchors


═══════════════════════════════════════════════════════════════════════════════════════
                              DATABASE STATE CHANGES
═══════════════════════════════════════════════════════════════════════════════════════

1. media_items table:
   • Created: When Instagram photos/reels scraped or files uploaded
   • Deleted: After Seedream generation completes (auto-clear)

2. identities table (Seedream):
   • Created: After Seedream API returns enhanced image
   • Fields: src='sd', status='completed', generated_image_url=r2_url

3. identities table (Anchor):
   • Created: 10 records immediately when generation starts
   • Initial: gen_st='gen', status='processing', generated_image_url=null, is_primary=false
   • Updated: Per-image as generation completes
     - generated_image_url=r2_url
     - status='completed'
   • Final: gen_st='done' (all 10 complete)

4. identities table (Primary):
   • Updated: When user selects "Make primary"
   • Previous primary: is_primary=false (cleared)
   • New primary: is_primary=true
   • Used as reference for variant generation

5. identities table (Variants):
   • Created: 5 records immediately when primary is set
   • Initial: gen_st='gen', status='processing', generated_image_url=null, src='var'
   • Updated: Per-image as generation completes
     - generated_image_url=r2_url
     - status='completed'
   • Final: gen_st='done' (all 5 complete)
   • source_photos: [primaryImageUrl] (references the primary anchor)


═══════════════════════════════════════════════════════════════════════════════════════
                              CONCEPT: ANCHOR, PRIMARY, AND VARIANTS
═══════════════════════════════════════════════════════════════════════════════════════

**Anchor Images (src='anc'):**
• 10 images generated from seedream references
• Define the person's core identity (face, proportions, overall look)
• Generated once per profile using NanoBanana Pro
• User can select one to become the "primary"

**Primary Image (is_primary=true):**
• One anchor image selected by the user as the "master photo"
• Becomes the reference point for all future variant generation
• Stored in database with is_primary=true flag
• Automatically triggers variant generation when set
• Main card displays the primary image (if set)

**Variant Images (src='var'):**
• 5 controlled variations generated from the primary anchor
• Maintain the same person's identity but with small changes:
  - Camera angles (left/right)
  - Lighting directions (left/right)
  - Camera distances (close/medium)
• All variants reference the primary in source_photos
• Purpose: Keep AI generating the same individual instead of inventing new ones

**Flow:**
Seedream → Anchor (10 images) → Primary (1 selected) → Variants (5 generated from primary)


═══════════════════════════════════════════════════════════════════════════════════════
                              KEY TECHNICAL DETAILS
═══════════════════════════════════════════════════════════════════════════════════════

• Real-time Updates: Supabase postgres_changes subscription with useRef persistence
• Image Proxy: /api/media/proxy streams R2 URLs for Next.js Image compatibility
• Progressive Display: Fixed slot-based layout (10 slots) with left-to-right replacement
• State Management: React useState + Supabase real-time + optimistic updates
• Error Handling: Retry logic for database updates, rollback on failures
• Auto-redirect: Collect page → Identity page after Seedream generation
• Auto-clear: Collection cleared from database after submission
• One-time Generation: Anchor can only be generated once per profile (no regeneration)
• Primary Selection: User manually selects which anchor image becomes the "master photo"
• Variant Generation: Automatically triggered when primary is set, generates 5 controlled variations
• Anchor vs Variants: Anchor defines the person's identity; variants are controlled offshoots with different angles/lighting/distances
• UI Modes: 
  - Anchor mode: Three-dot menus (Delete profile, Make primary)
  - Seedream mode: Trash icons
  - Variant mode: Profile card shows only trash button (no dropdown), variant cards have no menu
• Primary Selection UI: When "Make primary" clicked, 9 non-primary anchors disappear immediately (optimistic), primary moves to profile image, 5 grey variant placeholders appear, variants fill progressively left-to-right
• Variant Display: Fixed 6-card layout (1 primary anchor + 5 variants), primary stays visible with actual image, variants show grey placeholders that fill progressively
• Variant Progress: Shows "0/5 done processing..." (primary doesn't count), increments to "5/5", then shows "6 photos" when complete
• Profile Deletion: UI-only (removes from local state, not database), requires confirmation dialog
• Non-Primary Anchors: Remain in database but hidden in UI when variants exist (filtered out by grouping logic)
• State Persistence: Variant generation state persists on page refresh (checks for completed variants + primary)

