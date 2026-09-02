import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CRANE_ID } from '../domain/fleet'

/**
 * Маршрутизация по hash. На GitHub Pages нет rewrite на index.html,
 * поэтому обычные пути давали бы 404 при перезагрузке страницы.
 */
export type Section = 'dashboard' | 'monitoring'

export interface Route {
  section: Section
  craneId: string
}

const DEFAULT_ROUTE: Route = { section: 'dashboard', craneId: DEFAULT_CRANE_ID }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [section, craneId] = parts
  if (section === 'monitoring') {
    return { section: 'monitoring', craneId: craneId || DEFAULT_CRANE_ID }
  }
  return DEFAULT_ROUTE
}

export function hrefFor(route: Route): string {
  return route.section === 'monitoring' ? `#/monitoring/${route.craneId}` : '#/dashboard'
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    if (!window.location.hash) window.location.replace('#/dashboard')
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    const href = hrefFor(next)
    if (window.location.hash !== href) window.location.hash = href
    else setRoute(next)
  }, [])

  return { route, navigate }
}
