import { useCallback, useEffect, useState } from 'react'
import { authSessionGateway } from './auth-session'

const INITIAL_STATE = {
  status: 'loading',
  session: null,
  error: null,
}

export function useAuthSession(gateway = authSessionGateway) {
  const [state, setState] = useState(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    gateway
      .getSession()
      .then((session) => {
        if (active) {
          setState({ status: 'success', session, error: null })
        }
      })
      .catch((error) => {
        if (active) {
          setState({ status: 'error', session: null, error })
        }
      })

    return () => {
      active = false
    }
  }, [gateway, reloadToken])

  const reload = useCallback(() => {
    setState(INITIAL_STATE)
    setReloadToken((token) => token + 1)
  }, [])

  return {
    status: state.status,
    session: state.session,
    error: state.error,
    isLoading: state.status === 'loading',
    isAuthenticated: Boolean(state.session?.isAuthenticated),
    userId: state.session?.userId ?? null,
    user: state.session?.user ?? null,
    reload,
  }
}
