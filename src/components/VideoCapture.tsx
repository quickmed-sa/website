import { useRef, useState } from 'react'
import './VideoCapture.css'

interface VideoItem {
  file: File
  objectUrl: string
}

interface Props {
  onChange: (files: File[]) => void
  maxVideos?: number
}

export function VideoCapture({ onChange, maxVideos = 10 }: Props) {
  const [items, setItems] = useState<VideoItem[]>([])
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef  = useRef<HTMLInputElement>(null)

  function addFiles(newFiles: File[]) {
    const remaining = maxVideos - items.length
    if (remaining <= 0) return
    const toAdd = newFiles.slice(0, remaining).map(file => ({
      file,
      objectUrl: URL.createObjectURL(file),
    }))
    if (!toAdd.length) return
    const next = [...items, ...toAdd]
    setItems(next)
    onChange(next.map(i => i.file))
  }

  function remove(idx: number) {
    URL.revokeObjectURL(items[idx].objectUrl)
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    onChange(next.map(i => i.file))
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) addFiles([file])
  }

  return (
    <div className="vc-wrap">
      <input
        ref={galleryRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleGalleryChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="video/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCameraChange}
      />

      {items.length > 0 && (
        <div className="vc-grid">
          {items.map((item, i) => (
            <div key={i} className="vc-thumb">
              <video
                src={item.objectUrl}
                className="vc-preview"
                preload="metadata"
                playsInline
                muted
              />
              <span className="vc-name">{item.file.name}</span>
              <button
                type="button"
                className="vc-remove"
                onClick={() => remove(i)}
                aria-label="Remove video"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length < maxVideos ? (
        <div className="vc-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => galleryRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            From Gallery
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => cameraRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            Record Video
          </button>
          {items.length > 0 && (
            <span className="vc-count">{items.length} / {maxVideos}</span>
          )}
        </div>
      ) : (
        <p className="vc-limit">Maximum {maxVideos} videos reached.</p>
      )}
    </div>
  )
}
