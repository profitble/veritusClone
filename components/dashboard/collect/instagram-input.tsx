'use client'

import { PrimaryButton } from '@/components/ui/primary-button'

interface InstagramInputProps {
  instagramUrl: string
  instagramUsername: string | null
  analyzing: boolean
  identityExists: boolean
  onUrlChange: (url: string) => void
  onSubmit: () => void
}

export function InstagramInput({
  instagramUrl,
  instagramUsername,
  analyzing,
  identityExists,
  onUrlChange,
  onSubmit,
}: InstagramInputProps) {
  return (
    <div className="mb-8">
      <label className="block text-sm font-medium text-[#133333] mb-2">
        Instagram Profile
      </label>
      {instagramUsername && (
        <p className="text-sm text-[#133333]/60 mb-2 font-label">
          Current profile: @{instagramUsername}
        </p>
      )}
      <div className="flex items-center gap-3 max-w-xl">
        <input
          type="text"
          value={instagramUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="instagram.com/username"
          className="flex-1 rounded-lg border border-[#133333]/10 bg-white px-4 py-2.5 text-sm font-label focus:outline-none focus:ring-2 focus:ring-[#133333]/20 focus:border-[#133333]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          onKeyDown={(e) => e.key === 'Enter' && !analyzing && !identityExists && onSubmit()}
          disabled={analyzing || identityExists}
        />
        <PrimaryButton
          onClick={onSubmit}
          disabled={identityExists}
          loading={analyzing}
          loadingText="Processing..."
          className="whitespace-nowrap"
        >
          {identityExists ? 'Identity Exists' : 'Process'}
        </PrimaryButton>
      </div>
    </div>
  )
}

