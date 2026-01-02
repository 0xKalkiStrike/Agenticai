"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.replace("/login")
      return
    }

    // Redirect based on role
    switch (user?.role) {
      case "admin":
        router.replace("/dashboard/admin")
        break
      case "project_manager":
        router.replace("/dashboard/pm")
        break
      case "developer":
        router.replace("/dashboard/developer")
        break
      case "client":
        router.replace("/dashboard/client")
        break
      default:
        router.replace("/login")
    }
  }, [isAuthenticated, isLoading, user, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
