import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { Button } from "@/components/ui/button"
import { X, CameraOff } from "lucide-react"

interface Props {
  onScan: (value: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let stream: MediaStream | null = null
    let rafId: number

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (!videoRef.current || !active) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        tick()
      } catch {
        if (active) setError("Camera access denied or unavailable.")
      }
    }

    function tick() {
      if (!active) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafId = requestAnimationFrame(tick)
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const result = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      })
      if (result && active) {
        active = false
        onScan(result.data)
        return
      }

      rafId = requestAnimationFrame(tick)
    }

    start()
    return () => {
      active = false
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onScan])

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
          <video ref={videoRef} className="w-full rounded-lg" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
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
