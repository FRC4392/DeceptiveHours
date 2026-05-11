import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { X, CameraOff } from "lucide-react"

interface BarcodeResult {
  rawValue: string
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>
}

declare const BarcodeDetector: {
  new (options?: { formats: string[] }): BarcodeDetectorInstance
}

interface Props {
  onScan: (value: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window

  useEffect(() => {
    if (!supported) return

    let active = true
    let stream: MediaStream | null = null
    let rafId: number

    async function start() {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (!videoRef.current || !active) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        tick(detector)
      } catch {
        if (active) setError("Camera access denied or unavailable.")
      }
    }

    async function tick(detector: BarcodeDetectorInstance) {
      if (!active || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes.length > 0 && active) {
          active = false
          onScan(codes[0].rawValue)
          return
        }
      } catch {
        // ignore frame errors
      }
      rafId = requestAnimationFrame(() => tick(detector))
    }

    start()
    return () => {
      active = false
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [supported, onScan])

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CameraOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Camera QR scanning is not supported in this browser.
          <br />
          Please type your Member ID instead.
        </p>
        <Button variant="outline" onClick={onClose}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      {error ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CameraOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={onClose}>
            Go Back
          </Button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full rounded-lg"
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-lg border-4 border-primary/70" />
          </div>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 bg-black/40 text-white hover:bg-black/60"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
