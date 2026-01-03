import { NextRequest } from 'next/server'
import { getInstagramUserId } from '@/lib/api'
import { instagramProfileUrlSchema, extractUsernameFromUrl } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase'
import axios from 'axios'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileUrl } = body

    // Validate URL with Zod
    const validationResult = instagramProfileUrlSchema.safeParse(profileUrl)
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues[0]?.message || 'Invalid Instagram profile URL'
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Extract username from validated URL
    const username = extractUsernameFromUrl(validationResult.data)

    const token = process.env.ENSEMBLE_DATA_TOKEN
    if (!token) {
      return new Response(JSON.stringify({ error: 'ENSEMBLE_DATA_TOKEN not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create a readable stream for progress updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          // Step 1: Get Instagram User ID
          console.log(`\n[STEP 1] Getting Instagram User ID for profile: ${validationResult.data}`)
          console.log(`[STEP 1] Extracted username: @${username}`)
          const logStep1 = JSON.stringify({
            type: 'log',
            step: 1,
            message: `Getting Instagram User ID for @${username}`,
            status: 'processing',
          }) + '\n'
          controller.enqueue(encoder.encode(logStep1))
          
          const userId = await getInstagramUserId(username)
          console.log(`[STEP 1] User ID retrieved: ${userId}`)
          const logStep1Complete = JSON.stringify({
            type: 'log',
            step: 1,
            message: `User ID retrieved: ${userId}`,
            status: 'complete',
          }) + '\n'
          controller.enqueue(encoder.encode(logStep1Complete))

          // Step 2: Fetch Instagram Reels with pagination
          console.log(`[STEP 2] Fetching Instagram reels...`)
          const logStep2 = JSON.stringify({
            type: 'log',
            step: 2,
            message: 'Fetching Instagram reels',
            status: 'processing',
          }) + '\n'
          controller.enqueue(encoder.encode(logStep2))
          
          const reelList: Array<{ url: string; thumbnail?: string; id: string; caption?: string; shortcode?: string }> = []
          let cursor: string | null = null
          let pageCount = 0

          while (true) {
            pageCount++
            const params: any = {
              user_id: userId,
              depth: 1,
              chunk_size: 12,
              token,
            }
            
            if (cursor) {
              params.start_cursor = cursor
            }

            const reelResponse = await axios.get('https://api.ensembledata.com/instagram/user/reels', { params })
            
            // Debug: log response structure on first page
            if (pageCount === 1) {
              console.log(`[DEBUG] Reels response structure:`, JSON.stringify({
                hasData: !!reelResponse.data?.data,
                hasReels: !!reelResponse.data?.data?.reels,
                reelsLength: reelResponse.data?.data?.reels?.length || 0,
                lastCursor: reelResponse.data?.data?.last_cursor,
                topLevelKeys: Object.keys(reelResponse.data || {}),
                dataKeys: reelResponse.data?.data ? Object.keys(reelResponse.data.data) : [],
              }, null, 2))
            }
            
            // Defensive parsing: handle multiple response structures
            const responseData = reelResponse.data?.data || reelResponse.data || {}
            const reelsData = responseData.data || responseData.reels || responseData.posts || []
            
            console.log(`[STEP 2] Page ${pageCount}: Found ${reelsData.length} reels`)

            // Process each reel item
            reelsData.forEach((item: any) => {
              // Handle nested media structure: { media: { ... } } or direct object
              const media = item.media || item.node || item
              
              // Extract video URL with fallbacks
              const videoUrl = media.video_versions?.[0]?.url || 
                               media.video_url || 
                               media.video_versions2?.candidates?.[0]?.url
              
              // Extract thumbnail with fallbacks
              const thumbnail = media.image_versions2?.candidates?.[0]?.url ||
                                media.display_url ||
                                media.thumbnail_src ||
                                media.thumbnail_url ||
                                media.image_versions?.[0]?.url
              
              // Extract caption with fallbacks
              const caption = media.caption?.text ||
                              media.edge_media_to_caption?.edges?.[0]?.node?.text ||
                              media.caption_text ||
                              ''
              
              // Extract ID/shortcode
              const id = media.code || media.shortcode || media.id || media.pk
              
              if (videoUrl) {
                reelList.push({
                  url: videoUrl,
                  thumbnail: thumbnail,
                  id: id || `reel_${reelList.length}`,
                  caption: caption,
                  shortcode: media.code || media.shortcode,
                })
              }
            })

            // Check pagination using last_cursor (same as posts)
            const nextCursor = reelResponse.data?.data?.last_cursor || null

            // Stop if no cursor or no reels returned
            if (!nextCursor || reelsData.length === 0) {
              break
            }

            cursor = nextCursor
          }

          console.log(`[STEP 2] Found ${reelList.length} reels across ${pageCount} pages`)

          // Save Instagram reels to database
          if (supabaseAdmin && reelList.length > 0) {
            // Get current max display_order
            const { data: maxOrderData } = await supabaseAdmin
              .from('media_items')
              .select('display_order')
              .order('display_order', { ascending: false })
              .limit(1)
              .single()
            
            const startOrder = maxOrderData?.display_order ? maxOrderData.display_order + 1 : 1
            
            const mediaToSave = reelList.map((reel, index) => ({
              type: 'video',
              source: 'instagram',
              url: reel.url,
              thumbnail_url: reel.thumbnail,
              caption: reel.caption,
              instagram_id: reel.id,
              display_order: startOrder + index,
            }))

            const { error } = await supabaseAdmin.from('media_items').insert(mediaToSave)
            if (error) {
              console.error('[ERROR] Failed to save Instagram reels:', error)
            }
          }

          const logStep2Complete = JSON.stringify({
            type: 'log',
            step: 2,
            message: `Found ${reelList.length} reels`,
            status: 'complete',
            reelCount: reelList.length,
          }) + '\n'
          controller.enqueue(encoder.encode(logStep2Complete))

          // Send final complete message
          console.log(`\n[COMPLETE] Reel collection complete! ${reelList.length} reels ready\n`)
          const completeData = JSON.stringify({
            type: 'complete',
            reels: reelList,
            totalReels: reelList.length,
          }) + '\n'
          controller.enqueue(encoder.encode(completeData))
          controller.close()
        } catch (error: any) {
          const errorData = JSON.stringify({
            type: 'error',
            error: error.message || 'Failed to fetch reels',
          }) + '\n'
          controller.enqueue(encoder.encode(errorData))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to start reel collection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

