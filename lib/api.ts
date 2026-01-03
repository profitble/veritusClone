import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { logCost, calculateEnsembleCost, USER_INFO_UNITS } from './cost-tracker'

const ENSEMBLE_BASE_URL = 'https://api.ensembledata.com'

// Removed unused interfaces: InstagramPhoto, PhotoRating, RatingResult, FaceDetectionResult, CombinedPhotoResult
// These were related to Grok processing which has been removed

export async function getInstagramUserId(username: string, sessionId?: string): Promise<number> {
  const token = process.env.ENSEMBLE_DATA_TOKEN
  if (!token) {
    throw new Error('ENSEMBLE_DATA_TOKEN not configured')
  }

  const response = await axios.get(`${ENSEMBLE_BASE_URL}/instagram/user/info`, {
    params: { username, token },
  })
  
  // Log cost
  if (sessionId) {
    const cost = calculateEnsembleCost(USER_INFO_UNITS)
    await logCost({
      sessionId,
      api: 'ensemble',
      endpoint: '/instagram/user/info',
      units: USER_INFO_UNITS,
      cost,
    })
  }
  
  if (!response.data?.data?.pk) {
    throw new Error(`Failed to get user ID for username: ${username}. Response: ${JSON.stringify(response.data)}`)
  }
  
  return response.data.data.pk // User ID
}

// Removed unused functions: getInstagramUserPostCount, getInstagramPosts, getAllInstagramPosts
// These are no longer needed with the preview-based approach

// Grok-4 functions removed - not currently in use

