import { z } from 'zod'

// Instagram profile URL schema - normalizes and validates
export const instagramProfileUrlSchema = z
  .string()
  .min(1, 'URL is required')
  .transform((url) => {
    // Normalize: add https:// if missing
    const trimmed = url.trim()
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    
    try {
      const urlObj = new URL(normalized)
      
      // Extract username from path (handle /p/ paths, /username/, etc.)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      let username: string | null = pathParts[0] || null
      
      // If path starts with 'p', skip it and get the next part (for post URLs)
      if (username === 'p' && pathParts.length > 1) {
        // This is a post URL, we can't extract username from it
        // But we'll still normalize it
        username = null
      }
      
      // Remove trailing slashes and reconstruct URL
      // Strip all query parameters (UTM, igshid, etc.)
      const normalizedPath = username ? `/${username}` : urlObj.pathname.replace(/\/$/, '')
      const normalizedUrl = `https://${urlObj.hostname}${normalizedPath}`
      
      return normalizedUrl
    } catch {
      return normalized
    }
  })
  .pipe(
    z.string().url('Must be a valid URL').refine(
      (url) => {
        try {
          const urlObj = new URL(url)
          return urlObj.hostname.includes('instagram.com')
        } catch {
          return false
        }
      },
      { message: 'Must be an Instagram profile URL' }
    )
  )
  .refine(
    (url) => {
      try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(Boolean)
        // Must have a username in the path (not just instagram.com/)
        // Allow /p/ paths but they won't have a username
        return pathParts.length > 0 && pathParts[0] !== 'embed'
      } catch {
        return false
      }
    },
    { message: 'Must be a valid Instagram profile URL (e.g., https://instagram.com/username)' }
  )

// Extract username from Instagram URL
export function extractUsernameFromUrl(url: string): string {
  try {
    // First normalize the URL (remove query params, trailing slashes)
    const trimmed = url.trim()
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    const urlObj = new URL(normalized)
    
    // Remove query parameters
    const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
    const cleanUrlObj = new URL(cleanUrl)
    
    const pathParts = cleanUrlObj.pathname.split('/').filter(Boolean)
    
    // Skip 'p' if it's a post URL - we can't extract username from posts
    let username = pathParts[0]
    if (username === 'p') {
      throw new Error('Cannot extract username from Instagram post URL')
    }
    
    if (username && username !== 'embed' && username !== 'p') {
      return username.replace('@', '').replace(/\/$/, '')
    }
    
    throw new Error('Could not extract username from URL')
  } catch (error: any) {
    if (error.message) {
      throw error
    }
    throw new Error('Invalid Instagram URL format')
  }
}

