import { useState } from 'react'
import './LocationCapture.css'

export interface CapturedLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
}

interface Props {
  onCapture?: (location: CapturedLocation) => void
}

export function LocationCapture({ onCapture }: Props) {
  const [location, setLocation] = useState<CapturedLocation | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const capture = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.')
      return
    }

    setLoading(true)
    setLocationError(null)
    setLocation(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const captured: CapturedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          timestamp: new Date().toLocaleString(),
        }
        setLocation(captured)
        onCapture?.(captured)
        setLoading(false)
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Permission denied. Please allow location access.',
          2: 'Position unavailable. Could not determine location.',
          3: 'Request timed out. Try again.',
        }
        setLocationError(messages[error.code] ?? 'Unknown error occurred.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div className="location-capture">
      <button className="btn btn-location" onClick={capture} disabled={loading}>
        {loading ? 'Fetching...' : 'Capture Location'}
      </button>

      {locationError && <p className="error">{locationError}</p>}

      {location && (
        <div className="result-box">
          <table className="coords-table">
            <tbody>
              <tr>
                <td>Latitude</td>
                <td>{location.latitude.toFixed(6)}°</td>
              </tr>
              <tr>
                <td>Longitude</td>
                <td>{location.longitude.toFixed(6)}°</td>
              </tr>
              <tr>
                <td>Accuracy</td>
                <td>±{location.accuracy} m</td>
              </tr>
              <tr>
                <td>Timestamp</td>
                <td>{location.timestamp}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
