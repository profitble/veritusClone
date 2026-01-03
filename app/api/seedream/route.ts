import { NextRequest, NextResponse } from 'next/server'
import { SeedreamClient, PROMPT } from '@/lib/seedream'
import { supabaseAdmin } from '@/lib/supabase'
import sizeOf from 'image-size'

// Detect image dimensions and calculate output size maintaining aspect ratio
function calculateOutputSize(width: number, height: number): string {
  const aspectRatio = width / height
  const targetHeight = 3840 // Use same height as default
  
  // Calculate width maintaining aspect ratio
  const targetWidth = Math.round(targetHeight * aspectRatio)
  
  // Ensure dimensions are reasonable (not too small or too large)
  // Round to nearest 8 for better compatibility
  const finalWidth = Math.round(targetWidth / 8) * 8
  const finalHeight = Math.round(targetHeight / 8) * 8
  
  return `${finalWidth}*${finalHeight}`
}

// Get image dimensions from base64 or buffer
async function getImageDimensions(imageBase64: string, baseUrl: string): Promise<{ width: number; height: number }> {
  try {
    let buffer: Buffer
    
    // If it's a data URL, extract base64 and decode
    if (imageBase64.startsWith('data:')) {
      const base64Part = imageBase64.split(',')[1] || imageBase64
      buffer = Buffer.from(base64Part, 'base64')
    } else if (imageBase64.includes('http://') || imageBase64.includes('https://')) {
      // It's a URL, fetch it
      const isR2Url = imageBase64.includes('r2.cloudflarestorage.com')
      const fetchUrl = isR2Url 
        ? `${baseUrl}/api/media/proxy?url=${encodeURIComponent(imageBase64)}`
        : imageBase64
      
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.instagram.com/',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } else {
      // Assume it's raw base64
      buffer = Buffer.from(imageBase64, 'base64')
    }
    
    const dimensions = sizeOf(buffer)
    if (!dimensions.width || !dimensions.height) {
      throw new Error('Could not detect image dimensions')
    }
    
    return { width: dimensions.width, height: dimensions.height }
  } catch (error) {
    console.error(`[ERROR] Failed to detect image dimensions:`, error)
    // Return default 4:5 aspect ratio if detection fails
    return { width: 3072, height: 3840 }
  }
}

