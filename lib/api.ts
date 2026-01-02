// API service for communicating with FastAPI backend running on WAMP MySQL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

interface LoginResponse {
  token: string
  role: string
  username: string
}

interface RegisterResponse {
  status: string
  message: string
}

interface ApiError {
  detail: string
}

interface HealthCheckResponse {
  status: "healthy" | "unhealthy"
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

interface DashboardData {
  user_counts: {
    admin: number
    project_manager: number
    developer: number
    client: number
  }
  ticket_stats: {
    total_tickets: number
    open_tickets: number
    in_progress_tickets: number
    closed_tickets: number
    unassigned_tickets: number
  }
  recent_tickets: Array<{
    id: number
    query: string
    status: string
    priority: string
    created_at: string
    client_name: string
    developer_name?: string
  }>
}

class ApiService {
  private getAuthHeaders(): HeadersInit {
    // Only access localStorage on client side
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
    
    // Debug logging
    if (typeof window !== 'undefined') {
      console.log('Auth headers:', { hasToken: !!token, tokenLength: token?.length || 0 })
    }
    
    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ detail: 'Network error' }))
      
      // Handle authentication errors
      if (response.status === 401) {
        // Token expired or invalid - clear auth and redirect to login
        console.log('Authentication failed: Token expired or invalid')
        this.clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Session expired. Please login again.')
      }
      
      // Handle authorization errors
      if (response.status === 403) {
        console.log('Authorization failed: Access denied')
        throw new Error('Access denied. You do not have permission to perform this action.')
      }
      
      // Handle specific "Not authenticated" error
      if (error.detail === 'Not authenticated') {
        console.log('Not authenticated: No valid token provided')
        this.clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Please login to access this resource.')
      }
      
      // Log the error details for debugging
      console.error(`API Error ${response.status}:`, error)
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    return response.json()
  }

  // Authentication APIs
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    
    const data = await this.handleResponse<LoginResponse>(response)
    
    // Store token in localStorage only on client side
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', data.token)
    }
    
    return data
  }

  async register(username: string, password: string, email: string): Promise<RegisterResponse> {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    })
    
    return this.handleResponse<RegisterResponse>(response)
  }

  // Health check - connects to WAMP MySQL database
  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        headers: this.getAuthHeaders()
      })
      return this.handleResponse<HealthCheckResponse>(response)
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Failed to connect to backend server')
      }
      throw error
    }
  }

  // Admin APIs - all data from WAMP MySQL database
  async getAdminDashboard(): Promise<DashboardData> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: this.getAuthHeaders()
      })
      return this.handleResponse<DashboardData>(response)
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Failed to connect to backend server. Please ensure the backend is running.')
      }
      throw error
    }
  }

  async getAllUsers(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/users/all`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async getPendingApprovals(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/users/pending-approvals`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async approveUser(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/approve`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async createUser(userData: {
    username: string
    password: string
    email: string
    role: string
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/users/create`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData)
    })
    return this.handleResponse(response)
  }

  async getAllTickets(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/tickets/all`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async assignTicketAsAdmin(ticketId: number, developerId: number, notes?: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ 
        developer_id: developerId, 
        notes: notes || '' 
      })
    })
    return this.handleResponse(response)
  }

  // Client APIs
  async getClientDashboard(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/client/dashboard`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async createTicket(ticketData: {
    query: string
    priority: string
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/client/tickets/create`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(ticketData)
    })
    return this.handleResponse(response)
  }

  async getClientTickets(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/client/tickets/my-tickets`, {
      headers: this.getAuthHeaders()
    })
    const data = await this.handleResponse(response) as any
    // Backend returns {my_tickets: [...]} format - normalize to {tickets: [...]}
    return { tickets: data.my_tickets || [] }
  }

  async sendChatMessage(message: string, sessionId?: string): Promise<any> {
    const body: any = { query: message }
    if (sessionId) {
      body.session_id = sessionId
    }
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })
    return this.handleResponse(response)
  }

  async getChatHistory(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/client/chat/history`, {
        headers: this.getAuthHeaders()
      })
      return this.handleResponse(response)
    } catch (error) {
      // If chat history endpoint doesn't exist, return empty history
      console.warn('Chat history endpoint not available:', error)
      return { chat_history: [] }
    }
  }

  // Notification APIs
  async getNotifications(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async markNotificationAsRead(notificationId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async markAllNotificationsAsRead(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async deleteNotification(notificationId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  // User Settings APIs
  async getUserSettings(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/user/settings`, {
        headers: this.getAuthHeaders()
      })
      return this.handleResponse(response)
    } catch (error) {
      // If endpoint doesn't exist, return default settings
      console.log("User settings endpoint not available, using defaults")
      return {
        email: "",
        emailNotifications: true,
        browserNotifications: true,
        ticketAssignmentNotifications: true,
        ticketUpdateNotifications: true
      }
    }
  }

  async updateUserSettings(settings: any): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/user/settings`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(settings)
      })
      return this.handleResponse(response)
    } catch (error) {
      // If endpoint doesn't exist, simulate success and store locally
      console.log("User settings endpoint not available, storing locally")
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_settings', JSON.stringify(settings))
      }
      return { success: true, message: "Settings saved locally" }
    }
  }

  // Developer APIs
  async getDeveloperDashboard(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/dashboard`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async getDeveloperTeamMembers(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/team/members`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async getDeveloperTickets(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/my-assigned`, {
      headers: this.getAuthHeaders()
    })
    const data = await this.handleResponse(response) as any
    // Backend returns {assigned_tickets: [...]} format - normalize to {tickets: [...]}
    return { tickets: data.assigned_tickets || [] }
  }

  async getAvailableTickets(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/available`, {
      headers: this.getAuthHeaders()
    })
    const data = await this.handleResponse(response) as any
    // Backend returns {available_tickets: [...]} format - normalize to {tickets: [...]}
    return { tickets: data.available_tickets || [] }
  }

  async getDeveloperCompletedTickets(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/history`, {
      headers: this.getAuthHeaders()
    })
    const data = await this.handleResponse(response) as any
    // Backend returns {ticket_history: [...]} - filter for completed tickets
    const completedTickets = (data.ticket_history || []).filter((ticket: any) => ticket.status === 'CLOSED')
    return { tickets: completedTickets }
  }

  async selfAssignTicket(ticketId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/${ticketId}/self-assign`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async completeTicket(ticketId: number, completionNotes: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/${ticketId}/complete`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ completion_notes: completionNotes })
    })
    return this.handleResponse(response)
  }

  async passTicket(ticketId: number, reason: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/${ticketId}/pass`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason })
    })
    return this.handleResponse(response)
  }

  async cancelTicket(ticketId: number, reason: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/${ticketId}/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason })
    })
    return this.handleResponse(response)
  }

  async updateTicketStatus(ticketId: number, status: string, notes?: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/developer/tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status, notes })
    })
    return this.handleResponse(response)
  }

  // Role-based ticket fetching methods
  async getTicketsByRole(userRole: string): Promise<any> {
    switch (userRole) {
      case 'admin':
        return this.getAllTickets()
      case 'project_manager':
        return this.getAllTickets() // PMs can see all tickets
      case 'developer':
        return this.getDeveloperTickets()
      case 'client':
        return this.getClientTickets()
      default:
        throw new Error(`Unknown user role: ${userRole}`)
    }
  }

  async getActiveTicketsByRole(userRole: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/active`, {
        headers: this.getAuthHeaders()
      })
      return this.handleResponse(response)
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Failed to connect to backend server')
      }
      throw error
    }
  }

  async getUsersByRole(userRole: string): Promise<any> {
    switch (userRole) {
      case 'admin':
      case 'project_manager':
        return this.getAllUsers()
      case 'developer':
        return this.getDeveloperTeamMembers()
      case 'client':
        // Clients don't need to see other users
        return { users: [] }
      default:
        throw new Error(`Unknown user role: ${userRole}`)
    }
  }

  async getAvailableTicketsByRole(userRole: string): Promise<any> {
    switch (userRole) {
      case 'admin':
      case 'project_manager':
        return this.getUnassignedTickets()
      case 'developer':
        return this.getAvailableTickets()
      case 'client':
        // Clients can't see available tickets
        return { tickets: [] }
      default:
        throw new Error(`Unknown user role: ${userRole}`)
    }
  }

  async getCompletedTicketsByRole(userRole: string): Promise<any> {
    switch (userRole) {
      case 'admin':
      case 'project_manager':
        // For admins/PMs, we'll need to filter all tickets for completed ones
        const allTickets = await this.getAllTickets()
        return {
          tickets: allTickets.tickets?.filter((ticket: any) => ticket.status === 'CLOSED') || []
        }
      case 'developer':
        return this.getDeveloperCompletedTickets()
      case 'client':
        // For clients, filter their own tickets for completed ones
        const clientTickets = await this.getClientTickets()
        return {
          tickets: clientTickets.tickets?.filter((ticket: any) => ticket.status === 'CLOSED') || []
        }
      default:
        throw new Error(`Unknown user role: ${userRole}`)
    }
  }

  // Project Manager APIs
  async getPMDashboard(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/dashboard`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async getPMTeamMembers(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/team/members`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async getAvailableUsersForTeam(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/team/available`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async addTeamMember(memberId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/team/add/${memberId}`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async removeTeamMember(memberId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/team/remove/${memberId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async createTeamUser(userData: {
    username: string
    password: string
    email: string
    role: string
  }): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/team/create-user`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(userData)
    })
    return this.handleResponse(response)
  }

  async getUnassignedTickets(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/tickets/unassigned`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async assignTicket(ticketId: number, developerId: number, notes?: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/pm/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ 
        developer_id: developerId, 
        notes: notes || '' 
      })
    })
    return this.handleResponse(response)
  }

  async getDeveloperPerformance(period: 'week' | 'month' | 'all' = 'month'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/developer-performance?period=${period}`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  // Utility method to clear auth data
  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
  }
}

export const apiService = new ApiService()
export default apiService