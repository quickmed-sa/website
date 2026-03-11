import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { authService } from '../services/auth.service'
import './Layout.css'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const currentUser = authService.getCurrentUser()
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Operations'
  const canLogVisit = currentUser?.role === 'Admin' || currentUser?.role === 'Operations' || currentUser?.role === 'Area Manager'

  // Close mobile overlay on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  function handleLogout() {
    authService.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell${sidebarExpanded ? ' sidebar-expanded' : ' sidebar-collapsed'}`}>

      {/* ── Mobile top bar ── */}
      <header className="mobile-topbar">
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="mobile-brand">
          <img src="/logo.png" alt="Dr Morepen Pharmacy" className="brand-logo" />
        </div>
      </header>

      {/* ── Sidebar backdrop (mobile overlay) ── */}
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="Dr Morepen Pharmacy" className="brand-logo" />
          </div>

          {/* Mobile: close button */}
          <button
            className="sidebar-icon-btn sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>

          {/* Desktop: expand / collapse toggle */}
          <button
            className="sidebar-icon-btn sidebar-toggle-btn"
            onClick={() => setSidebarExpanded(e => !e)}
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
        </div>

        {/* User info */}
        {currentUser && (
          <div className="sidebar-user">
            <span className="sidebar-user-name">{currentUser.name}</span>
            <span className="sidebar-user-role">{currentUser.role}</span>
          </div>
        )}

        {/* Nav links */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink
            to="/stores"
            title="Stores"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className="sidebar-label">Stores</span>
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/users"
              title="Users"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span className="sidebar-label">Users</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/schedules"
              title="Schedules"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
                <line x1="8"  y1="14" x2="16" y2="14"/>
                <line x1="8"  y1="18" x2="12" y2="18"/>
              </svg>
              <span className="sidebar-label">Schedules</span>
            </NavLink>
          )}

          <NavLink
            to="/visits"
            title="Visits"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            <span className="sidebar-label">Visits</span>
          </NavLink>

          {canLogVisit && (
            <NavLink
              to="/log-visit"
              title="Log Visit"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="sidebar-label">Log Visit</span>
            </NavLink>
          )}

          <NavLink
            to="/site-inspections"
            title="Site Inspections"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span className="sidebar-label">Site Inspections</span>
          </NavLink>

          <NavLink
            to="/store-activations"
            title="Store Activations"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="sidebar-label">Store Activations</span>
          </NavLink>
        </nav>

        {/* Logout */}
        <div className="sidebar-footer">
          <button className="sidebar-logout" title="Logout" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="sidebar-label">Logout</span>
          </button>
        </div>

      </aside>

      {/* ── Page content ── */}
      <main className="page-content">
        <Outlet />
      </main>

    </div>
  )
}
