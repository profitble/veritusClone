import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import { generateImagesSequentially } from '@/lib/generate-images'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { instagram_username, referenceImageUrls } = body

    // 1. Validation
    if (!instagram_username || typeof instagram_username !== 'string') {
      return NextResponse.json(
        { error: 'Instagram username is required' },
        { status: 400 }
      )
    }

    if (!referenceImageUrls || !Array.isArray(referenceImageUrls) || referenceImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one reference image URL is required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database client not available' },
        { status: 500 }
      )
    }

    const admin = supabaseAdmin

    // 2. Check for in-progress generation
    const { data: inProgressData, error: checkError } = await admin
      .from('identities')
      .select('id')
      .eq('instagram_username', instagram_username)
      .eq('gen_st', 'gen')
      .limit(1)

    if (checkError) {
      console.error('[ANCHOR] Error checking for in-progress generation:', checkError)
      return NextResponse.json(
        { error: 'Failed to check generation status' },
        { status: 500 }
      )
    }

    if (inProgressData && inProgressData.length > 0) {
      return NextResponse.json(
        { error: 'Anchor generation already in progress for this profile' },
        { status: 409 }
      )
    }

    // 3. Fetch seedream images and verify they exist
    const { data: seedreamIdentities, error: fetchError } = await admin
      .from('identities')
      .select('id, generated_image_url, src')
      .eq('instagram_username', instagram_username)
      .eq('src', 'sd')
      .not('generated_image_url', 'is', null)

    if (fetchError) {
      console.error('[ANCHOR] Error fetching seedream images:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch seedream images' },
        { status: 500 }
      )
    }

    if (!seedreamIdentities || seedreamIdentities.length === 0) {
      return NextResponse.json(
        { error: 'No seedream images found for this profile' },
        { status: 404 }
      )
    }

    // Verify all reference URLs match seedream images
    const seedreamUrls = seedreamIdentities
      .map(id => id.generated_image_url)
      .filter(Boolean) as string[]

    const invalidReferences = referenceImageUrls.filter(
      url => !seedreamUrls.includes(url)
    )

    if (invalidReferences.length > 0) {
      return NextResponse.json(
        { error: 'Some reference images are not seedream images for this profile' },
        { status: 400 }
      )
    }

    // 4. Generate batch ID
    const generationId = randomUUID()

    // 5. Create 10 identity records
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    const identityRecords = await Promise.all(
      Array.from({ length: 10 }).map(async (_, index) => {
        const { data, error } = await admin
          .from('identities')
          .insert({
            name: `Anchor ${index + 1} - ${dateStr}`,
            source_photos: referenceImageUrls,
            generated_image_url: null,
            status: 'processing',
            src: 'anc',
            gen_st: 'gen',
            gen_id: generationId,
            instagram_username: instagram_username,
          })
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to create identity record ${index + 1}: ${error.message}`)
        }

        return data
      })
    )

    console.log(`[ANCHOR] Created ${identityRecords.length} identity records for generation ${generationId}`)

    // 6. Generate all 10 images sequentially (Phase 8)
    const mutations = [
      { id: 'angle-left', mutation: 'camera rotated 15 degrees left, subject remains centered, eye-level' },
      { id: 'angle-right', mutation: 'camera rotated 15 degrees right, subject remains centered, eye-level' },
    ]

    const basePrompt = `Create a realistic portrait photo that perfectly blends the identity from all reference images.

SUBJECT:
- Use all uploaded images as exact identity reference
- Preserve original facial structure, proportions, nose bridge, skin tone, and hairline
- Keep the facial features of the person in the uploaded images exactly consistent. Same person, same face, same age
- Slightly smaller, more petite face proportions while maintaining identity
- Larger expressive almond-shaped eyes with subtle visible double eyelids and brighter clarity, while maintaining the person's natural eye characteristics
- Softer petite jawline with gentle feminine contour, while maintaining the person's natural facial structure
- Plumper natural glossy lips, while maintaining the person's natural lip shape and characteristics
- Neutral to slightly curious expression, relaxed face
- Simple, natural posture with relaxed shoulders and arms at sides or resting naturally
- No objects in hands, no phone visible
- Framing: chest-up to waist portrait clearly showing head, shoulders, bust, and waist (NOT zoomed in face-only)
- Natural, unstyled hair with realistic strands visible
- Natural skin texture visible, subtle imperfections allowed
- Natural feminine proportions with full well-defined bust and visible waist/torso in frame
- Attractive, appealing appearance with natural enhancement

PHOTOGRAPHY:
- Amateur phone selfie, front-facing eye-level view (strictly portrait orientation, no sideways/landscape)
- Standard smartphone lens (NOT zoomed in)
- Vertical chest-up to waist portrait framing (head to waist visible, 9:16 aspect ratio)
- If it looks zoomed in or sideways → it's wrong
- No phone screen, UI elements, or mirror reflections visible
- Output image dimensions: 2160x3840 pixels (9:16 aspect ratio, 4K resolution)

LIGHTING:
- Soft natural daylight
- Evenly lit, no dramatic shadows
- Realistic phone camera lighting (slightly uneven is fine)

SKIN & TEXTURE:
- Natural skin texture with visible pores and subtle grain
- Light realistic smartphone camera noise
- Minor natural imperfections allowed — no heavy bumps or unevenness
- No airbrushing or beauty filters, but avoid excessive grain
- Soft healthy glow from skincare, textured but not raw

BACKGROUND:
- Plain, real-world surface (neutral wall or outdoor)
- Not studio, not blurred
- Real-world environment

CONSTRAINTS:
- Style: unposed real photo, not model shoot
- Amateur smartphone photo look, not professional studio
- Natural enhancement for attractiveness, no beauty filters or airbrushing
- Change only {mutation}`

    // 6. Generate all images sequentially using shared utility
    const result = await generateImagesSequentially({
      identityRecords,
      mutations,
      referenceImageUrls,
      generationId,
      sourceType: 'anc',
      logPrefix: 'ANCHOR',
      basePrompt,
    })

    // 7. Return success response
    return NextResponse.json({
      success: true,
      generationId: generationId,
      total: result.total,
      completed: result.completed,
      failed: result.failed,
    })
  } catch (error: any) {
    console.error('[ANCHOR] Error in anchor generation:', error)
    return NextResponse.json(
      { error: 'Failed to start anchor generation', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

