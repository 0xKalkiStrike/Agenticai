"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import type { Ticket, User } from "./types"
import { apiService } from "./api"
import { useAuth } from "./auth-context"

interface TicketContextType {
  tickets: Ticket[]
  users: User[]
  isLoading: boolean
  error: string | null
  createTicket: (query: string, priority: Ticket["priority"]) => Promise<boolean>
  assignTicket: (ticketId: number, developerId: number, assignedBy: number, notes?: string) => Promise<boolean>
  completeTicket: (ticketId: number, completionNotes: string) => Promise<boolean>
  selfAssignTicket: (ticketId: number, developerId: number) => Promise<boolean>
  passTicket: (ticketId: number, reason: string) => Promise<boolean>
  cancelTicket: (ticketId: number, reason: string) => Promise<boolean>
  updateTicketStatus: (ticketId: number, status: string, notes?: string) => Promise<boolean>
  refreshTickets: (force?: boolean) => Promise<void>
  refreshUsers: (force?: boolean) => Promise<void>
  getTicketsByUser: (userId: number) => Ticket[]
  getTicketsByDeveloper: (developerId: number) => Ticket[]
  getUnassignedTickets: () => Ticket[]
  getDeveloperStats: (developerId: number) => { assigned: number; completed: number; inProgress: number }
  getAvailableTicketsForRole: () => Promise<Ticket[]>
  getCompletedTicketsForRole: () => Promise<Ticket[]>
  getAllTicketsForAdmin: () => Promise<Ticket[]>
  clearError: () => void
  // Real-time update methods
  refreshAllTicketData: () => Promise<void>
  subscribeToTicketUpdates: (callback: () => void) => () => void
}

const TicketContext = createContext<TicketContextType | null>(null)

