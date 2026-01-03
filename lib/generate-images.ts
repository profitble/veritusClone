import { supabaseAdmin } from '@/lib/supabase'
import { NanoBananaClient } from '@/lib/nano-banana'
import { uploadToR2 } from '@/lib/cloudflare'

export interface GenerationConfig {
  identityRecords: Array<{ id: string; [key: string]: any }>
  mutations: Array<{ id: string; mutation: string; prompt?: string }>
  referenceImageUrls: string[]
  generationId: string
  sourceType: 'anc' | 'var'
  logPrefix: string
  basePrompt?: string
}

export async function generateImagesSequentially(config: GenerationConfig) {
  const { identityRecords, mutations, referenceImageUrls, generationId, sourceType, logPrefix, basePrompt } = config
  
  if (!supabaseAdmin) {
    throw new Error('Database client not available')
  }
  
  const admin = supabaseAdmin
  const client = new NanoBananaClient()
  let completedCount = 0
  let failedCount = 0

  // Generate images sequentially
  for (let i = 0; i < identityRecords.length; i++) {
    const identity = identityRecords[i]
    // For anchors: use angle-left for first 5, angle-right for last 5
    // For variants: use mutation from array directly
    const mutationIndex = sourceType === 'anc' ? (i < 5 ? 0 : 1) : i
    const mutation = mutations[mutationIndex]
    
    // Build prompt: anchors use basePrompt.replace(), variants use mutation.prompt directly
    const prompt = basePrompt 
      ? basePrompt.replace('{mutation}', mutation.mutation)
      : mutation.prompt || ''
    
    // Mutation parameter: anchors pass mutation.mutation, variants pass empty string
    const mutationParam = basePrompt ? mutation.mutation : ''
    
    try {
      console.log(`[${logPrefix}] Generating image ${i + 1}/${identityRecords.length} for identity ${identity.id}...`)
      
      // Generate image (retry logic handled in client)
      const base64Image = await client.generateImage(prompt, referenceImageUrls, mutationParam)
      
      // Convert base64 to Blob
      const imageBuffer = Buffer.from(base64Image, 'base64')
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
      
      // Upload to R2 - different naming patterns
      const fileName = sourceType === 'anc'
        ? `${sourceType}_${identity.id}_${mutation.id}_${(i % 5) + 1}.jpg`
        : `${sourceType}_${identity.id}_${mutation.id}.jpg`
      const r2Url = await uploadToR2(blob, fileName)
      
      console.log(`[${logPrefix}] Uploaded image ${i + 1}/${identityRecords.length} to R2: ${r2Url}`)
      
      // Update database (with retry logic)
      let updateSuccess = false
      for (let retry = 0; retry < 5; retry++) {
        const { error: updateError } = await admin
          .from('identities')
          .update({
            generated_image_url: r2Url,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', identity.id)
        
        if (!updateError) {
          updateSuccess = true
          completedCount++
          break
        }
        
        if (retry < 4) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)))
        }
      }
      
      if (!updateSuccess) {
        console.error(`[${logPrefix}] Failed to update database for identity ${identity.id} after retries`)
        failedCount++
        await admin
          .from('identities')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', identity.id)
      }
    } catch (error: any) {
      console.error(`[${logPrefix}] Failed to generate image ${i + 1}/${identityRecords.length}:`, error)
      failedCount++
      // Mark as failed
      await admin
        .from('identities')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', identity.id)
    }
  }

  // Update generation status to 'done' for all identities in batch
  console.log(`[${logPrefix}] Generation complete: ${completedCount} succeeded, ${failedCount} failed`)
  await admin
    .from('identities')
    .update({
      gen_st: 'done',
      updated_at: new Date().toISOString(),
    })
    .eq('gen_id', generationId)

  return {
    completed: completedCount,
    failed: failedCount,
    total: identityRecords.length,
  }
}

