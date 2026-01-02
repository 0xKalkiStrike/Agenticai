"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User } from "./types"
import { apiService } from "./api"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored session only on client side
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem("auth_user")
      const storedToken = localStorage.getItem("auth_token")
      
      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser)
          // Validate the parsed user object
          if (parsedUser && parsedUser.id && parsedUser.username && parsedUser.role) {
            setUser(parsedUser)
          } else {
            // Clear invalid stored data
            apiService.clearAuth()
          }
        } catch (error) {
          console.error("Error parsing stored user data:", error)
          // Clear invalid stored data
          apiService.clearAuth()
        }
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true)
      
      // Call real API
      const response = await apiService.login(username, password)
      
      // Decode JWT token to get user ID and other details
      const token = response.token
      let userId = 0
      try {
        // Simple JWT decode (just for getting payload, not for verification)
        const payload = JSON.parse(atob(token.split('.')[1]))
        userId = payload.id || 0
      } catch (e) {
        console.warn("Could not decode JWT token:", e)
      }
      
      // Create user object from API response
      const userData: User = {
        id: userId,
        username: response.username,
        email: "", // Will be fetched from backend if needed
        role: response.role as any,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        isActive: true,
      }

      setUser(userData)
      
      // Only use localStorage on client side
      if (typeof window !== 'undefined') {
        localStorage.setItem("auth_user", JSON.stringify(userData))
      }
      
      return { success: true }
    } catch (error) {
      console.error("Login error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Login failed" 
      }
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true)
      
      // Call real API
      await apiService.register(username, password, email)
      
      // After successful registration, automatically log in
      const loginResult = await login(username, password)
      return loginResult
      
    } catch (error) {
      console.error("Registration error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Registration failed" 
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    apiService.clearAuth()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
