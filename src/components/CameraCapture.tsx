import { useRef, useState, useCallback, useEffect } from 'react'
import './CameraCapture.css'

const isMobile = window.matchMedia('(pointer: coarse)').matches

export interface CapturedImage {
  dataUrl: string
  timestamp: string
}

interface Props {
  fileUpload?: boolean
  onCapture?: (image: CapturedImage) => void
}

export function CameraCapture({ fileUpload = false, onCapture }: Props) {
  // ── Shared state ────────────────────────────────────────────────────────────
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null)

  // ── Camera-only state ────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [hasFrontCamera, setHasFrontCamera] = useState(false)

  // ── Upload-only state ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Camera helpers ───────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startStream = useCallback(async (facing: 'environment' | 'user') => {
    stopStream()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing },
      audio: false,
    })
    streamRef.current = stream

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices.filter((d) => d.kind === 'videoinput')
    setHasFrontCamera(videoInputs.length > 1)

    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    })
  }, [stopStream])

  const openCamera = async () => {
    setCameraError(null)
    setCapturedImage(null)
    try {
      await startStream(facingMode)
      setCameraOpen(true)
    } catch (err: unknown) {
      const e = err as { name?: string }
      if (e.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access and try again.')
      } else if (e.name === 'NotFoundError') {
        setCameraError('No camera found on this device.')
      } else {
        setCameraError('Could not open camera. Try again.')
      }
    }
  }

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    try {
      await startStream(next)
    } catch {
      setFacingMode(facingMode)
      await startStream(facingMode)
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return

    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    if (facingMode === 'user') {
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, w, h)
    ctx.restore()

    const image: CapturedImage = {
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      timestamp: new Date().toLocaleString(),
    }

    setCapturedImage(image)
    onCapture?.(image)
    stopStream()
    setCameraOpen(false)
  }

  const closeCamera = () => {
    stopStream()
    setCameraOpen(false)
  }

  useEffect(() => () => stopStream(), [stopStream])

  // ── Upload handler ───────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be re-selected

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file.')
      return
    }

    setUploadError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const image: CapturedImage = {
        dataUrl: reader.result as string,
        timestamp: new Date().toLocaleString(),
      }
      setCapturedImage(image)
      onCapture?.(image)
    }
    reader.readAsDataURL(file)
  }

  // ── Render: upload mode ──────────────────────────────────────────────────────
  if (fileUpload) {
    return (
      <div className="camera-capture">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Primary action buttons — shown when camera is not open */}
        {!cameraOpen && (
          <div className="capture-options">
            <button className="btn btn-upload" onClick={() => fileInputRef.current?.click()}>
              Upload Image
            </button>
            <button className="btn btn-camera" onClick={openCamera}>
              Take Photo
            </button>
          </div>
        )}

        {uploadError && <p className="error">{uploadError}</p>}
        {cameraError && <p className="error">{cameraError}</p>}

        {/* Camera viewfinder — shared with camera-only mode */}
        {cameraOpen && (
          <div className="camera-viewer">
            <div className="camera-video-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`camera-video${facingMode === 'user' ? ' mirrored' : ''}`}
              />
              {isMobile && hasFrontCamera && (
                <button className="btn-flip" onClick={flipCamera} title="Flip camera">
                  &#x21BB;
                </button>
              )}
            </div>
            <div className="camera-controls">
              <button className="btn btn-capture" onClick={capturePhoto}>
                Capture
              </button>
              <button className="btn btn-cancel" onClick={closeCamera}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {capturedImage && (
          <div className="result-box">
            <img src={capturedImage.dataUrl} alt="Uploaded or captured" className="preview-image" />
            <p className="meta">
              {capturedImage.timestamp}
            </p>
            <div className="result-actions">
              <button
                className="btn btn-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                Change Image
              </button>
              <button className="btn btn-camera" onClick={openCamera}>
                Retake Photo
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render: camera mode ──────────────────────────────────────────────────────
  return (
    <div className="camera-capture">
      {!cameraOpen && (
        <button className="btn btn-camera" onClick={openCamera}>
          Open Camera
        </button>
      )}

      {cameraError && <p className="error">{cameraError}</p>}

      {cameraOpen && (
        <div className="camera-viewer">
          <div className="camera-video-wrapper">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`camera-video${facingMode === 'user' ? ' mirrored' : ''}`}
            />
            {isMobile && hasFrontCamera && (
              <button className="btn-flip" onClick={flipCamera} title="Flip camera">
                &#x21BB;
              </button>
            )}
          </div>
          <div className="camera-controls">
            <button className="btn btn-capture" onClick={capturePhoto}>
              Capture
            </button>
            <button className="btn btn-cancel" onClick={closeCamera}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {capturedImage && (
        <div className="result-box">
          <img src={capturedImage.dataUrl} alt="Captured" className="preview-image" />
          <p className="meta">Captured at: {capturedImage.timestamp}</p>
          <button className="btn btn-camera" onClick={openCamera}>
            Retake Photo
          </button>
        </div>
      )}
    </div>
  )
}
