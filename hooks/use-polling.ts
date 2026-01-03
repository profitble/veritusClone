import { useEffect, useRef } from 'react'

/**
 * Hook that automatically calls a callback function at regular intervals when a condition is true.
 * Automatically cleans up the interval when the condition becomes false or the component unmounts.
 * 
 * @param condition - Whether polling should be active
 * @param callback - Function to call on each poll
 * @param interval - Polling interval in milliseconds (default: 2500ms)
 */
export function usePolling(
  condition: boolean,
  callback: () => void,
  interval: number = 2500
): void {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (condition) {
      // Start polling
      intervalRef.current = setInterval(() => {
        callback()
      }, interval)
    } else {
      // Stop polling when condition is false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    // Cleanup on unmount or when condition/callback changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [condition, callback, interval])
}

