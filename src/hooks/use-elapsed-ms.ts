import { useEffect, useState } from "react"

export function useElapsedMs(since: number | null): number {
  const [ms, setMs] = useState(since ? Date.now() - since : 0)

  useEffect(() => {
    if (!since) {
      setMs(0)
      return
    }
    setMs(Date.now() - since)
    const id = setInterval(() => setMs(Date.now() - since), 1000)
    return () => clearInterval(id)
  }, [since])

  return ms
}
