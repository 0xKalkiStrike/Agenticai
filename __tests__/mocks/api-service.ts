// Comprehensive API service mock for testing
import type { User, Ticket } from '@/lib/types'

// Mock data generators
export const createMockTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  userId: 1,
  query: 'Test ticket',
  reply: null,
  status: 'OPEN',
  priority: 'MEDIUM',
  assignedDeveloperId: null,
  assignedBy: null,
  assignedAt: null,
  assignmentNotes: null,
  completedAt: null,
  completionNotes: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
  clientName: 'Test Client',
  developerName: null,
  assignedByName: null,
  ...overrides,
})

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'developer',
  createdAt: new Date().toISOString(),
  lastLogin: null,
  isActive: true,
  ...overrides,
})

// Mock API responses
export const mockApiResponses = {
  tickets: {
    success: (tickets: Ticket[] = []) => ({
      ok: true,
      status: 200,
      json: async () => ({ 
        tickets,
        assigned_tickets: tickets,
        available_tickets: tickets,
        my_tickets: tickets,
      }),
    }),
    empty: () => ({
      ok: true,
      status: 200,
      json: async () => ({ 
        tickets: [],
        assigned_tickets: [],
        available_tickets: [],
        my_tickets: [],
      }),
    }),
  },
  
  users: {
    success: (users: User[] = []) => ({
      ok: true,
      status: 200,
      json: async () => ({ users }),
    }),
  },
  
  auth: {
    success: (token = 'mock-token', role = 'developer') => ({
      ok: true,
      status: 200,
      json: async () => ({ token, role, username: 'testuser' }),
    }),
    unauthorized: () => ({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Not authenticated' }),
    }),
  },
  
  health: {
    healthy: () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'healthy',
        components: {
          database: { status: 'healthy', message: 'Connected' }
        }
      }),
    }),
  },
  
  errors: {
    networkError: () => {
      throw new TypeError('Failed to fetch')
    },
    serverError: (message = 'Internal server error') => ({
      ok: false,
      status: 500,
      json: async () => ({ detail: message }),
    }),
    forbidden: (message = 'Access denied') => ({
      ok: false,
      status: 403,
      json: async () => ({ detail: message }),
    }),
  }
}

