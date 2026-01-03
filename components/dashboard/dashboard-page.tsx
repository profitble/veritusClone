'use client'

import { AppSidebar, SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

interface DashboardPageProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  titleSize?: 'sm' | 'lg'
  headerActions?: React.ReactNode
  className?: string
}

export function DashboardPage({ 
  children, 
  title, 
  subtitle, 
  titleSize = 'sm',
  headerActions,
  className 
}: DashboardPageProps) {
  const titleClass = titleSize === 'lg' 
    ? 'text-4xl font-serif font-normal text-brand mb-2'
    : 'text-2xl font-serif font-normal text-brand mb-2'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className={`w-full px-4 sm:px-6 lg:px-8 py-8 ${className || ''}`}>
          {(title || subtitle || headerActions) && (
            <div className="mb-8">
              {headerActions ? (
                <div className="flex items-center justify-between">
                  <div>
                    {title && <h1 className={titleSize === 'lg' ? 'text-4xl font-serif font-normal text-brand' : 'text-2xl font-serif font-normal text-brand'}>{title}</h1>}
                    {subtitle && <p className="font-label text-brand/70">{subtitle}</p>}
                  </div>
                  {headerActions}
                </div>
              ) : (
                <>
                  {title && <h1 className={titleClass}>{title}</h1>}
                  {subtitle && <p className="font-label text-brand/70">{subtitle}</p>}
                </>
              )}
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

