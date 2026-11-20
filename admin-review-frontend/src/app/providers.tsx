// app/providers.tsx
'use client'

import { HeroUIProvider } from '@heroui/react'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useModalStore } from '@/store/modal.store'
import { getCurrentUser } from '@/lib/api/auth'
import { getWalletBalance } from '@/lib/api/wallet'
import { getCartItems } from '@/lib/api/cart'
import { WebSocketProvider } from '@/components/providers/WebSocketProvider'
import { AudioUnlock } from '@/components/providers/AudioUnlock'

export function Providers({ children }: { children: React.ReactNode }) {
  const { token, user, setUser, logout } = useAuthStore()
  const lastHydratedTokenRef = useRef<string | null>(null)

  // Handle referral link (?ref=CODE) — no /signup page; we use auth modal
  useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const refCode = urlParams.get('ref')

    if (refCode && refCode.trim() !== '') {
      // Store referral code so signup modal can use it
      localStorage.setItem('referral_code', refCode.trim())

      // Clean URL (remove ?ref=CODE)
      const newUrl = (window.location.pathname || '/') + (window.location.hash || '')
      window.history.replaceState({}, '', newUrl)

      // If not logged in, open signup modal so they can register with the ref
      const hasToken = useAuthStore.getState().token
      if (!hasToken) {
        useModalStore.getState().open('signup')
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!token) {
      lastHydratedTokenRef.current = null
      return
    }
    // Avoid duplicate hydrate for the same token (e.g. when effect runs multiple times in production build).
    if (lastHydratedTokenRef.current === token) return
    lastHydratedTokenRef.current = token

    async function hydrate() {
      // If we already have a user cached, we can skip, but we still try to validate token.
      const me = await getCurrentUser()
      if (cancelled) return
      if (!me) {
        logout()
        return
      }
      // Keep existing UI fields (avatar/level/etc) if present
      const merged = { ...(user ?? {}), ...me }
      setUser(merged)

      // Fetch lightweight user stats (wallet + cart count)
      try {
        const [wallet, cart] = await Promise.all([
          getWalletBalance(),
          getCartItems('AVAILABLE'),
        ])
        if (cancelled) return
        setUser({
          ...merged,
          walletBalance: wallet?.balance ?? merged.walletBalance,
          cartCount: cart?.length ?? merged.cartCount,
        })
      } catch {
        // ignore stats failures
      }
    }

    hydrate().catch(() => {
      if (!cancelled) logout()
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const content = (
      <HeroUIProvider>
        <WebSocketProvider>
          {/* <AudioUnlock /> */}
          {children}
        </WebSocketProvider>
      </HeroUIProvider>
  )
  return content
}