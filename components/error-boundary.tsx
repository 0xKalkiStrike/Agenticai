"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, AlertTriangle, Bug } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  errorId?: string
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    }

    console.error('React Error Boundary caught an error:', errorDetails)

    // Store error in localStorage for debugging
    if (typeof window !== 'undefined') {
      try {
        const errorHistory = JSON.parse(localStorage.getItem('react_error_history') || '[]')
        errorHistory.push(errorDetails)
        // Keep only last 20 errors
        if (errorHistory.length > 20) {
          errorHistory.splice(0, errorHistory.length - 20)
        }
        localStorage.setItem('react_error_history', JSON.stringify(errorHistory))
      } catch (storageError) {
        console.warn('Failed to store error in localStorage:', storageError)
      }
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined })
  }

  handleReportError = () => {
    const { error, errorInfo, errorId } = this.state
    
    if (error && errorId) {
      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      }

      // In a real application, you would send this to your error reporting service
      console.log('Error report generated:', errorReport)
      
      // For now, copy to clipboard
      if (typeof window !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
          .then(() => alert('Error report copied to clipboard'))
          .catch(() => console.warn('Failed to copy error report to clipboard'))
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const { error, errorId } = this.state

      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={error!} retry={this.handleRetry} />
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg">Something went wrong</CardTitle>
              </div>
              <CardDescription>
                An unexpected error occurred. Don't worry, this has been logged and we're working to fix it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error ID:</strong> {errorId}
                  <br />
                  <strong>Message:</strong> {error?.message || 'Unknown error'}
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={this.handleReportError}
                  className="w-full"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Report Error
                </Button>
                
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Reload Page
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                If this problem persists, please contact support with the error ID above.
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook to access error boundary functionality
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    // Log error for debugging
    console.error('Manual error report:', { error, errorInfo })
    
    // Store in error history
    if (typeof window !== 'undefined') {
      try {
        const errorHistory = JSON.parse(localStorage.getItem('manual_error_history') || '[]')
        errorHistory.push({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          context: errorInfo
        })
        if (errorHistory.length > 50) {
          errorHistory.splice(0, errorHistory.length - 50)
        }
        localStorage.setItem('manual_error_history', JSON.stringify(errorHistory))
      } catch (storageError) {
        console.warn('Failed to store manual error:', storageError)
      }
    }
  }, [])
}

// Simple error fallback component
export function SimpleErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h3 className="font-medium text-red-800">Error</h3>
      </div>
      <p className="text-sm text-red-700 mb-3">
        {error.message || 'An unexpected error occurred'}
      </p>
      <Button size="sm" onClick={retry} variant="outline">
        <RefreshCw className="h-3 w-3 mr-1" />
        Retry
      </Button>
    </div>
  )
}