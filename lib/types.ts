export type UserRole = "admin" | "project_manager" | "developer" | "client"

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  createdAt: string
  lastLogin: string | null
  isActive: boolean
}

export interface Ticket {
  id: number
  userId: number
  query: string
  reply: string | null
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  assignedDeveloperId: number | null
  assignedBy: number | null
  assignedAt: string | null
  assignmentNotes: string | null
  completedAt: string | null
  completionNotes: string | null
  createdAt: string
  updatedAt: string | null
  clientName?: string | null
  developerName?: string | null
  assignedByName?: string | null
  // Assignment lock information
  assignmentLock?: AssignmentLock | null
}

export interface AssignmentLock {
  id: string
  ticketId: number
  lockedBy: number
  lockedByName: string
  lockedByRole: UserRole
  lockedAt: string
  expiresAt: string
  isActive: boolean
}

export interface AssignmentConflict {
  id: string
  ticketId: number
  message: string
  conflictType: 'lock_conflict' | 'assignment_conflict' | 'permission_denied'
  timestamp: string
  involvedUsers: string[]
}

export interface DashboardStats {
  totalUsers: number
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  closedTickets: number
  unassignedTickets: number
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}
