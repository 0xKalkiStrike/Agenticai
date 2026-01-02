import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Ticket } from "@/lib/types"

interface StatusBadgeProps {
  status: Ticket["status"]
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium",
        status === "OPEN" && "bg-blue-500/15 text-blue-600 hover:bg-blue-500/20",
        status === "IN_PROGRESS" && "bg-amber-500/15 text-amber-600 hover:bg-amber-500/20",
        status === "CLOSED" && "bg-slate-500/15 text-slate-600 hover:bg-slate-500/20",
      )}
    >
      {status.replace("_", " ")}
    </Badge>
  )
}

interface PriorityBadgeProps {
  priority: Ticket["priority"]
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium",
        priority === "LOW" && "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20",
        priority === "MEDIUM" && "bg-amber-500/15 text-amber-600 hover:bg-amber-500/20",
        priority === "HIGH" && "bg-orange-500/15 text-orange-600 hover:bg-orange-500/20",
        priority === "CRITICAL" && "bg-red-500/15 text-red-600 hover:bg-red-500/20",
      )}
    >
      {priority}
    </Badge>
  )
}
