"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { apiService } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { CheckCircle, Clock, RefreshCw, Loader2, UserCheck } from "lucide-react"
import { toast } from "sonner"

interface PendingUser {
  id: number
  username: string
  email: string
  role: string
  created_at: string
  created_by_pm: string
  pm_email: string
}

export default function AdminApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [approvingUsers, setApprovingUsers] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadPendingUsers()
  }, [])

  const loadPendingUsers = async (force = false) => {
    try {
      setIsRefreshing(true)
      const response = await apiService.getPendingApprovals()
      setPendingUsers(response.pending_users || [])
    } catch (error) {
      console.error("Failed to load pending users:", error)
      toast.error("Failed to load pending users")
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleApproveUser = async (userId: number, username: string) => {
    try {
      setApprovingUsers(prev => new Set(prev).add(userId))
      
      await apiService.approveUser(userId)
      
      // Remove from pending list
      setPendingUsers(prev => prev.filter(user => user.id !== userId))
      
      toast.success(`User "${username}" approved successfully`)
      
    } catch (error) {
      console.error("Failed to approve user:", error)
      toast.error(error instanceof Error ? error.message : "Failed to approve user")
    } finally {
      setApprovingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Approvals</h1>
            <p className="text-muted-foreground">
              Approve users created by Project Managers
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => loadPendingUsers(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingUsers.length}</p>
                  <p className="text-xs text-muted-foreground">Pending Approvals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingUsers.filter(u => u.role === 'developer').length}</p>
                  <p className="text-xs text-muted-foreground">Pending Developers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingUsers.filter(u => u.role === 'client').length}</p>
                  <p className="text-xs text-muted-foreground">Pending Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending User Approvals</CardTitle>
            <CardDescription>
              Users created by Project Managers that need admin approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created By PM</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRefreshing ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading pending users...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pendingUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No pending user approvals
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'developer' ? 'default' : 'secondary'}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.created_by_pm}</p>
                            <p className="text-xs text-muted-foreground">{user.pm_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-orange-600 border-orange-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleApproveUser(user.id, user.username)}
                            disabled={approvingUsers.has(user.id)}
                          >
                            {approvingUsers.has(user.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}