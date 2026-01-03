'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Loader2, MoreVertical, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

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
  hasProcessing: boolean
  hasCompleted: boolean
  processingCount: number
  totalCount: number
  completedCount: number
}

interface IdentityCardProps {
  group: GroupedIdentity
  main: Identity
  isExpanded: boolean
  isDeleting: boolean
  isProcessing: boolean
  visibleCompletedCount: number
  visibleCount: number
  visibleProcessingCount: number
  isGeneratingAnchor?: boolean
  isGeneratingVariants?: boolean
  anchorProgress?: { total: number; completed: number; failed: number }
  variantProgress?: { completed: number; total: number }
  isVariantState?: boolean
  totalPhotoCount?: number
  onExpand: () => void
  onDeletePhoto: (id: string) => void
  onDeleteProfile: () => void
  onGenerateAnchor: () => void
  onSelectPrimary?: () => void
  deletingPhotoId: string | null
  groupKey: string
  hasAnchorImages?: boolean
}

export function IdentityCard({
  group,
  main,
  isExpanded,
  isDeleting,
  isProcessing,
  visibleCompletedCount,
  visibleCount,
  visibleProcessingCount,
  isGeneratingAnchor,
  isGeneratingVariants,
  anchorProgress,
  variantProgress,
  isVariantState = false,
  totalPhotoCount,
  onExpand,
  onDeletePhoto,
  onDeleteProfile,
  onGenerateAnchor,
  onSelectPrimary,
  deletingPhotoId,
  groupKey,
  hasAnchorImages = false,
}: IdentityCardProps) {
  return (
    <motion.div
      animate={{
        y: isExpanded ? -8 : 0,
      }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={`bg-white rounded-lg overflow-hidden border border-brand-10 relative h-full transition-shadow duration-400 ${
        isExpanded 
          ? 'shadow-xl' 
          : 'shadow-sm'
      }`}
    >
      {/* Top Card - Image 1 */}
      <div
        className="relative cursor-pointer h-full"
        onClick={onExpand}
      >
        <div className="relative w-full h-full">
          {main?.generated_image_url && !isGeneratingAnchor ? (
            <>
              {main.generated_image_url.includes('/api/media/proxy') ? (
                <img
                  src={main.generated_image_url}
                  alt={group.instagram_username ? `@${group.instagram_username}` : 'Uncategorized'}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              ) : (
            <Image
              src={main.generated_image_url}
              alt={group.instagram_username ? `@${group.instagram_username}` : 'Uncategorized'}
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
              )}
            </>
          ) : isGeneratingAnchor ? (
            // Show loading state during generation instead of placeholder
            <div className="relative w-full h-full bg-gray-200 flex items-center justify-center rounded-lg animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            </div>
          ) : (
            <div className="relative w-full h-full bg-brand-5 rounded-lg" />
          )}

          {/* Processing overlay */}
          {isProcessing && !main?.generated_image_url && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
                <p className="text-xs text-white font-label">Processing...</p>
              </div>
            </div>
          )}

          {/* White gradient overlay with text */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/95 to-transparent flex items-end">
            <div className="p-4 w-full">
              <h3 className="text-sm font-medium text-brand mb-1">
                {group.instagram_username ? `@${group.instagram_username}` : 'Uncategorized'}
              </h3>
              {isVariantState && variantProgress && variantProgress.completed < variantProgress.total ? (
                <p className="text-xs font-label text-brand-60">
                  {variantProgress.completed}/{variantProgress.total} done processing...
                </p>
              ) : isVariantState && totalPhotoCount !== undefined ? (
                <p className="text-xs font-label text-brand-60">
                  {totalPhotoCount} photos
                </p>
              ) : isGeneratingAnchor ? (
                <p className="text-xs font-label text-brand-60">
                  {anchorProgress?.completed || 0}/{anchorProgress?.total || 10} done processing...
                </p>
              ) : (
                <p className="text-xs font-label text-brand-60">
                  {group.photoCount} photo{group.photoCount !== 1 ? 's' : ''}
                </p>
              )}
              {isProcessing && visibleProcessingCount > 0 && !isGeneratingAnchor && !isVariantState && (
                <p className="text-xs font-label text-brand-60 mt-1">
                  {visibleCompletedCount}/{visibleCount} done processing...
                </p>
              )}
            </div>
          </div>

          {/* Ellipsis Menu or Trash Button */}
          {group.instagram_username && (
            isVariantState ? (
              // Variant state: Show only trash button
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteProfile()
                }}
                disabled={isProcessing}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Delete profile"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            ) : (
              // Non-variant state: Show dropdown menu
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    disabled={isGeneratingAnchor || isProcessing}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Profile actions"
                  >
                    <MoreVertical className="w-4 h-4 text-brand" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {hasAnchorImages ? (
                    // Anchor mode: Show Delete profile and Select primary
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteProfile()
                        }}
                        disabled={isProcessing || isGeneratingAnchor}
                        className="text-red-600 focus:text-red-600"
                      >
                        Delete profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onSelectPrimary) {
                            onSelectPrimary()
                          }
                        }}
                        disabled={isProcessing || isGeneratingAnchor}
                      >
                        Make primary
                      </DropdownMenuItem>
                    </>
                  ) : (
                    // Seedream mode: Show original menu
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          if (main?.id) {
                            onDeletePhoto(main.id)
                          }
                        }}
                        disabled={!main?.id || deletingPhotoId === main.id || isProcessing || isGeneratingAnchor}
                      >
                        Delete photo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteProfile()
                        }}
                        disabled={isProcessing || isGeneratingAnchor}
                        className="text-red-600 focus:text-red-600"
                      >
                        Delete profile
                      </DropdownMenuItem>
                      {!group.identities.some(id => id.src === 'anc' && id.generated_image_url) && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            if (group.instagram_username) {
                              onGenerateAnchor()
                            } else {
                              toast.error('Cannot generate anchor for uncategorized profiles')
                            }
                          }}
                          disabled={!group.instagram_username || isProcessing || isGeneratingAnchor}
                        >
                          Generate anchor
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
        </div>
      </div>

      {/* Deleting overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-50">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
      )}
    </motion.div>
  )
}