// Convert image URL or base64 data URL to base64 string
async function imageToBase64(urlOrBase64: string, baseUrl: string): Promise<string> {
  try {
    // If already base64 data URL, extract just the base64 part
    if (urlOrBase64.startsWith('data:')) {
      const base64Part = urlOrBase64.split(',')[1]
      if (base64Part) {
        return base64Part
      }
      // If no comma, assume it's already just base64
      return urlOrBase64
    }

    // Check if it's an R2 URL - use proxy endpoint
    const isR2Url = urlOrBase64.includes('r2.cloudflarestorage.com')
    const fetchUrl = isR2Url 
      ? `${baseUrl}/api/media/proxy?url=${encodeURIComponent(urlOrBase64)}`
      : urlOrBase64

    // Handle external URLs (Instagram, R2 via proxy, etc.)
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    
    return base64
  } catch (error) {
    console.error(`[ERROR] Failed to convert image to base64: ${urlOrBase64}`, error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photos, instagram_username } = body
    
    // Get base URL for proxy endpoint
    const baseUrl = request.nextUrl.origin

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.WAVESPEED_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Wavespeed API key not configured' },
        { status: 500 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database client not available' },
        { status: 500 }
      )
    }

    // Check for duplicate identities (only if instagram_username is provided)
    if (instagram_username) {
      const admin = supabaseAdmin
      const { data: existingIdentities, error: checkError } = await admin
        .from('identities')
        .select('id, status, generated_image_url')
        .eq('instagram_username', instagram_username)
      
      if (checkError) {
        console.error('[ERROR] Failed to check for duplicate identities:', checkError)
        // Continue anyway - don't block on check error
      } else {
        const hasProcessing = existingIdentities?.some(
          (id) => id.status === 'processing' || 
                  (id.status === 'completed' && id.generated_image_url)
        )
        
        if (hasProcessing) {
          return NextResponse.json(
            { 
              error: 'DUPLICATE_IDENTITY',
              message: `An identity for @${instagram_username} is already being processed or completed. Please wait for it to finish or use a different profile.`
            },
            { status: 409 }
          )
        }
      }
    }

    const dateStr = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })

    // Step 1: Create all identity records upfront with status 'processing'
    console.log(`[SEEDREAM] Creating ${photos.length} identity records...`)
    const admin = supabaseAdmin // TypeScript guard
    const identityRecords = await Promise.all(
      photos.map(async (photoUrlOrBase64: string, index: number) => {
        const { data, error } = await admin
      .from('identities')
      .insert({
            name: `Identity ${index + 1} - ${dateStr}`,
            source_photos: [photoUrlOrBase64],
            generated_image_url: null,
            status: 'processing',
            src: 'sd',
            instagram_username: instagram_username || null,
      })
      .select()
      .single()

        if (error) {
          throw new Error(`Failed to create identity record: ${error.message}`)
        }

        return data
      })
    )

    console.log(`[SEEDREAM] Created ${identityRecords.length} identity records`)

    // Step 2: Process photos sequentially (one at a time) with retry logic
    const client = new SeedreamClient({ apiKey })
    const results = []

    // Retry function with exponential backoff
    const retryWithBackoff = async (
      fn: () => Promise<string>,
      maxRetries: number = 3,
      initialDelay: number = 5000
    ): Promise<string> => {
      let lastError: any
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn()
        } catch (error: any) {
          lastError = error
          if (attempt < maxRetries - 1) {
            const delay = initialDelay * Math.pow(2, attempt) // Exponential backoff: 5s, 10s, 20s, 40s...
            console.log(`[SEEDREAM] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }
      throw lastError
    }

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      const identityRecord = identityRecords[i]

      try {
        console.log(`[SEEDREAM] Processing photo ${i + 1}/${photos.length}...`)
        
        // Detect image dimensions to preserve aspect ratio
        const dimensions = await getImageDimensions(photo, baseUrl)
        const outputSize = calculateOutputSize(dimensions.width, dimensions.height)
        console.log(`[SEEDREAM] Detected dimensions: ${dimensions.width}x${dimensions.height}, output size: ${outputSize}`)
        
        // Convert photo to base64 (with retry)
        const base64Image = await retryWithBackoff(async () => {
          return await imageToBase64(photo, baseUrl)
        }, 5, 2000) // Retry base64 conversion up to 5 times with 2s initial delay

        // Call Wavespeed API (with retry until it works) - pass calculated size
        const generatedImageUrl = await retryWithBackoff(async () => {
          return await client.enhanceImage(base64Image, PROMPT, outputSize)
        }, 3, 5000) // Retry API call up to 3 times with 5s initial delay

        console.log(`[SEEDREAM] Photo ${i + 1} completed: ${generatedImageUrl}`)

        // Update identity record with generated image and completed status
        const { error: updateError } = await admin
          .from('identities')
          .update({
            generated_image_url: generatedImageUrl,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', identityRecord.id)

        if (updateError) {
          console.error(`[ERROR] Failed to update identity ${identityRecord.id}:`, updateError)
          // Retry the update operation
          let updateSuccess = false
          for (let retry = 0; retry < 5; retry++) {
            const { error: retryError } = await admin
            .from('identities')
              .update({
                generated_image_url: generatedImageUrl,
                status: 'completed',
                updated_at: new Date().toISOString(),
              })
            .eq('id', identityRecord.id)
            
            if (!retryError) {
              updateSuccess = true
              break
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)))
          }
          
          if (!updateSuccess) {
            console.error(`[ERROR] Failed to update identity ${identityRecord.id} after retries`)
            // Keep as processing so it can be retried later
            continue
          }
        }
        
          results.push({
            id: identityRecord.id,
            name: identityRecord.name,
            generated_image_url: generatedImageUrl,
            status: 'completed',
          })
      } catch (error: any) {
        console.error(`[ERROR] Failed to process photo ${i + 1} after all retries:`, error)
        // Update status to 'failed' instead of deleting (Apple HIG: progress must be explainable)
        console.log(`[SEEDREAM] Marking identity ${identityRecord.id} as failed after 3 retries...`)
        const { error: updateError } = await admin
          .from('identities')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', identityRecord.id)
        
        if (updateError) {
          console.error(`[ERROR] Failed to update failed identity ${identityRecord.id}:`, updateError)
        } else {
          console.log(`[SEEDREAM] Successfully marked identity ${identityRecord.id} as failed after 3 retries`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      identities: results,
      total: photos.length,
      completed: results.length,
    })
  } catch (error: any) {
    console.error('[ERROR] Seedream generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate identity', details: error.message },
      { status: 500 }
    )
  }
}

