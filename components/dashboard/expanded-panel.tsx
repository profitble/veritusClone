'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Loader2, Trash2, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ExpandedPanelProps {
  images: Array<{
    id: string
    url: string | null
    status?: string
    hasImage: boolean
    created_at?: string
  }>
  groupKey: string
  groupUsername: string | null
  cardWidth: number | undefined
  cardHeight: number | undefined
  deletingPhotoId: string | null
  onDeletePhoto: (id: string) => void
  onSelectPrimary?: (id: string) => void
  isProcessing?: boolean
  isGeneratingAnchor?: boolean
  hasAnchorImages?: boolean
  isVariantState?: boolean
}

export function ExpandedPanel({
  images,
  groupKey,
  groupUsername,
  cardWidth,
  cardHeight,
  deletingPhotoId,
  onDeletePhoto,
  onSelectPrimary,
  isProcessing = false,
  isGeneratingAnchor = false,
  hasAnchorImages = false,
  isVariantState = false,
}: ExpandedPanelProps) {
  return (
    <motion.div
      key={`${groupKey}-expanded`}
      initial={{ opacity: 0, x: -30, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.95 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="absolute top-0 left-full ml-6 flex gap-6 z-20 overflow-x-auto overflow-y-hidden pr-4 sm:pr-6 lg:pr-8"
      style={{ 
        height: cardHeight ? `${cardHeight}px` : 'auto',
        width: 'max-content'
      }}
    >
      {images.map((img, index) => (
        <motion.div
          key={img.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
          className="relative aspect-4/5 shrink-0"
          style={{ width: cardWidth ? `${cardWidth}px` : 'auto' }}
        >
          {img.hasImage && img.url ? (
            <>
              {img.url.includes('/api/media/proxy') ? (
                <img
                  src={img.url}
                  alt={`${groupUsername ? `@${groupUsername}` : 'Uncategorized'} - Image ${index + 2}`}
                  className="absolute inset-0 w-full h-full object-cover object-top rounded-lg"
                />
              ) : (
              <Image
                src={img.url}
                alt={`${groupUsername ? `@${groupUsername}` : 'Uncategorized'} - Image ${index + 2}`}
                fill
                className="object-cover object-top rounded-lg"
                sizes="20vw"
              />
              )}
              {(img.status === 'processing' || !img.status) && (
                <>
                  <div className="absolute inset-0 bg-gray-200 rounded-lg" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                </div>
                </>
              )}
              {deletingPhotoId === img.id ? (
                <div className="absolute top-2 right-2">
                  <div className="bg-black/50 rounded-full p-1">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                </div>
              ) : hasAnchorImages && !isVariantState ? (
                // Anchor mode: Show three dots menu (not in variant state)
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      disabled={isProcessing || isGeneratingAnchor || img.status === 'processing'}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      aria-label="Image actions"
                    >
                      <MoreVertical className="w-4 h-4 text-brand" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onSelectPrimary) {
                          onSelectPrimary(img.id)
                        }
                      }}
                      disabled={isProcessing || isGeneratingAnchor || img.status === 'processing'}
                    >
                      Make primary
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : hasAnchorImages && isVariantState ? (
                // Variant state: No menu (variants don't have actions)
                null
              ) : (
                // Seedream mode: Show trash icon
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePhoto(img.id)
                  }}
                  disabled={deletingPhotoId !== null || isProcessing || isGeneratingAnchor}
                  className={`absolute top-2 right-2 p-1 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all z-10 shadow-sm ${isProcessing || isGeneratingAnchor ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Delete photo"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-brand-30" />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

