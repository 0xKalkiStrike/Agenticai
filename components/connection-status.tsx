"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { apiService } from "@/lib/api"

interface ConnectionStatus {
  status: "healthy" | "unhealthy" | "checking"
  components: {
    database: {
      status: "healthy" | "unhealthy"
      message: string
    }
    rbac?: {
      status: "healthy" | "unhealthy"
      message: string
    }
  }
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const response = await apiService.healthCheck()
      setStatus(response)
    } catch (error) {
      setStatus({
        status: "unhealthy",
        components: {
          database: {
            status: "unhealthy",
            message: error instanceof Error ? error.message : "Connection failed"
          }
        }
      })
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>
      case "unhealthy":
        return <Badge variant="destructive">Unhealthy</Badge>
      default:
        return <Badge variant="secondary">Checking...</Badge>
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle className="text-lg">System Status</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkConnection}
            disabled={isChecking}
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          WAMP MySQL Database Connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Status</span>
              {getStatusBadge(status.status)}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.components.database.status)}
                  <span className="text-sm">Database</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {status.components.database.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {status.components.database.message}
              </p>
            </div>

            {status.components.rbac && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.components.rbac.status)}
                    <span className="text-sm">RBAC</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {status.components.rbac.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {status.components.rbac.message}
                </p>
              </div>
            )}

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Database:</span>
                <code className="bg-muted px-2 py-1 rounded">agentic_ai</code>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                <span>MySQL:</span>
                <code className="bg-muted px-2 py-1 rounded">localhost:3306</code>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                <span>Apache:</span>
                <code className="bg-muted px-2 py-1 rounded">localhost:8080</code>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}