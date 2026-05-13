import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import OAuthCallback from './pages/OAuthCallback'
import SignUp from './pages/SignUp'
import AgentSetup from './pages/onboarding/AgentSetup'
import DonationPreferences from './pages/onboarding/DonationPreferences'
import Overview from './pages/dashboard/Overview'
import Agents from './pages/dashboard/Agents'
import Contributions from './pages/dashboard/Contributions'
import Marketplace from './pages/dashboard/Marketplace'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import Docs from './pages/Docs'

function PlaceholderPage({ title }) {
  return (
    <div className="min-h-screen bg-alabaster flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-heading-lg font-bold text-charcoal mb-2">{title}</h1>
        <p className="text-body text-slate">Coming soon.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/projects" element={<Navigate to="/dashboard/marketplace" replace />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/terms" element={<PlaceholderPage title="Terms of Service" />} />
          <Route path="/privacy" element={<PlaceholderPage title="Privacy Policy" />} />
          <Route path="/support" element={<PlaceholderPage title="Support" />} />

          {/* Onboarding (auth required) */}
          <Route path="/onboarding/agent-setup" element={
            <ProtectedRoute><AgentSetup /></ProtectedRoute>
          } />
          <Route path="/onboarding/donation" element={
            <ProtectedRoute><DonationPreferences /></ProtectedRoute>
          } />

          {/* Dashboard (auth required) */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Overview /></ProtectedRoute>
          } />
          <Route path="/dashboard/agents" element={
            <ProtectedRoute><Agents /></ProtectedRoute>
          } />
          <Route path="/dashboard/contributions" element={
            <ProtectedRoute><Contributions /></ProtectedRoute>
          } />
          <Route path="/dashboard/marketplace" element={
            <ProtectedRoute><Marketplace /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute><Notifications /></ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
