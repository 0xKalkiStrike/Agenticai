"use client"

import { useState } from "react"
import { format } from "date-fns"
import type { Ticket, User, AssignmentConflict } from "@/lib/types"
import { StatusBadge, PriorityBadge } from "@/components/ticket-badge"
import { AssignmentStatus, AssignmentLockBadge } from "@/components/assignment-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, UserPlus, CheckCircle, ArrowRight, X, AlertTriangle } from "lucide-react"

interface TicketTableProps {
  tickets: Ticket[]
  developers?: User[]
  showAssign?: boolean
  showComplete?: boolean
  showDeveloperActions?: boolean
  currentUserId?: number
  currentUserRole?: string
  assignmentConflicts?: AssignmentConflict[]
  onAssign?: (ticketId: number, developerId: number, notes: string) => void
  onComplete?: (ticketId: number, notes: string) => void
  onSelfAssign?: (ticketId: number) => void
  onPass?: (ticketId: number, reason: string) => void
  onCancel?: (ticketId: number, reason: string) => void
  onOverrideLock?: (ticketId: number) => void
  onDismissConflict?: (conflictId: string) => void
}

export function TicketTable({
  tickets,
  developers = [],
  showAssign = false,
  showComplete = false,
  showDeveloperActions = false,
  currentUserId,
  currentUserRole,
  assignmentConflicts = [],
  onAssign,
  onComplete,
  onSelfAssign,
  onPass,
  onCancel,
  onOverrideLock,
  onDismissConflict,
}: TicketTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [passDialogOpen, setPassDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [selectedDeveloper, setSelectedDeveloper] = useState("")
  const [notes, setNotes] = useState("")

  const resetDialogState = () => {
    setSelectedTicket(null)
    setNotes("")
  }

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.query?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.id.toString().includes(search)

    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })



  const handleAssign = () => {
    if (!selectedTicket || !selectedDeveloper || !onAssign) return
    onAssign(selectedTicket.id, Number(selectedDeveloper), notes)
    setAssignDialogOpen(false)
    resetDialogState()
  }

  const handleComplete = () => {
    if (!selectedTicket || !notes.trim() || !onComplete) return
    onComplete(selectedTicket.id, notes)
    setCompleteDialogOpen(false)
    resetDialogState()
  }

  const handlePass = () => {
    if (!selectedTicket || !onPass || !notes.trim()) return
    onPass(selectedTicket.id, notes)
    setPassDialogOpen(false)
    resetDialogState()
  }

  const handleCancel = () => {
    if (!selectedTicket || !onCancel || !notes.trim()) return
    onCancel(selectedTicket.id, notes)
    setCancelDialogOpen(false)
    resetDialogState()
  }

  const getTicketConflicts = (ticketId: number) =>
    assignmentConflicts.filter(conf => conf.ticketId === ticketId)

  const isAssignmentDisabled = (ticket: Ticket): boolean => {
    const hasActiveLock = ticket.assignmentLock?.isActive
    const isOwner = ticket.assignmentLock?.lockedBy === currentUserId
    return Boolean(hasActiveLock && !isOwner)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead>Query</TableHead>
              <TableHead className="hidden md:table-cell">Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
              <TableHead className="hidden xl:table-cell">Assignment Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              {(showAssign || showComplete || onSelfAssign || showDeveloperActions) && (
                <TableHead className="w-[200px]">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => {
                const ticketConflicts = getTicketConflicts(ticket.id)
                const assignmentDisabled = isAssignmentDisabled(ticket)

                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">#{ticket.id}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="truncate">{ticket.query}</p>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell">{ticket.clientName || "-"}</TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>

                    {/* Developer Cell */}
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span>{ticket.developerName || "-"}</span>
                        {ticket.assignmentLock && (
                          <AssignmentLockBadge
                            assignmentLock={ticket.assignmentLock}
                            isOwner={ticket.assignmentLock.lockedBy === currentUserId}
                          />
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      <AssignmentStatus
                        ticketId={ticket.id}
                        assignmentLock={ticket.assignmentLock}
                        conflicts={ticketConflicts}
                        currentUserId={currentUserId}
                        currentUserRole={currentUserRole}
                        onOverrideLock={onOverrideLock}
                        onDismissConflict={onDismissConflict}
                      />
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy") : "-"}
                    </TableCell>

                    {/* Actions */}
                    {(showAssign || showComplete || onSelfAssign || showDeveloperActions) && (
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Other Action Buttons */}
                          {showDeveloperActions && ticket.assignedDeveloperId && ticket.status !== "CLOSED" && (
                            <>
                              <Button size="sm" variant="outline" disabled={assignmentDisabled}
                                title="Pass ticket to another developer"
                                onClick={() => { setSelectedTicket(ticket); setPassDialogOpen(true) }}>
                                <ArrowRight className="h-4 w-4" />
                              </Button>

                              <Button size="sm" variant="outline" disabled={assignmentDisabled}
                                title="Cancel ticket"
                                onClick={() => { setSelectedTicket(ticket); setCancelDialogOpen(true) }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {showAssign && !ticket.assignedDeveloperId && (
                            <Button size="sm" variant="outline" disabled={assignmentDisabled}
                              title="Assign ticket"
                              onClick={() => { setSelectedTicket(ticket); setAssignDialogOpen(true) }}>
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}

                          {onSelfAssign && !ticket.assignedDeveloperId && (
                            <Button size="sm" variant="outline" disabled={assignmentDisabled}
                              title="Self-assign ticket"
                              onClick={() => onSelfAssign(ticket.id)}>
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}

                          {showComplete && ticket.status !== "CLOSED" && ticket.assignedDeveloperId && (
                            <Button size="sm" variant="outline" disabled={assignmentDisabled}
                              title="Complete ticket"
                              onClick={() => { setSelectedTicket(ticket); setCompleteDialogOpen(true) }}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ------------------- DIALOGS ------------------- */}

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Ticket #{selectedTicket?.id}</DialogTitle>
            <DialogDescription>Select a developer and add optional notes.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Developer</Label>
              <Select value={selectedDeveloper} onValueChange={setSelectedDeveloper}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a developer" />
                </SelectTrigger>
                <SelectContent>
                  {developers.length === 0 ? (
                    <SelectItem value="no-developers" disabled>No developers available</SelectItem>
                  ) : (
                    developers.map((dev) => (
                      <SelectItem key={dev.id} value={String(dev.id)}>
                        {dev.username} ({dev.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedDeveloper}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close / Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Ticket #{selectedTicket?.id}</DialogTitle>
            <DialogDescription>Add completion notes before closing.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full border p-2 rounded" placeholder="Describe the resolution..." />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleComplete} disabled={!notes.trim()}>Close Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pass Dialog */}
      <Dialog open={passDialogOpen} onOpenChange={setPassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pass Ticket #{selectedTicket?.id}</DialogTitle>
            <DialogDescription>Why are you passing this ticket to another developer?</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea 
              placeholder="Explain why you cannot resolve this ticket (e.g., requires different expertise, missing information, etc.)..."
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              rows={4} 
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPassDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePass} disabled={!notes.trim()}>Pass Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Ticket #{selectedTicket?.id}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                This will close the ticket and notify the client.
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Cancellation</Label>
              <Textarea
                placeholder="Explain why this ticket cannot be resolved (e.g., duplicate request, invalid requirement, client unresponsive, etc.)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={dialogConfig.type === 'assign' ? !selectedDeveloper || !notes.trim() : !notes.trim()}
              className={`px-6 ${
                dialogConfig.type === 'pass' ? 'bg-orange-600 hover:bg-orange-700' :
                dialogConfig.type === 'complete' ? 'bg-green-600 hover:bg-green-700' :
                dialogConfig.type === 'cancel' ? 'bg-red-600 hover:bg-red-700' :
                'bg-blue-600 hover:bg-blue-700' 
              } text-white`}
            >
              {dialogConfig.type === 'pass' ? 'Pass Ticket' : 
               dialogConfig.type === 'complete' ? 'Mark as Resolved' :
               dialogConfig.type ? `Confirm ${dialogConfig.type.charAt(0).toUpperCase() + dialogConfig.type.slice(1)}` : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}