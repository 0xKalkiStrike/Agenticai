"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useTickets } from "@/lib/ticket-context"
import { useAuth } from "@/lib/auth-context"
import { apiService } from "@/lib/api"
import type { UserRole } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Plus, Search, Users, Shield, Code, Briefcase, UserIcon, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const roleConfig: Record<UserRole, { label: string; color: string; icon: typeof Users }> = {
  admin: { label: "Admin", color: "bg-red-500", icon: Shield },
  project_manager: { label: "Project Manager", color: "bg-violet-500", icon: Briefcase },
  developer: { label: "Developer", color: "bg-emerald-500", icon: Code },
  client: { label: "Client", color: "bg-blue-500", icon: UserIcon },
}

export default function UsersPage() {
  const { isLoading } = useTickets()
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "client" as UserRole,
  })

  // Load users on component mount
  useEffect(() => {
    if (currentUser) {
      loadUsers()
    }
  }, [currentUser])

  const loadUsers = async () => {
    try {
      setIsRefreshing(true)
      
      // Load users based on current user role
      if (currentUser?.role === "admin") {
        // Admin sees all users - fetch directly
        const response = await apiService.getAllUsers()
        if (response.users && Array.isArray(response.users)) {
          setUsers(response.users)
        }
      } else if (currentUser?.role === "project_manager") {
        // PM sees only their team members
        const teamMembers = await apiService.getPMTeamMembers()
        const allTeamMembers: any[] = []
        Object.entries(teamMembers).forEach(([role, memberList]) => {
          if (Array.isArray(memberList)) {
            allTeamMembers.push(...memberList.map((member: any) => ({
              ...member,
              role: role as any
            })))
          }
        })
        setUsers(allTeamMembers)
      } else if (currentUser?.role === "developer") {
        // Developer sees their whole team (PM + developers + clients)
        const teamMembers = await apiService.getDeveloperTeamMembers()
        const allTeamMembers: any[] = []
        Object.entries(teamMembers).forEach(([role, memberList]) => {
          if (Array.isArray(memberList)) {
            allTeamMembers.push(...memberList.map((member: any) => ({
              ...member,
              role: role as any
            })))
          }
        })
        setUsers(allTeamMembers)
      } else {
        // Client sees no users (they don't have access to user management)
        setUsers([])
      }
    } catch (error) {
      console.error("Failed to load users:", error)
      toast.error("Failed to load users")
    } finally {
      setIsRefreshing(false)
    }
  }

  // Use appropriate users based on role
  const allUsers = users

  const filteredUsers = allUsers.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error("Please fill in all fields")
      return
    }

    try {
      setIsCreating(true)
      
      // Call appropriate API based on user role
      if (currentUser?.role === "project_manager") {
        // PM creates team member
        if (newUser.role === "admin" || newUser.role === "project_manager") {
          toast.error("PM can only create developers and clients")
          return
        }
        
        await apiService.createTeamUser({
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        })
      } else {
        // Admin creates any user
        await apiService.createUser({
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        })
      }

      // Refresh users list to show new user
      await loadUsers()
      
      // Reset form and close dialog
      setNewUser({ username: "", email: "", password: "", role: "client" })
      setIsCreateOpen(false)
      
      toast.success(`${newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)} user created successfully`)
      
    } catch (error) {
      console.error("Failed to create user:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setIsCreating(false)
    }
  }

  const userCounts = {
    total: allUsers.length,
    admin: allUsers.filter((u) => u.role === "admin").length,
    project_manager: allUsers.filter((u) => u.role === "project_manager").length,
    developer: allUsers.filter((u) => u.role === "developer").length,
    client: allUsers.filter((u) => u.role === "client").length,
  }

  return (
    <DashboardLayout allowedRoles={["admin", "project_manager", "developer"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {currentUser?.role === "project_manager" ? "Team Management" : 
               currentUser?.role === "developer" ? "My Team" : 
               "User Management"}
            </h1>
            <p className="text-muted-foreground">
              {currentUser?.role === "project_manager" 
                ? "Manage your team members and add new developers and clients" 
                : currentUser?.role === "developer"
                ? "View your team members and project manager"
                : "Manage system users and their roles"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => loadUsers()}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || isLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {currentUser?.role === "admin" && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateUser}>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>Add a new user to the system</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          disabled={isCreating}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          disabled={isCreating}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          disabled={isCreating}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}
                          disabled={isCreating}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="project_manager">Project Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateOpen(false)}
                        disabled={isCreating}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create User"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {currentUser?.role === "project_manager" && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateUser}>
                    <DialogHeader>
                      <DialogTitle>Create New Team Member</DialogTitle>
                      <DialogDescription>Add a new developer or client to your team</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          disabled={isCreating}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          disabled={isCreating}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          disabled={isCreating}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}
                          disabled={isCreating}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateOpen(false)}
                        disabled={isCreating}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Team Member"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Role Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{userCounts.total}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {(Object.keys(roleConfig) as UserRole[]).map((role) => {
            const config = roleConfig[role]
            const Icon = config.icon
            return (
              <Card key={role}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg text-white", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{userCounts[role]}</p>
                      <p className="text-xs text-muted-foreground">{config.label}s</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>A list of all registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="project_manager">Project Manager</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="hidden md:table-cell">Last Login</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || isRefreshing ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading users...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {allUsers.length === 0 ? "No users found in database" : "No users match your search"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const config = roleConfig[user.role as UserRole]
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-white", config.color)}>{config.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {user.lastLogin ? format(new Date(user.lastLogin), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
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
