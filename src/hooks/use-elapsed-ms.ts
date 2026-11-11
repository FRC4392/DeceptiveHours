import { useEffect, useState } from "react"

export function useElapsedMs(since: number | null): number {
  const [ms, setMs] = useState(0)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let intervalId: ReturnType<typeof setInterval> | undefined

    if (!since) {
      timeoutId = setTimeout(() => setMs(0), 0)
    } else {
      // Clamped so a future `since` cannot subtract from the kiosk's displayed
      // total, which adds this elapsed time to completed hours.
      const update = () => setMs(Math.max(0, Date.now() - since))
      timeoutId = setTimeout(update, 0)
      intervalId = setInterval(update, 1000)
    }

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      if (intervalId !== undefined) clearInterval(intervalId)
    }
  }, [since])

  return ms
}
