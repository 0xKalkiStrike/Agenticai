"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { StatCard } from "@/components/stat-card"
import { TicketTable } from "@/components/ticket-table"
import { useTickets } from "@/lib/ticket-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, Inbox, TrendingUp, AlertCircle, RefreshCw } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import type { Ticket } from "@/lib/types"
import { apiService } from "@/lib/api"

export default function DeveloperDashboard() {
  const { 
    tickets, 
    selfAssignTicket, 
    completeTicket, 
    passTicket,
    cancelTicket,
    getAvailableTicketsForRole, 
    getCompletedTicketsForRole,
    subscribeToTicketUpdates,
    isLoading,
    error,
    clearError
  } = useTickets()
  const { user } = useAuth()

  const [availableTickets, setAvailableTickets] = useState<Ticket[]>([])
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [loadingCompleted, setLoadingCompleted] = useState(false)
  const [availableError, setAvailableError] = useState<string | null>(null)
  const [completedError, setCompletedError] = useState<string | null>(null)

  // All useCallback hooks declared at top level consistently
  const handleSelfAssign = useCallback(async (ticketId: number) => {
    if (!user?.id) return false
    const success = await selfAssignTicket(ticketId, user.id)
    // Real-time updates will handle refreshing ticket lists automatically
    return success
  }, [selfAssignTicket, user?.id])

  const handleComplete = useCallback(async (ticketId: number, notes: string) => {
    const success = await completeTicket(ticketId, notes)
    // Real-time updates will handle refreshing ticket lists automatically
    return success
  }, [completeTicket])

  const handlePass = useCallback(async (ticketId: number, reason: string) => {
    const success = await passTicket(ticketId, reason)
    // Real-time updates will handle refreshing ticket lists automatically
    return success
  }, [passTicket])

  const handleCancel = useCallback(async (ticketId: number, reason: string) => {
    const success = await cancelTicket(ticketId, reason)
    // Real-time updates will handle refreshing ticket lists automatically
    return success
  }, [cancelTicket])

  // Load role-specific ticket data
  useEffect(() => {
    const loadTicketData = async () => {
      if (!user?.role || user.role !== 'developer') {
        return
      }

      // Check if we have an auth token
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (!token) {
        console.error('No auth token found, user needs to re-login')
        setAvailableError('Authentication required. Please log in again.')
        setCompletedError('Authentication required. Please log in again.')
        return
      }
      
      try {
        // Load available tickets
        setLoadingAvailable(true)
        setAvailableError(null)
        const available = await getAvailableTicketsForRole()
        setAvailableTickets(available || [])
      } catch (error) {
        console.error("Failed to load available tickets:", error)
        setAvailableError(error instanceof Error ? error.message : 'Failed to load available tickets')
        setAvailableTickets([])
      } finally {
        setLoadingAvailable(false)
      }

      try {
        // Load completed tickets
        setLoadingCompleted(true)
        setCompletedError(null)
        const completed = await getCompletedTicketsForRole()
        setCompletedTickets(completed || [])
      } catch (error) {
        console.error("Failed to load completed tickets:", error)
        setCompletedError(error instanceof Error ? error.message : 'Failed to load completed tickets')
        setCompletedTickets([])
      } finally {
        setLoadingCompleted(false)
      }
    }

    loadTicketData()
  }, [user, getAvailableTicketsForRole, getCompletedTicketsForRole])

  // Subscribe to real-time ticket updates
  useEffect(() => {
    if (!user?.role || user.role !== 'developer') {
      return
    }

    const unsubscribe = subscribeToTicketUpdates(() => {
      // Refresh all ticket data when updates occur - use the function directly
      // to avoid dependency issues
      if (user?.role === 'developer') {
        Promise.all([
          getAvailableTicketsForRole().then(setAvailableTickets).catch(console.error),
          getCompletedTicketsForRole().then(setCompletedTickets).catch(console.error)
        ])
      }
    })

    return unsubscribe
  }, [user, subscribeToTicketUpdates, getAvailableTicketsForRole, getCompletedTicketsForRole])

  // Early return AFTER all hooks are declared
  if (!user) return null

  // For developers, the main tickets array now contains their assigned tickets
  const myActiveTickets = (tickets || []).filter((t) => t && t.status !== "CLOSED")
  
  // Calculate stats based on role-appropriate data according to requirements
  const stats = {
    inProgress: myActiveTickets.length, // Active Tickets count - assigned open tickets (Req 5.1)
    completed: (completedTickets || []).length, // Completed count - completed tickets by developer (Req 5.2)
    available: (availableTickets || []).length, // Available count - unassigned open tickets (Req 5.3)
    assigned: (tickets || []).length + (completedTickets || []).length // Total Assigned count - all tickets ever assigned (Req 5.4)
  }
    

  return (
    <DashboardLayout allowedRoles={["developer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Developer Dashboard</h1>
          <p className="text-muted-foreground">Manage your assigned tickets and track progress</p>
        </div>

        {/* Global Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  clearError()
                  window.location.reload()
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Tickets" value={stats.inProgress} icon={Clock} description="Currently working on" />
          <StatCard title="Completed" value={stats.completed} icon={CheckCircle} description="Tickets resolved" />
          <StatCard title="Available" value={stats.available} icon={Inbox} description="Can self-assign" />
          <StatCard title="Total Assigned" value={stats.assigned} icon={TrendingUp} description="All time" />
        </div>

        {/* Tickets */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">My Active ({myActiveTickets.length})</TabsTrigger>
            <TabsTrigger value="available">Available ({availableTickets.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTickets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>My Active Tickets</CardTitle>
                <CardDescription>Tickets assigned to you that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading tickets...</p>
                  </div>
                ) : myActiveTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active tickets</p>
                    <p className="text-sm">Check the Available tab to pick up new work</p>
                  </div>
                ) : (
                  <TicketTable 
                    tickets={myActiveTickets} 
                    showDeveloperActions={true}
                    onComplete={handleComplete}
                    onPass={handlePass}
                    onCancel={handleCancel}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="available">
            <Card>
              <CardHeader>
                <CardTitle>Available Tickets</CardTitle>
                <CardDescription>Unassigned tickets you can pick up</CardDescription>
              </CardHeader>
              <CardContent>
                {availableError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>{availableError}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setAvailableError(null)
                          // Retry loading available tickets
                          getAvailableTicketsForRole().then(setAvailableTickets).catch(console.error)
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {loadingAvailable ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading available tickets...</p>
                  </div>
                ) : availableTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No available tickets</p>
                    <p className="text-sm">All tickets are currently assigned</p>
                  </div>
                ) : (
                  <TicketTable tickets={availableTickets} onSelfAssign={handleSelfAssign} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed Tickets</CardTitle>
                <CardDescription>Your ticket history</CardDescription>
              </CardHeader>
              <CardContent>
                {completedError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>{completedError}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setCompletedError(null)
                          // Retry loading completed tickets
                          getCompletedTicketsForRole().then(setCompletedTickets).catch(console.error)
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {loadingCompleted ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading completed tickets...</p>
                  </div>
                ) : completedTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No completed tickets yet</p>
                    <p className="text-sm">Complete your assigned tickets to see them here</p>
                  </div>
                ) : (
                  <TicketTable tickets={completedTickets} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
