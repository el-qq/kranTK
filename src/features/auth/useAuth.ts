import { useCallback, useEffect, useState } from 'react'

/**
 * Демонстрационный вход.
 *
 * ВНИМАНИЕ: это витрина, а не защита. Пара логин/пароль лежит в клиентском
 * коде и проверяется в браузере — исходники сайта публичны. За этой формой
 * нельзя держать ничего, что нельзя показывать. См. docs/06-auth.md.
 */
export const DEMO_LOGIN = 'demo'
export const DEMO_PASSWORD = 'demo'

const STORAGE_KEY = 'kran-tk.session'

export interface Session {
  login: string
  since: number
}

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(read)

  useEffect(() => {
    const sync = () => setSession(read())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const signIn = useCallback((login: string, password: string): boolean => {
    const ok = login.trim().toLowerCase() === DEMO_LOGIN && password === DEMO_PASSWORD
    if (!ok) return false
    const next: Session = { login: login.trim().toLowerCase(), since: Date.now() }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* приватный режим — работаем в памяти */
    }
    setSession(next)
    return true
  }, [])

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* игнорируем */
    }
    setSession(null)
  }, [])

  return { session, signIn, signOut }
}
