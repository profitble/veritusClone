'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'

interface MediaItem {
  id: string
  type: 'photo' | 'video' | 'frame'
  source: 'instagram' | 'upload'
  url: string
  thumbnail?: string
  caption?: string
  extractedFrames?: string[]
  metadata?: {
    instagramId?: string
  }
}

interface MediaGridProps {
  items: MediaItem[]
  type: 'photo' | 'video' | 'frame'
  finalSelection: MediaItem[]
  addingToFinal: Set<string>
  processingVideo: string | null
  inspectorItem: MediaItem | null
  onItemTap: (item: MediaItem, isFinal: boolean) => void
  isR2Url: (url: string) => boolean
  getProxiedImageUrl: (url: string) => string
}

export function MediaGrid({
  items,
  type,
  finalSelection,
  addingToFinal,
  processingVideo,
  inspectorItem,
  onItemTap,
  isR2Url,
  getProxiedImageUrl,
}: MediaGridProps) {
  const filteredItems = items.filter((item) => item.type === type)

  if (filteredItems.length === 0) return null

  const typeLabel = type === 'photo' ? 'Photos' : type === 'video' ? 'Reels' : 'Frames'

  return (
    <div>
      <h3 className="text-sm font-medium text-[#133333] mb-4">
        {typeLabel} ({filteredItems.length})
      </h3>
      <div className={`grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 ${type === 'video' ? '' : ''}`}>
        {filteredItems.map((item) => {
          const isInFinal = finalSelection.some((i) => i.id === item.id)
          const isProcessing = processingVideo === item.url
          const isAdding = addingToFinal.has(item.id)
          const isProcessed = type === 'video' && !!item.extractedFrames && item.extractedFrames.length > 0
          const isSelected = type === 'video' && inspectorItem?.id === item.id && inspectorItem?.type === 'video'

          return (
            <div
              key={item.id}
              className={`relative rounded-md overflow-hidden transition-all ${
                type === 'video'
                  ? `${isProcessed ? 'ring-2 ring-purple-500' : isSelected ? 'ring-2 ring-purple-500' : ''} ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`
                  : `cursor-pointer ${isInFinal ? 'ring-2 ring-green-500' : ''}`
              }`}
              onClick={() => {
                if (type === 'video' && !isProcessing) {
                  onItemTap(item, false)
                } else if (type !== 'video') {
                  onItemTap(item, false)
                }
              }}
            >
              {type === 'video' ? (
                <video
                  src={item.url}
                  className="w-full aspect-[9/16] object-cover"
                  poster={item.thumbnail ? (isR2Url(item.thumbnail) ? getProxiedImageUrl(item.thumbnail) : item.thumbnail) : undefined}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="relative aspect-square">
                  {isR2Url(item.url) ? (
                    <img
                      src={getProxiedImageUrl(item.url)}
                      alt={item.caption || `${type} ${item.id}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.caption || `${type} ${item.id}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  )}
                </div>
              )}

              {/* Adding to final indicator */}
              {isAdding && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

