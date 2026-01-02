"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, RefreshCw, Server } from "lucide-react"
import { apiService } from "@/lib/api"

interface BackendStatusProps {
  onStatusChange?: (isOnline: boolean) => void
}

export function BackendStatus({ onStatusChange }: BackendStatusProps) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkBackendStatus = async () => {
    setIsChecking(true)
    try {
      await apiService.healthCheck()
      setIsOnline(true)
      setLastChecked(new Date())
      onStatusChange?.(true)
    } catch (error) {
      setIsOnline(false)
      setLastChecked(new Date())
      onStatusChange?.(false)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkBackendStatus()
    
    // Check status every 30 seconds
    const interval = setInterval(checkBackendStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isOnline === null) {
    return null // Don't show anything while initial check is happening
  }

  if (isOnline) {
    return null // Don't show anything when backend is online
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Backend Server Offline</p>
              <p className="text-xs text-red-600 mt-1">
                Please start the backend server: <code className="bg-red-100 px-1 rounded">cd backend && py main.py</code>
              </p>
              {lastChecked && (
                <p className="text-xs text-red-500 mt-1">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkBackendStatus}
            disabled={isChecking}
            className="border-red-200 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}