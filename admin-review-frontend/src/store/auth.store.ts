// store/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  role?: string
  username?: string
  email?: string
  firstName?: string | null
  lastName?: string | null
  referralCode?: string
  referredBy?: string | null
  avatar?: string
  birthday?: Date | string | null
  address?: string | null
  addressAlt?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  phone?: string | null

  // UI convenience fields (optional)
  name?: string
  balance?: number
  totalExperience?: number
  level?: number
  levelProgress?: number
  walletBalance?: string
  cartCount?: number
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean
  setHasHydrated: (hasHydrated: boolean) => void
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setAuth: (user: User, token: string) => void
  updateUser: (updates: Partial<User>) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      
      setUser: (user) => 
        set({ 
          user, 
          isAuthenticated: !!user 
        }),

      setToken: (token) =>
        set({
          token,
          isAuthenticated: !!token,
        }),

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      
      updateUser: (updates) => 
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        })),
      
      logout: () => 
        set({ 
          user: null, 
          token: null,
          isAuthenticated: false 
        }),
      
      setLoading: (isLoading) => 
        set({ isLoading }),
    }),
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        isAuthenticated: state.isAuthenticated 
      }), // Only persist user and auth status
      onRehydrateStorage: () => (state) => {
        // Mark store hydrated so auth guards don't redirect prematurely.
        state?.setHasHydrated(true);
      },
    }
  )
)
