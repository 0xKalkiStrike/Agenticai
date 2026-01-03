import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock fetch
global.fetch = jest.fn()

// Mock window.location with proper JSDOM handling
delete window.location
window.location = {
  href: 'http://localhost:3000',
  assign: jest.fn(),
  reload: jest.fn(),
  replace: jest.fn(),
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
}

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Suppress React act() warnings in tests by providing a custom act implementation
import { act } from '@testing-library/react'

// Global test utilities for proper React state handling
global.testUtils = {
  // Wrapper for async operations that need act()
  async actAsync(fn) {
    let result
    await act(async () => {
      result = await fn()
    })
    return result
  },
  
  // Wrapper for sync operations that need act()
  actSync(fn) {
    let result
    act(() => {
      result = fn()
    })
    return result
  }
}

// Enhanced error handling for tests
const originalConsoleError = console.error
console.error = (...args) => {
  // Filter out known React warnings that we're testing for
  const message = args[0]
  if (typeof message === 'string') {
    // Allow act() warnings to be captured by tests
    if (message.includes('Warning: An update to') || 
        message.includes('Warning: Cannot update') ||
        message.includes('act(')) {
      return originalConsoleError(...args)
    }
    
    // Suppress JSDOM navigation warnings
    if (message.includes('Not implemented: navigation')) {
      return
    }
  }
  
  return originalConsoleError(...args)
}

// Mock API service methods for consistent testing
jest.mock('@/lib/api', () => {
  const { mockApiService } = require('./__tests__/mocks/api-service')
  return {
    apiService: mockApiService
  }
})

// Setup default mock implementations
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks()
  
  // Reset API service mock to defaults
  const { resetApiServiceMock } = require('./__tests__/mocks/api-service')
  resetApiServiceMock()
  
  // Setup localStorage defaults
  localStorageMock.getItem.mockImplementation((key) => {
    if (key === 'auth_token') return 'mock-token'
    return null
  })
})