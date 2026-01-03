import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function truncateUrl(url: string): string {
  return url.length > 30 ? url.substring(0, 30) + '...' : url
}

export interface GeminiAnalysisResult {
  url: string
  zoom_score: number
  visibility_score: number
  total: number
  decision: 'yes' | 'no'
  explanation: string
}

export interface GeminiAnalysisResponse {
  allResults: GeminiAnalysisResult[]
  topSelections: GeminiAnalysisResult[]
}

export async function analyzeFacesWithGemini(
  urls: string[],
  batchSize: number = 10,
  onProgress?: (batch: number, totalBatches: number, analyzed: number, passed: number) => void
): Promise<GeminiAnalysisResponse> {
  const results: GeminiAnalysisResult[] = []
  const totalBatches = Math.ceil(urls.length / batchSize)

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(urls.length / batchSize)
    console.log(`\n  [BATCH ${batchNumber}/${totalBatches}] Analyzing ${batch.length} photos...`)

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      
      // Fetch images and convert to base64 for Gemini API
      const imageParts = await Promise.all(
        batch.map(async (url) => {
          try {
            // Fetch image and convert to base64 with timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
            
            const response = await fetch(url, { signal: controller.signal })
            clearTimeout(timeoutId)
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const base64 = buffer.toString('base64')
            
            // Determine MIME type from URL or response headers
            const contentType = response.headers.get('content-type') || 'image/jpeg'
            
            return {
              data: base64,
              mimeType: contentType,
              url, // Keep URL for mapping results back
            }
          } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('timeout') || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
              console.error(`[ERROR] Timeout fetching image ${truncateUrl(url)}`)
            } else {
            console.error(`[ERROR] Failed to fetch image ${truncateUrl(url)}:`, error)
            }
            return { url, error: true }
          }
        })
      )

      const validImageParts = imageParts.filter((part: any) => part && !part.error && part.data)
      const errorUrls = imageParts.filter((part: any) => part && part.error).map((p: any) => p.url)

      // Add error results for failed image fetches
      errorUrls.forEach((url: string) => {
        results.push({
          url,
          zoom_score: 0,
          visibility_score: 0,
          total: 0,
          decision: 'no',
          explanation: 'Failed to fetch image',
        })
      })

      if (validImageParts.length === 0) {
        console.error(`[ERROR] No valid images in batch`)
        continue
      }

      // Create a mapping of image index to URL (only for valid images)
      const urlMap = validImageParts.map((part: any) => part.url)
      
      const prompt = `Analyze these ${validImageParts.length} photos (numbered 0 to ${validImageParts.length - 1}) for identity cloning suitability. For each photo:

1. Detect faces - REJECT if no face detected or multiple faces detected (must be single person only)
2. Check orientation: REJECT if photo is upside down or significantly rotated (>30°). Photo must be in normal, upright orientation (slight tilts <30° are acceptable)
3. Score zoom (1-10): Higher if face fills 25%+ of frame and is centered. Face should be clearly visible and well-zoomed. REJECT if zoom score <6/10 (too zoomed out)
4. Score visibility (1-10): Higher if unobstructed. REJECT if eyes are closed, or excessive clothing/accessories obscuring the face (hats, masks, hands covering face). CRITICAL: REJECT if hand or any object is covering the nose - the nose must be fully visible and unobstructed
5. Check pose: REJECT if weird/unnatural pose or unnatural expression
6. Decision: "yes" ONLY if ALL conditions met: single face, normal orientation (not upside down or significantly rotated), zoom >=6, visibility >=6, nose fully visible and unobstructed (no hands/objects covering nose), natural pose

Output strict JSON array with index numbers: [{"index": 0, "zoom_score": X, "visibility_score": Y, "total": X+Y, "decision": "yes/no", "explanation": "..."}, ...]. Be strict - reject photos that are upside down, too zoomed out (zoom <6), have multiple people, eyes closed, excessive clothing, hands/objects covering the nose, or weird poses.`

      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            ...validImageParts.map((part: any) => ({
              inlineData: {
                data: part.data,
                mimeType: part.mimeType,
              },
            })),
          ],
        }],
      })

      let output: string
      try {
        output = response.response.text()
      } catch (error: any) {
        // Handle PROHIBITED_CONTENT errors
        if (error.message?.includes('PROHIBITED_CONTENT') || error.message?.includes('Text not available')) {
          console.error(`  [BATCH ${batchNumber}/${totalBatches}] Content blocked by safety filters`)
          // Mark all photos in batch as rejected
          urlMap.forEach((url) => {
            results.push({
              url,
              zoom_score: 0,
              visibility_score: 0,
              total: 0,
              decision: 'no',
              explanation: 'Content blocked by safety filters',
            })
          })
          continue
        }
        throw error
      }

      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) || output.match(/```\s*([\s\S]*?)\s*```/)
      const jsonString = jsonMatch ? jsonMatch[1] : output
      const parsed = JSON.parse(jsonString.trim().replace(/```json|```/g, ''))

      const batchResults = Array.isArray(parsed) ? parsed : [parsed]
      
      // Map results back to URLs by index
      batchResults.forEach((result: any) => {
        const index = result.index !== undefined ? result.index : batchResults.indexOf(result)
        if (index >= 0 && index < urlMap.length) {
          const url = urlMap[index]
          results.push({
            url,
            zoom_score: result.zoom_score || 0,
            visibility_score: result.visibility_score || 0,
            total: result.total || (result.zoom_score || 0) + (result.visibility_score || 0),
            decision: result.decision === 'yes' ? 'yes' : 'no',
            explanation: result.explanation || '',
          })
        }
      })

      const yesCount = batchResults.filter((r: any) => r.decision === 'yes').length
      const analyzedCount = results.length
      const passedCount = results.filter(r => r.decision === 'yes').length

      console.log(`  [BATCH ${batchNumber}/${totalBatches}] Complete: ${yesCount} passed, ${batchResults.length - yesCount} rejected (Total: ${passedCount}/${analyzedCount} passed so far)`)

      // Call progress callback
      if (onProgress) {
        onProgress(batchNumber, totalBatches, analyzedCount, passedCount)
      }
    } catch (error) {
      const batchNumber = Math.floor(i / batchSize) + 1
      console.error(`  [BATCH ${batchNumber}/${totalBatches}] Failed:`, error)
      batch.forEach(url => results.push({
        url,
        zoom_score: 0,
        visibility_score: 0,
        total: 0,
        decision: 'no',
        explanation: 'API error',
      }))
    }
  }

  const yesResults = results.filter(r => r.decision === 'yes')
  const sorted = yesResults.sort((a, b) => b.total - a.total)
  
  return {
    allResults: results,
    topSelections: sorted.slice(0, 5),
  }
}
