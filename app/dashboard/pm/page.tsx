"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { StatCard } from "@/components/stat-card"
import { TicketTable } from "@/components/ticket-table"
import { useTickets } from "@/lib/ticket-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock, Users, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
import { useEffect, useCallback } from "react"

export default function PMDashboard() {
  const { 
    tickets, 
    users, 
    assignTicket, 
    getDeveloperStats, 
    subscribeToTicketUpdates,
    isLoading, 
    error, 
    clearError 
  } = useTickets()
  const { user } = useAuth()

  const developers = users.filter((u) => u.role === "developer")
  const unassignedTickets = tickets.filter((t) => !t.assignedDeveloperId && t.status === "OPEN")
  const inProgressTickets = tickets.filter((t) => t.status === "IN_PROGRESS")
  const closedTickets = tickets.filter((t) => t.status === "CLOSED")

  // Subscribe to real-time ticket updates
  useEffect(() => {
    const unsubscribe = subscribeToTicketUpdates(() => {
      // Statistics will automatically update when tickets state changes
      // No additional action needed as React will re-render with new data
    })

    return unsubscribe
  }, [subscribeToTicketUpdates])

  const handleAssign = useCallback((ticketId: number, developerId: number, notes: string) => {
    if (user) {
      assignTicket(ticketId, developerId, user.id, notes)
      // Real-time updates will handle refreshing automatically
    }
  }, [assignTicket, user])

  return (
    <DashboardLayout allowedRoles={["admin", "project_manager"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Manager Dashboard</h1>
          <p className="text-muted-foreground">Manage active ticket assignments and developer workload</p>
        </div>

        {/* Error Display */}
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
          <StatCard
            title="Unassigned"
            value={unassignedTickets.length}
            icon={AlertTriangle}
            description="Tickets need assignment"
          />
          <StatCard title="In Progress" value={inProgressTickets.length} icon={Clock} description="Currently active" />
          <StatCard title="Completed" value={closedTickets.length} icon={CheckCircle} description="Total resolved" />
          <StatCard title="Developers" value={developers.length} icon={Users} description="Available team members" />
        </div>

        {/* Developer Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Developer Workload</CardTitle>
            <CardDescription>Current ticket distribution across team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {developers.map((dev) => {
                const stats = getDeveloperStats(dev.id)
                const maxWorkload = 10
                const workloadPercent = (stats.assigned / maxWorkload) * 100

                return (
                  <div key={dev.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                          {dev.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{dev.username}</p>
                          <p className="text-xs text-muted-foreground">{dev.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {stats.inProgress} active / {stats.completed} completed
                        </p>
                        <p className="text-xs text-muted-foreground">{stats.assigned} total assigned</p>
                      </div>
                    </div>
                    <Progress value={workloadPercent} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Tickets ({tickets.length})</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned ({unassignedTickets.length})</TabsTrigger>
            <TabsTrigger value="inprogress">In Progress ({inProgressTickets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Tickets</CardTitle>
                <CardDescription>All open and in-progress tickets requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading active tickets...</p>
                  </div>
                ) : (
                  <TicketTable tickets={tickets} developers={developers} showAssign onAssign={handleAssign} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unassigned">
            <Card>
              <CardHeader>
                <CardTitle>Unassigned Tickets</CardTitle>
                <CardDescription>Assign these tickets to available developers</CardDescription>
              </CardHeader>
              <CardContent>
                <TicketTable tickets={unassignedTickets} developers={developers} showAssign onAssign={handleAssign} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inprogress">
            <Card>
              <CardHeader>
                <CardTitle>In Progress</CardTitle>
                <CardDescription>Tickets currently being worked on by developers</CardDescription>
              </CardHeader>
              <CardContent>
                <TicketTable tickets={inProgressTickets} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
