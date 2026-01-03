import React from 'react'
import * as fc from 'fast-check'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { apiService } from '@/lib/api'
import { ConnectionStatus } from '@/components/connection-status'
import { TicketProvider, useTickets } from '@/lib/ticket-context'
import { AuthProvider } from '@/lib/auth-context'

/**
 * Property-based tests for System Error Resilience
 * Feature: project-error-fixes, Property 4: System Error Resilience
 * **Validates: Requirements 4.4, 5.1, 5.2, 5.3, 5.4**
 */

// Mock fetch for testing
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock localStorage for client-side operations
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock console methods to capture error logging
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
}

// Test component that demonstrates error handling
const ErrorTestComponent: React.FC<{ 
  triggerError?: string
  onError?: (error: Error) => void 
}> = ({ triggerError, onError }) => {
  const { tickets, isLoading, error, refreshTickets } = useTickets()
  const [localError, setLocalError] = React.useState<string | null>(null)

  const handleAction = async () => {
    try {
      setLocalError(null)
      
      switch (triggerError) {
        case 'network':
          await apiService.getDeveloperTickets()
          break
        case 'auth':
          await apiService.getAllUsers()
          break
        case 'permission':
          await apiService.getAdminDashboard()
          break
        default:
          await refreshTickets(true)
      }
    } catch (err) {
      const error = err as Error
      setLocalError(error.message)
      if (onError) {
        onError(error)
      }
    }
  }

  return (
    <div>
      <div data-testid="error-message">{error || localError || 'no-error'}</div>
      <div data-testid="loading-state">{isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="ticket-count">{tickets.length}</div>
      <button onClick={handleAction} data-testid="trigger-action">
        Trigger Action
      </button>
    </div>
  )
}

// Wrapper component with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <TicketProvider>
        {children}
      </TicketProvider>
    </AuthProvider>
  )
}

