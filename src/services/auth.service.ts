import { api, tokenStorage } from './api'

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  user: { id: string; name: string; email: string; role: string; status: string }
}

export interface JwtPayload {
  sub: string
  email: string
  role: string
  name: string
}

function decodeToken(token: string): JwtPayload | null {
  try {
    const raw = token.split('.')[1]
    return JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/login', payload)
    tokenStorage.set(res.access_token)
    if (res.user?.name) localStorage.setItem('USER_NAME', res.user.name)
    return res
  },

  logout(): void {
    tokenStorage.clear()
    localStorage.removeItem('USER_NAME')
  },

  isAuthenticated(): boolean {
    return tokenStorage.get() !== null
  },

  getCurrentUser(): JwtPayload | null {
    const token = tokenStorage.get()
    if (!token) return null
    const payload = decodeToken(token)
    if (!payload) return null
    return { ...payload, name: localStorage.getItem('USER_NAME') ?? '' }
  },
}
