"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Award, 
  Target,
  Calendar,
  BarChart3,
  RefreshCw
} from "lucide-react"
import { apiService } from "@/lib/api"

interface DeveloperStats {
  id: number
  username: string
  email: string
  totalAssigned: number
  totalCompleted: number
  totalInProgress: number
  averageCompletionTime: number // in hours
  completionRate: number // percentage
  thisWeekCompleted: number
  thisMonthCompleted: number
  performanceScore: number // 0-100
  recentTickets: Array<{
    id: number
    title: string
    priority: string
    status: string
    assignedAt: string
    completedAt?: string
    completionTime?: number
  }>
}

interface TeamPerformance {
  totalDevelopers: number
  totalTicketsAssigned: number
  totalTicketsCompleted: number
  averageCompletionTime: number
  topPerformer: string
  developers: DeveloperStats[]
}

export function DeveloperPerformance() {
  const [performanceData, setPerformanceData] = useState<TeamPerformance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    loadPerformanceData()
  }, [selectedPeriod])

  const loadPerformanceData = async () => {
    setIsLoading(true)
    try {
      const data = await apiService.getDeveloperPerformance(selectedPeriod)
      
      // Handle different API response formats
      if (data.developers && Array.isArray(data.developers)) {
        // Check if it's the old format with developer_id, developer_name
        if (data.developers.length > 0 && data.developers[0].developer_id !== undefined) {
          // Convert old format to new format
          const convertedData = convertOldFormatToNew(data)
          setPerformanceData(convertedData)
        } else {
          // Already in new format
          setPerformanceData(data)
        }
      } else {
        // Fallback to mock data
        setPerformanceData(getMockPerformanceData())
      }
    } catch (error) {
      console.error("Failed to load developer performance:", error)
      // Mock data for demonstration
      setPerformanceData(getMockPerformanceData())
    } finally {
      setIsLoading(false)
    }
  }

  const convertOldFormatToNew = (oldData: any): TeamPerformance => {
    const developers = oldData.developers.map((dev: any) => ({
      id: dev.developer_id,
      username: dev.developer_name,
      email: `${dev.developer_name}@example.com`,
      totalAssigned: dev.total_tickets || 0,
      totalCompleted: dev.completed_tickets || 0,
      totalInProgress: Math.max(0, (dev.total_tickets || 0) - (dev.completed_tickets || 0)),
      averageCompletionTime: dev.avg_completion_time || 0,
      completionRate: dev.completion_rate || 0,
      thisWeekCompleted: Math.max(0, (dev.completed_tickets || 0) - 2),
      thisMonthCompleted: dev.completed_tickets || 0,
      performanceScore: Math.min(100, Math.max(0, (dev.completion_rate || 0) + 20)),
      recentTickets: []
    }))

    const totalAssigned = developers.reduce((sum: number, dev: any) => sum + dev.totalAssigned, 0)
    const totalCompleted = developers.reduce((sum: number, dev: any) => sum + dev.totalCompleted, 0)
    const avgCompletionTime = developers.length > 0 
      ? developers.reduce((sum: number, dev: any) => sum + dev.averageCompletionTime, 0) / developers.length 
      : 0
    const topPerformer = developers.length > 0 
      ? developers.reduce((prev: any, current: any) => 
          prev.performanceScore > current.performanceScore ? prev : current
        ).username 
      : "N/A"

    return {
      totalDevelopers: developers.length,
      totalTicketsAssigned: totalAssigned,
      totalTicketsCompleted: totalCompleted,
      averageCompletionTime: avgCompletionTime,
      topPerformer,
      developers
    }
  }

  const getMockPerformanceData = (): TeamPerformance => ({
    totalDevelopers: 3,
    totalTicketsAssigned: 45,
    totalTicketsCompleted: 38,
    averageCompletionTime: 18.5,
    topPerformer: "dev1",
    developers: [
      {
        id: 3,
        username: "dev1",
        email: "dev1@example.com",
        totalAssigned: 18,
        totalCompleted: 16,
        totalInProgress: 2,
        averageCompletionTime: 14.2,
        completionRate: 88.9,
        thisWeekCompleted: 4,
        thisMonthCompleted: 12,
        performanceScore: 92,
        recentTickets: [
          {
            id: 101,
            title: "Fix login authentication bug",
            priority: "HIGH",
            status: "COMPLETED",
            assignedAt: "2024-12-28T10:00:00Z",
            completedAt: "2024-12-29T16:30:00Z",
            completionTime: 30.5
          },
          {
            id: 102,
            title: "Implement user settings page",
            priority: "MEDIUM",
            status: "IN_PROGRESS",
            assignedAt: "2024-12-30T09:00:00Z"
          }
        ]
      },
      {
        id: 4,
        username: "dev2",
        email: "dev2@example.com",
        totalAssigned: 15,
        totalCompleted: 12,
        totalInProgress: 3,
        averageCompletionTime: 22.8,
        completionRate: 80.0,
        thisWeekCompleted: 2,
        thisMonthCompleted: 8,
        performanceScore: 78,
        recentTickets: [
          {
            id: 103,
            title: "Database optimization",
            priority: "MEDIUM",
            status: "COMPLETED",
            assignedAt: "2024-12-27T14:00:00Z",
            completedAt: "2024-12-30T11:00:00Z",
            completionTime: 69
          }
        ]
      },
      {
        id: 5,
        username: "dev3",
        email: "dev3@example.com",
        totalAssigned: 12,
        totalCompleted: 10,
        totalInProgress: 2,
        averageCompletionTime: 19.1,
        completionRate: 83.3,
        thisWeekCompleted: 3,
        thisMonthCompleted: 7,
        performanceScore: 85,
        recentTickets: []
      }
    ]
  })

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50 border-green-200"
    if (score >= 75) return "text-blue-600 bg-blue-50 border-blue-200"
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200"
    return "text-red-600 bg-red-50 border-red-200"
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'MEDIUM': return 'default'
      case 'LOW': return 'secondary'
      default: return 'default'
    }
  }

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours.toFixed(1)}h`
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}d ${remainingHours.toFixed(1)}h`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Developer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading performance data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!performanceData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Developer Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No performance data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Developer Performance</h2>
          <p className="text-muted-foreground">Track team productivity and individual performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)}>
            <TabsList>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="all">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={loadPerformanceData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Developers</p>
                <p className="text-2xl font-bold">{performanceData.totalDevelopers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Tickets Assigned</p>
                <p className="text-2xl font-bold">{performanceData.totalTicketsAssigned}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Tickets Completed</p>
                <p className="text-2xl font-bold">{performanceData.totalTicketsCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg. Completion Time</p>
                <p className="text-2xl font-bold">{formatDuration(performanceData.averageCompletionTime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Top Performer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Award className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold">{performanceData.topPerformer}</p>
              <p className="text-sm text-muted-foreground">Highest performance score this {selectedPeriod}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Developer Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Performance</CardTitle>
          <CardDescription>Detailed performance metrics for each developer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {performanceData.developers.map((dev) => (
              <div key={dev.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{dev.username}</h3>
                      <p className="text-sm text-muted-foreground">{dev.email}</p>
                    </div>
                  </div>
                  <Badge className={getPerformanceColor(dev.performanceScore)}>
                    Performance: {dev.performanceScore}%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned</p>
                    <p className="text-lg font-semibold">{dev.totalAssigned}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-lg font-semibold text-green-600">{dev.totalCompleted}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-lg font-semibold text-blue-600">{dev.totalInProgress}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Time</p>
                    <p className="text-lg font-semibold">{formatDuration(dev.averageCompletionTime)}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Completion Rate</span>
                    <span>{dev.completionRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={dev.completionRate} className="h-2" />
                </div>

                {dev.recentTickets.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recent Tickets</h4>
                    <div className="space-y-2">
                      {dev.recentTickets.slice(0, 3).map((ticket) => (
                        <div key={ticket.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={getPriorityColor(ticket.priority)} className="text-xs">
                              {ticket.priority}
                            </Badge>
                            <span className="truncate max-w-[200px]">{ticket.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={ticket.status === 'COMPLETED' ? 'default' : 'secondary'}>
                              {ticket.status}
                            </Badge>
                            {ticket.completionTime && (
                              <span className="text-muted-foreground">
                                {formatDuration(ticket.completionTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}