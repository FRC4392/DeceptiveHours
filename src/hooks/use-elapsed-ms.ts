import { useEffect, useState } from "react"

export function useElapsedMs(since: number | null): number {
  const [ms, setMs] = useState(0)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let intervalId: ReturnType<typeof setInterval> | undefined

    if (!since) {
      timeoutId = setTimeout(() => setMs(0), 0)
    } else {
      const update = () => setMs(Date.now() - since)
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
