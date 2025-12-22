"use client"

import { useEffect, useRef, useState } from "react"
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision"

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null)
  const animationFrameIdRef = useRef<number>(0)

  useEffect(() => {
    let isActive = true

    const initializeGestureRecognizer = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )

        const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU",
          },
          numHands: 1,
          runningMode: "VIDEO",
        })

        if (!isActive) return

        gestureRecognizerRef.current = gestureRecognizer
        setIsLoading(false)
        await startCamera()
      } catch (error) {
        console.error("Error initializing gesture recognizer:", error)
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

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const startTimeMs = performance.now()
        const results = gestureRecognizerRef.current.recognizeForVideo(video, startTimeMs)

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw landmarks if detected
        if (results.landmarks && results.landmarks.length > 0) {
          const drawingUtils = new DrawingUtils(ctx)

          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(
              landmarks,
              GestureRecognizer.HAND_CONNECTIONS,
              { color: "#00FF00", lineWidth: 5 }
            )
            drawingUtils.drawLandmarks(landmarks, {
              color: "#FF0000",
              lineWidth: 2,
            })
          }

          // Check for gestures
          if (results.gestures && results.gestures.length > 0) {
            const gesture = results.gestures[0][0]
            console.log(gesture);
            
            // if (gesture.categoryName) {
            //   console.log(`Gesture detected: ${gesture.categoryName} (${(gesture.score * 100).toFixed(0)}%)`)
            // }
          }

          // Custom pinch detection
          const landmarks = results.landmarks[0]
          const thumbTip = landmarks[4]
          const indexTip = landmarks[8]

          const distance = Math.hypot(
            thumbTip.x - indexTip.x,
            thumbTip.y - indexTip.y
          )

          if (distance < 0.05) {
            console.log("🤏 PINCH")
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
