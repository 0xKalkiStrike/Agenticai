"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StatCard } from "@/components/stat-card"
import { TicketTable } from "@/components/ticket-table"
import { ConnectionStatus } from "@/components/connection-status"
import { BackendStatus } from "@/components/backend-status"
import { DeveloperPerformance } from "@/components/developer-performance"
import { useTickets } from "@/lib/ticket-context"
import { useAuth } from "@/lib/auth-context"
import { apiService } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Ticket, Clock, CheckCircle, AlertTriangle, UserCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminDashboard() {
  const { 
    tickets, 
    users, 
    assignTicket, 
    refreshTickets, 
    refreshUsers, 
    subscribeToTicketUpdates,
    isLoading, 
    getAllTicketsForAdmin,
    error 
  } = useTickets()
  const { user, isAuthenticated } = useAuth()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [allTickets, setAllTickets] = useState<any[]>([])
  const [loadingAllTickets, setLoadingAllTickets] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      console.log('User not authenticated, redirecting to login')
      window.location.href = '/login'
      return
    }
  }, [isAuthenticated])

  // Load dashboard data from API with caching
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsRefreshing(true)
        
        // Check if user is authenticated before making API calls
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        if (!token) {
          console.log('No authentication token found, redirecting to login')
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return
        }
        
        const data = await apiService.getAdminDashboard()
        setDashboardData(data)
        await refreshTickets() // This loads active tickets for main dashboard
        await refreshUsers()
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Handle authentication/authorization errors
        if (errorMessage.includes('Session expired') || errorMessage.includes('Not authenticated') || errorMessage.includes('Please login')) {
          console.log('Authentication error, redirecting to login')
          setAuthError('Please login to access the admin dashboard')
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return
        }
        
        if (errorMessage.includes('Access denied')) 
        {
          // User doesn't have admin permissions
          console.error("Access denied: User does not have admin permissions")
          return
        }
        
        // For other errors, show a generic message
        console.log("Dashboard load error:", errorMessage)
      } finally {
        setIsRefreshing(false)
      }
    }

    loadData()
    
    // Set up periodic refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      if (!isRefreshing) {
        loadData()
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [refreshTickets, refreshUsers, isRefreshing])

  // Subscribe to real-time ticket updates
  useEffect(() => {
    const unsubscribe = subscribeToTicketUpdates(() => {
      // Just trigger a simple refresh without dependencies
      refreshTickets(true)
      refreshUsers(true)
    })

    return unsubscribe
  }, [subscribeToTicketUpdates, refreshTickets, refreshUsers])

  // Debug effect to monitor users data
  useEffect(() => {
    console.log('Admin Dashboard - Users state changed:', {
      usersCount: users.length,
      users: users,
      isLoading: isLoading,
      error: error
    })
  }, [users, isLoading, error])

  // Function to load all tickets for admin tabs
  const loadAllTickets = useCallback(async () => {
    try {
      setLoadingAllTickets(true)
      const allTicketsData = await getAllTicketsForAdmin()
      setAllTickets(allTicketsData)
    } catch (error) {
      console.error("Failed to load all tickets:", error)
    } finally {
      setLoadingAllTickets(false)
    }
  }, [getAllTicketsForAdmin])

  const developers = users.filter((u) => u.role === "developer")
  const clients = users.filter((u) => u.role === "client")
  const projectManagers = users.filter((u) => u.role === "project_manager")

  // Debug logging
  useEffect(() => {
    console.log('Admin Dashboard - Users data:', users)
    console.log('Admin Dashboard - Developers:', developers)
    console.log('Admin Dashboard - Clients:', clients)
    console.log('Admin Dashboard - Project Managers:', projectManagers)
  }, [users, developers, clients, projectManagers])

  // Use active tickets for main dashboard stats (from tickets state)
  const openTickets = tickets.filter((t) => t.status === "OPEN")
  const inProgressTickets = tickets.filter((t) => t.status === "IN_PROGRESS")
  const closedTickets = tickets.filter((t) => t.status === "CLOSED")
  const unassignedTickets = tickets.filter((t) => !t.assignedDeveloperId && t.status === "OPEN")
  const criticalTickets = tickets.filter((t) => t.priority === "CRITICAL" && t.status !== "CLOSED")

  // Use all tickets for admin-specific tabs
  const allOpenTickets = allTickets.filter((t) => t.status === "OPEN")
  const allInProgressTickets = allTickets.filter((t) => t.status === "IN_PROGRESS")
  const allClosedTickets = allTickets.filter((t) => t.status === "CLOSED")
  const allUnassignedTickets = allTickets.filter((t) => !t.assignedDeveloperId && t.status === "OPEN")
  const allCriticalTickets = allTickets.filter((t) => t.priority === "CRITICAL" && t.status !== "CLOSED")

  const handleAssign = useCallback(async (ticketId: number, developerId: number, notes: string) => {
    if (user) {
      try {
        await assignTicket(ticketId, developerId, user.id, notes)
        // Real-time updates will handle refreshing automatically
      } catch (error) {
        console.error("Failed to assign ticket:", error)
      }
    }
  }, [assignTicket, user])

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <BackendStatus onStatusChange={(isOnline) => {
          if (isOnline) {
            // Reload data when backend comes back online
            refreshTickets(true)
            refreshUsers(true)
          }
        }} />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Complete system overview and management</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                refreshTickets(true)
                refreshUsers(true)
              }}
              disabled={isRefreshing || isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || isLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Users" 
            value={
              dashboardData?.user_counts && Object.keys(dashboardData.user_counts).length > 0
                ? (Object.values(dashboardData.user_counts) as number[]).reduce((a, b) => a + b, 0) 
                : users.length
            } 
            icon={Users} 
            description="All registered users" 
          />
          <StatCard 
            title="Total Tickets" 
            value={
              dashboardData?.ticket_stats?.total_tickets !== undefined 
                ? dashboardData.ticket_stats.total_tickets 
                : tickets.length
            } 
            icon={Ticket} 
            description="All time tickets" 
          />
          <StatCard 
            title="Open Tickets" 
            value={
              dashboardData?.ticket_stats?.open_tickets !== undefined 
                ? dashboardData.ticket_stats.open_tickets 
                : openTickets.length
            } 
            icon={Clock} 
            description="Awaiting assignment" 
          />
          <StatCard
            title="Unassigned"
            value={
              dashboardData?.ticket_stats?.unassigned_tickets !== undefined 
                ? dashboardData.ticket_stats.unassigned_tickets 
                : unassignedTickets.length
            }
            icon={AlertTriangle}
            description="Need attention"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="In Progress" 
            value={
              dashboardData?.ticket_stats?.in_progress_tickets !== undefined 
                ? dashboardData.ticket_stats.in_progress_tickets 
                : inProgressTickets.length
            } 
            icon={UserCheck} 
          />
          <StatCard 
            title="Completed" 
            value={
              dashboardData?.ticket_stats?.closed_tickets !== undefined 
                ? dashboardData.ticket_stats.closed_tickets 
                : closedTickets.length
            } 
            icon={CheckCircle} 
          />
          <StatCard title="Critical" value={criticalTickets.length} icon={AlertTriangle} />
          <StatCard 
            title="Developers" 
            value={
              dashboardData?.user_counts?.developer !== undefined 
                ? dashboardData.user_counts.developer 
                : developers.length
            } 
            icon={Users} 
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="active" className="space-y-4" onValueChange={(value) => {
          console.log('Tab changed to:', value)
          if (value === "tickets" && allTickets.length === 0) {
            loadAllTickets()
          }
          if (value === "users") {
            console.log('Users tab selected, users data:', users)
            // Refresh users when tab is selected
            refreshUsers()
          }
        }}>
          <TabsList>
            <TabsTrigger value="active">Active Tickets ({tickets.length})</TabsTrigger>
            <TabsTrigger value="tickets">All Tickets</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
            <TabsTrigger value="users">Users Overview</TabsTrigger>
            <TabsTrigger value="performance">Developer Performance</TabsTrigger>
            <TabsTrigger value="recent">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Tickets</CardTitle>
                <CardDescription>Currently open and in-progress tickets visible to all staff</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading active tickets...</p>
                  </div>
                ) : (
                  <TicketTable 
                    tickets={tickets} 
                    developers={developers} 
                    showAssign 
                    onAssign={handleAssign} 
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <CardTitle>All Tickets</CardTitle>
                <CardDescription>Complete system ticket overview (all statuses)</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAllTickets ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading all tickets...</p>
                  </div>
                ) : (
                  <TicketTable 
                    tickets={allTickets.length > 0 ? allTickets : tickets} 
                    developers={developers} 
                    showAssign 
                    onAssign={handleAssign} 
                  />
                )}
                {allTickets.length === 0 && !loadingAllTickets && (
                  <div className="text-center py-4">
                    <Button 
                      variant="outline" 
                      onClick={loadAllTickets}
                      disabled={loadingAllTickets}
                    >
                      Load All Tickets
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unassigned">
            <Card>
              <CardHeader>
                <CardTitle>Unassigned Tickets</CardTitle>
                <CardDescription>Tickets waiting to be assigned to developers</CardDescription>
              </CardHeader>
              <CardContent>
                <TicketTable 
                  tickets={allTickets.length > 0 ? allUnassignedTickets : unassignedTickets} 
                  developers={developers} 
                  showAssign 
                  onAssign={handleAssign} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              {/* Error Display */}
              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      <p>Error loading users: {error}</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          console.log('Retry after error clicked')
                          refreshUsers(true)
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* User Management Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Add new users and manage existing ones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => {
                        // TODO: Implement add user functionality
                        alert('Add User functionality will be implemented')
                      }}
                    >
                      Add New User
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        console.log('Manual refresh users clicked')
                        refreshUsers(true) // Force refresh
                      }}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh Users
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Users Overview */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Developers</CardTitle>
                    <CardDescription>{developers.length} registered</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {developers.length > 0 ? developers.map((dev) => (
                        <div key={dev.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">{dev.username}</p>
                            <p className="text-sm text-muted-foreground">{dev.email}</p>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {tickets.filter((t) => t.assignedDeveloperId === dev.id && t.status !== "CLOSED").length}{" "}
                            active
                          </span>
                        </div>
                      )) : (
                        <p className="text-muted-foreground text-center py-4">No developers found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Project Managers</CardTitle>
                    <CardDescription>{projectManagers.length} registered</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {projectManagers.length > 0 ? projectManagers.map((pm) => (
                        <div key={pm.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">{pm.username}</p>
                            <p className="text-sm text-muted-foreground">{pm.email}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-muted-foreground text-center py-4">No project managers found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Clients</CardTitle>
                    <CardDescription>{clients.length} registered</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {clients.length > 0 ? clients.map((client) => (
                        <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">{client.username}</p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {tickets.filter((t) => t.userId === client.id).length} tickets
                          </span>
                        </div>
                      )) : (
                        <p className="text-muted-foreground text-center py-4">No clients found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* All Users Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Complete list of all system users</CardDescription>
                </CardHeader>
                <CardContent>
                  {users.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Username</th>
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Role</th>
                            <th className="text-left p-2">Status</th>
                            <th className="text-left p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id} className="border-b">
                              <td className="p-2 font-medium">{user.username}</td>
                              <td className="p-2 text-muted-foreground">{user.email}</td>
                              <td className="p-2">
                                <span className="px-2 py-1 rounded-full text-xs bg-muted">
                                  {user.role}
                                </span>
                              </td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="p-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    // TODO: Implement edit user functionality
                                    alert(`Edit user: ${user.username}`)
                                  }}
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No users found. Try refreshing or check your connection.</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => refreshUsers()}
                      >
                        Refresh Users
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <DeveloperPerformance />
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest tickets and system activity</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData?.recent_tickets ? (
                  <div className="space-y-3">
                    {dashboardData.recent_tickets.map((ticket: any) => (
                      <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">#{ticket.id} - {ticket.query.substring(0, 50)}...</p>
                          <p className="text-sm text-muted-foreground">
                            by {ticket.client_name} • {ticket.priority} priority • {ticket.status}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No recent activity data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
