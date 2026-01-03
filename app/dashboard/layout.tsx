'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Set html and body background to match sidebar for overscroll bounce
    // Using the CSS variable directly - CSS will handle OKLCH format
    document.documentElement.style.setProperty('background-color', 'var(--sidebar)')
    document.body.style.setProperty('background-color', 'var(--sidebar)')
    
    return () => {
      // Reset to default landing page background when leaving dashboard
      document.documentElement.style.removeProperty('background-color')
      document.body.style.removeProperty('background-color')
    }
  }, [])

  return (
    <div className="min-h-screen bg-sidebar">
      {children}
      <Toaster position="top-right" />
    </div>
  )
}

