'use client'

import { Loader2 } from 'lucide-react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  size?: 'xs' | 'sm' | 'default' | 'lg'
  fullWidth?: boolean
  asChild?: boolean
  children: React.ReactNode
}

const sizeClasses = {
  xs: 'px-4 py-2 text-xs',
  sm: 'px-4 py-2 text-sm',
  default: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-2 text-sm',
}

export function PrimaryButton({
  loading = false,
  loadingText,
  size = 'default',
  fullWidth = false,
  asChild = false,
  children,
  className,
  disabled,
  ...props
}: PrimaryButtonProps) {
  const sizeClass = sizeClasses[size]
  const displayText = loading && loadingText ? loadingText : children
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(
        'rounded-lg bg-[#133333] text-white font-label font-medium',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'flex items-center justify-center gap-2',
        'transition-all active:scale-[0.98]',
        sizeClass,
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {displayText}
    </Comp>
  )
}

