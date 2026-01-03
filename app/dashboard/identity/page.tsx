'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Image as ImageIcon, Loader2 } from 'lucide-react'
import { PrimaryButton } from '@/components/ui/primary-button'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { IdentityCard } from '@/components/dashboard/identity-card'
import { ExpandedPanel } from '@/components/dashboard/expanded-panel'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { toast } from 'sonner'
import { ProcessingContext } from '@/contexts/processing-context'

interface Identity {
  id: string
  name: string
  source_photos: string[]
  generated_image_url: string | null
  status?: 'processing' | 'completed' | 'failed'
  src?: 'sd' | 'anc' | 'var'
  gen_st?: 'gen' | 'done' | null
  gen_id?: string | null
  created_at: string
  updated_at: string
  instagram_username?: string | null
}

interface GroupedIdentity {
  instagram_username: string | null
  identities: Identity[]
  photoCount: number
  firstImage: string | null
  mainCandidate: Identity | null
  hasProcessing: boolean
  hasCompleted: boolean
  processingCount: number
  totalCount: number
  completedCount: number
  hasAnchorImages: boolean
}

export default function Identities() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedUsername, setExpandedUsername] = useState<string | null>(null)
  const [deletingUsername, setDeletingUsername] = useState<string | null>(null)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null)
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; groupKey: string } | null>(null)
  const [anchorToGenerate, setAnchorToGenerate] = useState<string | null>(null)
  const [primaryToSelectMain, setPrimaryToSelectMain] = useState<string | null>(null)
  const [primaryToSelect, setPrimaryToSelect] = useState<{ id: string; groupKey: string } | null>(null)
  const [primaryImages, setPrimaryImages] = useState<Record<string, string>>({}) // username -> identity id
  const [generatingAnchor, setGeneratingAnchor] = useState<Set<string>>(new Set())
  const [anchorGenerationProgress, setAnchorGenerationProgress] = useState<Record<string, {
    total: number
    completed: number
    failed: number
  }>>({})
  const [generatingVariants, setGeneratingVariants] = useState<Set<string>>(new Set())
  const [variantGenerationProgress, setVariantGenerationProgress] = useState<Record<string, {
    total: number
    completed: number
    failed: number
  }>>({})
  // Refs for cards (used to get dimensions for expanded panel)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Helper to proxy R2 URLs for Next.js Image component
  const getProxiedImageUrl = (url: string | null): string | null => {
    if (!url) return null
    if (url.includes('r2.cloudflarestorage.com')) {
      return `/api/media/proxy?url=${encodeURIComponent(url)}`
    }
    return url
  }

  const fetchIdentities = async () => {
    try {
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('identities')
        .select('*')
        .neq('status', 'failed')
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setIdentities(data || [])
    } catch (err: any) {
      console.error('[ERROR] Failed to fetch identities:', err)
      setError(err.message || 'Failed to load identities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIdentities()
  }, [])

  // Load primary images from database
  useEffect(() => {
    const loadPrimaryImages = async () => {
      try {
        const { data, error } = await supabase
          .from('identities')
          .select('id, instagram_username')
          .eq('is_primary', true)
          .not('instagram_username', 'is', null)

        // Check if error exists and handle column not found case
        if (error) {
          const errorStr = JSON.stringify(error)
          const errorMessage = error.message || errorStr
          
          // If column doesn't exist (empty error object or column-related errors), silently skip
          if (!errorStr || errorStr === '{}' || error.code === '42703' || 
              errorMessage.includes('column') || errorMessage.includes('does not exist') || 
              errorMessage.includes('is_primary') || errorMessage.includes('42703')) {
            console.log('[INFO] is_primary column not found, skipping primary load (column will be added via migration)')
            return
          }
          console.error('[ERROR] Failed to load primary images:', error)
          return
        }

        // Build map from database results
        const primaryMap: Record<string, string> = {}
        data?.forEach(id => {
          if (id.instagram_username) {
            primaryMap[id.instagram_username] = id.id
          }
        })
        setPrimaryImages(primaryMap)
      } catch (err: any) {
        // Handle case where column might not exist
        const errorStr = err ? JSON.stringify(err) : '{}'
        const errorMessage = err?.message || errorStr
        
        if (errorStr === '{}' || err?.code === '42703' || 
            errorMessage.includes('column') || errorMessage.includes('does not exist') || 
            errorMessage.includes('is_primary') || errorMessage.includes('42703')) {
          console.log('[INFO] is_primary column not found, skipping primary load (column will be added via migration)')
          return
        }
        console.error('[ERROR] Failed to load primary images:', err)
      }
    }

    loadPrimaryImages()
  }, [])

  useEffect(() => {
    // Real-time subscription for instant updates
    // Use useRef to persist channel across React Strict Mode's double-mounts in development
    let mounted = true
    
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('identities-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'identities',
          },
          (payload) => {
            // Prevent state updates after unmount
            if (!mounted) return
            
            const newRecord = payload.new as Identity | null
            const oldRecord = payload.old as Identity | null
            console.log('[REALTIME] 📡 Received event:', payload.eventType, {
              id: newRecord?.id || oldRecord?.id,
              username: newRecord?.instagram_username || oldRecord?.instagram_username,
              src: newRecord?.src || oldRecord?.src,
              status: newRecord?.status || oldRecord?.status,
              hasImage: !!newRecord?.generated_image_url,
              gen_st: newRecord?.gen_st || oldRecord?.gen_st,
            })
            
            // Optimistically update state when database changes
            setIdentities((prev) => {
              const updated = [...prev]
              const newRecord = payload.new as Identity | null
              const oldRecord = payload.old as Identity | null
              const recordId = newRecord?.id || oldRecord?.id
              
              if (!recordId) {
                console.log('[REALTIME] ⚠️ No record ID found, skipping update')
                return prev
              }
              
              const index = updated.findIndex((id) => id.id === recordId)
              
              if (payload.eventType === 'UPDATE' && newRecord) {
                if (index !== -1) {
                  // Update existing record
                  const oldStatus = updated[index].status
                  const oldHasImage = !!updated[index].generated_image_url
                  updated[index] = { ...updated[index], ...newRecord } as Identity
                  console.log('[REALTIME] ✅ Updated identity:', recordId, {
                    username: newRecord.instagram_username,
                    src: newRecord.src,
                    statusChanged: oldStatus !== newRecord.status,
                    imageAdded: !oldHasImage && !!newRecord.generated_image_url,
                    newStatus: newRecord.status,
                    hasImage: !!newRecord.generated_image_url,
                  })
                } else {
                  // New record appeared (shouldn't happen but handle it)
                  updated.push(newRecord as Identity)
                  console.log('[REALTIME] ➕ Added new identity (unexpected):', recordId)
                }
              } else if (payload.eventType === 'INSERT' && newRecord) {
                // New record inserted during generation
                // Check if it already exists to avoid duplicates
                if (index === -1) {
                  updated.push(newRecord as Identity)
                  console.log('[REALTIME] ➕ Inserted new identity:', recordId, {
                    username: newRecord.instagram_username,
                    src: newRecord.src,
                  })
                } else {
                  console.log('[REALTIME] ⚠️ INSERT event but identity already exists:', recordId)
                }
              } else if (payload.eventType === 'DELETE' && index !== -1) {
                // Record deleted
                updated.splice(index, 1)
                console.log('[REALTIME] 🗑️ Deleted identity:', recordId)
              }
              
              console.log('[REALTIME] 📊 Total identities after update:', updated.length)
              // Return new array reference to trigger re-render
              return [...updated]
            })
          }
        )
        .subscribe((status) => {
          console.log('[REALTIME] 🔌 Subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('[REALTIME] ✅ Successfully subscribed to identities table changes')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[REALTIME] ❌ Channel error - real-time not working!')
          } else if (status === 'TIMED_OUT') {
            console.error('[REALTIME] ⏱️ Subscription timed out')
          } else if (status === 'CLOSED') {
            console.log('[REALTIME] 🔴 Channel closed')
          }
        })
    }

    // Cleanup on unmount
    return () => {
      mounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // Fallback polling during anchor generation (in case real-time fails)
  useEffect(() => {
    if (generatingAnchor.size === 0) return

    console.log('[POLLING] 🔄 Starting fallback polling for anchor generation')
    const interval = setInterval(() => {
      console.log('[POLLING] 📡 Fetching identities (fallback)')
      fetchIdentities()
    }, 2000) // Poll every 2 seconds while generating

    return () => {
      console.log('[POLLING] 🛑 Stopping fallback polling')
      clearInterval(interval)
    }
  }, [generatingAnchor])

  // Fallback polling during variant generation (in case real-time fails)
  useEffect(() => {
    if (generatingVariants.size === 0) return

    console.log('[POLLING] 🔄 Starting fallback polling for variant generation')
    const interval = setInterval(() => {
      console.log('[POLLING] 📡 Fetching identities (fallback)')
      fetchIdentities()
    }, 2000) // Poll every 2 seconds while generating

    return () => {
      console.log('[POLLING] 🛑 Stopping fallback polling')
      clearInterval(interval)
    }
  }, [generatingVariants])

  // Restore anchor generation state on page load
  useEffect(() => {
    const checkInProgressGenerations = async () => {
      // Find all usernames with in-progress anchor generation
      const { data } = await supabase
        .from('identities')
        .select('instagram_username, gen_st, status, generated_image_url, src')
        .eq('gen_st', 'gen')
        .not('instagram_username', 'is', null)

      if (!data || data.length === 0) return

      // Group by username
      const usernameMap = new Map<string, typeof data>()
      data.forEach(id => {
        const username = id.instagram_username!
        if (!usernameMap.has(username)) {
          usernameMap.set(username, [])
        }
        usernameMap.get(username)!.push(id)
      })

      // Only restore state for usernames that have anchor identities with gen_st='gen'
      // AND at least one is not complete (still generating)
      const usernamesToRestore: string[] = []
      const progress: Record<string, { total: number; completed: number; failed: number }> = {}
      
      usernameMap.forEach((identities, username) => {
        // Filter to only anchor identities that are generating
        const generatingAnchors = identities.filter(id => 
          id.src === 'anc' && id.gen_st === 'gen'
        )
        
        // Only restore if there are actually generating anchor identities
        // and they're not all complete
        if (generatingAnchors.length > 0) {
          const allComplete = generatingAnchors.every(id => 
            id.gen_st === 'done' || id.status === 'failed'
          )
          
          // Only restore if not all complete (still generating)
          // Restore if there are generating anchors (don't require completed images)
          // This ensures state persists even if you refresh right after clicking Generate
          if (!allComplete) {
            usernamesToRestore.push(username)
            
            const completed = generatingAnchors.filter(id => 
              id.status === 'completed' && id.generated_image_url
            ).length
            const failed = generatingAnchors.filter(id => id.status === 'failed').length
            
            progress[username] = { total: 10, completed, failed }
          }
        }
      })

      // Only restore state if there are usernames to restore
      if (usernamesToRestore.length > 0) {
        setGeneratingAnchor(new Set(usernamesToRestore))
        setAnchorGenerationProgress(progress)
      }
    }

    checkInProgressGenerations()
  }, []) // Run once on mount

  // Restore variant generation state on page load
  useEffect(() => {
    const checkInProgressVariants = async () => {
      // Find all usernames with in-progress variant generation
      const { data: generatingData } = await supabase
        .from('identities')
        .select('instagram_username, gen_st, status, generated_image_url, src')
        .eq('gen_st', 'gen')
        .eq('src', 'var')
        .not('instagram_username', 'is', null)

      // Also check for completed variants with primary set (for state persistence after refresh)
      const { data: primaryData } = await supabase
        .from('identities')
        .select('instagram_username')
        .eq('is_primary', true)
        .not('instagram_username', 'is', null)

      const { data: variantData } = await supabase
        .from('identities')
        .select('instagram_username, src, status, generated_image_url')
        .eq('src', 'var')
        .not('instagram_username', 'is', null)

      const usernamesToRestore: string[] = []
      const progress: Record<string, { total: number; completed: number; failed: number }> = {}
      
      // Check generating variants (in-progress)
      if (generatingData && generatingData.length > 0) {
        const usernameMap = new Map<string, typeof generatingData>()
        generatingData.forEach(id => {
          const username = id.instagram_username!
          if (!usernameMap.has(username)) {
            usernameMap.set(username, [])
          }
          usernameMap.get(username)!.push(id)
        })
        
        usernameMap.forEach((identities, username) => {
          const generatingVariants = identities.filter(id => 
            id.src === 'var' && id.gen_st === 'gen'
          )
          
          if (generatingVariants.length > 0) {
            const allComplete = generatingVariants.every(id => 
              id.gen_st === 'done' || id.status === 'failed'
            )
            
            if (!allComplete) {
              usernamesToRestore.push(username)
              const completed = generatingVariants.filter(id => 
                id.status === 'completed' && id.generated_image_url
              ).length
              const failed = generatingVariants.filter(id => id.status === 'failed').length
              progress[username] = { total: 5, completed, failed }
            }
          }
        })
      }
      
      // Check completed variants with primary set (for state persistence)
      if (primaryData && variantData) {
        const primaryUsernames = new Set(primaryData.map(p => p.instagram_username!))
        primaryUsernames.forEach(username => {
          if (usernamesToRestore.includes(username)) return // Already added
          
          const variants = variantData.filter(v => v.instagram_username === username)
          const hasVariants = variants.some(v => v.status === 'completed' && v.generated_image_url)
          
          if (hasVariants) {
            usernamesToRestore.push(username)
            const completed = variants.filter(v => v.status === 'completed' && v.generated_image_url).length
            const failed = variants.filter(v => v.status === 'failed').length
            progress[username] = { total: 5, completed, failed }
          }
        })
      }

      if (usernamesToRestore.length > 0) {
        setGeneratingVariants(new Set(usernamesToRestore))
        setVariantGenerationProgress(progress)
      }
    }

    checkInProgressVariants()
  }, []) // Run once on mount

  // Real-time subscription replaces polling - no need for this anymore

  // Update anchor generation progress as images complete
  useEffect(() => {
    if (generatingAnchor.size === 0) return

    console.log('[PROGRESS] 🔄 Checking progress for usernames:', Array.from(generatingAnchor))
    
    generatingAnchor.forEach((username) => {
      // Find ALL anchor identities for this username (not just those with gen_st='gen')
      // This ensures we count completed images even if gen_st hasn't been updated to 'done' yet
      const anchorIdentities = identities.filter(id => 
        id.instagram_username === username &&
        id.src === 'anc'
      )
      
      console.log(`[PROGRESS] 👤 ${username}: Found ${anchorIdentities.length} anchor identities`)
      
      // Count visible completed images (must have generated_image_url to be visible)
      const visibleCompleted = anchorIdentities.filter(id => 
        id.status === 'completed' && id.generated_image_url
      ).length
      
      // Count failed images
      const failed = anchorIdentities.filter(id => id.status === 'failed').length
      
      const completedDetails = anchorIdentities
        .filter(id => id.status === 'completed' && id.generated_image_url)
        .map(id => ({ id: id.id, hasImage: !!id.generated_image_url, status: id.status }))
      
      console.log(`[PROGRESS] 📊 ${username}: ${visibleCompleted}/10 completed, ${failed} failed`, {
        completedDetails,
        allIdentities: anchorIdentities.map(id => ({
          id: id.id,
          status: id.status,
          hasImage: !!id.generated_image_url,
          gen_st: id.gen_st,
        })),
      })
      
      // Update progress state (this triggers UI update in IdentityCard)
      setAnchorGenerationProgress(prev => ({
        ...prev,
        [username]: { total: 10, completed: visibleCompleted, failed }
      }))

      // Check if generation is complete
      // Complete if: we have 10 identities AND (all have gen_st='done' OR all have status='failed' OR we have 10 completed)
      const allComplete = anchorIdentities.length === 10 && (
        anchorIdentities.every(id => id.gen_st === 'done' || id.status === 'failed') ||
        visibleCompleted === 10
      )

      if (allComplete) {
        console.log(`[PROGRESS] ✅ ${username}: Generation complete!`)
        // Remove from generating set (stops showing "X/10 generating" text)
        setGeneratingAnchor(prev => {
          const next = new Set(prev)
          next.delete(username)
          return next
        })

        // If all 10 images failed, show error toast
        if (failed === 10 && visibleCompleted === 0) {
          toast.error('Failed to generate anchor images. Please try again.')
        }
      }
    })
  }, [identities, generatingAnchor]) // Runs when identities update (via real-time subscription)

  // Update variant generation progress as images complete
  useEffect(() => {
    if (generatingVariants.size === 0) return

    console.log('[PROGRESS] 🔄 Checking variant progress for usernames:', Array.from(generatingVariants))
    
    generatingVariants.forEach((username) => {
      // Find ALL variant identities for this username (not just those with gen_st='gen')
      // This ensures we count completed images even if gen_st hasn't been updated to 'done' yet
      const variantIdentities = identities.filter(id => 
        id.instagram_username === username &&
        id.src === 'var'
      )
      
      console.log(`[PROGRESS] 👤 ${username}: Found ${variantIdentities.length} variant identities`)
      
      // Count visible completed images (must have generated_image_url to be visible)
      const visibleCompleted = variantIdentities.filter(id => 
        id.status === 'completed' && id.generated_image_url
      ).length
      
      // Count failed images
      const failed = variantIdentities.filter(id => id.status === 'failed').length
      
      console.log(`[PROGRESS] 📊 ${username}: ${visibleCompleted}/5 completed, ${failed} failed`)
      
      // Update progress state (this triggers UI update in IdentityCard)
      setVariantGenerationProgress(prev => ({
        ...prev,
        [username]: { total: 5, completed: visibleCompleted, failed }
      }))

      // Check if generation is complete
      // Complete if: we have 5 identities AND (all have gen_st='done' OR all have status='failed' OR we have 5 completed)
      const allComplete = variantIdentities.length === 5 && (
        variantIdentities.every(id => id.gen_st === 'done' || id.status === 'failed') ||
        visibleCompleted === 5
      )

      if (allComplete) {
        console.log(`[PROGRESS] ✅ ${username}: Variant generation complete!`)
        // Remove from generating set (stops showing "X/5 generating" text)
        setGeneratingVariants(prev => {
          const next = new Set(prev)
          next.delete(username)
          return next
        })

        // If all 5 images failed, show error toast
        if (failed === 5 && visibleCompleted === 0) {
          toast.error('Failed to generate variant images. Please try again.')
        }
      }
    })
  }, [identities, generatingVariants]) // Runs when identities update (via real-time subscription)

  // Group identities by Instagram username
  const groupedIdentities = (): GroupedIdentity[] => {
    const groups = new Map<string, Identity[]>()
    const uncategorizedKey = 'Uncategorized'

    identities.forEach((identity) => {
      let username = identity.instagram_username
      
      if (username === null || username === undefined || username === '') {
        username = uncategorizedKey
      }

      if (!groups.has(username)) {
        groups.set(username, [])
      }
      groups.get(username)!.push(identity)
    })

    return Array.from(groups.entries()).map(([username, identityList]) => {
      console.log(`[GROUPING] 👤 Grouping identities for: ${username || 'Uncategorized'}`, {
        totalIdentities: identityList.length,
        anchorCount: identityList.filter(id => id.src === 'anc').length,
        seedreamCount: identityList.filter(id => id.src === 'sd' || !id.src).length,
        completedAnchors: identityList.filter(id => id.src === 'anc' && id.status === 'completed' && id.generated_image_url).length,
      })
      
      // Filter by source type (anchor vs seedream)
      // Switch to anchor view as soon as first anchor image completes (don't wait for batch completion)
      const hasAnchorImages = identityList.some(
        id => id.src === 'anc' && !!id.generated_image_url && id.status === 'completed'
      )
      
      console.log(`[GROUPING] 🔍 ${username}: hasAnchorImages = ${hasAnchorImages}`)
      
      // Track generation progress separately (for progress text, not filtering)
      const isGeneratingAnchor = identityList.some(
        id => id.src === 'anc' && id.gen_st === 'gen'
      )
      
      // Check if variants exist (completed) or are being generated
      const hasVariants = identityList.some(
        id => id.src === 'var' && !!id.generated_image_url && id.status === 'completed'
      )
      const isGeneratingVariantsForUser = username !== uncategorizedKey && generatingVariants.has(username)
      const primaryId = username !== uncategorizedKey ? primaryImages[username] : null
      
      // If variants exist OR are being generated, show only primary + variants
      const shouldShowOnlyPrimaryAndVariants = (hasVariants || isGeneratingVariantsForUser) && primaryId
      
      const filteredIdentities = hasAnchorImages
        ? (shouldShowOnlyPrimaryAndVariants
            ? identityList.filter(id => 
                id.src === 'var' || 
                (id.src === 'anc' && id.id === primaryId)
              )
            : identityList.filter(id => id.src === 'anc' || id.src === 'var'))
        : identityList.filter(id => id.src === 'sd' || !id.src)
      
      console.log(`[GROUPING] 📋 ${username}: Filtered to ${filteredIdentities.length} identities (${hasAnchorImages ? 'anchor' : 'seedream'} view)`)
      
      const sortedIdentities = filteredIdentities.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      
      // Explicitly prefer completed anchor images for main card
      // This ensures main card shows anchor images as soon as they complete
      const completedAnchors = identityList
        .filter(id =>
          id.src === 'anc' &&
          !!id.generated_image_url &&
          id.status === 'completed'
        )
        .sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      
      console.log(`[GROUPING] 🎯 ${username}: Found ${completedAnchors.length} completed anchors for main card`)
      
      // Main card selection priority:
      // 1. Manually selected primary image (if exists)
      // 2. First completed anchor (if any)
      // 3. First image from filtered list (seedream or anchor)
      // 4. First identity (fallback)
      const primaryImage = primaryId ? identityList.find(id => id.id === primaryId) : null
      
      const mainCandidate: Identity | null =
        (primaryImage ?? null) ||
        completedAnchors[0] ||
        sortedIdentities.find(id => id.generated_image_url) ||
        sortedIdentities[0] ||
        null
      
      console.log(`[GROUPING] 🖼️ ${username}: Selected main candidate:`, {
        id: mainCandidate?.id,
        src: mainCandidate?.src,
        status: mainCandidate?.status,
        hasImage: !!mainCandidate?.generated_image_url,
        source: primaryImage ? 'primary' : completedAnchors[0] ? 'completedAnchor' : sortedIdentities.find(id => id.generated_image_url) ? 'filteredList' : 'fallback',
      })
      
      const firstImage = mainCandidate?.generated_image_url || null
      const hasProcessing = sortedIdentities.some(
        (id) => id.status === 'processing' || (!id.generated_image_url && id.status !== 'failed') || id.gen_st === 'gen'
      )
      const hasCompleted = sortedIdentities.some((id) => id.status === 'completed' && id.generated_image_url)

      // Only count identities with generated images (visible photos)
      const visiblePhotoCount = sortedIdentities.filter((id) => id.generated_image_url).length
      
      // Calculate processing progress
      const totalCount = sortedIdentities.length
      const completedCount = sortedIdentities.filter((id) => id.generated_image_url).length
      const processingCount = totalCount - completedCount

      return {
        instagram_username: username === uncategorizedKey ? null : username,
        identities: sortedIdentities,
        photoCount: visiblePhotoCount,
        firstImage: firstImage ? getProxiedImageUrl(firstImage) : null,
        mainCandidate: mainCandidate && mainCandidate.generated_image_url ? { ...mainCandidate, generated_image_url: getProxiedImageUrl(mainCandidate.generated_image_url) } : null,
        hasProcessing,
        hasCompleted,
        processingCount,
        totalCount,
        completedCount,
        hasAnchorImages,
      }
    })
  }

  const handleDeletePhoto = async (photoId: string, groupKey: string) => {
    setPhotoToDelete(null) // Close dialog
    setDeletingPhotoId(photoId)
    
    try {
      // Optimistic: Remove from local state immediately
      const updatedIdentities = identities.filter((id) => id.id !== photoId)
      setIdentities(updatedIdentities)

      // Delete from Supabase
      const { error } = await supabase
        .from('identities')
        .delete()
        .eq('id', photoId)

      if (error) {
        throw error
      }

      // Check if this was the last photo in the group
      const remainingInGroup = updatedIdentities.filter(
        (id) => (id.instagram_username || 'uncategorized') === groupKey
      )
      
      if (remainingInGroup.length === 0) {
        // Auto-remove empty profile group
        if (expandedUsername === groupKey) {
          setExpandedUsername(null)
        }
      }

      toast.success('Photo deleted')
      
      // Refresh to ensure consistency
      await fetchIdentities()
    } catch (err: any) {
      console.error('[ERROR] Failed to delete photo:', err)
      // Rollback: refresh from server
      await fetchIdentities()
      toast.error('Failed to delete photo: ' + (err.message || 'Unknown error'))
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const handleDeleteUsername = async (username: string | null) => {
    if (!username) return
    
    setDeletingUsername(username)
    setShowConfirmDialog(null)

    // Wait for exit animation before removing from UI
    await new Promise(resolve => setTimeout(resolve, 300))

    try {
      // Only remove from local state (UI deletion only, not database)
      const updatedIdentities = identities.filter(
        (id) => id.instagram_username !== username
      )
      setIdentities(updatedIdentities)

      // Remove from expanded set if it was expanded
      if (expandedUsername === username) {
        setExpandedUsername(null)
      }

      // Remove from generating sets if present
      setGeneratingVariants(prev => {
        const next = new Set(prev)
        next.delete(username)
        return next
      })
      
      // Clear variant progress
      setVariantGenerationProgress(prev => {
        const next = { ...prev }
        delete next[username]
        return next
      })

      // Remove from primary images
      setPrimaryImages(prev => {
        const next = { ...prev }
        delete next[username]
        return next
      })

      // Clear anchor generation state if present
      setGeneratingAnchor(prev => {
        const next = new Set(prev)
        next.delete(username)
        return next
      })
      
      setAnchorGenerationProgress(prev => {
        const next = { ...prev }
        delete next[username]
        return next
      })

      toast.success(`Profile @${username} removed`)
    } catch (err: any) {
      console.error('[ERROR] Failed to remove profile:', err)
      toast.error('Failed to remove profile')
    } finally {
      setDeletingUsername(null)
    }
  }

  const toggleExpand = (groupKey: string | null) => {
    if (!groupKey) return
    if (expandedUsername === groupKey) {
      setExpandedUsername(null)
    } else {
      setExpandedUsername(groupKey)
    }
  }

  const handleSelectPrimary = async (identityId: string, username: string | null) => {
    if (!username) {
      toast.error('Cannot set primary for uncategorized profiles')
      return
    }

    try {
      // Update local state immediately (optimistic update)
      setPrimaryImages(prev => ({
        ...prev,
        [username]: identityId
      }))

      // Optimistically set variant generation state (shows 5 grey placeholders immediately)
      setGeneratingVariants(prev => {
        const next = new Set(prev)
        next.add(username)
        return next
      })
      setVariantGenerationProgress(prev => ({
        ...prev,
        [username]: { total: 5, completed: 0, failed: 0 }
      }))

      // Clear previous primary for this username
      const { error: clearError } = await supabase
        .from('identities')
        .update({ is_primary: false })
        .eq('instagram_username', username)
        .eq('is_primary', true)

      if (clearError) {
        const errorStr = JSON.stringify(clearError)
        // If column doesn't exist, skip database update but keep local state
        if (!errorStr || errorStr === '{}' || clearError.code === '42703' || 
            clearError.message?.includes('column') || clearError.message?.includes('does not exist')) {
          console.log('[INFO] is_primary column not found, using local state only')
          toast.success('Primary image updated (local only - column will be added via migration)')
          await fetchIdentities()
          return
        }
        throw clearError
      }

      // Set new primary in database
      const { error: updateError } = await supabase
        .from('identities')
        .update({ is_primary: true })
        .eq('id', identityId)

      if (updateError) {
        const errorStr = JSON.stringify(updateError)
        // If column doesn't exist, skip database update but keep local state
        if (!errorStr || errorStr === '{}' || updateError.code === '42703' || 
            updateError.message?.includes('column') || updateError.message?.includes('does not exist')) {
          console.log('[INFO] is_primary column not found, using local state only')
          toast.success('Primary image updated (local only - column will be added via migration)')
          await fetchIdentities()
          return
        }
        throw updateError
      }

      toast.success('Primary image updated')
      
      // Find the primary identity to get its image URL
      const primaryIdentity = identities.find(id => id.id === identityId)
      
      // Trigger variant generation if primary image exists
      if (primaryIdentity?.generated_image_url) {
        try {
          toast.info('Generating variants...')
          const response = await fetch('/api/anchor/variants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instagram_username: username,
              primaryImageUrl: primaryIdentity.generated_image_url
            })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('[VARIANTS] Failed to start variant generation:', errorData)
            toast.error('Failed to start variant generation')
          } else {
            toast.success('Primary set! Generating variants...')
            // Add username to generating set - SAME as anchors
            setGeneratingVariants(prev => {
              const next = new Set(prev)
              next.add(username)
              return next
            })
            setVariantGenerationProgress(prev => ({
              ...prev,
              [username]: { total: 5, completed: 0, failed: 0 }
            }))
          }
        } catch (err: any) {
          console.error('[VARIANTS] Error starting variant generation:', err)
          toast.error('Failed to start variant generation')
        }
      }
      
      // Refresh identities to update mainCandidate
      await fetchIdentities()
    } catch (err: any) {
      console.error('[ERROR] Failed to set primary:', err)
      // Rollback on error
      setPrimaryImages(prev => {
        const next = { ...prev }
        delete next[username]
        return next
      })
      toast.error('Failed to set primary image')
    }
  }

  const handleGenerateAnchor = async (username: string) => {
    try {
      // 1. Check if already generating
      if (generatingAnchor.has(username)) {
        toast.error('Anchor generation already in progress for this profile')
        return
      }

      // 2. Get all seedream images for this username from raw identities array
      // (Not from filtered groups, since groups hide seedream when anchor exists)
      const seedreamImages = identities
        .filter(id => 
          id.instagram_username === username &&
          (id.src === 'sd' || !id.src) && // Seedream or null (defaults to seedream)
          id.generated_image_url && // Must have completed image
          id.status === 'completed' // Must be completed
        )
        .map(id => id.generated_image_url!)
        .filter(Boolean)

      if (seedreamImages.length === 0) {
        toast.error('No seedream images available to use as reference')
        return
      }

      // 3. Set generating state BEFORE API call (optimistic update)
      setGeneratingAnchor(prev => new Set(prev).add(username))
      setAnchorGenerationProgress(prev => ({
        ...prev,
        [username]: { total: 10, completed: 0, failed: 0 }
      }))

      // Auto-expand if not already expanded
      const groupKey = username || 'uncategorized'
      if (expandedUsername !== groupKey) {
        setExpandedUsername(groupKey)
      }

      // 4. Call API endpoint
      const response = await fetch('/api/anchor/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_username: username,
          referenceImageUrls: seedreamImages
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.message || errorData.error || 'Failed to generate anchor'
        
        // Reset generating state on error
        setGeneratingAnchor(prev => {
          const next = new Set(prev)
          next.delete(username)
          return next
        })
        setAnchorGenerationProgress(prev => {
          const next = { ...prev }
          delete next[username]
          return next
        })
        
        toast.error(errorMessage)
        return
      }

      // 5. API call successful - state already set, polling will handle progress
      const result = await response.json()
      console.log('[ANCHOR] Generation started:', result)
      
      // Refresh identities to show new anchor records (with gen_st='gen')
      await fetchIdentities()

    } catch (error: any) {
      console.error('[ERROR] Anchor generation failed:', error)
      
      // Reset generating state on error
      setGeneratingAnchor(prev => {
        const next = new Set(prev)
        next.delete(username)
        return next
      })
      setAnchorGenerationProgress(prev => {
        const next = { ...prev }
        delete next[username]
        return next
      })
      
      toast.error(error.message || 'Failed to generate anchor images')
    }
  }

  const groups = groupedIdentities()
  console.log('[RENDER] 🎨 Rendering with', groups.length, 'groups')

  // Create processing lookup function
  const getGroupProcessing = (groupKey: string): boolean => {
    const group = groups.find(g => (g.instagram_username || 'uncategorized') === groupKey)
    return group?.hasProcessing || false
  }

  return (
    <ProcessingContext.Provider value={{ getGroupProcessing }}>
    <DashboardPage title="Identities">

          {error && (
            <div className="mb-6 p-3 bg-red-50/50 rounded-md">
              <p className="font-label text-xs text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-brand-30 mx-auto mb-4" />
              <h3 className="text-lg font-serif font-normal text-brand mb-2">
                No identities yet
                      </h3>
              <p className="font-label text-sm text-brand-60 mb-6">
                Create your first identity by selecting photos and clicking Submit
              </p>
              <PrimaryButton asChild>
                <a href="/dashboard/collect">Go to Media Collection</a>
              </PrimaryButton>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="flex flex-col gap-12">
                {groups.map((group) => {
                const groupKey = group.instagram_username || 'uncategorized'
                const isExpanded = expandedUsername === groupKey
                const isDeleting = deletingUsername === groupKey
                const isProcessing = group.hasProcessing

                // Apple HIG: Assign roles before slicing (lifecycle-based, not position-based)
                const identities = group.identities
                
                // Use mainCandidate from groupedIdentities (explicitly prefers completed anchors)
                // Falls back to finding from filtered list if mainCandidate is null
                // mainCandidate is already proxied, but fallback needs proxying
                const mainFallback = identities.find(id => id.generated_image_url) || identities[0]
                const main = group.mainCandidate || (mainFallback ? { ...mainFallback, generated_image_url: getProxiedImageUrl(mainFallback.generated_image_url) } : mainFallback)
                
                console.log(`[RENDER] 🎯 ${groupKey}: Rendering main card with:`, {
                  hasMainCandidate: !!group.mainCandidate,
                  mainCandidateId: group.mainCandidate?.id,
                  mainCandidateHasImage: !!group.mainCandidate?.generated_image_url,
                  mainId: main?.id,
                  mainSrc: main?.src,
                  mainStatus: main?.status,
                  mainHasImage: !!main?.generated_image_url,
                  mainImageUrl: main?.generated_image_url,
                  usingMainCandidate: main?.id === group.mainCandidate?.id,
                })
                
                // Get rest (excluding main)
                const rest = identities.filter(id => id.id !== main?.id)
                
                // Hard-cap UI explicitly (Apple clarity rule)
                const MAX_VISIBLE = 5
                const visible = [main, ...rest].filter(Boolean).slice(0, MAX_VISIBLE)
                
                // Counts must match what's on screen (Apple rule: numbers map 1:1 to visible objects)
                const visibleCount = visible.length
                const visibleCompletedCount = visible.filter(id => id?.generated_image_url).length
                const visibleProcessingCount = visibleCount - visibleCompletedCount

                // Expanded images - use ALL identities except main (no limit for horizontal scrolling)
                // Sort chronologically (oldest to newest) so new images appear left-to-right
                const isGeneratingAnchor = generatingAnchor.has(groupKey)
                const isGeneratingVariants = generatingVariants.has(groupKey)
                const isGenerating = isGeneratingAnchor || isGeneratingVariants
                
                // Get all anchor/variant identities for this group
                // When generating variants with primary set, include primary in expanded panel
                const primaryId = primaryImages[groupKey]
                // Check if we're generating variants AND have a primary set (even if main hasn't updated yet)
                const isGeneratingVariantsForGroup = isGeneratingVariants && primaryId && (main?.src === 'anc' || group.identities.some(id => id.id === primaryId && id.src === 'anc'))
                
                // Calculate variant state: variants exist (completed) OR variants are generating, AND primary is set
                const hasVariants = group.identities.some(id => id.src === 'var' && id.status === 'completed' && id.generated_image_url)
                const isVariantState = Boolean((hasVariants || isGeneratingVariants) && primaryId)
                
                // Calculate variant-specific counts (exclude primary from count)
                const variantIdentities = identities.filter(id => id.src === 'var')
                const variantCompleted = variantIdentities.filter(id => id.status === 'completed' && id.generated_image_url).length
                const variantTotal = variantIdentities.length || 5 // Default to 5 if generating
                const variantProgress = isVariantState ? { completed: variantCompleted, total: variantTotal } : undefined
                const totalPhotoCount = isVariantState ? 1 + variantCompleted : group.photoCount // 1 primary + variants
                
                // When generating variants with primary, expanded panel should only show variants (5 cards)
                // Primary anchor is already in main card, so don't duplicate it in expanded panel
                const anchorVariantRest = isGeneratingVariantsForGroup && primaryId
                  ? identities.filter(id => id.src === 'var')  // Only variants, exclude primary
                  : rest.filter(id => id.src === 'anc' || id.src === 'var')
                
                // If main is an anchor, we should only show 9 in expanded (not 10)
                // If main is a variant, we should only show 4 in expanded (not 5)
                // When generating variants with primary: show only 5 variants in expanded panel (primary is in main card)
                const isMainAnchor = main?.src === 'anc'
                const isMainVariant = main?.src === 'var'
                const maxExpandedCount = isGeneratingVariantsForGroup ? 5 : (isMainAnchor ? 9 : isMainVariant ? 4 : 10)
                
                console.log(`[RENDER] 📸 ${groupKey}: Expanded images logic:`, {
                  isGeneratingAnchor,
                  isGeneratingVariants,
                  isGeneratingVariantsForGroup,
                  isGenerating,
                  anchorVariantRestCount: anchorVariantRest.length,
                  totalRest: rest.length,
                  isMainAnchor,
                  isMainVariant,
                  maxExpandedCount,
                  primaryId: primaryImages[groupKey],
                  mainId: main?.id,
                  mainSrc: main?.src,
                  primaryMatchesMain: primaryImages[groupKey] === main?.id,
                })
                
                const expandedImages = isGenerating
                  ? (() => {
                      // Fixed slot-based layout: fill with completed images first, then placeholders
                      // Get all variant identities sorted chronologically
                      // When generating variants, primary is already in main card, so don't include it here
                      const allImages = (() => {
                        const filtered = anchorVariantRest.filter(id => {
                          if (isGeneratingVariantsForGroup) {
                            // Only show variants (primary is already in main card)
                            return id.src === 'var'
                          }
                          return (isGeneratingAnchor && id.src === 'anc') || (isGeneratingVariants && id.src === 'var')
                        })
                        
                        return filtered
                      })().sort((a, b) => {
                          // Sort chronologically (no special primary handling needed - primary is in main card)
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        })
                      
                      // Create fixed slots: fill with completed images first, then placeholders
                      const slots: Array<{ id: string; url: string | null; status: string; hasImage: boolean; created_at: string }> = []
                      
                      // Fill slots with completed images (left-to-right)
                      let completedIndex = 0
                      for (let i = 0; i < maxExpandedCount; i++) {
                        // Find next completed image
                        while (completedIndex < allImages.length && 
                               (!allImages[completedIndex].generated_image_url || 
                                allImages[completedIndex].status !== 'completed')) {
                          completedIndex++
                        }
                        
                        if (completedIndex < allImages.length) {
                          // Fill slot with completed image
                          const img = allImages[completedIndex]
                          slots.push({
                            id: img.id,
                            url: getProxiedImageUrl(img.generated_image_url!),
                            status: img.status || 'completed',
                            hasImage: true,
                            created_at: img.created_at,
                          })
                          completedIndex++
                        } else {
                          // Fill slot with placeholder
                          // For variants, show placeholder even if no records exist yet (optimistic UI)
                          slots.push({
                            id: `${isGeneratingVariants ? 'variant' : 'anchor'}-placeholder-${groupKey}-${i}`,
                            url: null,
                            status: 'processing',
                            hasImage: false,
                            created_at: new Date(Date.now() + i * 1000).toISOString(),
                          })
                        }
                      }
                      
                      console.log(`[RENDER] 🔄 ${groupKey}: Generating ${isGeneratingVariants ? 'variants' : 'anchors'} - ${slots.filter(s => s.hasImage).length} completed, ${slots.filter(s => !s.hasImage).length} placeholders`)
                      
                      return slots
                    })()
                  : rest.map((id) => ({
                      url: getProxiedImageUrl(id?.generated_image_url || null),
                  status: id?.status,
                  id: id?.id || '',
                  hasImage: !!id?.generated_image_url,
                      created_at: id?.created_at,
                })).sort((a, b) => {
                      // Chronological order (oldest to newest)
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  })

                return (
                    <motion.div
                    key={groupKey}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`relative w-[calc(100%-1.5rem)] sm:w-[calc(45%-0.75rem)] lg:w-[calc(28%-1rem)] xl:w-[calc(22%-1.125rem)] max-w-[280px] ${isExpanded ? 'z-10' : ''}`}
                  >
                    {/* Height establisher - matches aspect-[4/5] exactly */}
                    <div
                    ref={(el) => {
                      cardRefs.current[groupKey] = el
                    }}
                      className="aspect-[4/5] w-full relative"
                    >
                      {/* Main Card */}
                      <IdentityCard
                        group={group}
                        main={main}
                        isExpanded={isExpanded}
                        isDeleting={isDeleting}
                        isProcessing={isProcessing}
                        visibleCompletedCount={visibleCompletedCount}
                        visibleCount={visibleCount}
                        visibleProcessingCount={visibleProcessingCount}
                        isGeneratingAnchor={isGeneratingAnchor}
                        isGeneratingVariants={isGeneratingVariants}
                        anchorProgress={isGeneratingVariants ? variantGenerationProgress[groupKey] : anchorGenerationProgress[groupKey]}
                        variantProgress={variantProgress}
                        isVariantState={isVariantState}
                        totalPhotoCount={totalPhotoCount}
                        onExpand={() => toggleExpand(groupKey)}
                          onDeletePhoto={(id: string) => setPhotoToDelete({ id, groupKey })}
                        onDeleteProfile={() => setShowConfirmDialog(groupKey)}
                        onGenerateAnchor={() => {
                          if (group.instagram_username) {
                            // Prevent opening dialog if anchor already exists
                            const hasAnchor = identities.some(id => 
                              id.instagram_username === group.instagram_username && 
                              id.src === 'anc' && 
                              id.generated_image_url
                            )
                            if (!hasAnchor) {
                            setAnchorToGenerate(group.instagram_username)
                            }
                          }
                        }}
                        onSelectPrimary={() => {
                          if (main?.id && group.instagram_username) {
                            setPrimaryToSelectMain(groupKey)
                          }
                        }}
                        hasAnchorImages={group.hasAnchorImages}
                        deletingPhotoId={deletingPhotoId}
                        groupKey={groupKey}
                      />
                    </div>

                    {/* Expanded Panel - nested, rightward */}
                    <AnimatePresence>
                      {isExpanded && (
                        <ExpandedPanel
                          images={expandedImages}
                          groupKey={groupKey}
                          groupUsername={group.instagram_username}
                          cardWidth={cardRefs.current[groupKey]?.offsetWidth}
                          cardHeight={cardRefs.current[groupKey]?.offsetHeight}
                          deletingPhotoId={deletingPhotoId}
                          onDeletePhoto={(id: string) => setPhotoToDelete({ id, groupKey })}
                          onSelectPrimary={(id: string) => {
                            setPrimaryToSelect({ id, groupKey })
                          }}
                          isProcessing={isProcessing}
                          isGeneratingAnchor={isGeneratingAnchor || isGeneratingVariants}
                          hasAnchorImages={group.hasAnchorImages}
                          isVariantState={isVariantState}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
                })}
            </div>
            </AnimatePresence>
          )}

          {/* Photo Deletion Confirmation Dialog */}
          <ConfirmationDialog
            open={!!photoToDelete}
            onOpenChange={(open) => !open && setPhotoToDelete(null)}
            title="Delete Photo?"
            description="This photo will be permanently deleted. This action cannot be undone."
            confirmText="Delete"
            variant="destructive"
            disabled={photoToDelete ? getGroupProcessing(photoToDelete.groupKey) : false}
            onConfirm={() => {
              if (photoToDelete) {
                handleDeletePhoto(photoToDelete.id, photoToDelete.groupKey)
              }
            }}
          />

          {/* Profile Deletion Confirmation Dialog */}
          <ConfirmationDialog
            open={!!showConfirmDialog}
            onOpenChange={(open) => !open && setShowConfirmDialog(null)}
            title="Delete Profile?"
            description={`This will remove @${showConfirmDialog} from the UI. The profile will not be deleted from the database.`}
            confirmText="Delete"
            variant="destructive"
            disabled={showConfirmDialog ? getGroupProcessing(showConfirmDialog) : false}
            onConfirm={() => {
              if (showConfirmDialog) {
                handleDeleteUsername(showConfirmDialog)
              }
            }}
          />

          {/* Generate Anchor Confirmation Dialog */}
          <ConfirmationDialog
            open={!!anchorToGenerate}
            onOpenChange={(open) => !open && setAnchorToGenerate(null)}
            title="Generate Anchor?"
            description="The anchor will replace the current profile image."
            confirmText="Generate Anchor"
            variant="default"
            disabled={anchorToGenerate ? getGroupProcessing(anchorToGenerate) : false}
            onConfirm={() => {
              if (anchorToGenerate) {
                // Close dialog first
                setAnchorToGenerate(null)
                
                // Call API handler
                handleGenerateAnchor(anchorToGenerate)
              }
            }}
          />

          {/* Make Primary Confirmation Dialog (for main card) */}
          <ConfirmationDialog
            open={!!primaryToSelectMain}
            onOpenChange={(open) => !open && setPrimaryToSelectMain(null)}
            title="Make Primary?"
            description="This will set this image as the primary profile image."
            confirmText="Make Primary"
            variant="default"
            disabled={primaryToSelectMain ? getGroupProcessing(primaryToSelectMain) : false}
            onConfirm={() => {
              if (primaryToSelectMain) {
                const group = groups.find(g => (g.instagram_username || 'uncategorized') === primaryToSelectMain)
                if (group && group.mainCandidate && group.instagram_username) {
                  handleSelectPrimary(group.mainCandidate.id, group.instagram_username)
                }
                setPrimaryToSelectMain(null)
              }
            }}
          />

          {/* Make Primary Confirmation Dialog (for expanded panel) */}
          <ConfirmationDialog
            open={!!primaryToSelect}
            onOpenChange={(open) => !open && setPrimaryToSelect(null)}
            title="Make Primary?"
            description="This will set this image as the primary profile image."
            confirmText="Make Primary"
            variant="default"
            disabled={primaryToSelect ? getGroupProcessing(primaryToSelect.groupKey) : false}
            onConfirm={() => {
              if (primaryToSelect) {
                const group = groups.find(g => (g.instagram_username || 'uncategorized') === primaryToSelect.groupKey)
                if (group && group.instagram_username) {
                  handleSelectPrimary(primaryToSelect.id, group.instagram_username)
                }
                setPrimaryToSelect(null)
              }
            }}
          />
    </DashboardPage>
    </ProcessingContext.Provider>
  )
}



