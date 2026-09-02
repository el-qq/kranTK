import { useCallback } from 'react'
import { Sidebar } from '../components/Sidebar'
import { LoginScreen } from '../features/auth/LoginScreen'
import { useAuth } from '../features/auth/useAuth'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { MonitoringPage } from '../features/monitoring/MonitoringPage'
import { useRoute, type Section } from './router'
import './app.css'

export function App() {
  const { session, signIn, signOut } = useAuth()
  const { route, navigate } = useRoute()

  const goSection = useCallback(
    (section: Section) => navigate({ ...route, section }),
    [navigate, route],
  )

  const openMonitoring = useCallback(
    (craneId: string) => navigate({ section: 'monitoring', craneId }),
    [navigate],
  )

  if (!session) return <LoginScreen onSubmit={signIn} />

  return (
    <div className="shell">
      <Sidebar route={route} onNavigate={goSection} onSignOut={signOut} />
      <div className="shell__content">
        {route.section === 'dashboard' ? (
          <DashboardPage onOpenCrane={openMonitoring} />
        ) : (
          <MonitoringPage craneId={route.craneId} onSelectCrane={openMonitoring} />
        )}
      </div>
    </div>
  )
}
