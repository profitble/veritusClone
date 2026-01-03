'use client'

import { createContext, useContext } from 'react'

interface ProcessingContextType {
  getGroupProcessing: (groupKey: string) => boolean
}

export const ProcessingContext = createContext<ProcessingContextType | null>(null)

export function useProcessing() {
  const context = useContext(ProcessingContext)
  if (!context) {
    throw new Error('useProcessing must be used within ProcessingProvider')
  }
  return context
}

