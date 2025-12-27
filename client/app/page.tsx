"use client"

import { useEffect, useRef, useState } from "react"
import { FilesetResolver, DrawingUtils, HandLandmarker } from "@mediapipe/tasks-vision"
import Fetch from "@/Fetch"

// Modern design system
const COLORS = {
  primary: "#6366f1",
  secondary: "#a855f7",
  accent: "#ec4899",
  success: "#10b981",
  background: "rgba(10, 10, 15, 0.7)",
  border: "rgba(255, 255, 255, 0.1)",
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeHand, setActiveHand] = useState<string | null>(null)
  const [isPinching, setIsPinching] = useState(false)
  const gestureRecognizerRef = useRef<HandLandmarker | null>(null)
  const animationFrameIdRef = useRef<number>(0)

  // High-performance state storage to avoid React overhead in the loop
  const trackerState = useRef({
    lastSent: 0,
    lastX: 0,
    lastY: 0,
    isPinching: false,
    lastPinchTime: 0,
    smoothing: 0.75
  })

  function processCursor(landmarks: any) {
    const indexTip = landmarks[8]

    // Mapping 0-1 range to screen resolution
    // Using (1 - indexTip.x) because the video is mirrored for the user
    const targetX = (1 - indexTip.x) * window.screen.width
    const targetY = indexTip.y * window.screen.height

    const { lastX, lastY, smoothing } = trackerState.current

    const x = lastX * smoothing + targetX * (1 - smoothing)
    const y = lastY * smoothing + targetY * (1 - smoothing)

    trackerState.current.lastX = x
    trackerState.current.lastY = y

    sendUpdate(x, y)
  }

  function detectPinch(landmarks: any) {
    const thumb = landmarks[4]
    const middle = landmarks[12]

    const distance = Math.hypot(
      thumb.x - middle.x,
      thumb.y - middle.y,
      thumb.z - middle.z
    )

    // Pinch thresholding
    if (!trackerState.current.isPinching && distance < 0.035) {
      trackerState.current.isPinching = true
      return "START"
    }

    if (trackerState.current.isPinching && distance > 0.05) {
      trackerState.current.isPinching = false
      return "END"
    }

    return trackerState.current.isPinching ? "HOLD" : "NONE"
  }

  function sendUpdate(x: number, y: number) {
    const now = Date.now()
    if (now - trackerState.current.lastSent < 60) return // ~16 FPS limit for mouse updates
    Fetch.post('/gesture', { action: 'cursor', x, y })
    trackerState.current.lastSent = now
  }

  useEffect(() => {
    let mounted = true
    let lastProcessTime = 0

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          numHands: 2,
          runningMode: "VIDEO",
        })

        if (!mounted) return
        gestureRecognizerRef.current = handLandmarker
        setIsLoading(false)
        setupCamera()
      } catch (err) {
        console.error("Initialization failed:", err)
        setIsLoading(false)
      }
    }

    const setupCamera = async () => {
      if (!videoRef.current) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        })
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            loop()
          }
        }
      } catch (err) {
        console.error("Camera access denied:", err)
      }
    }

    const loop = () => {
      if (!videoRef.current || !canvasRef.current || !gestureRecognizerRef.current) return

      const now = Date.now()
      if (now - lastProcessTime < 30) { // Limit to 33 FPS
        animationFrameIdRef.current = requestAnimationFrame(loop)
        return
      }
      lastProcessTime = now

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const results = gestureRecognizerRef.current.detectForVideo(videoRef.current, performance.now())
        const ctx = canvasRef.current.getContext("2d")!
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

        let leftHandFound = false

        if (results.landmarks && results.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx)

          for (let i = 0; i < results.landmarks.length; i++) {
            const hand = results.landmarks[i]
            const type = results.handedness[i][0].categoryName // "Left" or "Right"
            const isTarget = type === "Left"

            if (isTarget) {
              leftHandFound = true
              processCursor(hand)

              const pinchAction = detectPinch(hand)
              if (pinchAction === "START") {
                setIsPinching(true)
                const pinchNow = Date.now()
                if (pinchNow - trackerState.current.lastPinchTime < 400) {
                  Fetch.post('/gesture', { action: 'double-tap' })
                  console.log('double-tap')
                } else {
                  Fetch.post('/gesture', { action: 'pinch' })
                  console.log('pinch')
                }
                trackerState.current.lastPinchTime = pinchNow
              } else if (pinchAction === "END") {
                setIsPinching(false)
              }
            }

            // Enhanced visualization
            drawingUtils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
              color: isTarget ? "#00FF00" : "rgba(255, 255, 255, 0.2)",
              lineWidth: isTarget ? 4 : 2
            })
            drawingUtils.drawLandmarks(hand, {
              color: isTarget ? "#FF0000" : "rgba(255, 255, 255, 0.1)",
              lineWidth: 1
            })
          }
        }

        setActiveHand(leftHandFound ? "Left Hand" : null)
      }

      animationFrameIdRef.current = requestAnimationFrame(loop)
    }

    init()

    return () => {
      mounted = false
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current)
      const tracks = (videoRef.current?.srcObject as MediaStream)?.getTracks()
      tracks?.forEach(t => t.stop())
      gestureRecognizerRef.current?.close()
    }
  }, [])

  return (
    <main style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#050505",
      fontFamily: "var(--font-geist-sans), system-ui"
    }}>
      {isLoading && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          zIndex: 100,
          color: "white"
        }}>
          <div style={{
            width: "50px",
            height: "50px",
            border: "2px solid #333",
            borderTopColor: COLORS.primary,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            marginBottom: "20px"
          }} />
          <div style={{ letterSpacing: "4px", fontSize: "12px", opacity: 0.7 }}>BOOTING GESTURE ENGINE...</div>
        </div>
      )}

      {/* Control Overlay */}
      <div style={{
        position: "absolute",
        top: "40px",
        left: "40px",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: "15px"
      }}>
        {/* <div style={{
          background: COLORS.background,
          backdropFilter: "blur(20px)",
          padding: "20px 30px",
          borderRadius: "20px",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
        }}>
          {/* <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "8px",
              height: "8px",
              background: activeHand ? COLORS.success : "#ff4444",
              borderRadius: "50%",
              boxShadow: activeHand ? `0 0 10px ${COLORS.success}` : "none"
            }} />
            <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "white", letterSpacing: "1px" }}>
              GESTURE CORE v2.0
            </h1>
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            Target: {activeHand || "Searching for Left Hand..."}
          </div>
        </div> */}

        <div style={{
          background: isPinching ? COLORS.accent : COLORS.background,
          backdropFilter: "blur(20px)",
          padding: "12px 24px",
          borderRadius: "15px",
          border: `1px solid ${COLORS.border}`,
          color: "white",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          transform: isPinching ? "scale(1.05)" : "scale(1)"
        }}>
          {isPinching ? "🎯 PINCH ACTIVE" : "🖐 READY TO PINCH"}
        </div>
      </div>

      {/* <div style={{
        position: "absolute",
        bottom: "40px",
        right: "40px",
        background: COLORS.background,
        backdropFilter: "blur(10px)",
        padding: "8px 16px",
        borderRadius: "100px",
        border: `1px solid ${COLORS.border}`,
        fontSize: "10px",
        color: "rgba(255,255,255,0.3)",
        letterSpacing: "1px"
      }}>
        L-HAND ISOLATION ENABLED
      </div> */}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          transform: "scaleX(-1)",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.8
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "scaleX(-1)",
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        }}
      />

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        body { margin: 0; background: #050505; }
      `}</style>
    </main>
  )
}
