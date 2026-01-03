import axios, { AxiosInstance } from 'axios'

export const PROMPT = `Reference this image, keeping the same person with her original identity and overall gentle temperament entirely unchanged. Preserve pose, framing, lighting, background, facial structure, expression, and proportions. The person must have exactly two hands, naturally positioned as in the original image. Perform targeted optimization based solely on existing features without any drastic reshaping, ensuring high attractiveness, facial symmetry, and harmonious proportions aligned with East Asian beauty ideals.

Enhance skin quality: make the skin significantly whiter yet highly clean, delicate, even, hydrated, and translucent with a soft natural glow resembling perfect long-term skincare and glass-like porcelain texture. Retain realistic texture while avoiding any waxy or plastic feel or obvious edits.

Apply subtle K-pop style makeup: light foundation, straight brows, gradient pink lips, soft eyeliner, long lashes, subtle double eyelids, aegyo-sal under-eye highlights for a cute youthful charm, and natural blush for a fresh youthful look with a dewy, radiant finish.

Enhance eyes: slightly enlarge and brighten the eyes on their original basis to enhance clarity and roundness with natural proportions and no exaggeration. Softly fill the under-eye area without any filler traces, making them more expressive, almond-shaped yet rounded, with a captivating sparkle and perfect symmetry.

Refine facial contours: lightly refine for a cleaner jawline that remains soft and feminine, with a small balanced face shape achieving a gentle V-line for elegance without overly sharpening. Perform only minor subtle refinements on the nose to add a slim, high bridge and lips to make them plumper and more defined while keeping their original proportions and ensuring overall facial harmony.

Maintain realistic body proportions with a slightly fuller chest that conforms naturally without exaggeration or fabric distortion. Ensure clothing remains exactly as in the original with no changes or added exposure, strictly following real fabric physics.

Achieve an overall highly refined yet believably natural close-up photo in amateur style under good natural lighting with true colors. Photorealistic, no stylization, sharp focus, masterpiece quality with detailed, attractive facial features.`


export interface SeedreamConfig {
  apiKey: string
}

export class SeedreamClient {
  private client: AxiosInstance
  private config: SeedreamConfig

  constructor(config: SeedreamConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: 'https://api.wavespeed.ai',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    })
  }

  async enhanceImage(imageBase64: string, prompt: string = PROMPT, size: string = '3072*3840'): Promise<string> {
    const endpoint = `/api/v3/bytedance/seedream-v4.5/edit`
    const payload = {
      images: [imageBase64],
      prompt: prompt,
      size: size,
    }

    try {
      const response = await this.client.post(endpoint, payload)
      if (response.data) {
        const data = response.data.data || response.data
        if (data.id || data.requestId) {
          const requestId = data.id || data.requestId
          return await this.pollForResult(requestId)
        }
        let imageUrl: string | undefined
        if (response.data.output) {
          imageUrl = response.data.output
        } else if (data.output) {
          imageUrl = data.output
        } else if (data.outputs && data.outputs.length > 0) {
          imageUrl = data.outputs[0]
        } else if (response.data.url) {
          imageUrl = response.data.url
        } else if (data.url) {
          imageUrl = data.url
        }
        if (imageUrl) {
          return imageUrl
        }
      }
      throw new Error(`Invalid API response format: ${JSON.stringify(response.data)}`)
    } catch (error: any) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  private async pollForResult(requestId: string): Promise<string> {
    const maxAttempts = 60
    let attempts = 0
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const pollResponse = await this.client.get(
          `/api/v3/predictions/${requestId}/result`
        )
        const data = pollResponse.data.data || pollResponse.data
        const status = data.status || pollResponse.data.status
        if (status === 'completed' || status === 'succeeded') {
          let imageUrl: string | undefined
          if (data.outputs && data.outputs.length > 0) {
            imageUrl = data.outputs[0]
          } else if (data.output) {
            imageUrl = data.output
          } else if (pollResponse.data.output) {
            imageUrl = pollResponse.data.output
          }
          if (imageUrl) {
            return imageUrl
          }
        }
        if (status === 'failed' || status === 'error') {
          throw new Error(`Image processing failed: ${JSON.stringify(data)}`)
        }
        attempts++
      } catch (error: any) {
        if (error.response?.status === 404) {
          attempts++
          continue
        }
        throw error
      }
    }
    throw new Error('Timeout waiting for image processing result')
  }
}

