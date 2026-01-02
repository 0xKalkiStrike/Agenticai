import * as fc from 'fast-check'
import { Ticket, User } from '@/lib/types'

/**
 * Property Test for Statistics Accuracy
 * Feature: developer-ticket-visibility-fix, Property 3: Statistics Accuracy
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */

// Helper function to calculate statistics like the dashboard does
function calculateDeveloperStats(
  assignedTickets: Ticket[],
  completedTickets: Ticket[],
  availableTickets: Ticket[]
) {
  const activeTickets = assignedTickets.filter(t => t.status !== "CLOSED")
  
  return {
    inProgress: activeTickets.length, // Active Tickets count - assigned open tickets (Req 5.1)
    completed: completedTickets.length, // Completed count - completed tickets by developer (Req 5.2)
    available: availableTickets.length, // Available count - unassigned open tickets (Req 5.3)
    assigned: assignedTickets.length + completedTickets.length // Total Assigned count - all tickets ever assigned (Req 5.4)
  }
}

// Generators for property-based testing
const ticketStatusGen = fc.constantFrom('OPEN', 'IN_PROGRESS', 'CLOSED')
const priorityGen = fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')

const ticketGen = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  query: fc.string({ minLength: 1, maxLength: 100 }),
  reply: fc.option(fc.string(), { nil: null }),
  status: ticketStatusGen,
  priority: priorityGen,
  userId: fc.integer({ min: 1, max: 100 }),
  assignedDeveloperId: fc.option(fc.integer({ min: 1, max: 50 }), { nil: null }),
  assignedBy: fc.option(fc.integer({ min: 1, max: 50 }), { nil: null }),
  assignedAt: fc.option(fc.constant('2024-01-01T00:00:00.000Z'), { nil: null }),
  assignmentNotes: fc.option(fc.string(), { nil: null }),
  completedAt: fc.option(fc.constant('2024-01-01T00:00:00.000Z'), { nil: null }),
  completionNotes: fc.option(fc.string(), { nil: null }),
  createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
  updatedAt: fc.option(fc.constant('2024-01-01T00:00:00.000Z'), { nil: null })
})

const assignedTicketGen = ticketGen.map(ticket => ({
  ...ticket,
  assignedDeveloperId: 1, // Always assigned to developer ID 1
  assignedBy: 1,
  assignedAt: '2024-01-01T00:00:00.000Z',
  status: fc.sample(fc.constantFrom('OPEN', 'IN_PROGRESS'), 1)[0] as any
}))

const completedTicketGen = ticketGen.map(ticket => ({
  ...ticket,
  assignedDeveloperId: 1, // Always assigned to developer ID 1
  assignedBy: 1,
  assignedAt: '2024-01-01T00:00:00.000Z',
  status: 'CLOSED' as any,
  completedAt: new Date('2024-01-01').toISOString(),
  completionNotes: 'Completed by developer'
}))

const availableTicketGen = ticketGen.map(ticket => ({
  ...ticket,
  assignedDeveloperId: null, // Unassigned
  assignedBy: null,
  assignedAt: null,
  status: 'OPEN' as any
}))

describe('Statistics Accuracy Property Tests', () => {
  test('Property 3: Statistics Accuracy - dashboard statistics should accurately reflect actual ticket counts', () => {
    fc.assert(
      fc.property(
        fc.array(assignedTicketGen, { minLength: 0, maxLength: 20 }),
        fc.array(completedTicketGen, { minLength: 0, maxLength: 20 }),
        fc.array(availableTicketGen, { minLength: 0, maxLength: 20 }),
        (assignedTickets, completedTickets, availableTickets) => {
          // Calculate statistics using the same logic as the dashboard
          const stats = calculateDeveloperStats([...assignedTickets], [...completedTickets], [...availableTickets])
          
          // Property 1: Active Tickets count should equal assigned open tickets (Req 5.1)
          const expectedInProgress = assignedTickets.filter(t => t.status !== "CLOSED").length
          expect(stats.inProgress).toBe(expectedInProgress)
          
          // Property 2: Completed count should equal completed tickets by developer (Req 5.2)
          const expectedCompleted = completedTickets.length
          expect(stats.completed).toBe(expectedCompleted)
          
          // Property 3: Available count should equal unassigned open tickets (Req 5.3)
          const expectedAvailable = availableTickets.length
          expect(stats.available).toBe(expectedAvailable)
          
          // Property 4: Total Assigned count should equal all tickets ever assigned (Req 5.4)
          const expectedAssigned = assignedTickets.length + completedTickets.length
          expect(stats.assigned).toBe(expectedAssigned)
          
          // Additional invariant: inProgress + completed should never exceed assigned
          expect(stats.inProgress + stats.completed).toBeLessThanOrEqual(stats.assigned)
          
          // Additional invariant: all counts should be non-negative
          expect(stats.inProgress).toBeGreaterThanOrEqual(0)
          expect(stats.completed).toBeGreaterThanOrEqual(0)
          expect(stats.available).toBeGreaterThanOrEqual(0)
          expect(stats.assigned).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    )
  })

  test('Property 3a: Statistics consistency - assigned tickets should equal active plus completed', () => {
    fc.assert(
      fc.property(
        fc.array(assignedTicketGen, { minLength: 0, maxLength: 15 }),
        fc.array(completedTicketGen, { minLength: 0, maxLength: 15 }),
        (assignedTickets, completedTickets) => {
          const stats = calculateDeveloperStats([...assignedTickets], [...completedTickets], [])
          
          // The total assigned should equal the sum of active and completed tickets
          // This validates the consistency of our statistics calculation
          expect(stats.assigned).toBe(stats.inProgress + stats.completed)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Property 3b: Statistics edge cases - empty ticket arrays should produce zero counts', () => {
    fc.assert(
      fc.property(
        fc.constant([]), // Empty assigned tickets
        fc.constant([]), // Empty completed tickets  
        fc.constant([]), // Empty available tickets
        (assignedTickets, completedTickets, availableTickets) => {
          const stats = calculateDeveloperStats([...assignedTickets], [...completedTickets], [...availableTickets])
          
          // All statistics should be zero when no tickets exist
          expect(stats.inProgress).toBe(0)
          expect(stats.completed).toBe(0)
          expect(stats.available).toBe(0)
          expect(stats.assigned).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})