// Enhanced API service mock with proper error handling
export const createApiServiceMock = () => {
  const mock = {
    // Core ticket methods
    getDeveloperTickets: jest.fn().mockResolvedValue({ tickets: [] }),
    getClientTickets: jest.fn().mockResolvedValue({ tickets: [] }),
    getAllTickets: jest.fn().mockResolvedValue({ tickets: [] }),
    createTicket: jest.fn().mockResolvedValue({ success: true }),
    assignTicket: jest.fn().mockResolvedValue({ success: true }),
    completeTicket: jest.fn().mockResolvedValue({ success: true }),
    selfAssignTicket: jest.fn().mockResolvedValue({ success: true }),
    passTicket: jest.fn().mockResolvedValue({ success: true }),
    cancelTicket: jest.fn().mockResolvedValue({ success: true }),
    updateTicketStatus: jest.fn().mockResolvedValue({ success: true }),
    
    // Auth methods
    login: jest.fn().mockResolvedValue({ token: 'mock-token', role: 'developer' }),
    register: jest.fn().mockResolvedValue({ status: 'success' }),
    clearAuth: jest.fn(),
    
    // Health and status
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
    getApiServiceStatus: jest.fn(() => ({
      isAvailable: true,
      methods: {
        getDeveloperTickets: true,
        getClientTickets: true,
        getAllTickets: true,
        createTicket: true,
      },
      lastCheck: Date.now(),
      errors: []
    })),
    
    // Utility methods
    checkMethodExists: jest.fn((methodName: string) => {
      const availableMethods = [
        'getDeveloperTickets', 'getClientTickets', 'getAllTickets',
        'createTicket', 'assignTicket', 'completeTicket',
        'selfAssignTicket', 'passTicket', 'cancelTicket', 'updateTicketStatus',
        'login', 'register', 'healthCheck'
      ]
      return availableMethods.includes(methodName)
    }),
    
    safeMethodCall: jest.fn(async (methodName: string, ...args: any[]) => {
      if (mock.checkMethodExists(methodName)) {
        const method = (mock as any)[methodName]
        if (typeof method === 'function') {
          return await method(...args)
        }
      }
      throw new Error(`API Service method '${methodName}' is not a function`)
    }),
    
    // Role-based methods
    getTicketsByRole: jest.fn().mockResolvedValue({ tickets: [] }),
    getActiveTicketsByRole: jest.fn().mockResolvedValue({ tickets: [] }),
    getUsersByRole: jest.fn().mockResolvedValue({ users: [] }),
    getAvailableTicketsByRole: jest.fn().mockResolvedValue({ tickets: [] }),
    getCompletedTicketsByRole: jest.fn().mockResolvedValue({ tickets: [] }),
    
    // Admin methods
    getAdminDashboard: jest.fn().mockResolvedValue({
      user_counts: { admin: 1, developer: 2, client: 3, project_manager: 1 },
      ticket_stats: { total_tickets: 10, open_tickets: 5, in_progress_tickets: 3, closed_tickets: 2 },
      recent_tickets: []
    }),
    getAllUsers: jest.fn().mockResolvedValue({ users: [] }),
    createUser: jest.fn().mockResolvedValue({ success: true }),
    
    // Developer methods
    getDeveloperDashboard: jest.fn().mockResolvedValue({
      assigned_tickets: [],
      available_tickets: [],
      stats: { assigned: 0, completed: 0 }
    }),
    getAvailableTickets: jest.fn().mockResolvedValue({ tickets: [] }),
    
    // Client methods
    getClientDashboard: jest.fn().mockResolvedValue({
      my_tickets: [],
      stats: { open: 0, in_progress: 0, closed: 0 }
    }),
    
    // Notification methods
    getNotifications: jest.fn().mockResolvedValue({ notifications: [] }),
    markNotificationAsRead: jest.fn().mockResolvedValue({ success: true }),
    markAllNotificationsAsRead: jest.fn().mockResolvedValue({ success: true }),
    deleteNotification: jest.fn().mockResolvedValue({ success: true }),
    
    // Settings methods
    getUserSettings: jest.fn().mockResolvedValue({
      email: 'test@example.com',
      emailNotifications: true,
      browserNotifications: true
    }),
    updateUserSettings: jest.fn().mockResolvedValue({ success: true }),
    
    // Chat methods
    sendChatMessage: jest.fn().mockResolvedValue({ response: 'Mock response' }),
    getChatHistory: jest.fn().mockResolvedValue({ chat_history: [] }),
  }
  
  // Helper methods to configure mock behavior
  mock.mockSuccess = (method: string, data: any) => {
    if ((mock as any)[method]) {
      (mock as any)[method].mockResolvedValue(data)
    }
  }
  
  mock.mockError = (method: string, error: Error) => {
    if ((mock as any)[method]) {
      (mock as any)[method].mockRejectedValue(error)
    }
  }
  
  mock.mockNetworkError = (method: string) => {
    mock.mockError(method, new TypeError('Failed to fetch'))
  }
  
  mock.mockAuthError = (method: string) => {
    mock.mockError(method, new Error('Session expired. Please login again.'))
  }
  
  mock.mockPermissionError = (method: string) => {
    mock.mockError(method, new Error('You do not have permission to perform this action.'))
  }
  
  return mock
}

// Default mock instance
export const mockApiService = createApiServiceMock()

// Reset function for tests
export const resetApiServiceMock = () => {
  Object.values(mockApiService).forEach(method => {
    if (typeof method === 'function' && method.mockReset) {
      method.mockReset()
    }
  })
  
  // Restore default implementations
  mockApiService.getDeveloperTickets.mockResolvedValue({ tickets: [] })
  mockApiService.getClientTickets.mockResolvedValue({ tickets: [] })
  mockApiService.getAllTickets.mockResolvedValue({ tickets: [] })
  mockApiService.createTicket.mockResolvedValue({ success: true })
  mockApiService.healthCheck.mockResolvedValue({ status: 'healthy' })
}