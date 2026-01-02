"use client"

import { useState, useEffect } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Lock, Clock, User, AlertTriangle, X } from "lucide-react"
import type { AssignmentLock, AssignmentConflict } from "@/lib/types"

interface AssignmentStatusProps {
  ticketId: number
  assignmentLock?: AssignmentLock | null
  conflicts?: AssignmentConflict[]
  currentUserId?: number
  currentUserRole?: string
  onOverrideLock?: (ticketId: number) => void
  onDismissConflict?: (conflictId: string) => void
}

export function AssignmentStatus({
  ticketId,
  assignmentLock,
  conflicts = [],
  currentUserId,
  currentUserRole,
  onOverrideLock,
  onDismissConflict,
}: AssignmentStatusProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("")

  // Update time remaining for active locks
  useEffect(() => {
    if (!assignmentLock?.isActive) return

    const updateTimeRemaining = () => {
      const expiresAt = new Date(assignmentLock.expiresAt)
      const now = new Date()
      
      if (expiresAt <= now) {
        setTimeRemaining("Expired")
        return
      }

      const remaining = formatDistanceToNow(expiresAt, { addSuffix: false })
      setTimeRemaining(remaining)
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [assignmentLock])

  const isLockOwner = assignmentLock?.lockedBy === currentUserId
  const canOverrideLock = currentUserRole === "admin" && !isLockOwner && assignmentLock?.isActive

  return (
    <div className="space-y-2">
      {/* Assignment Lock Status */}
      {assignmentLock?.isActive && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {isLockOwner ? "You're assigning" : "Being assigned"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>{assignmentLock.lockedByName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Expires in {timeRemaining}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Locked at {format(new Date(assignmentLock.lockedAt), "HH:mm:ss")}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {canOverrideLock && onOverrideLock && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOverrideLock(ticketId)}
              className="h-6 px-2 text-xs"
            >
              Override
            </Button>
          )}
        </div>
      )}

      {/* Assignment Conflicts */}
      {conflicts.length > 0 && (
        <div className="space-y-1">
          {conflicts.map((conflict) => (
            <Alert key={conflict.id} variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm">{conflict.message}</span>
                  {conflict.involvedUsers.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Involved: {conflict.involvedUsers.join(", ")}
                    </div>
                  )}
                </div>
                {onDismissConflict && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDismissConflict(conflict.id)}
                    className="h-6 w-6 p-0 ml-2"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  )
}

export function AssignmentLockBadge({ 
  assignmentLock, 
  isOwner = false 
}: { 
  assignmentLock: AssignmentLock
  isOwner?: boolean 
}) {
  if (!assignmentLock.isActive) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={isOwner ? "default" : "secondary"} 
            className="flex items-center gap-1 text-xs"
          >
            <Lock className="h-3 w-3" />
            {isOwner ? "Assigning" : "Locked"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div>Locked by: {assignmentLock.lockedByName}</div>
            <div>Expires: {format(new Date(assignmentLock.expiresAt), "HH:mm:ss")}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}