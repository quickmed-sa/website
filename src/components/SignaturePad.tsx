import { useRef, useState, useCallback, useEffect } from 'react'
import './SignaturePad.css'

export interface CapturedSignature {
  dataUrl: string
  timestamp: string
}

interface Props {
  onCapture?: (sig: CapturedSignature) => void
}

const INK_COLOUR = '#1a1a2e'
const STROKE_WIDTH = 2

/** Draw the faint guide line across the lower third of the canvas. */
function drawGuideLine(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const y = Math.round(height * (2 / 3))
  ctx.save()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(16, y)
  ctx.lineTo(width - 16, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

/** Fill the canvas white and redraw the guide line. */
function resetCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  drawGuideLine(ctx, width, height)
}

export function SignaturePad({ onCapture }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  const [isEmpty, setIsEmpty] = useState(true)
  const [savedSig, setSavedSig] = useState<CapturedSignature | null>(null)

  // ── Canvas initialisation ────────────────────────────────────────────────────

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    resetCanvas(ctx, canvas.width, canvas.height)
  }, [])

  useEffect(() => {
    initCanvas()
  }, [initCanvas])

  // Reinitialise when the canvas element is first painted (size may change).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Preserve pixel dimensions when container resizes.
      // We only reset if the logical size actually changed.
      const { offsetWidth } = canvas
      if (canvas.width !== offsetWidth) {
        canvas.width = offsetWidth
        resetCanvas(ctx, canvas.width, canvas.height)
        setIsEmpty(true)
      }
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // ── Pointer helpers ──────────────────────────────────────────────────────────

  /** Translate a MouseEvent or Touch into canvas-local coordinates. */
  function getPoint(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  function beginStroke(x: number, y: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    isDrawing.current = true
    lastPoint.current = { x, y }
    setIsEmpty(false)

    ctx.beginPath()
    ctx.arc(x, y, STROKE_WIDTH / 2, 0, Math.PI * 2)
    ctx.fillStyle = INK_COLOUR
    ctx.fill()
  }

  function continueStroke(x: number, y: number) {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const from = lastPoint.current ?? { x, y }

    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(x, y)
    ctx.strokeStyle = INK_COLOUR
    ctx.lineWidth = STROKE_WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPoint.current = { x, y }
  }

  function endStroke() {
    isDrawing.current = false
    lastPoint.current = null
  }

  // ── Mouse events ─────────────────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = getPoint(canvas, e.clientX, e.clientY)
    beginStroke(x, y)
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = getPoint(canvas, e.clientX, e.clientY)
    continueStroke(x, y)
  }

  const onMouseUp = () => endStroke()
  const onMouseLeave = () => endStroke()

  // ── Touch events ─────────────────────────────────────────────────────────────

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault() // prevent scroll while signing
    const canvas = canvasRef.current
    if (!canvas) return
    const touch = e.touches[0]
    const { x, y } = getPoint(canvas, touch.clientX, touch.clientY)
    beginStroke(x, y)
  }

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const touch = e.touches[0]
    const { x, y } = getPoint(canvas, touch.clientX, touch.clientY)
    continueStroke(x, y)
  }

  const onTouchEnd = () => endStroke()

  // ── Actions ──────────────────────────────────────────────────────────────────

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    resetCanvas(ctx, canvas.width, canvas.height)
    setIsEmpty(true)
    setSavedSig(null)
  }, [])

  const save = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sig: CapturedSignature = {
      dataUrl: canvas.toDataURL('image/png'),
      timestamp: new Date().toLocaleString(),
    }
    setSavedSig(sig)
    onCapture?.(sig)
  }, [onCapture])

  const resign = useCallback(() => {
    setSavedSig(null)
    // Keep the canvas strokes intact so the user can adjust if needed,
    // but also offer a fresh start via the Clear button.
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="signature-pad">
      {/* Drawing surface */}
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        width={560}
        height={200}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="Signature drawing area"
        role="img"
      />

      {/* Controls */}
      <div className="signature-controls">
        <button className="btn btn-sig-clear" onClick={clear}>
          Clear
        </button>
        <button
          className="btn btn-sig-save"
          onClick={save}
          disabled={isEmpty}
        >
          Save Signature
        </button>
      </div>

      {/* Result preview */}
      {savedSig && (
        <div className="result-box">
          <img
            src={savedSig.dataUrl}
            alt="Saved signature preview"
            className="preview-image signature-preview"
          />
          <p className="meta">Signed at: {savedSig.timestamp}</p>
          <button className="btn btn-sig-clear" onClick={resign}>
            Re-sign
          </button>
        </div>
      )}
    </div>
  )
}
