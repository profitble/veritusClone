'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Loader2, X } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { instagramProfileUrlSchema, extractUsernameFromUrl } from '@/lib/validation'
import { extractFramesFromVideo } from '@/lib/videoExtractor'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { MediaGrid } from '@/components/dashboard/collect/media-grid'
import { FinalSelectionPanel } from '@/components/dashboard/collect/final-selection-panel'
import { VideoInspectorSheet } from '@/components/dashboard/collect/video-inspector-sheet'
import { InstagramInput } from '@/components/dashboard/collect/instagram-input'

interface MediaItem {
  id: string
  type: 'photo' | 'video' | 'frame'
  source: 'instagram' | 'upload'
  url: string
  thumbnail?: string
  caption?: string
  geminiResult?: {
  zoom_score: number
  visibility_score: number
  total: number
    decision: 'yes' | 'no'
  explanation: string
  }
  metadata?: {
    instagramId?: string
    uploadedAt?: Date
    originalFilename?: string
  }
  parentVideoId?: string
  extractedFrames?: string[]
}

interface Progress {
  batch: number
  totalBatches: number
  analyzed: number
  passed: number
}

interface LogEntry {
  step: number
  message: string
  status: 'processing' | 'complete'
  photoCount?: number
  totalPhotos?: number
}

