'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
  onConfirm: () => void
  onCancel?: () => void
  disabled?: boolean
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  disabled = false,
}: ConfirmationDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const confirmButtonClass = variant === 'destructive'
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white'
    : '!bg-[#133333] hover:!bg-[#133333e6] focus:ring-[#133333] !text-white'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-medium text-[#133333]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm font-label text-[#133333]/70 mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3 sm:justify-end sm:flex-row">
          <AlertDialogCancel 
            onClick={handleCancel}
            disabled={disabled}
            className={`mt-0 order-2 sm:order-1 font-label focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={disabled}
            className={`${confirmButtonClass} order-1 sm:order-2 font-label ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

