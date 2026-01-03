import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import { generateImagesSequentially } from '@/lib/generate-images'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { instagram_username, primaryImageUrl } = body

    // 1. Validation
    if (!instagram_username || typeof instagram_username !== 'string') {
      return NextResponse.json(
        { error: 'Instagram username is required' },
        { status: 400 }
      )
    }

    if (!primaryImageUrl || typeof primaryImageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Primary image URL is required' },
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

    // 2. Check for in-progress variant generation
    const { data: inProgressData, error: checkError } = await admin
      .from('identities')
      .select('id')
      .eq('instagram_username', instagram_username)
      .eq('src', 'var')
      .eq('gen_st', 'gen')
      .limit(1)

    if (checkError) {
      console.error('[VARIANTS] Error checking for in-progress generation:', checkError)
      return NextResponse.json(
        { error: 'Failed to check generation status' },
        { status: 500 }
      )
    }

    if (inProgressData && inProgressData.length > 0) {
      return NextResponse.json(
        { error: 'Variant generation already in progress for this profile' },
        { status: 409 }
      )
    }

    // 3. Generate batch ID
    const generationId = randomUUID()

    // 4. Define 5 mutations (first 5 from provided list)
    const mutations = [
      { 
        id: 'angle-left', 
        mutation: 'slight 15-20 degree camera yaw left',
        prompt: 'Keep the facial features of the person in the uploaded image exactly consistent. Same person, same face, same age. Change only camera angle: slight 15-20 degree camera yaw left. Neutral expression, relaxed face. Natural skin texture visible. Close distance, amateur smartphone photo look, eye-level. Soft natural daylight, evenly lit.'
      },
      { 
        id: 'angle-right', 
        mutation: 'slight 15-20 degree camera yaw right',
        prompt: 'Keep the facial features of the person in the uploaded image exactly consistent. Same person, same face, same age. Change only camera angle: slight 15-20 degree camera yaw right. Neutral expression, relaxed face. Natural skin texture visible. Close distance, amateur smartphone photo look, eye-level. Soft natural daylight, evenly lit.'
      },
      { 
        id: 'light-left', 
        mutation: 'soft natural light from camera-left',
        prompt: 'Keep the facial features of the person in the uploaded image exactly consistent. Same person, same face, same age. Change only lighting direction: soft natural light from camera-left. Neutral expression, relaxed face. Natural skin texture visible. Close distance, amateur smartphone photo look, eye-level. Evenly lit, no dramatic shadows.'
      },
      { 
        id: 'light-right', 
        mutation: 'soft natural light from camera-right',
        prompt: 'Keep the facial features of the person in the uploaded image exactly consistent. Same person, same face, same age. Change only lighting direction: soft natural light from camera-right. Neutral expression, relaxed face. Natural skin texture visible. Close distance, amateur smartphone photo look, eye-level. Evenly lit, no dramatic shadows.'
      },
      { 
        id: 'distance-medium', 
        mutation: 'medium chest-up portrait distance',
        prompt: 'Keep the facial features of the person in the uploaded image exactly consistent. Same person, same face, same age. Change only camera distance: medium chest-up portrait distance showing head, shoulders, and upper torso. Neutral expression, relaxed face. Natural skin texture visible. Amateur smartphone photo look, eye-level. Soft natural daylight, evenly lit.'
      },
    ]

    // 5. Create 5 identity records
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    const identityRecords = await Promise.all(
      mutations.map(async (mutation, index) => {
        const { data, error } = await admin
          .from('identities')
          .insert({
            name: `Variant ${index + 1} - ${dateStr}`,
            source_photos: [primaryImageUrl],
            generated_image_url: null,
            status: 'processing',
            src: 'var',
            gen_st: 'gen',
            gen_id: generationId,
            instagram_username: instagram_username,
          })
          .select()
          .single()

        if (error) {
          throw new Error(`Failed to create variant record ${index + 1}: ${error.message}`)
        }

        return data
      })
    )

    console.log(`[VARIANTS] Created ${identityRecords.length} variant records for generation ${generationId}`)

    // 6. Generate all 5 images sequentially using shared utility
    const result = await generateImagesSequentially({
      identityRecords,
      mutations,
      referenceImageUrls: [primaryImageUrl],
      generationId,
      sourceType: 'var',
      logPrefix: 'VARIANTS',
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
    console.error('[VARIANTS] Error in variant generation:', error)
    return NextResponse.json(
      { error: 'Failed to start variant generation', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