export default function Identities() {
  const router = useRouter()
  const pathname = usePathname()
  const [instagramUrl, setInstagramUrl] = useState('')
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [finalSelection, setFinalSelection] = useState<MediaItem[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processingVideo, setProcessingVideo] = useState<string | null>(null)
  const [inspectorItem, setInspectorItem] = useState<MediaItem | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [addingToFinal, setAddingToFinal] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [processingIdentities, setProcessingIdentities] = useState(0)
  const [identityExists, setIdentityExists] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const framesSectionRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
      
  // Load saved media from database
  const loadMedia = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) {
        console.error('[ERROR] Failed to load media:', error)
        setLoading(false)
        return
      }
      
      // Convert DB format to MediaItem format
      const items: MediaItem[] = (data || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        source: item.source,
        url: item.url,
        thumbnail: item.thumbnail_url,
        caption: item.caption,
        metadata: {
          instagramId: item.instagram_id,
        },
        parentVideoId: item.parent_video_id,
      }))
      
      setMediaItems(items)
      
      // Derive Instagram username from database (get from first Instagram photo/video)
      const instagramItem = items.find((item) => item.source === 'instagram' && item.type === 'photo')
      if (instagramItem && data) {
        const dbItem = data.find((d: any) => d.id === instagramItem.id)
        if (dbItem?.instagram_username) {
          setInstagramUsername(dbItem.instagram_username)
        } else {
          setInstagramUsername(null)
        }
      } else {
        setInstagramUsername(null)
      }
      
      setLoading(false)
    }
    
  // Load saved media on page load
  useEffect(() => {
    loadMedia()
  }, [])

  // Check if identity exists for current username
  const checkIdentityExists = async (username: string | null) => {
    if (!username) {
      setIdentityExists(false)
      return
    }

    try {
      const { data } = await supabase
        .from('identities')
        .select('id, status, generated_image_url')
        .eq('instagram_username', username)
      
      const exists = data?.some(
        (id) => id.status === 'processing' || 
                (id.status === 'completed' && id.generated_image_url) ||
                id.status === 'failed'
      ) || false
      
      setIdentityExists(exists)
      // Don't show toast here - it will be shown in handleInstagramAnalyze when user tries to submit
    } catch (err) {
      console.error('[ERROR] Failed to check identity existence:', err)
      setIdentityExists(false)
    }
  }

  // Check identity when username changes
  useEffect(() => {
    if (instagramUsername) {
      checkIdentityExists(instagramUsername)
    }
    // Don't reset identityExists when username is cleared - it might have been set after submission
  }, [instagramUsername])
      
  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => {
        if (item.extractedFrames) {
          item.extractedFrames.forEach((url) => {
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url)
      }
          })
        }
        if (item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url)
        }
      })
    }
  }, [mediaItems])

  // Poll for processing identities
  useEffect(() => {
    const checkProcessingIdentities = async () => {
      try {
        const { data } = await supabase
          .from('identities')
          .select('id, status, generated_image_url')
        
        const processing = (data || []).filter(
          (id) => id.status === 'processing' || (!id.generated_image_url && id.status !== 'failed')
        )
        
        setProcessingIdentities(processing.length)
        
        // Stop polling if no processing identities
        if (processing.length === 0 && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      } catch (err) {
        console.error('[ERROR] Failed to check processing identities:', err)
      }
    }

    // Check immediately
    checkProcessingIdentities()

    // Poll every 2.5 seconds
    pollingIntervalRef.current = setInterval(checkProcessingIdentities, 2500)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [])

  const handleInstagramAnalyze = async () => {
    if (!instagramUrl.trim()) {
      toast.error('Please enter an Instagram profile URL')
      return
    }

    const validationResult = instagramProfileUrlSchema.safeParse(instagramUrl.trim())
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues[0]?.message || 'Invalid Instagram profile URL'
      toast.error(errorMessage)
      return
    }

    const profileUrl = validationResult.data
    // Extract Instagram username (will be saved to database with media items)
    let username: string | null = null
    try {
      username = extractUsernameFromUrl(profileUrl)
    } catch (err) {
      // If username extraction fails, clear it
      username = null
    }

    // Check if identity exists before proceeding
    if (username) {
      const { data } = await supabase
        .from('identities')
        .select('id, status, generated_image_url')
        .eq('instagram_username', username)
      
      const exists = data?.some(
        (id) => id.status === 'processing' || 
                (id.status === 'completed' && id.generated_image_url) ||
                id.status === 'failed'
      ) || false
      
      if (exists) {
        toast.error(`Identity for @${username} already exists. Please use a different profile.`, {
          duration: 4000,
        })
        return
      }
    }

    setInstagramUsername(username)
    setAnalyzing(true)
    setError(null)
    setProgress(null)
    setMediaItems([])
    setLogs([])
    setCurrentStep(0)

    try {
      // Fetch both photos and reels in parallel
      const [photosResponse, reelsResponse] = await Promise.all([
        fetch('/api/instagram/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileUrl }),
        }),
        fetch('/api/instagram/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileUrl }),
        }),
      ])

      if (!photosResponse.ok && !reelsResponse.ok) {
        throw new Error('Failed to start analysis')
      }

      const allMediaItems: MediaItem[] = []

      // Process photos
      if (photosResponse.ok) {
        const photosReader = photosResponse.body?.getReader()
        const photosDecoder = new TextDecoder()

        if (photosReader) {
          let buffer = ''

          while (true) {
            const { done, value } = await photosReader.read()
            
            if (done) {
              if (buffer.trim()) {
                try {
                  const data = JSON.parse(buffer.trim())
                  if (data.type === 'complete') {
                    const photos = (data.photos || []).map((photo: any) => ({
                      id: photo.id,
                      type: 'photo' as const,
                      source: 'instagram' as const,
                      url: photo.url,
                      thumbnail: photo.thumbnail,
                      caption: photo.caption,
                      geminiResult: photo.geminiResult,
                      metadata: { instagramId: photo.id },
                    }))
                    allMediaItems.push(...photos)
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
              break
            }

            buffer += photosDecoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue

              try {
                const data = JSON.parse(line)

                if (data.type === 'log') {
                  setLogs((prev) => [...prev, {
                    step: data.step,
                    message: data.message,
                    status: data.status,
                    photoCount: data.photoCount,
                    totalPhotos: data.totalPhotos,
                  }])
                  setCurrentStep(data.step)
                } else if (data.type === 'progress') {
                  setProgress({
                    batch: data.batch,
                    totalBatches: data.totalBatches,
                    analyzed: data.analyzed,
                    passed: data.passed,
                  })
                } else if (data.type === 'complete') {
                  const photos = (data.photos || []).map((photo: any) => ({
                    id: photo.id,
                    type: 'photo' as const,
                    source: 'instagram' as const,
                    url: photo.url,
                    thumbnail: photo.thumbnail,
                    caption: photo.caption,
                    geminiResult: photo.geminiResult,
                    metadata: { instagramId: photo.id },
                  }))
                  allMediaItems.push(...photos)
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Photos analysis failed')
                }
              } catch (parseError) {
                console.error('Failed to parse stream data:', parseError)
              }
            }
          }
        }
      }

      // Process reels
      if (reelsResponse.ok) {
        const reelsReader = reelsResponse.body?.getReader()
        const reelsDecoder = new TextDecoder()

        if (reelsReader) {
          let buffer = ''

          while (true) {
            const { done, value } = await reelsReader.read()
            
            if (done) {
              if (buffer.trim()) {
                try {
                  const data = JSON.parse(buffer.trim())
                  if (data.type === 'complete') {
                    const reels = (data.reels || []).map((reel: any) => ({
                      id: reel.id,
                      type: 'video' as const,
                      source: 'instagram' as const,
                      url: reel.url,
                      thumbnail: reel.thumbnail,
                      caption: reel.caption,
                      metadata: { instagramId: reel.id, shortcode: reel.shortcode },
                    }))
                    allMediaItems.push(...reels)
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
              break
            }

            buffer += reelsDecoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue

              try {
                const data = JSON.parse(line)

                if (data.type === 'log') {
                  setLogs((prev) => [...prev, {
                    step: data.step,
                    message: data.message,
                    status: data.status,
                  }])
                } else if (data.type === 'complete') {
                  const reels = (data.reels || []).map((reel: any) => ({
                    id: reel.id,
                    type: 'video' as const,
                    source: 'instagram' as const,
                    url: reel.url,
                    thumbnail: reel.thumbnail,
                    caption: reel.caption,
                    metadata: { instagramId: reel.id, shortcode: reel.shortcode },
                  }))
                  allMediaItems.push(...reels)
                } else if (data.type === 'error') {
                  console.error('Reels fetch error:', data.error)
                }
              } catch (parseError) {
                console.error('Failed to parse stream data:', parseError)
              }
            }
          }
        }
      }

      setMediaItems(allMediaItems)
      setProgress(null)
      setAnalyzing(false)
      
      // Reload media from database to ensure persistence and consistency
      await loadMedia()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to analyze profile'
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        toast.error('Unable to connect to server. Please check your internet connection.')
      } else if (err.message?.includes('Invalid Instagram')) {
        toast.error('Invalid Instagram profile URL. Please check the link and try again.')
      } else {
        toast.error(errorMessage)
      }
      setError(errorMessage)
      setAnalyzing(false)
      setProgress(null)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    const newItems: MediaItem[] = []
    const filesToUpload: File[] = []
    
    // Allowed image formats
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.heic']
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
    
    // Collect existing URLs for duplicate checking
    const existingUrls = new Set(mediaItems.map(item => item.url))
    
    // First pass: validate and check for duplicates
    for (const file of Array.from(files)) {
      const fileType = file.type
      const fileName = file.name.toLowerCase()
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'))
      
      // Only allow photos in specified formats
      const isAllowedImage = allowedImageTypes.includes(fileType) || 
                            allowedImageExtensions.includes(fileExtension)
      
      if (!isAllowedImage) {
        toast.error(`File "${file.name}" is not supported. Please upload JPG, JPEG, PNG, or HEIC files only.`)
        continue
      }

      // Check for duplicate by creating a temporary URL to compare
      // We'll check after upload by comparing the returned URL
      filesToUpload.push(file)
    }

    // Track uploading files
    const uploadingSet = new Set(filesToUpload.map(f => f.name))
    setUploadingFiles(uploadingSet)

    // Upload files
    for (const file of filesToUpload) {
      try {
        // Get Supabase session for JWT token (optional)
        const { data: { session } } = await supabase.auth.getSession()

        // Upload to R2 via Edge Function
        const formData = new FormData()
        formData.append('file', file)
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const headers: HeadersInit = {}
        if (session) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/media-upload`, {
          method: 'POST',
          headers,
          body: formData,
        })
        
        if (!response.ok) throw new Error('Upload failed')
        
        const { url } = await response.json()
        
        // Check for duplicate URL
        if (existingUrls.has(url)) {
          console.log(`[SKIP] Duplicate image detected: ${file.name}`)
          toast.error(`Image "${file.name}" is already in the collection.`)
          continue
        }
        
        // Add to existing URLs set to prevent duplicates in this batch
        existingUrls.add(url)
        
        // Add to mediaItems state
        const newItem: MediaItem = {
          id: crypto.randomUUID(),
          type: 'photo',
          source: 'upload',
          url,
          metadata: {
            originalFilename: file.name,
            uploadedAt: new Date(),
          },
        }
        
        newItems.push(newItem)
      } catch (error) {
        console.error('[ERROR] Failed to upload file:', error)
        toast.error(`Failed to upload "${file.name}". Please try again or use a different file.`)
      } finally {
        // Remove from uploading set
        uploadingSet.delete(file.name)
        setUploadingFiles(new Set(uploadingSet))
      }
    }

    // Clear uploading state
    setUploadingFiles(new Set())

    // Uploaded files go directly to final selection
    if (newItems.length > 0) {
    setFinalSelection((prev) => [...prev, ...newItems])
    setMediaItems((prev) => [...prev, ...newItems])
    }
  }

  const addToFinal = (item: MediaItem) => {
    // Add photos and frames to final selection
    if ((item.type === 'photo' || item.type === 'frame') && !finalSelection.find((i) => i.id === item.id)) {
      setAddingToFinal((prev) => new Set(prev).add(item.id))
      setFinalSelection((prev) => [...prev, item])
      // Loading state cleared when image loads (see Image onLoad handler)
      }
  }

  const removeFromFinal = (itemId: string) => {
    setFinalSelection((prev) => prev.filter((item) => item.id !== itemId))
    // Cancel loading state if item was being added
    setAddingToFinal((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handleClearAll = async () => {
    setShowClearDialog(false)
    
    try {
      // Get Supabase session for JWT token (optional)
      const { data: { session } } = await supabase.auth.getSession()

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/media`, {
        method: 'DELETE',
        headers,
      })

      if (!response.ok) {
        throw new Error('Failed to clear media items')
      }

      // Clear all state
      setMediaItems([])
      setFinalSelection([])
      setInstagramUsername(null)
      setInstagramUrl('')
      setError(null)
      setIdentityExists(false)
    } catch (err: any) {
      console.error('[ERROR] Failed to clear media:', err)
      toast.error('Failed to clear media items. Please try again.')
    }
  }

  const handleProcessVideos = async () => {
    if (!inspectorItem || inspectorItem.type !== 'video') {
      toast.error('No video selected')
      return
    }

    const video = inspectorItem
    setProcessing(true)
    setError(null)
    setInspectorItem(null) // Close Sheet after processing starts

    console.log(`[UI] Extracting frames from: ${video.url}`)
    setProcessingVideo(video.url)
    try {
      const frameUrls = await extractFramesFromVideo(video.url)
      
      // Get Supabase session for JWT token (optional, reused for both calls)
      const { data: { session } } = await supabase.auth.getSession()

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      // Find or create video record in database via Edge Function
      const videoResponse = await fetch(`${supabaseUrl}/functions/v1/media-reels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: video.url,
          thumbnail_url: video.thumbnail,
          caption: video.caption,
          instagram_id: video.metadata?.instagramId,
          source: video.source,
        }),
      })
      
      if (!videoResponse.ok) {
        throw new Error('Failed to save video record')
      }
      
      const { id: parentVideoId } = await videoResponse.json()
      
      // Convert blob URLs to data URLs for API
      const frameDataUrls = await Promise.all(
        frameUrls.map(async (blobUrl) => {
          const response = await fetch(blobUrl)
          const blob = await response.blob()
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        })
      )
      
      // Save frames to R2 and database via Edge Function
      const framesResponse = await fetch(`${supabaseUrl}/functions/v1/media-frames`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          frames: frameDataUrls,
          parentVideoId,
        }),
      })
      
      if (!framesResponse.ok) {
        const errorText = await framesResponse.text()
        console.error('[ERROR] Failed to save frames:', errorText)
        throw new Error(`Failed to save frames: ${errorText}`)
      }
      
      const framesResult = await framesResponse.json()
      
      if (framesResult.errors && framesResult.errors.length > 0) {
        console.error('[ERROR] Frame save errors:', framesResult.errors)
      }
      
      // Reload media from database to get the actual frame records
      await loadMedia()

      // Auto-scroll to frames section after processing completes
      setTimeout(() => {
        if (framesSectionRef.current) {
          framesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        } else {
          // Fallback: scroll to bottom of page
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
        }
      }, 100)
    } catch (error) {
      console.error(`[ERROR] Failed to extract from ${video.url}:`, error)
      toast.error('Failed to extract frames from video. Please try again.')
    } finally {
      setProcessing(false)
    setProcessingVideo(null)
    }
  }

  const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
    const response = await fetch(blobUrl)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Helper to check if URL needs proxy (R2 URLs)
  const isR2Url = (url: string): boolean => {
    return url.includes('r2.cloudflarestorage.com')
  }

  // Helper to get proxied image URL for R2
  const getProxiedImageUrl = (url: string): string => {
    return `/api/media/proxy?url=${encodeURIComponent(url)}`
  }

  const handleSubmit = async () => {
    const photos = finalSelection.filter((item) => item.type === 'photo' || item.type === 'frame')
    
    if (photos.length === 0) {
      toast.error('Please select at least one photo or frame')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Check for duplicate identities before submitting (only if instagram_username is provided)
      if (instagramUsername) {
        const { data: existingIdentities } = await supabase
          .from('identities')
          .select('id, status, generated_image_url')
          .eq('instagram_username', instagramUsername)
        
        const hasProcessing = existingIdentities?.some(
          (id) => id.status === 'processing' || 
                  (id.status === 'completed' && id.generated_image_url)
        )
        
        if (hasProcessing) {
          toast.error(`An identity for @${instagramUsername} is already being processed or completed. Please wait for it to finish or use a different profile.`)
          setSubmitting(false)
          return
        }
      }

      // Convert blob URLs to base64 on client side, keep external URLs as-is
      const photoData = await Promise.all(
        photos.map(async (photo) => {
          if (photo.url.startsWith('blob:')) {
            return await blobUrlToBase64(photo.url)
          }
          return photo.url
        })
      )
      
      console.log(`[UI] Submitting ${photoData.length} photos for identity generation...`)
      
      const requestBody: { photos: string[]; instagram_username?: string } = { photos: photoData }
      if (instagramUsername) {
        requestBody.instagram_username = instagramUsername
      }
      
      const response = await fetch('/api/seedream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json()
          // Use the message from API if available, otherwise use error code
          const errorMessage = errorData.message || errorData.error || 'Failed to generate identity'
          throw new Error(errorMessage)
        } else {
          throw new Error(`Failed to generate identity: ${response.status} ${response.statusText}`)
        }
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server')
      }

      const data = await response.json()
      console.log('[UI] Identity generation started:', data)

      setProcessingIdentities(data.total || photos.length)

      // Store username before clearing
      const submittedUsername = instagramUsername

      // Clear collection from database
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (session) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
        await fetch(`${supabaseUrl}/functions/v1/media`, {
          method: 'DELETE',
          headers,
        })
      } catch (clearError) {
        console.error('[ERROR] Failed to clear collection:', clearError)
      }

      // Clear entire page after successful submission
      setMediaItems([])
      setFinalSelection([])
      setInstagramUrl('')
      setInstagramUsername(null)
      setError(null)
      setIdentityExists(false)

      // Check if identity exists for submitted username (it should, since we just created it)
      // This will disable buttons even after clearing the username
      if (submittedUsername) {
        setTimeout(async () => {
          await checkIdentityExists(submittedUsername)
        }, 500) // Small delay to ensure DB has updated
      }

      toast.success('Identity creation started! Your collection has been cleared.', {
        duration: 3000,
      })

      // Redirect to identity page if not already there
      if (pathname !== '/dashboard/identity') {
        router.push('/dashboard/identity')
      }
      
      // Trigger polling check immediately to get actual identity records
      const checkProcessingIdentities = async () => {
        try {
          const { data: identityData } = await supabase
            .from('identities')
            .select('id, status, generated_image_url')
          
          const processing = (identityData || []).filter(
            (id) => id.status === 'processing' || (!id.generated_image_url && id.status !== 'failed')
          )
          
          setProcessingIdentities(processing.length)
        } catch (err) {
          console.error('[ERROR] Failed to check processing identities:', err)
        }
      }
      // Wait a bit for database to update, then check
      setTimeout(checkProcessingIdentities, 1000)
    } catch (error: any) {
      console.error('[ERROR] Failed to submit:', error)
      const errorMessage = error.message || 'Failed to generate identity. Please try again.'
      
      // Handle specific error cases
      if (error.message?.includes('DUPLICATE_IDENTITY') || error.message?.includes('already being processed')) {
        toast.error('This profile is already being processed. Please wait for it to finish.')
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('Unable to connect to server. Please check your internet connection.')
      } else if (error.message?.includes('timeout')) {
        toast.error('Request timed out. Please try again.')
      } else {
        toast.error(errorMessage)
      }
      
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleItemTap = (item: MediaItem, isFinal: boolean = false) => {
    if (isFinal) {
      // In final selection, tap to inspect
      setInspectorItem(item)
    } else {
      if (item.type === 'video') {
        // Prevent opening Sheet if video is already being processed
        if (processingVideo === item.url) {
          return
        }
        // Toggle Sheet for videos
        if (inspectorItem?.id === item.id) {
          // Close Sheet if clicking same video
          setInspectorItem(null)
        } else {
          // Open Sheet for new video
          setInspectorItem(item)
        }
      } else {
        // For photos and frames, toggle final selection
        const isInFinal = finalSelection.some((i) => i.id === item.id)
        if (isInFinal) {
          removeFromFinal(item.id)
        } else {
          addToFinal(item)
        }
      }
    }
  }

  const progressPercentage = 
    currentStep === 3 && progress
      ? Math.round(66 + (progress.batch / progress.totalBatches) * 34)
      : currentStep === 3
      ? 66
      : currentStep === 2
      ? 66
      : currentStep === 1
      ? 33
      : 0


  return (
    <DashboardPage
      title="Media Collection"
      headerActions={
        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[#133333]/70 font-label">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Refreshing...</span>
            </div>
          )}
          {mediaItems.length > 0 && (
                <button
              onClick={() => setShowClearDialog(true)}
              className="rounded-lg border border-[#133333]/20 px-4 py-2 text-sm font-medium text-[#133333] font-label transition-all active:scale-[0.98]"
                >
                  Clear Collection
                </button>
            )}
        </div>
      }
    >
      {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-label text-sm font-medium text-red-800 mb-1">Error</p>
                  <p className="font-label text-sm text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
              className="shrink-0 text-red-600 hover:text-red-800 transition-colors active:scale-[0.98]"
                  aria-label="Dismiss error"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Processing Section - Minimal, inline */}
          {analyzing && (
            <div className="mb-6 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-[#133333]" />
          <p className="font-label text-sm text-[#133333]">
                {currentStep === 3 && progress
                  ? `Batch ${progress.batch}/${progress.totalBatches} • ${progress.analyzed} analyzed • ${progress.passed} passed`
                  : logs[logs.length - 1]?.message || 'Processing...'}
              </p>
          <span className="ml-auto font-label text-sm font-medium text-[#133333]">
                {progressPercentage}%
              </span>
          </div>
          )}

      {/* Instagram Input */}
      <InstagramInput
        instagramUrl={instagramUrl}
        instagramUsername={instagramUsername}
        analyzing={analyzing}
        identityExists={identityExists}
        onUrlChange={setInstagramUrl}
        onSubmit={handleInstagramAnalyze}
      />

          {/* Layout: Full width until selection exists */}
          {mediaItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Media Grid */}
              <div className="lg:col-span-2">
            <div className="space-y-8" ref={framesSectionRef}>
              <MediaGrid
                items={mediaItems}
                type="photo"
                finalSelection={finalSelection}
                addingToFinal={addingToFinal}
                processingVideo={processingVideo}
                inspectorItem={inspectorItem}
                onItemTap={handleItemTap}
                isR2Url={isR2Url}
                getProxiedImageUrl={getProxiedImageUrl}
              />
              <MediaGrid
                items={mediaItems}
                type="video"
                finalSelection={finalSelection}
                addingToFinal={addingToFinal}
                processingVideo={processingVideo}
                inspectorItem={inspectorItem}
                onItemTap={handleItemTap}
                isR2Url={isR2Url}
                getProxiedImageUrl={getProxiedImageUrl}
              />
              <MediaGrid
                items={mediaItems}
                type="frame"
                finalSelection={finalSelection}
                addingToFinal={addingToFinal}
                processingVideo={processingVideo}
                inspectorItem={inspectorItem}
                onItemTap={handleItemTap}
                isR2Url={isR2Url}
                getProxiedImageUrl={getProxiedImageUrl}
              />
                                </div>
              </div>

              {/* Right Column - Final Selection */}
          <FinalSelectionPanel
            finalSelection={finalSelection}
            uploadingFiles={uploadingFiles}
            processingIdentities={processingIdentities}
            submitting={submitting}
            identityExists={identityExists}
            isDragging={isDragging}
            fileInputRef={fileInputRef}
            onFileUpload={handleFileUpload}
            onItemTap={handleItemTap}
            onSubmit={handleSubmit}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
            isR2Url={isR2Url}
            getProxiedImageUrl={getProxiedImageUrl}
            setAddingToFinal={setAddingToFinal}
            processingVideo={processingVideo}
            addingToFinal={addingToFinal}
                  />
                      </div>
          )}

          {/* Video Sheet */}
      <VideoInspectorSheet
        inspectorItem={inspectorItem}
        processing={processing}
        processingVideo={processingVideo}
        identityExists={identityExists}
        hasProcessedFrames={
          inspectorItem?.type === 'video' && inspectorItem?.id
            ? mediaItems.some((item) => item.type === 'frame' && item.parentVideoId === inspectorItem.id)
            : false
        }
        onClose={() => setInspectorItem(null)}
        onProcessVideo={handleProcessVideos}
        isR2Url={isR2Url}
        getProxiedImageUrl={getProxiedImageUrl}
      />

      {/* Clear Collection Confirmation Dialog */}
      <ConfirmationDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Clear Collection"
        description="Are you sure you want to clear this collection? This will delete all photos, videos, and frames from storage."
        confirmText="Clear Collection"
        variant="destructive"
        onConfirm={handleClearAll}
      />
    </DashboardPage>
  )
}
