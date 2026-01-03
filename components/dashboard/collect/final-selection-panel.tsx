'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { PrimaryButton } from '@/components/ui/primary-button'

interface MediaItem {
  id: string
  type: 'photo' | 'video' | 'frame'
  source: 'instagram' | 'upload'
  url: string
  caption?: string
}

interface FinalSelectionPanelProps {
  finalSelection: MediaItem[]
  uploadingFiles: Set<string>
  processingIdentities: number
  submitting: boolean
  identityExists: boolean
  isDragging: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileUpload: (files: FileList) => void
  onItemTap: (item: MediaItem, isFinal: boolean) => void
  onSubmit: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  isR2Url: (url: string) => boolean
  getProxiedImageUrl: (url: string) => string
  setAddingToFinal: React.Dispatch<React.SetStateAction<Set<string>>>
  processingVideo: string | null
  addingToFinal: Set<string>
}

export function FinalSelectionPanel({
  finalSelection,
  uploadingFiles,
  processingIdentities,
  submitting,
  identityExists,
  isDragging,
  fileInputRef,
  onFileUpload,
  onItemTap,
  onSubmit,
  onDragOver,
  onDragLeave,
  onDrop,
  isR2Url,
  getProxiedImageUrl,
  setAddingToFinal,
  processingVideo,
  addingToFinal,
}: FinalSelectionPanelProps) {
  return (
    <div className="lg:col-span-1">
      <div className="sticky top-8">
        <h3 className="text-sm font-medium text-[#133333] mb-4">
          Final Selection ({finalSelection.length})
        </h3>

        {/* Upload Area */}
        <div
          className={`mb-6 rounded-lg border border-dashed transition-colors p-4 relative ${
            isDragging ? 'border-[#133333] bg-[#133333]/5' : 'border-[#133333]/20 bg-[#133333]/2'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {uploadingFiles.size > 0 && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#133333]" />
                <p className="text-xs text-[#133333]/70 font-label">
                  Uploading {uploadingFiles.size} file{uploadingFiles.size !== 1 ? 's' : ''}...
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center">
            <PrimaryButton
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles.size > 0}
              size="xs"
            >
              Browse Files
            </PrimaryButton>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic"
              className="hidden"
              disabled={uploadingFiles.size > 0}
              onChange={(e) => {
                if (e.target.files) {
                  onFileUpload(e.target.files)
                }
              }}
            />
          </div>
        </div>

        {/* Final Selection Grid */}
        <div className="grid grid-cols-3 gap-1.5 max-h-[calc(100vh-300px)] overflow-y-auto">
          {finalSelection.map((item) => {
            const isProcessing = processingVideo === item.url
            const isAdding = addingToFinal.has(item.id)

            return (
              <div
                key={item.id}
                className="relative rounded-lg overflow-hidden cursor-pointer transition-all"
                onClick={() => onItemTap(item, true)}
              >
                <div className="relative aspect-square">
                  {isR2Url(item.url) ? (
                    <img
                      src={getProxiedImageUrl(item.url)}
                      alt={item.caption || `Photo ${item.id}`}
                      className="w-full h-full object-cover"
                      onLoad={() => {
                        setAddingToFinal((prev) => {
                          const next = new Set(prev)
                          next.delete(item.id)
                          return next
                        })
                      }}
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.caption || `Photo ${item.id}`}
                      fill
                      className="object-cover"
                      sizes="33vw"
                      onLoad={() => {
                        setAddingToFinal((prev) => {
                          const next = new Set(prev)
                          next.delete(item.id)
                          return next
                        })
                      }}
                    />
                  )}
                </div>

                {/* Loading indicator */}
                {isAdding && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Processing indicator only */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Generation Status - Show if processing */}
        {processingIdentities > 0 && (
          <div className="mt-6 pt-6 border-t border-[#133333]/10">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#133333]" />
              <p className="text-xs font-label text-[#133333]/60">
                Generating {processingIdentities} photo{processingIdentities !== 1 ? 's' : ''}...
              </p>
            </div>
            <p className="text-xs font-label text-[#133333]/40">
              Your images are being processed. You can continue working or refresh the page.
            </p>
          </div>
        )}

        {/* Submit Button - Show only if there are photos/frames in final selection */}
        {finalSelection.some((item) => item.type === 'photo' || item.type === 'frame') && (
          <div className="mt-6 pt-6 border-t border-[#133333]/10">
            <PrimaryButton
              onClick={onSubmit}
              disabled={processingIdentities > 0 || identityExists}
              loading={submitting}
              loadingText="Generating..."
              fullWidth
            >
              {identityExists ? 'Identity Exists' : 'Submit'}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}