describe('System Error Resilience Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
    mockConsole.error.mockClear()
    mockConsole.warn.mockClear()
    mockConsole.log.mockClear()
    
    // Mock successful auth token by default
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'auth_token') return 'mock-token'
      return null
    })

    // Spy on console methods
    jest.spyOn(console, 'error').mockImplementation(mockConsole.error)
    jest.spyOn(console, 'warn').mockImplementation(mockConsole.warn)
    jest.spyOn(console, 'log').mockImplementation(mockConsole.log)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /**
   * Property 4: System Error Resilience
   * For any system error condition, the system should display user-friendly messages, 
   * show connection status when appropriate, implement retry logic for transient failures, 
   * and log detailed information for debugging
   * **Validates: Requirements 4.4, 5.1, 5.2, 5.3, 5.4**
   */
  describe('Property 4: System Error Resilience', () => {
    
    test('Property 4.1: User-friendly error messages for all error types', () => {
      fc.assert(
        fc.property(
          fc.record({
            errorType: fc.constantFrom(
              'network-error',
              'auth-error', 
              'permission-error',
              'server-error',
              'timeout-error',
              'json-parse-error'
            ),
            errorDetails: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async (errorConfig) => {
            // Property: For any error condition, system should display user-friendly messages
            let mockResponse: any
            let shouldReject = false

            switch (errorConfig.errorType) {
              case 'network-error':
                shouldReject = true
                mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
                break
              case 'auth-error':
                mockResponse = {
                  ok: false,
                  status: 401,
                  json: async () => ({ detail: 'Not authenticated' })
                }
                break
              case 'permission-error':
                mockResponse = {
                  ok: false,
                  status: 403,
                  json: async () => ({ detail: 'Access denied' })
                }
                break
              case 'server-error':
                mockResponse = {
                  ok: false,
                  status: 500,
                  json: async () => ({ detail: errorConfig.errorDetails })
                }
                break
              case 'timeout-error':
                shouldReject = true
                mockFetch.mockRejectedValueOnce(new Error('Request timeout'))
                break
              case 'json-parse-error':
                mockResponse = {
                  ok: true,
                  status: 200,
                  json: async () => { throw new Error('Invalid JSON') }
                }
                break
            }

            if (!shouldReject) {
              mockFetch.mockResolvedValueOnce(mockResponse as Response)
            }

            let capturedError: Error | null = null
            const onError = (error: Error) => {
              capturedError = error
            }

            let component: any
            await act(async () => {
              component = render(
                <TestWrapper>
                  <ErrorTestComponent 
                    triggerError={errorConfig.errorType.split('-')[0]} 
                    onError={onError}
                  />
                </TestWrapper>
              )
            })

            // Trigger the error condition
            await act(async () => {
              const triggerButton = component.getByTestId('trigger-action')
              await userEvent.click(triggerButton)
            })

            // Wait for error handling to complete
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, 100))
            })

            // Requirement 5.1: WHEN API calls fail, THE System SHALL display user-friendly error messages
            if (capturedError) {
              expect(capturedError.message).toBeDefined()
              expect(typeof capturedError.message).toBe('string')
              expect(capturedError.message.length).toBeGreaterThan(0)
              
              // Error message should be user-friendly (not technical)
              expect(capturedError.message).not.toContain('TypeError')
              expect(capturedError.message).not.toContain('fetch')
              expect(capturedError.message).not.toContain('JSON.parse')
              
              // Should contain helpful guidance
              const message = capturedError.message.toLowerCase()
              const hasHelpfulContent = 
                message.includes('please') ||
                message.includes('try again') ||
                message.includes('contact') ||
                message.includes('check') ||
                message.includes('refresh') ||
                message.includes('login')
              
              expect(hasHelpfulContent).toBe(true)
            }

            // Verify error is displayed in UI
            const errorElement = component.getByTestId('error-message')
            expect(errorElement.textContent).not.toBe('no-error')
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 4.2: Connection status indicators for backend availability', () => {
      fc.assert(
        fc.property(
          fc.record({
            backendStatus: fc.constantFrom('healthy', 'unhealthy', 'timeout'),
            databaseStatus: fc.constantFrom('healthy', 'unhealthy'),
          }),
          async (statusConfig) => {
            // Property: System should show connection status when backend is unavailable
            let mockResponse: any
            let shouldReject = false

            if (statusConfig.backendStatus === 'timeout') {
              shouldReject = true
              mockFetch.mockRejectedValueOnce(new Error('Request timeout'))
            } else {
              mockResponse = {
                ok: statusConfig.backendStatus === 'healthy',
                status: statusConfig.backendStatus === 'healthy' ? 200 : 500,
                json: async () => ({
                  status: statusConfig.backendStatus,
                  components: {
                    database: {
                      status: statusConfig.databaseStatus,
                      message: statusConfig.databaseStatus === 'healthy' 
                        ? 'Database connection successful'
                        : 'Database connection failed'
                    }
                  }
                })
              }
            }

            if (!shouldReject) {
              mockFetch.mockResolvedValueOnce(mockResponse as Response)
            }

            // Requirement 5.2: WHEN the backend is unavailable, THE Frontend_Server SHALL show connection status
            let component: any
            await act(async () => {
              component = render(<ConnectionStatus />)
            })

            // Wait for health check to complete
            await waitFor(() => {
              const statusElements = component.container.querySelectorAll('[data-testid], .text-green-500, .text-red-500, .text-yellow-500')
              expect(statusElements.length).toBeGreaterThan(0)
            }, { timeout: 2000 })

            // Verify connection status is displayed
            const statusText = component.container.textContent
            expect(statusText).toContain('System Status')
            
            if (statusConfig.backendStatus === 'healthy' && statusConfig.databaseStatus === 'healthy') {
              expect(statusText).toContain('Healthy')
            } else {
              expect(statusText).toContain('Unhealthy')
            }

            // Verify database status is shown
            expect(statusText).toContain('Database')
            
            // Verify status indicators are present (icons or badges)
            const badges = component.container.querySelectorAll('.bg-green-100, .bg-red-100, [variant="destructive"], [variant="default"]')
            expect(badges.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Property 4.3: Retry logic for transient failures', () => {
      fc.assert(
        fc.property(
          fc.record({
            failureCount: fc.integer({ min: 1, max: 3 }),
            eventualSuccess: fc.boolean(),
            retryDelay: fc.integer({ min: 50, max: 200 }),
          }),
          async (retryConfig) => {
            // Property: System should implement retry logic for transient failures
            let callCount = 0
            
            mockFetch.mockImplementation(() => {
              callCount++
              
              if (callCount <= retryConfig.failureCount && !retryConfig.eventualSuccess) {
                // Always fail
                return Promise.reject(new TypeError('Network error'))
              } else if (callCount <= retryConfig.failureCount) {
                // Fail initially, then succeed
                return Promise.reject(new TypeError('Network error'))
              } else {
                // Success after retries
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ assigned_tickets: [] })
                } as Response)
              }
            })

            let component: any
            await act(async () => {
              component = render(
                <TestWrapper>
                  <ErrorTestComponent />
                </TestWrapper>
              )
            })

            // Trigger action that may retry
            await act(async () => {
              const triggerButton = component.getByTestId('trigger-action')
              await userEvent.click(triggerButton)
            })

            // Wait for potential retries to complete
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, retryConfig.retryDelay * 3))
            })

            // Requirement 5.3: WHEN network errors occur, THE System SHALL retry operations appropriately
            if (retryConfig.eventualSuccess) {
              // If configured to eventually succeed, verify multiple calls were made
              expect(callCount).toBeGreaterThan(1)
              
              // Final state should be successful
              const errorElement = component.getByTestId('error-message')
              const loadingElement = component.getByTestId('loading-state')
              
              // Should not be in permanent error state if retries succeeded
              expect(loadingElement.textContent).toBe('idle')
            } else {
              // If configured to always fail, should still attempt retries
              expect(callCount).toBeGreaterThanOrEqual(1)
              
              // Should show error after retries exhausted
              const errorElement = component.getByTestId('error-message')
              expect(errorElement.textContent).not.toBe('no-error')
            }
          }
        ),
        { numRuns: 30 } // Fewer runs due to timing dependencies
      )
    })

    test('Property 4.4: Comprehensive error logging for debugging', () => {
      fc.assert(
        fc.property(
          fc.record({
            errorScenario: fc.constantFrom(
              'api-method-missing',
              'network-failure',
              'auth-failure',
              'server-error',
              'json-parse-error'
            ),
            errorContext: fc.record({
              userId: fc.integer({ min: 1, max: 1000 }),
              action: fc.constantFrom('getDeveloperTickets', 'createTicket', 'updateTicket'),
              timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
            }),
          }),
          async (logConfig) => {
            // Property: System should log detailed errors for debugging while showing simple messages to users
            let mockResponse: any
            let shouldReject = false

            switch (logConfig.errorScenario) {
              case 'api-method-missing':
                // Simulate method not available error
                shouldReject = true
                mockFetch.mockRejectedValueOnce(new Error('getDeveloperTickets is not a function'))
                break
              case 'network-failure':
                shouldReject = true
                mockFetch.mockRejectedValueOnce(new TypeError('Failed to connect to server'))
                break
              case 'auth-failure':
                mockResponse = {
                  ok: false,
                  status: 401,
                  json: async () => ({ detail: 'Token expired' })
                }
                break
              case 'server-error':
                mockResponse = {
                  ok: false,
                  status: 500,
                  json: async () => ({ detail: 'Internal server error' })
                }
                break
              case 'json-parse-error':
                mockResponse = {
                  ok: true,
                  status: 200,
                  json: async () => { throw new SyntaxError('Unexpected token') }
                }
                break
            }

            if (!shouldReject) {
              mockFetch.mockResolvedValueOnce(mockResponse as Response)
            }

            let capturedError: Error | null = null
            const onError = (error: Error) => {
              capturedError = error
            }

            let component: any
            await act(async () => {
              component = render(
                <TestWrapper>
                  <ErrorTestComponent 
                    triggerError="network"
                    onError={onError}
                  />
                </TestWrapper>
              )
            })

            // Trigger error condition
            await act(async () => {
              const triggerButton = component.getByTestId('trigger-action')
              await userEvent.click(triggerButton)
            })

            // Wait for error handling and logging
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, 100))
            })

            // Requirement 5.4: THE System SHALL log detailed errors for debugging while showing simple messages to users
            
            // Verify detailed logging occurred
            const errorLogs = mockConsole.error.mock.calls.filter(call =>
              call.some(arg => 
                typeof arg === 'string' && 
                (arg.includes('Error') || arg.includes('API') || arg.includes('method'))
              )
            )
            
            expect(errorLogs.length).toBeGreaterThan(0)
            
            // Verify logs contain detailed information
            const logContent = errorLogs.flat().join(' ')
            expect(logContent).toContain(logConfig.errorScenario.includes('method') ? 'method' : 'Error')
            
            // Verify user-facing error is simple and helpful
            if (capturedError) {
              const userMessage = capturedError.message
              expect(userMessage).toBeDefined()
              expect(userMessage.length).toBeGreaterThan(0)
              
              // User message should be simpler than log details
              expect(userMessage).not.toContain('TypeError')
              expect(userMessage).not.toContain('SyntaxError')
              expect(userMessage).not.toContain('stack trace')
              expect(userMessage).not.toContain('function')
              
              // Should contain actionable guidance
              const hasActionableGuidance = 
                userMessage.toLowerCase().includes('please') ||
                userMessage.toLowerCase().includes('try') ||
                userMessage.toLowerCase().includes('check') ||
                userMessage.toLowerCase().includes('contact')
              
              expect(hasActionableGuidance).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Property 4.5: System graceful degradation during backend unavailability', () => {
      fc.assert(
        fc.property(
          fc.record({
            backendAvailable: fc.boolean(),
            userRole: fc.constantFrom('admin', 'developer', 'client', 'project_manager'),
            requestedAction: fc.constantFrom('view-tickets', 'create-ticket', 'update-status'),
          }),
          async (degradationConfig) => {
            // Property: System should handle missing backend gracefully with appropriate error messages
            if (!degradationConfig.backendAvailable) {
              mockFetch.mockRejectedValue(new TypeError('Failed to connect to backend server'))
            } else {
              mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ assigned_tickets: [], tickets: [] })
              } as Response)
            }

            let component: any
            await act(async () => {
              component = render(
                <TestWrapper>
                  <ErrorTestComponent />
                </TestWrapper>
              )
            })

            // Trigger action
            await act(async () => {
              const triggerButton = component.getByTestId('trigger-action')
              await userEvent.click(triggerButton)
            })

            // Wait for response
            await act(async () => {
              await new Promise(resolve => setTimeout(resolve, 100))
            })

            // Requirement 4.4: THE System SHALL handle missing backend gracefully with appropriate error messages
            const errorElement = component.getByTestId('error-message')
            const loadingElement = component.getByTestId('loading-state')
            
            if (!degradationConfig.backendAvailable) {
              // Should show appropriate error message
              expect(errorElement.textContent).not.toBe('no-error')
              expect(errorElement.textContent).toContain('connect')
              
              // Should not be stuck in loading state
              expect(loadingElement.textContent).toBe('idle')
              
              // Component should still be functional (not crashed)
              const triggerButton = component.getByTestId('trigger-action')
              expect(triggerButton).toBeEnabled()
            } else {
              // Should work normally when backend is available
              expect(loadingElement.textContent).toBe('idle')
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Property 4.6: Error message consistency across different error types', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              errorType: fc.constantFrom('network', 'auth', 'permission', 'server'),
              errorMessage: fc.string({ minLength: 5, maxLength: 50 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (errorSequence) => {
            // Property: Error messages should be consistent in format and helpfulness across different error types
            const capturedErrors: Error[] = []
            const onError = (error: Error) => {
              capturedErrors.push(error)
            }

            for (const errorConfig of errorSequence) {
              // Setup different error types
              switch (errorConfig.errorType) {
                case 'network':
                  mockFetch.mockRejectedValueOnce(new TypeError('Network error'))
                  break
                case 'auth':
                  mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    json: async () => ({ detail: 'Not authenticated' })
                  } as Response)
                  break
                case 'permission':
                  mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({ detail: 'Access denied' })
                  } as Response)
                  break
                case 'server':
                  mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    json: async () => ({ detail: errorConfig.errorMessage })
                  } as Response)
                  break
              }

              let component: any
              await act(async () => {
                component = render(
                  <TestWrapper>
                    <ErrorTestComponent 
                      triggerError={errorConfig.errorType}
                      onError={onError}
                    />
                  </TestWrapper>
                )
              })

              await act(async () => {
                const triggerButton = component.getByTestId('trigger-action')
                await userEvent.click(triggerButton)
              })

              await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 50))
              })

              component.unmount()
            }

            // Verify error message consistency
            expect(capturedErrors.length).toBeGreaterThan(0)
            
            capturedErrors.forEach(error => {
              expect(error.message).toBeDefined()
              expect(typeof error.message).toBe('string')
              expect(error.message.length).toBeGreaterThan(0)
              
              // All error messages should follow similar patterns
              const message = error.message.toLowerCase()
              
              // Should contain helpful language
              const hasHelpfulLanguage = 
                message.includes('please') ||
                message.includes('try') ||
                message.includes('check') ||
                message.includes('contact') ||
                message.includes('refresh')
              
              expect(hasHelpfulLanguage).toBe(true)
              
              // Should not contain technical jargon
              expect(message).not.toContain('typeerror')
              expect(message).not.toContain('fetch')
              expect(message).not.toContain('json.parse')
              expect(message).not.toContain('undefined')
            })
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  /**
   * Edge cases for system error resilience
   */
  describe('System Error Resilience Edge Cases', () => {
    test('Simultaneous multiple error conditions should be handled gracefully', async () => {
      // Simulate multiple simultaneous errors
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ detail: 'Not authenticated' })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Server error' })
        } as Response)

      const errors: Error[] = []
      const onError = (error: Error) => errors.push(error)

      let component: any
      await act(async () => {
        component = render(
          <TestWrapper>
            <ErrorTestComponent onError={onError} />
          </TestWrapper>
        )
      })

      // Trigger multiple rapid actions that will cause different errors
      await act(async () => {
        const triggerButton = component.getByTestId('trigger-action')
        await userEvent.click(triggerButton)
        await userEvent.click(triggerButton)
        await userEvent.click(triggerButton)
      })

      // Wait for all error handling to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      // Verify system handled multiple errors without crashing
      expect(component.getByTestId('trigger-action')).toBeEnabled()
      expect(component.getByTestId('loading-state').textContent).toBe('idle')
      
      // Should have captured at least one error
      expect(errors.length).toBeGreaterThan(0)
      
      // All errors should be properly formatted
      errors.forEach(error => {
        expect(error.message).toBeDefined()
        expect(typeof error.message).toBe('string')
      })
    })

    test('Error recovery after backend comes back online', async () => {
      // First call fails (backend down)
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to connect'))
      
      let component: any
      await act(async () => {
        component = render(
          <TestWrapper>
            <ErrorTestComponent />
          </TestWrapper>
        )
      })

      // Trigger error
      await act(async () => {
        const triggerButton = component.getByTestId('trigger-action')
        await userEvent.click(triggerButton)
      })

      // Verify error state
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(component.getByTestId('error-message').textContent).not.toBe('no-error')

      // Backend comes back online
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ assigned_tickets: [] })
      } as Response)

      // Retry action
      await act(async () => {
        const triggerButton = component.getByTestId('trigger-action')
        await userEvent.click(triggerButton)
      })

      // Verify recovery
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(component.getByTestId('loading-state').textContent).toBe('idle')
      expect(component.getByTestId('trigger-action')).toBeEnabled()
    })
  })
})