/**
 * Nano Banana Pro API Client
 * Handles image generation using Google Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

export class NanoBananaClient {
  private genAI: GoogleGenerativeAI
  private modelId: string

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NANO_BANANA_API_KEY || ''
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or NANO_BANANA_API_KEY environment variable is required')
    }
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.modelId = process.env.GEMINI_MODEL_ID || 'gemini-3-pro-image-preview'
  }

  /**
   * Convert image URL or base64 data URL to base64 string
   * Handles R2 URLs (via proxy), external URLs, and base64 data URLs
   * @param imageUrl The image URL or base64 data URL
   * @param appBaseUrl The base URL of the Next.js app (for proxy endpoint)
   */
  private async imageToBase64(imageUrl: string, appBaseUrl?: string): Promise<string> {
    try {
      // If already base64 data URL, extract just the base64 part
      if (imageUrl.startsWith('data:')) {
        const base64Part = imageUrl.split(',')[1]
        if (base64Part) {
          return base64Part
        }
        // If no comma, assume it's already just base64
        return imageUrl
      }

      // Check if it's an R2 URL - use proxy endpoint
      const isR2Url = imageUrl.includes('r2.cloudflarestorage.com')
      // Use app base URL from env or default to localhost for server-side
      const appBase = appBaseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const fetchUrl = isR2Url 
        ? `${appBase}/api/media/proxy?url=${encodeURIComponent(imageUrl)}`
        : imageUrl

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
      console.error(`[NANO_BANANA] Failed to convert image to base64: ${imageUrl}`, error)
      throw error
    }
  }

  /**
   * Retry a function with exponential backoff
   * @param fn Function to retry
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @param initialDelay Initial delay in milliseconds (default: 1000ms)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt) // Exponential backoff: 1s, 2s, 4s
          console.log(`[NANO_BANANA] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    throw lastError
  }

  /**
   * Generate an image using Nano Banana Pro API
   * 
   * @param prompt The generation prompt (with {mutation} placeholder)
   * @param referenceImages Array of reference image URLs
   * @param mutation The mutation string to apply (replaces {mutation} in prompt)
   * @returns Base64-encoded image data
   */
  async generateImage(
    prompt: string,
    referenceImages: string[],
    mutation: string
  ): Promise<string> {
    // Build final prompt with mutation
    const finalPrompt = prompt.replace('{mutation}', mutation)
    
    // Convert all reference images to base64
    // Pass undefined for appBaseUrl - will use env var or default
    const base64References = await Promise.all(
      referenceImages.map(url => this.imageToBase64(url))
    )
    
    console.log('[NANO_BANANA] Generating image with:')
    console.log(`  Prompt length: ${finalPrompt.length} chars`)
    console.log(`  Reference images: ${base64References.length}`)
    console.log(`  Mutation: ${mutation}`)
    console.log(`  Model: ${this.modelId}`)
    
    // Call Google Gemini API with retry logic
    return await this.retryWithBackoff(async () => {
      const model = this.genAI.getGenerativeModel({ model: this.modelId })
      
      // Prepare image parts for Gemini API
      const imageParts = base64References.map((base64, index) => {
        // Try to detect MIME type from base64 or default to jpeg
        // Most images will be jpeg, but we'll default to that
        return {
          inlineData: {
            data: base64,
            mimeType: 'image/jpeg', // Default, can be enhanced later
          },
        }
      })
      
      // Generate content with prompt and reference images
      // @ts-ignore - imageConfig may not be in types yet
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: finalPrompt },
            ...imageParts,
          ],
        }],
        generationConfig: {
          imageConfig: {
            aspectRatio: '9:16',
            imageSize: '4K',
          },
        } as any,
      })
      
      const response = result.response
      
      // Extract image data from response
      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: any) => part.inlineData?.data
      )
      
      if (!imagePart?.inlineData?.data) {
        throw new Error('Gemini API did not return image data')
      }
      
      return imagePart.inlineData.data
    }, 3, 1000) // 3 retries, 1s initial delay
  }
}

