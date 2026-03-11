const BASE_URL = import.meta.env.VITE_API_BASE_URL

const TOKEN_KEY = 'auth_token'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = tokenStorage.get()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    if (res.status === 401) {
      const hadToken = !!tokenStorage.get()
      tokenStorage.clear()
      if (hadToken) {
        // Existing session expired — redirect and suspend (page is navigating away)
        window.location.href = '/login'
        return new Promise<T>(() => {})
      }
      // No existing token (e.g. failed login attempt) — fall through to throw normally
    }
    // Try to extract the error message from the NestJS error body
    let message = res.statusText
    try {
      const err = await res.json()
      message = err.message ?? message
    } catch {
      // non-JSON body — keep statusText
    }
    throw new ApiError(res.status, message)
  }

  // 204 No Content — return empty object cast to T
  if (res.status === 204) return {} as T

  return res.json() as Promise<T>
}

// ── Multipart upload helper ───────────────────────────────────────────────────

export async function apiUpload<T = void>(path: string, formData: FormData): Promise<T> {
  const token = tokenStorage.get()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (res.status === 401) {
    tokenStorage.clear()
    window.location.href = '/login'
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const err = await res.json()
      message = err.message ?? message
    } catch { /* non-JSON */ }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

// ── Authenticated file download ───────────────────────────────────────────────

export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = tokenStorage.get()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { headers })
  if (!res.ok) throw new ApiError(res.status, `Download failed: ${res.statusText}`)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── HTTP method shortcuts ─────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)  => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown)  => request<T>('PATCH',  path, body),
  put:    <T>(path: string, body?: unknown)  => request<T>('PUT',    path, body),
  delete: <T>(path: string, body?: unknown)  => request<T>('DELETE', path, body),
}
