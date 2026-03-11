import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { authService } from './services/auth.service'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Stores } from './pages/Stores'
import { Users } from './pages/Users'
import { Visits } from './pages/Visits'
import { LogVisit } from './pages/LogVisit'
import { VisitDetail } from './pages/VisitDetail'
import { SiteInspection } from './pages/SiteInspection'
import { SiteInspections } from './pages/SiteInspections'
import { SiteInspectionDetail } from './pages/SiteInspectionDetail'
import { SiteInspectionAMForm } from './pages/SiteInspectionAMForm'
import { SiteInspectionOpsForm } from './pages/SiteInspectionOpsForm'
import { SiteInspectionsComparison } from './pages/SiteInspectionsComparison'
import { Schedules } from './pages/Schedules'
import { StoreActivations } from './pages/StoreActivations'
import { StoreActivation } from './pages/StoreActivation'
import './App.css'

function RootRedirect() {
  return authService.isAuthenticated()
    ? <Navigate to="/stores" replace />
    : <Navigate to="/login" replace />
}

/** Renders element only if current user has one of the allowed roles; otherwise redirects to /stores. */
function RoleRoute({ roles, element }: { roles: string[]; element: React.ReactElement }) {
  const user = authService.getCurrentUser()
  return (user && roles.includes(user.role))
    ? element
    : <Navigate to="/stores" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Protected — wrapped in Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/stores" element={<Stores />} />
            <Route path="/users"  element={<RoleRoute roles={['Admin']} element={<Users />} />} />
            <Route path="/visits"     element={<Visits />} />
            <Route path="/visits/:id" element={<VisitDetail />} />
            <Route path="/log-visit"  element={<RoleRoute roles={['Admin', 'Area Manager']} element={<LogVisit />} />} />
            <Route path="/site-inspection/:storeId" element={<SiteInspection />} />
            <Route path="/site-inspections" element={<SiteInspections />} />
            {/* compare must be declared before :id so the static segment takes priority */}
            <Route path="/site-inspections/compare/:storeId" element={<SiteInspectionsComparison />} />
            {/* multi-segment routes before the plain :id route */}
            <Route path="/site-inspections/:id/area-manager" element={<SiteInspectionAMForm />} />
            <Route path="/site-inspections/:id/operations" element={<SiteInspectionOpsForm />} />
            <Route path="/site-inspections/:id" element={<SiteInspectionDetail />} />
            <Route path="/schedules" element={<RoleRoute roles={['Admin', 'Area Manager']} element={<Schedules />} />} />
            <Route path="/store-activations"     element={<RoleRoute roles={['Admin', 'Operations', 'Franchise', 'Area Manager']} element={<StoreActivations />} />} />
            <Route path="/store-activations/:id" element={<RoleRoute roles={['Admin', 'Operations', 'Franchise', 'Area Manager']} element={<StoreActivation />} />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
