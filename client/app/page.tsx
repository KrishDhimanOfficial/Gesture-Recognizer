"use client"

import { useEffect, useRef, useState } from "react"
import { GestureRecognizer, FilesetResolver, DrawingUtils, HandLandmarker } from "@mediapipe/tasks-vision"
import Fetch from "@/Fetch"

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const gestureRecognizerRef = useRef<HandLandmarker | null>(null)
  const animationFrameIdRef = useRef<number>(0)
  let lastSent = 0
  let lastX = 0
  let lastY = 0
   let pinching = false
  const SMOOTHING = 0.7

  function detectCursor(landmarks: any) {
    const indexTip = landmarks[8]

    const targetX = (1 - indexTip.x) * window.screen.width
    const targetY = indexTip.y * window.screen.height

    // smoothing (VERY IMPORTANT)
    const x = lastX * SMOOTHING + targetX * (1 - SMOOTHING)
    const y = lastY * SMOOTHING + targetY * (1 - SMOOTHING)

    lastX = x
    lastY = y

    sendMouseMove(x, y)
  }

  function isMiddlePinching(landmarks: any) {
    const thumb = landmarks[4]
    const middle = landmarks[12]

    const dist = Math.hypot(
      thumb.x - middle.x,
      thumb.y - middle.y,
      thumb.z - middle.z
    )

    // Start pinch
    if (!pinching && dist < 0.035) {
      pinching = true
      return "PINCH_START"
    }

    // Release pinch
    if (pinching && dist > 0.05) {
      pinching = false
      return "PINCH_END"
    }

    return pinching ? "PINCH_HOLD" : "NO_PINCH"
  }

  function sendMouseMove(x: number, y: number) {
    const now = Date.now()
    if (now - lastSent < 100) return // ~10fps
    Fetch.post('/gesture', { action: 'cursor', x, y })
    lastSent = now
  }

  useEffect(() => {
    let isActive = true
    let lastVideoTime = 0
    let lastPinchTime = 0

    const initializeGestureRecognizer = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          numHands: 1,
          runningMode: "VIDEO",
        })

        if (!isActive) return

        gestureRecognizerRef.current = handLandmarker
        setIsLoading(false)
        await startCamera()
      } catch (error) {
        console.error("Error initializing hand landmarker:", error)
        setIsLoading(false)
      }
    }

    const startCamera = async () => {
      if (!videoRef.current || !canvasRef.current) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        })

        videoRef.current.srcObject = stream

        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            processFrame()
          }
        }
      } catch (error) {
        console.error("Error accessing camera:", error)
      }
    }

    const processFrame = () => {
      if (!videoRef.current || !canvasRef.current || !gestureRecognizerRef.current) {
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!

      const now = Date.now()
      // Limit to ~24 FPS (approx 42ms per frame) to reduce CPU usage
      if (now - lastVideoTime < 40) {
        animationFrameIdRef.current = requestAnimationFrame(processFrame)
        return
      }
      lastVideoTime = now

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const startTimeMs = performance.now()
        // HandLandmarker uses detectForVideo
        const results = gestureRecognizerRef.current.detectForVideo(video, startTimeMs)

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw landmarks if detected
        if (results.landmarks && results.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx)

          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(
              landmarks,
              HandLandmarker.HAND_CONNECTIONS,
              { color: "#00FF00", lineWidth: 5 }
            )
            drawingUtils.drawLandmarks(landmarks, {
              color: "#FF0000",
              lineWidth: 2,
            })
          }

          // HandLandmarker does not return 'gestures', only landmarks.
          // We removed the gesture checking block.

          // Custom pinch detection
          const landmarks = results.landmarks[0]
          const thumbTip = landmarks[4]
          const indexTip = landmarks[8]

          detectCursor(landmarks)
          const isPinching = isMiddlePinching(landmarks)
          if (isPinching === "PINCH_START") {
            const now = Date.now()
            if (now - lastPinchTime < 300) {
              Fetch.post('/gesture', { action: 'double-tap' })
              console.log("Double Tap")
            } else {
              Fetch.post('/gesture', { action: 'pinch' })
              console.log("Single Tap")
            }
            lastPinchTime = now
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(processFrame)
    }

    initializeGestureRecognizer()
    return () => {
      isActive = false
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
      const stream = videoRef.current?.srcObject as MediaStream
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      if (gestureRecognizerRef.current) {
        gestureRecognizerRef.current.close()
      }
    }
  }, [])

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {isLoading && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "24px",
          color: "white",
          zIndex: 10
        }}>
          Loading gesture recognizer...
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          transform: "scaleX(-1)",
          width: "100%",
          height: "100%",
          objectFit: "cover"
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
          height: "100%"
        }}
      />
    </main>
  )
}
