import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  spacing?: 'sm' | 'md' | 'lg'
  className?: string
}

const spacingClasses = {
  sm: 'mb-4',
  md: 'mb-6',
  lg: 'mb-8',
}

export function PageHeader({ 
  title, 
  spacing = 'md',
  className 
}: PageHeaderProps) {
  return (
    <h2 className={cn(
      'text-2xl font-serif font-normal text-brand',
      spacingClasses[spacing],
      className
    )}>
      {title}
    </h2>
  )
}

