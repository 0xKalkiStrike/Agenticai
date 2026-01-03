"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface User {
  id: number
  username: string
  email: string
  role: string
  createdAt?: string
  lastLogin?: string | null
  isActive: boolean
}

interface UserActionButtonsProps {
  user: User
  currentUserId: number
  onActivate: (userId: number) => Promise<void>
  onDeactivate: (userId: number) => Promise<void>
  isLoading: boolean
}

export function UserActionButtons({
  user,
  currentUserId,
  onActivate,
  onDeactivate,
  isLoading
}: UserActionButtonsProps) {
  const [operationLoading, setOperationLoading] = useState(false)

  // Don't show buttons for current user (prevent self-deactivation)
  if (user.id === currentUserId) {
    return (
      <span className="text-sm text-muted-foreground">
        Current User
      </span>
    )
  }

  const handleActivate = async () => {
    if (operationLoading || isLoading) return
    
    try {
      setOperationLoading(true)
      await onActivate(user.id)
    } catch (error) {
      console.error('Failed to activate user:', error)
    } finally {
      setOperationLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (operationLoading || isLoading) return
    
    try {
      setOperationLoading(true)
      await onDeactivate(user.id)
    } catch (error) {
      console.error('Failed to deactivate user:', error)
    } finally {
      setOperationLoading(false)
    }
  }

  const isButtonLoading = operationLoading || isLoading

  if (user.isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDeactivate}
        disabled={isButtonLoading}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        {isButtonLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Deactivating...
          </>
        ) : (
          'Deactivate'
        )}
      </Button>
    )
  } else {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleActivate}
        disabled={isButtonLoading}
        className="text-green-600 hover:text-green-700 hover:bg-green-50"
      >
        {isButtonLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Activating...
          </>
        ) : (
          'Activate'
        )}
      </Button>
    )
  }
}