export function TicketProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<{ tickets: number; users: number }>({
    tickets: 0,
    users: 0
  })
  
  // Use useRef for subscribers to avoid infinite loops
  const updateSubscribersRef = useRef<Set<() => void>>(new Set())

  // Get user role from auth context
  const { user } = useAuth()
  const userRole = user?.role

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000

  // Load initial data
  useEffect(() => {
    // Only load data if user is authenticated and role is available
    if (user && userRole) {
      refreshTickets()
      refreshUsers()
    }
  }, [user, userRole])

  const refreshTickets = useCallback(async (force = false, retryCount = 0) => {
    const now = Date.now()
    const MAX_RETRIES = 3
    const RETRY_DELAY = Math.pow(2, retryCount) * 1000 // Exponential backoff: 1s, 2s, 4s
    
    // Don't fetch if user role is not available
    if (!userRole) {
      return
    }
    
    // Skip if recently fetched and not forced
    if (!force && (now - lastFetch.tickets) < CACHE_DURATION && tickets.length > 0) {
      return
    }
    
    try {
      setIsLoading(true)
      setError(null) // Clear any previous errors
      
      // Use role-based ticket loading for proper visibility control
      let response
      if (userRole === 'client') {
        // Clients see only their own tickets (Requirements 1.1)
        response = await apiService.getClientTickets()
      } else if (userRole === 'developer') {
        // Developers see their assigned tickets in main view (Requirements 1.5)
        response = await apiService.getDeveloperTickets()
      } else {
        // Admin and PM see all active tickets (Requirements 1.3, 1.4)
        response = await apiService.getActiveTicketsByRole(userRole)
      }
      
      if (response.tickets || response.assigned_tickets) {
        // Handle different response formats from different endpoints
        const ticketData = response.tickets || response.assigned_tickets || []
        setTickets(ticketData)
        setLastFetch(prev => ({ ...prev, tickets: now }))
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error)
      
      // Handle different error types with appropriate responses
      if (error instanceof Error) {
        // Handle 403 Forbidden errors gracefully
        if (error.message.includes('Access denied') || error.message.includes('403')) {
          console.warn(`Access denied for role ${userRole}, user may need different permissions`)
          setError('You do not have permission to view tickets. Please contact your administrator.')
          // For developers, show empty state rather than error
          if (userRole === 'developer') {
            setTickets([])
          }
          return // Don't retry on permission errors
        }
        
        // Handle network errors with retry logic
        if (error.message.includes('Network error') || 
            error.message.includes('Failed to connect') ||
            error.message.includes('fetch')) {
          
          if (retryCount < MAX_RETRIES) {
            console.log(`Network error, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
            setError(`Connection issue. Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
            setTimeout(() => {
              refreshTickets(force, retryCount + 1)
            }, RETRY_DELAY)
            return
          } else {
            console.error('Max retries reached for network error')
            setError('Unable to connect to the server. Please check your internet connection and try again.')
            // Keep existing tickets if we have them, otherwise show empty
            if (tickets.length === 0) {
              setTickets([])
            }
          }
        }
        
        // Handle server errors (5xx) with retry logic
        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`Server error, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
            setError(`Server temporarily unavailable. Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
            setTimeout(() => {
              refreshTickets(force, retryCount + 1)
            }, RETRY_DELAY)
            return
          } else {
            console.error('Max retries reached for server error')
            setError('The server is temporarily unavailable. Please try again later.')
            // Keep existing tickets if we have them
            if (tickets.length === 0) {
              setTickets([])
            }
          }
        }
        
        // Handle authentication errors
        if (error.message.includes('Session expired') || error.message.includes('401')) {
          console.warn('Authentication error, user will be redirected to login')
          setError('Your session has expired. You will be redirected to login.')
          // The API service already handles this by redirecting to login
          return
        }
      }
      
      // For any other errors, just log and keep existing state
      console.error('Unhandled error in refreshTickets:', error)
      setError('An unexpected error occurred while loading tickets. Please try refreshing the page.')
      if (tickets.length === 0) {
        setTickets([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [userRole, lastFetch.tickets, tickets.length])

  // Add function to get all tickets for admin dashboard tabs
  const getAllTicketsForAdmin = async (): Promise<Ticket[]> => {
    if (userRole !== 'admin') {
      return []
    }
    
    try {
      const response = await apiService.getAllTickets()
      return response.tickets || []
    } catch (error) {
      console.error("Failed to fetch all tickets for admin:", error)
      return []
    }
  }

  const refreshUsers = async (force = false, retryCount = 0) => {
    const now = Date.now()
    const MAX_RETRIES = 3
    const RETRY_DELAY = Math.pow(2, retryCount) * 1000 // Exponential backoff: 1s, 2s, 4s
    
    // Don't fetch if user role is not available
    if (!userRole) {
      return
    }
    
    // Skip if recently fetched and not forced
    if (!force && (now - lastFetch.users) < CACHE_DURATION && users.length > 0) {
      return
    }
    
    try {
      // Use role-based user fetching instead of admin-only getAllUsers
      const response = await apiService.getUsersByRole(userRole)
      
      // Handle the response format from role-based API
      if (response.users && Array.isArray(response.users)) {
        // Direct array of users from API
        setUsers(response.users)
      } else {
        // Handle role-based user object (fallback for other APIs)
        const allUsers: User[] = []
        Object.entries(response).forEach(([role, userList]) => {
          if (Array.isArray(userList)) {
            allUsers.push(...userList.map((user: any) => ({
              ...user,
              role: role as any
            })))
          }
        })
        setUsers(allUsers)
      }
      
      setLastFetch(prev => ({ ...prev, users: now }))
    } catch (error) {
      console.error("Failed to fetch users:", error)
      
      // Handle different error types with appropriate responses
      if (error instanceof Error) {
        // Handle 403 Forbidden errors gracefully
        if (error.message.includes('Access denied') || error.message.includes('403')) {
          console.warn(`Access denied for role ${userRole}, user may need different permissions`)
          // Keep existing users or set empty array
          if (users.length === 0) {
            setUsers([])
          }
          return // Don't retry on permission errors
        }
        
        // Handle network errors with retry logic
        if (error.message.includes('Network error') || 
            error.message.includes('Failed to connect') ||
            error.message.includes('fetch')) {
          
          if (retryCount < MAX_RETRIES) {
            console.log(`Network error fetching users, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
            setTimeout(() => {
              refreshUsers(force, retryCount + 1)
            }, RETRY_DELAY)
            return
          } else {
            console.error('Max retries reached for network error fetching users')
            if (users.length === 0) {
              setUsers([])
            }
          }
        }
        
        // Handle server errors (5xx) with retry logic
        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`Server error fetching users, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
            setTimeout(() => {
              refreshUsers(force, retryCount + 1)
            }, RETRY_DELAY)
            return
          } else {
            console.error('Max retries reached for server error fetching users')
            if (users.length === 0) {
              setUsers([])
            }
          }
        }
        
        // Handle authentication errors
        if (error.message.includes('Session expired') || error.message.includes('401')) {
          console.warn('Authentication error fetching users, user will be redirected to login')
          return
        }
      }
      
      // For any other errors, just log and keep existing state
      console.error('Unhandled error in refreshUsers:', error)
      if (users.length === 0) {
        setUsers([])
      }
    }
  }

  const createTicket = async (query: string, priority: Ticket["priority"]) => {
    try {
      setIsLoading(true)
      await apiService.createTicket({ query, priority })
      await refreshTickets(true) // Force refresh after creation
      notifySubscribers() // Notify subscribers of ticket list changes
      return true
    } catch (error) {
      console.error("Failed to create ticket:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const assignTicket = async (ticketId: number, developerId: number, assignedBy: number, notes?: string) => {
    try {
      setIsLoading(true)
      // Call the admin assign ticket API
      await apiService.assignTicketAsAdmin(ticketId, developerId, notes)
      await refreshTickets(true) // Force refresh after assignment
      notifySubscribers() // Notify subscribers of assignment changes
      return true
    } catch (error) {
      console.error("Failed to assign ticket:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const completeTicket = async (ticketId: number, completionNotes: string) => {
    try {
      setIsLoading(true)
      // Call the developer complete ticket API
      await apiService.completeTicket(ticketId, completionNotes)
      await refreshTickets(true) // Force refresh after completion
      notifySubscribers() // Notify subscribers of completion
      return true
    } catch (error) {
      console.error("Failed to complete ticket:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const selfAssignTicket = async (ticketId: number, developerId: number) => {
    try {
      setIsLoading(true)
      // Call the developer self-assign API
      await apiService.selfAssignTicket(ticketId)
      await refreshTickets(true) // Force refresh after self-assignment
      notifySubscribers() // Notify subscribers of self-assignment
      return true
    } catch (error) {
      console.error("Failed to self-assign ticket:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const passTicket = async (ticketId: number, reason: string) => {
    try {
      setIsLoading(true)
      // Call the developer pass ticket API
      await apiService.passTicket(ticketId, reason)
      await refreshTickets(true) // Force refresh after passing
      notifySubscribers() // Notify subscribers of ticket pass
      return true
    } catch (error) {
      console.error("Failed to pass ticket:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const cancelTicket = async (ticketId: number, reason: string) => {
    try {
      setIsLoading(true)
      // Call the developer cancel ticket API
      await apiService.cancelTicket(ticketId, reason)
      await refreshTickets(true) // Force refresh after canceling
      notifySubscribers() // Notify subscribers of ticket cancellation
      return true
    } catch (error) {
      console.error("Failed to cancel ticket:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const updateTicketStatus = async (ticketId: number, status: string, notes?: string) => {
    try {
      setIsLoading(true)
      // Call the developer update status API
      await apiService.updateTicketStatus(ticketId, status, notes)
      await refreshTickets(true) // Force refresh after status update
      notifySubscribers() // Notify subscribers of status change
      return true
    } catch (error) {
      console.error("Failed to update ticket status:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const getTicketsByUser = (userId: number) => {
    return tickets.filter((t) => t.userId === userId)
  }

  const getTicketsByDeveloper = (developerId: number) => {
    return tickets.filter((t) => t.assignedDeveloperId === developerId)
  }

  const getUnassignedTickets = () => {
    return tickets.filter((t) => t.assignedDeveloperId === null && t.status === "OPEN")
  }

  const getDeveloperStats = (developerId: number) => {
    const devTickets = tickets.filter((t) => t.assignedDeveloperId === developerId)
    const activeTickets = devTickets.filter((t) => t.status !== "CLOSED")
    const completedTickets = devTickets.filter((t) => t.status === "CLOSED")
    
    return {
      assigned: devTickets.length, // Total assigned tickets (active + completed) - Req 5.4
      completed: completedTickets.length, // Completed tickets by developer - Req 5.2
      inProgress: activeTickets.length, // Active/In-progress tickets - Req 5.1
    }
  }

  const getAvailableTicketsForRole = async (retryCount = 0): Promise<Ticket[]> => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = Math.pow(2, retryCount) * 1000 // Exponential backoff
    
    if (!userRole) {
      return []
    }
    
    try {
      const response = await apiService.getAvailableTicketsByRole(userRole)
      return response.tickets || []
    } catch (error) {
      console.error("Failed to fetch available tickets:", error)
      
      if (error instanceof Error) {
        // Handle 403 Forbidden errors gracefully
        if (error.message.includes('Access denied') || error.message.includes('403')) {
          console.warn(`Access denied for available tickets with role ${userRole}`)
          return []
        }
        
        // Handle network/server errors with retry logic
        if ((error.message.includes('Network error') || 
             error.message.includes('Failed to connect') ||
             error.message.includes('fetch') ||
             error.message.includes('500') ||
             error.message.includes('502') ||
             error.message.includes('503')) && retryCount < MAX_RETRIES) {
          
          console.log(`Error fetching available tickets, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return getAvailableTicketsForRole(retryCount + 1)
        }
      }
      
      return []
    }
  }

  const getCompletedTicketsForRole = async (retryCount = 0): Promise<Ticket[]> => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = Math.pow(2, retryCount) * 1000 // Exponential backoff
    
    if (!userRole) {
      return []
    }
    
    try {
      const response = await apiService.getCompletedTicketsByRole(userRole)
      return response.tickets || []
    } catch (error) {
      console.error("Failed to fetch completed tickets:", error)
      
      if (error instanceof Error) {
        // Handle 403 Forbidden errors gracefully
        if (error.message.includes('Access denied') || error.message.includes('403')) {
          console.warn(`Access denied for completed tickets with role ${userRole}`)
          return []
        }
        
        // Handle network/server errors with retry logic
        if ((error.message.includes('Network error') || 
             error.message.includes('Failed to connect') ||
             error.message.includes('fetch') ||
             error.message.includes('500') ||
             error.message.includes('502') ||
             error.message.includes('503')) && retryCount < MAX_RETRIES) {
          
          console.log(`Error fetching completed tickets, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return getCompletedTicketsForRole(retryCount + 1)
        }
      }
      
      return []
    }
  }

  // Real-time update methods
  const subscribeToTicketUpdates = useCallback((callback: () => void) => {
    updateSubscribersRef.current.add(callback)
    
    // Return unsubscribe function
    return () => {
      updateSubscribersRef.current.delete(callback)
    }
  }, [])

  const notifySubscribers = useCallback(() => {
    updateSubscribersRef.current.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Error in ticket update subscriber:', error)
      }
    })
  }, [])

  const refreshAllTicketData = async () => {
    // Force refresh all ticket data and notify subscribers
    await Promise.all([
      refreshTickets(true),
      refreshUsers(true)
    ])
    notifySubscribers()
  }

  const clearError = () => {
    setError(null)
  }

  return (
    <TicketContext.Provider
      value={{
        tickets,
        users,
        isLoading,
        error,
        createTicket,
        assignTicket,
        completeTicket,
        selfAssignTicket,
        passTicket,
        cancelTicket,
        updateTicketStatus,
        refreshTickets,
        refreshUsers,
        getTicketsByUser,
        getTicketsByDeveloper,
        getUnassignedTickets,
        getDeveloperStats,
        getAvailableTicketsForRole,
        getCompletedTicketsForRole,
        getAllTicketsForAdmin,
        clearError,
        refreshAllTicketData,
        subscribeToTicketUpdates,
      }}
    >
      {children}
    </TicketContext.Provider>
  )
}

export function useTickets() {
  const context = useContext(TicketContext)
  if (!context) {
    throw new Error("useTickets must be used within TicketProvider")
  }
  return context
}
