import { NextRequest } from 'next/server'
import { getInstagramUserId } from '@/lib/api'
import { analyzeFacesWithGemini } from '@/lib/gemini'
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

          // Step 2: Fetch Instagram photos and reels with pagination
          console.log(`[STEP 2] Fetching photos and reels...`)
          const logStep2 = JSON.stringify({
            type: 'log',
            step: 2,
            message: 'Fetching photos and reels',
            status: 'processing',
          }) + '\n'
          controller.enqueue(encoder.encode(logStep2))
          
          // Pagination loop to fetch all pages
          const photoList: Array<{ url: string; thumbnail?: string; id: string; caption?: string }> = []
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

            const response = await axios.get('https://api.ensembledata.com/instagram/user/posts', { params })
            
            // Debug: log response structure on first page
            if (pageCount === 1) {
              console.log(`[DEBUG] Response structure:`, JSON.stringify({
                hasData: !!response.data?.data,
                hasPosts: !!response.data?.data?.posts,
                postsLength: response.data?.data?.posts?.length || 0,
                lastCursor: response.data?.data?.last_cursor,
                topLevelKeys: Object.keys(response.data || {}),
                dataKeys: response.data?.data ? Object.keys(response.data.data) : [],
              }, null, 2))
            }
            
            const responseData = response.data?.data || response.data || {}
            const posts = responseData.posts || []
            const extractedPosts = posts.map((post: any) => post.node || post)

            console.log(`[STEP 2] Page ${pageCount}: Found ${extractedPosts.length} posts`)

            // Extract photo URLs and thumbnails from this page
            for (const post of extractedPosts) {
              const typename = post.__typename

              // Single image post
              if (typename === 'GraphImage' && post.display_url) {
                photoList.push({
                  url: post.display_url,
                  thumbnail: post.display_url,
                  id: post.id || post.shortcode,
                  caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                })
              }

              // Carousel post (Sidecar)
              if (typename === 'GraphSidecar' && post.display_url) {
                photoList.push({
                  url: post.display_url,
                  thumbnail: post.display_url,
                  id: post.id || post.shortcode,
                  caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                })

                // Also include carousel children if available
                if (post.edge_sidecar_to_children?.edges) {
                  for (const edge of post.edge_sidecar_to_children.edges) {
                    const child = edge.node
                    if (child.display_url && child.__typename === 'GraphImage') {
                      photoList.push({
                        url: child.display_url,
                        thumbnail: child.display_url,
                        id: child.id || `${post.id}_${photoList.length}`,
                        caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                      })
                    }
                  }
                }
              }
            }

            // Check pagination using last_cursor
            // Extract from normalized data first, then fallback to raw response
            const nextCursor = responseData.last_cursor || response.data?.data?.last_cursor || null

            // Stop only when cursor is missing (don't break on empty posts)
            if (!nextCursor) {
              break
            }

            cursor = nextCursor
          }

          // Filter out videos and duplicates
          const uniquePhotos = Array.from(
            new Map(photoList.map((photo) => [photo.url, photo])).values()
          )

          const photoUrls = uniquePhotos.map((p) => p.url)
          console.log(`[STEP 2] Found ${uniquePhotos.length} photos across ${pageCount} pages`)
          const logStep2Complete = JSON.stringify({
            type: 'log',
            step: 2,
            message: `Found ${uniquePhotos.length} photos`,
            status: 'complete',
            photoCount: uniquePhotos.length,
          }) + '\n'
          controller.enqueue(encoder.encode(logStep2Complete))

          // Step 3: Analyze with Gemini (with progress callback)
          console.log(`[STEP 3] Starting Gemini analysis of ${photoUrls.length} photos...`)
          const logStep3 = JSON.stringify({
            type: 'log',
            step: 3,
            message: `Starting Gemini analysis of ${photoUrls.length} photos`,
            status: 'processing',
            totalPhotos: photoUrls.length,
          }) + '\n'
          controller.enqueue(encoder.encode(logStep3))
          const result = await analyzeFacesWithGemini(
            photoUrls,
            10,
            (batch, totalBatches, analyzed, passed) => {
              // Send progress update
              const progressData = JSON.stringify({
                type: 'progress',
                batch,
                totalBatches,
                analyzed,
                passed,
              }) + '\n'
              controller.enqueue(encoder.encode(progressData))
            }
          )

          // Filter to only photos that passed (decision === 'yes')
          const passedResults = result.allResults.filter((r) => r.decision === 'yes')
          console.log(`[STEP 3] Analysis complete: ${passedResults.length} photos passed (out of ${photoUrls.length})`)
          
          // Map results back to photo objects
          const filteredPhotos = uniquePhotos
            .filter((photo) => passedResults.some((r) => r.url === photo.url))
            .map((photo) => {
              const result = passedResults.find((r) => r.url === photo.url)
              return {
                ...photo,
                geminiResult: result,
              }
            })

          // Save Instagram photos to database (only filtered photos that passed Gemini analysis)
          if (supabaseAdmin && filteredPhotos.length > 0) {
            // Get current max display_order
            const { data: maxOrderData } = await supabaseAdmin
              .from('media_items')
              .select('display_order')
              .order('display_order', { ascending: false })
              .limit(1)
              .single()
            
            const startOrder = maxOrderData?.display_order ? maxOrderData.display_order + 1 : 1
            
            const mediaToSave = filteredPhotos.map((photo, index) => ({
              type: 'photo',
              source: 'instagram',
              url: photo.url,
              caption: photo.caption,
              instagram_id: photo.id,
              instagram_username: username,
              display_order: startOrder + index,
            }))

            const { error } = await supabaseAdmin.from('media_items').insert(mediaToSave)
            if (error) {
              console.error('[ERROR] Failed to save Instagram photos:', error)
            }
          }

          // Send final complete message
          console.log(`\n[COMPLETE] Analysis complete! ${filteredPhotos.length} photos ready for identity cloning\n`)
          const completeData = JSON.stringify({
            type: 'complete',
            photos: filteredPhotos,
            totalAnalyzed: photoUrls.length,
            totalPassed: filteredPhotos.length,
          }) + '\n'
          controller.enqueue(encoder.encode(completeData))
          controller.close()
        } catch (error: any) {
          const errorData = JSON.stringify({
            type: 'error',
            error: error.message || 'Failed to analyze photos',
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
    return new Response(JSON.stringify({ error: error.message || 'Failed to start analysis' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

