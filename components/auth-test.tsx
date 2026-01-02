"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthTest() {
  const { user, isAuthenticated, login, logout } = useAuth()
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("admin123")
  const [testResult, setTestResult] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    setTestResult("Attempting login...")
    
    try {
      const result = await login(username, password)
      if (result.success) {
        setTestResult("✅ Login successful!")
      } else {
        setTestResult(`❌ Login failed: ${result.error}`)
      }
    } catch (error) {
      setTestResult(`❌ Login error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testAdminDashboard = async () => {
    setIsLoading(true)
    setTestResult("Testing admin dashboard access...")
    
    try {
      const data = await apiService.getAdminDashboard()
      setTestResult("✅ Admin dashboard access successful!")
      console.log("Dashboard data:", data)
    } catch (error) {
      setTestResult(`❌ Admin dashboard failed: ${error}`)
      console.error("Dashboard error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const testHealthCheck = async () => {
    setIsLoading(true)
    setTestResult("Testing backend health...")
    
    try {
      const health = await apiService.healthCheck()
      setTestResult(`✅ Backend health: ${health.status}`)
      console.log("Health data:", health)
    } catch (error) {
      setTestResult(`❌ Health check failed: ${error}`)
      console.error("Health error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
          <CardDescription>Test authentication and API access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Auth Status */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Current Status:</h3>
            <p><strong>Authenticated:</strong> {isAuthenticated ? "✅ Yes" : "❌ No"}</p>
            {user && (
              <>
                <p><strong>User:</strong> {user.username}</p>
                <p><strong>Role:</strong> {user.role}</p>
                <p><strong>ID:</strong> {user.id}</p>
              </>
            )}
            <p><strong>Token:</strong> {typeof window !== 'undefined' && localStorage.getItem('auth_token') ? "Present" : "Missing"}</p>
          </div>

          {/* Login Form */}
          {!isAuthenticated && (
            <div className="space-y-3">
              <h3 className="font-semibold">Login Test:</h3>
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={handleLogin} disabled={isLoading}>
                {isLoading ? "Logging in..." : "Test Login"}
              </Button>
            </div>
          )}

          {/* Test Buttons */}
          <div className="space-y-2">
            <h3 className="font-semibold">API Tests:</h3>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={testHealthCheck} disabled={isLoading}>
                Test Health Check
              </Button>
              <Button variant="outline" onClick={testAdminDashboard} disabled={isLoading}>
                Test Admin Dashboard
              </Button>
              {isAuthenticated && (
                <Button variant="destructive" onClick={logout}>
                  Logout
                </Button>
              )}
            </div>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Test Result:</h3>
              <p className="font-mono text-sm">{testResult}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}