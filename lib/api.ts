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

interface ErrorResponse {
  type: 'network' | 'api' | 'auth' | 'permission' | 'unknown'
  message: string
  details?: string
  retryable: boolean
  timestamp: number
}

interface ApiServiceStatus {
  isAvailable: boolean
  methods: Record<string, boolean>
  lastCheck: number
  errors: ErrorResponse[]
}

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  retryableErrors: string[]
}

// Enhanced error logging utility
class ErrorLogger {
  private static logError(error: Error, context: string, details?: any): void {
    const timestamp = new Date().toISOString()
    const errorInfo = {
      timestamp,
      context,
      message: error.message,
      name: error.name,
      stack: error.stack,
      details,
    }
    
    // Log detailed error for debugging
    console.error(`[API Error] ${context}:`, errorInfo)
    
    // Store error for potential retry logic or user feedback
    if (typeof window !== 'undefined') {
      const errorHistory = JSON.parse(localStorage.getItem('error_history') || '[]')
      errorHistory.push(errorInfo)
      // Keep only last 50 errors
      if (errorHistory.length > 50) {
        errorHistory.splice(0, errorHistory.length - 50)
      }
      localStorage.setItem('error_history', JSON.stringify(errorHistory))
    }
  }

  static logNetworkError(error: Error, url: string, method: string): void {
    this.logError(error, 'Network Request Failed', { url, method })
  }

  static logAuthError(error: Error, endpoint: string): void {
    this.logError(error, 'Authentication Failed', { endpoint })
  }

  static logPermissionError(error: Error, endpoint: string, userRole?: string): void {
    this.logError(error, 'Permission Denied', { endpoint, userRole })
  }

  static logApiError(error: Error, endpoint: string, status?: number): void {
    this.logError(error, 'API Error', { endpoint, status })
  }

