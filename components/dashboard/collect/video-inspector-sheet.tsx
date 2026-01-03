'use client'

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/shadcn/sheet'
import { PrimaryButton } from '@/components/ui/primary-button'

interface MediaItem {
  id: string
  type: 'photo' | 'video' | 'frame'
  url: string
  thumbnail?: string
  extractedFrames?: string[]
  metadata?: {
    instagramId?: string
  }
}

interface VideoInspectorSheetProps {
  inspectorItem: MediaItem | null
  processing: boolean
  processingVideo: string | null
  identityExists: boolean
  hasProcessedFrames?: boolean
  onClose: () => void
  onProcessVideo: () => void
  isR2Url: (url: string) => boolean
  getProxiedImageUrl: (url: string) => string
}

export function VideoInspectorSheet({
  inspectorItem,
  processing,
  processingVideo,
  identityExists,
  hasProcessedFrames = false,
  onClose,
  onProcessVideo,
  isR2Url,
  getProxiedImageUrl,
}: VideoInspectorSheetProps) {
  if (!inspectorItem || inspectorItem.type !== 'video') return null

  return (
    <Sheet open={!!inspectorItem && inspectorItem.type === 'video'} onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetTitle className="text-2xl font-semibold tracking-tight text-[#133333] mb-8">Video Details</SheetTitle>
        <div className="space-y-6">
          {/* Video Player */}
          <div className="relative w-full max-w-[280px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-lg">
            <video
              src={inspectorItem.url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              poster={inspectorItem.thumbnail ? (isR2Url(inspectorItem.thumbnail) ? getProxiedImageUrl(inspectorItem.thumbnail) : inspectorItem.thumbnail) : undefined}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Instagram URL */}
          {inspectorItem.metadata?.instagramId && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#133333]/60 uppercase tracking-wide">Video Link</p>
              <a
                href={`https://www.instagram.com/p/${inspectorItem.metadata.instagramId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-[#133333]/80 hover:text-[#133333] transition-colors break-all"
              >
                https://www.instagram.com/p/{inspectorItem.metadata.instagramId}/
              </a>
            </div>
          )}

          {/* Process Button */}
          <PrimaryButton
            onClick={onProcessVideo}
            disabled={processingVideo === inspectorItem.url || hasProcessedFrames || (inspectorItem.extractedFrames && inspectorItem.extractedFrames.length > 0) || identityExists}
            loading={processing}
            loadingText="Processing..."
            fullWidth
            className="rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 shadow-sm font-semibold"
          >
            {identityExists ? 'Identity Exists' : (hasProcessedFrames || (inspectorItem.extractedFrames && inspectorItem.extractedFrames.length > 0)) ? 'Already Processed' : 'Process Video'}
          </PrimaryButton>
        </div>
      </SheetContent>
    </Sheet>
  )
}