  static logMethodError(error: Error, methodName: string): void {
    this.logError(error, 'Method Availability Error', { methodName })
  }
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
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    retryableErrors: ['TypeError', 'NetworkError', 'TimeoutError', 'AbortError']
  }

  // Enhanced retry logic with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    isRetryable: (error: Error) => boolean = this.isRetryableError.bind(this)
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        // Log each attempt
        ErrorLogger.logApiError(lastError, context, undefined)
        
        // Don't retry on last attempt or if error is not retryable
        if (attempt === this.retryConfig.maxRetries || !isRetryable(lastError)) {
          break
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay
        )
        
        console.log(`Retrying ${context} in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // All retries failed, throw the last error with enhanced message
    throw this.enhanceErrorMessage(lastError!, context)
  }

  private isRetryableError(error: Error): boolean {
    // Network errors are generally retryable
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true
    }
    
    // Timeout errors are retryable
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return true
    }
    
    // Server errors (5xx) are retryable
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504')) {
      return true
    }
    
    // Auth errors (401, 403) are not retryable
    if (error.message.includes('401') || error.message.includes('403') || 
        error.message.includes('Not authenticated') || error.message.includes('Access denied')) {
      return false
    }
    
    return this.retryConfig.retryableErrors.some(retryableType => 
      error.name === retryableType || error.constructor.name === retryableType
    )
  }

  private enhanceErrorMessage(error: Error, context: string): Error {
    let userFriendlyMessage: string
    
    // Create user-friendly error messages based on error type
    if (error instanceof TypeError && error.message.includes('fetch')) {
      userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
      ErrorLogger.logNetworkError(error, context, 'fetch')
    } else if (error.message.includes('401') || error.message.includes('Not authenticated')) {
      userFriendlyMessage = 'Your session has expired. Please log in again to continue.'
      ErrorLogger.logAuthError(error, context)
    } else if (error.message.includes('403') || error.message.includes('Access denied')) {
      userFriendlyMessage = 'You do not have permission to perform this action. Please contact your administrator if you believe this is an error.'
      ErrorLogger.logPermissionError(error, context)
    } else if (error.message.includes('500')) {
      userFriendlyMessage = 'The server encountered an error. Please try again in a few moments or contact support if the problem persists.'
      ErrorLogger.logApiError(error, context, 500)
    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      userFriendlyMessage = 'The request timed out. Please check your connection and try again.'
      ErrorLogger.logNetworkError(error, context, 'timeout')
    } else if (error.message.includes('not a function') || error.message.includes('not available')) {
      userFriendlyMessage = 'This feature is temporarily unavailable. Please refresh the page and try again.'
      ErrorLogger.logMethodError(error, context)
    } else {
      userFriendlyMessage = 'An unexpected error occurred. Please try again or contact support if the problem continues.'
      ErrorLogger.logApiError(error, context)
    }
    
    // Return enhanced error with user-friendly message
    const enhancedError = new Error(userFriendlyMessage)
    enhancedError.name = error.name
    enhancedError.stack = error.stack
    return enhancedError
  }

  // Method existence check for defensive programming
  private checkMethodExists(methodName: string): boolean {
    const method = (this as any)[methodName]
    const exists = typeof method === 'function'
    if (!exists) {
      const error = new Error(`API Service method '${methodName}' is not available`)
      ErrorLogger.logMethodError(error, methodName)
    }
    return exists
  }

  // Safe method caller with existence check and retry logic
  private async safeMethodCall<T>(methodName: string, ...args: any[]): Promise<T> {
    if (!this.checkMethodExists(methodName)) {
      throw new Error(`This feature is temporarily unavailable. Please refresh the page and try again.`)
    }
    
    return this.withRetry(async () => {
      try {
        const method = (this as any)[methodName]
        return await method.apply(this, args)
      } catch (error) {
        ErrorLogger.logApiError(error as Error, methodName)
        throw error
      }
    }, methodName)
  }

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
        ErrorLogger.logAuthError(new Error(error.detail), response.url)
        this.clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Your session has expired. Please log in again to continue.')
      }
      
      // Handle authorization errors
      if (response.status === 403) {
        console.log('Authorization failed: Access denied')
        ErrorLogger.logPermissionError(new Error(error.detail), response.url)
        
        // Check if this is a deactivated account error
        if (error.detail && error.detail.includes('deactivated')) {
          console.log('Account deactivated: Clearing auth and redirecting to login')
          this.clearAuth()
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          throw new Error('Your account has been deactivated. Please contact your administrator.')
        }
        
        throw new Error('You do not have permission to perform this action. Please contact your administrator if you believe this is an error.')
      }
      
      // Handle specific "Not authenticated" error
      if (error.detail === 'Not authenticated') {
        console.log('Not authenticated: No valid token provided')
        ErrorLogger.logAuthError(new Error(error.detail), response.url)
        this.clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new Error('Please log in to access this resource.')
      }
      
      // Handle server errors with user-friendly messages
      if (response.status >= 500) {
        ErrorLogger.logApiError(new Error(error.detail), response.url, response.status)
        throw new Error('The server encountered an error. Please try again in a few moments or contact support if the problem persists.')
      }
      
      // Handle client errors
      if (response.status >= 400 && response.status < 500) {
        ErrorLogger.logApiError(new Error(error.detail), response.url, response.status)
        throw new Error(`Request failed: ${error.detail || `HTTP ${response.status}`}. Please check your input and try again.`)
      }
      
      // Log the error details for debugging
      console.error(`API Error ${response.status}:`, error)
      ErrorLogger.logApiError(new Error(error.detail), response.url, response.status)
      throw new Error(error.detail || `An unexpected error occurred (HTTP ${response.status}). Please try again.`)
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
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          headers: this.getAuthHeaders()
        })
        return this.handleResponse<HealthCheckResponse>(response)
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Unable to connect to the server. Please check that the backend service is running and try again.')
        }
        throw error
      }
    }, 'healthCheck')
  }

  // Admin APIs - all data from WAMP MySQL database
  async getAdminDashboard(): Promise<DashboardData> {
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
          headers: this.getAuthHeaders()
        })
        return this.handleResponse<DashboardData>(response)
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Unable to connect to the server. Please ensure the backend is running and try again.')
        }
        throw error
      }
    }, 'getAdminDashboard')
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

  async activateUser(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/activate`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse(response)
  }

  async deactivateUser(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/deactivate`, {
      method: 'POST',
      headers: this.getAuthHeaders()
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
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/developer/tickets/my-assigned`, {
          headers: this.getAuthHeaders()
        })
        
        const data = await this.handleResponse(response) as any
        // Backend returns {assigned_tickets: [...]} format - normalize to {tickets: [...]}
        return { tickets: data.assigned_tickets || [] }
      } catch (error) {
        console.error('Error in getDeveloperTickets:', error)
        
        // Enhanced error handling with specific error types
        if (error instanceof Error) {
          if (error.message.includes('not a function') || error.message.includes('not available')) {
            // Method availability error
            ErrorLogger.logMethodError(error, 'getDeveloperTickets')
            throw new Error('The developer tickets service is temporarily unavailable. Please refresh the page and try again.')
          }
          
          if (error.message.includes('Failed to connect') || error.message.includes('fetch')) {
            // Network error
            ErrorLogger.logNetworkError(error, `${API_BASE_URL}/developer/tickets/my-assigned`, 'GET')
            throw new Error('Unable to connect to the server. Please check your internet connection and try again.')
          }
          
          if (error.message.includes('403') || error.message.includes('Access denied')) {
            // Permission error
            ErrorLogger.logPermissionError(error, 'getDeveloperTickets')
            throw new Error('You do not have permission to view developer tickets. Please contact your administrator.')
          }
          
          if (error.message.includes('401') || error.message.includes('Session expired')) {
            // Authentication error
            ErrorLogger.logAuthError(error, 'getDeveloperTickets')
            throw new Error('Your session has expired. Please log in again.')
          }
        }
        
        // Re-throw the original error if it's not one we specifically handle
        throw error
      }
    }, 'getDeveloperTickets')
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

  // Role-based ticket fetching methods with enhanced error handling
  async getTicketsByRole(userRole: string): Promise<any> {
    try {
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
    } catch (error) {
      console.error(`Error in getTicketsByRole for role ${userRole}:`, error)
      throw error
    }
  }

  // API Service status check method
  getApiServiceStatus(): ApiServiceStatus {
    const methods = [
      'getDeveloperTickets',
      'getClientTickets', 
      'getAllTickets',
      'createTicket',
      'assignTicket',
      'completeTicket',
      'selfAssignTicket',
      'passTicket',
      'cancelTicket',
      'updateTicketStatus'
    ]
    
    const methodStatus: Record<string, boolean> = {}
    let allAvailable = true
    const errors: ErrorResponse[] = []
    
    methods.forEach(methodName => {
      const available = this.checkMethodExists(methodName)
      methodStatus[methodName] = available
      if (!available) {
        allAvailable = false
        errors.push({
          type: 'api',
          message: `Method ${methodName} is not available`,
          retryable: false,
          timestamp: Date.now()
        })
      }
    })
    
    return {
      isAvailable: allAvailable,
      methods: methodStatus,
      lastCheck: Date.now(),
      errors
    }
  }

  // Get error history for debugging and user feedback
  getErrorHistory(): any[] {
    if (typeof window === 'undefined') return []
    
    try {
      return JSON.parse(localStorage.getItem('error_history') || '[]')
    } catch {
      return []
    }
  }

  // Clear error history
  clearErrorHistory(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('error_history')
    }
  }

  // Get connection status with enhanced error information
  async getConnectionStatus(): Promise<{
    backend: boolean
    database: boolean
    lastError?: string
    retryCount?: number
  }> {
    try {
      const health = await this.healthCheck()
      return {
        backend: health.status === 'healthy',
        database: health.components.database.status === 'healthy',
      }
    } catch (error) {
      const errorHistory = this.getErrorHistory()
      const recentErrors = errorHistory.filter(e => 
        Date.now() - new Date(e.timestamp).getTime() < 60000 // Last minute
      )
      
      return {
        backend: false,
        database: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        retryCount: recentErrors.length
      }
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
        return this.getAllUsers()
      case 'project_manager':
        return this.getPMTeamMembers()
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