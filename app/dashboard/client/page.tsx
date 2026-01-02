// "use client"

// import { useState, useEffect, useRef } from "react"
// import { DashboardLayout } from "@/components/dashboard-layout"
// import { useAuth } from "@/lib/auth-context"
// import { apiService } from "@/lib/api"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Badge } from "@/components/ui/badge"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { 
//   Send, 
//   Bot, 
//   User, 
//   Ticket, 
//   Clock, 
//   CheckCircle, 
//   AlertCircle,
//   Loader2
// } from "lucide-react"
// import { format } from "date-fns"
// import { toast } from "sonner"

// interface Message {
//   id: string
//   content: string
//   role: "user" | "assistant"
//   timestamp: Date
// }

// interface ClientTicket {
//   id: number
//   query: string
//   reply: string | null
//   status: "OPEN" | "IN_PROGRESS" | "CLOSED"
//   priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
//   created_at: string
//   developer_name?: string
// }

// export default function ClientDashboard() {
//   const { } = useAuth()
//   const [messages, setMessages] = useState<Message[]>([])
//   const [inputMessage, setInputMessage] = useState("")
//   const [isLoading, setIsLoading] = useState(false)
//   const [tickets, setTickets] = useState<ClientTicket[]>([])
//   const [isLoadingTickets, setIsLoadingTickets] = useState(false)
//   const messagesEndRef = useRef<HTMLDivElement>(null)

//   useEffect(() => {
//     loadClientTickets()
//     loadChatHistory()
//   }, [])

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages])

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }

//   const loadClientTickets = async () => {
//     try {
//       setIsLoadingTickets(true)
//       const response = await apiService.getClientTickets()
//       setTickets(response.tickets || [])
//     } catch (error) {
//       console.error("Failed to load tickets:", error)
//       toast.error("Failed to load tickets")
//     } finally {
//       setIsLoadingTickets(false)
//     }
//   }

//   const loadChatHistory = async () => {
//     try {
//       const response = await apiService.getChatHistory()
//       const history = response.chat_history || []
      
//       // Convert database history to message format and prepend to messages
//       const historyMessages: Message[] = []
      
//       // Add welcome message first
//       historyMessages.push({
//         id: "welcome",
//         content: "Hello! I'm your intelligent AI assistant. I can help you with technical questions, troubleshooting, and general support. If I can't solve your issue, I'll automatically create a support ticket and connect you with our expert team. How can I assist you today?",
//         role: "assistant",
//         timestamp: new Date()
//       })
      
//       // Add history in chronological order (reverse the DESC order from database)
//       history.reverse().forEach((chat: any, index: number) => {
//         // Add user message
//         historyMessages.push({
//           id: `history-user-${chat.id}`,
//           content: chat.message,
//           role: "user",
//           timestamp: new Date(chat.created_at)
//         })
        
//         // Add AI response
//         historyMessages.push({
//           id: `history-ai-${chat.id}`,
//           content: chat.response,
//           role: "assistant",
//           timestamp: new Date(chat.created_at)
//         })
//       })
      
//       setMessages(historyMessages)
//     } catch (error) {
//       console.error("Failed to load chat history:", error)
//       // Don't show error toast for chat history, just use default welcome message
//     }
//   }

//   const sendMessage = async () => {
//     if (!inputMessage.trim() || isLoading) return

//     const userMessage: Message = {
//       id: Date.now().toString(),
//       content: inputMessage.trim(),
//       role: "user",
//       timestamp: new Date()
//     }

//     setMessages(prev => [...prev, userMessage])
//     setInputMessage("")
//     setIsLoading(true)

//     try {
//       const response = await apiService.sendChatMessage(inputMessage.trim())
      
//       const assistantMessage: Message = {
//         id: (Date.now() + 1).toString(),
//         content: response.message,
//         role: "assistant",
//         timestamp: new Date()
//       }

//       setMessages(prev => [...prev, assistantMessage])
      
//       // If a ticket was created, show success notification and refresh tickets
//       if (response.ticket_created) {
//         toast.success(`🎫 Support ticket #${response.ticket_id} created automatically!`)
//         await loadClientTickets() // Refresh the tickets list
//       }
      
//       // Show confidence level for debugging (optional)
//       if (response.confidence && response.confidence < 0.6) {
//         console.log(`Low confidence response: ${response.confidence}`)
//       }
      
//     } catch (error) {
//       console.error("Failed to send message:", error)
//       const errorMessage: Message = {
//         id: (Date.now() + 1).toString(),
//         content: "I'm sorry, I'm having trouble connecting right now. Please try again later or our system will automatically create a support ticket for you.",
//         role: "assistant",
//         timestamp: new Date()
//       }
//       setMessages(prev => [...prev, errorMessage])
//       toast.error("Failed to send message")
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault()
//       sendMessage()
//     }
//   }

//   const ticketStats = {
//     total: tickets.length,
//     open: tickets.filter(t => t.status === "OPEN").length,
//     inProgress: tickets.filter(t => t.status === "IN_PROGRESS").length,
//     closed: tickets.filter(t => t.status === "CLOSED").length
//   }

//   const getPriorityColor = (priority: string) => {
//     switch (priority) {
//       case "CRITICAL": return "bg-red-500"
//       case "HIGH": return "bg-orange-500"
//       case "MEDIUM": return "bg-yellow-500"
//       case "LOW": return "bg-green-500"
//       default: return "bg-gray-500"
//     }
//   }

//   const getStatusIcon = (status: string) => {
//     switch (status) {
//       case "OPEN": return <Clock className="h-4 w-4" />
//       case "IN_PROGRESS": return <AlertCircle className="h-4 w-4" />
//       case "CLOSED": return <CheckCircle className="h-4 w-4" />
//       default: return <Clock className="h-4 w-4" />
//     }
//   }

//   return (
//     <DashboardLayout allowedRoles={["client"]}>
//       <div className="space-y-6">
//         <div>
//           <h1 className="text-3xl font-bold tracking-tight">Client Dashboard</h1>
//           <p className="text-muted-foreground">
//             Chat with AI assistant and manage your support tickets
//           </p>
//         </div>

//         {/* Stats */}
//         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
//           <Card>
//             <CardContent className="pt-6">
//               <div className="flex items-center gap-4">
//                 <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
//                   <Ticket className="h-5 w-5" />
//                 </div>
//                 <div>
//                   <p className="text-2xl font-bold">{ticketStats.total}</p>
//                   <p className="text-xs text-muted-foreground">Total Tickets</p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
          
//           <Card>
//             <CardContent className="pt-6">
//               <div className="flex items-center gap-4">
//                 <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
//                   <Clock className="h-5 w-5" />
//                 </div>
//                 <div>
//                   <p className="text-2xl font-bold">{ticketStats.open}</p>
//                   <p className="text-xs text-muted-foreground">Open Tickets</p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
          
//           <Card>
//             <CardContent className="pt-6">
//               <div className="flex items-center gap-4">
//                 <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
//                   <AlertCircle className="h-5 w-5" />
//                 </div>
//                 <div>
//                   <p className="text-2xl font-bold">{ticketStats.inProgress}</p>
//                   <p className="text-xs text-muted-foreground">In Progress</p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
          
//           <Card>
//             <CardContent className="pt-6">
//               <div className="flex items-center gap-4">
//                 <div className="p-2 rounded-lg bg-green-100 text-green-600">
//                   <CheckCircle className="h-5 w-5" />
//                 </div>
//                 <div>
//                   <p className="text-2xl font-bold">{ticketStats.closed}</p>
//                   <p className="text-xs text-muted-foreground">Completed</p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         <div className="grid gap-6 lg:grid-cols-2">
//           {/* AI Chat */}
//           <Card className="lg:col-span-1">
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Bot className="h-5 w-5" />
//                 AI Assistant
//               </CardTitle>
//               <CardDescription>
//                 Get instant help - I'll create tickets automatically when needed
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ScrollArea className="h-[400px] w-full border rounded-lg p-4">
//                 <div className="space-y-4">
//                   {messages.map((message) => (
//                     <div
//                       key={message.id}
//                       className={`flex gap-3 ${
//                         message.role === "user" ? "justify-end" : "justify-start"
//                       }`}
//                     >
//                       <div
//                         className={`flex gap-3 max-w-[80%] ${
//                           message.role === "user" ? "flex-row-reverse" : "flex-row"
//                         }`}
//                       >
//                         <div
//                           className={`w-8 h-8 rounded-full flex items-center justify-center ${
//                             message.role === "user"
//                               ? "bg-blue-500 text-white"
//                               : "bg-gray-100 text-gray-600"
//                           }`}
//                         >
//                           {message.role === "user" ? (
//                             <User className="h-4 w-4" />
//                           ) : (
//                             <Bot className="h-4 w-4" />
//                           )}
//                         </div>
//                         <div
//                           className={`rounded-lg p-3 ${
//                             message.role === "user"
//                               ? "bg-blue-500 text-white"
//                               : "bg-gray-100 text-gray-900"
//                           }`}
//                         >
//                           <p className="text-sm whitespace-pre-wrap">{message.content}</p>
//                           <p
//                             className={`text-xs mt-1 ${
//                               message.role === "user" ? "text-blue-100" : "text-gray-500"
//                             }`}
//                           >
//                             {format(message.timestamp, "HH:mm")}
//                           </p>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                   {isLoading && (
//                     <div className="flex gap-3 justify-start">
//                       <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
//                         <Bot className="h-4 w-4" />
//                       </div>
//                       <div className="bg-gray-100 rounded-lg p-3">
//                         <div className="flex items-center gap-2">
//                           <Loader2 className="h-4 w-4 animate-spin" />
//                           <span className="text-sm text-gray-600">AI is thinking...</span>
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                   <div ref={messagesEndRef} />
//                 </div>
//               </ScrollArea>
              
//               <div className="flex gap-2">
//                 <Input
//                   placeholder="Type your message..."
//                   value={inputMessage}
//                   onChange={(e) => setInputMessage(e.target.value)}
//                   onKeyPress={handleKeyPress}
//                   disabled={isLoading}
//                 />
//                 <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
//                   <Send className="h-4 w-4" />
//                 </Button>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Support Tickets */}
//           <Card className="lg:col-span-1">
//             <CardHeader>
//               <div>
//                 <CardTitle className="flex items-center gap-2">
//                   <Ticket className="h-5 w-5" />
//                   Support Tickets
//                 </CardTitle>
//                 <CardDescription>
//                   Your support requests and AI-created tickets
//                 </CardDescription>
//               </div>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ScrollArea className="h-[400px]">
//                 <div className="space-y-3">
//                   {isLoadingTickets ? (
//                     <div className="flex items-center justify-center py-8">
//                       <Loader2 className="h-6 w-6 animate-spin" />
//                     </div>
//                   ) : tickets.length === 0 ? (
//                     <div className="text-center py-8 text-muted-foreground">
//                       <p>No tickets yet.</p>
//                       <p className="text-sm mt-1">When the AI assistant can't solve your query, it will automatically create a ticket for you.</p>
//                     </div>
//                   ) : (
//                     tickets.map((ticket) => (
//                       <Card key={ticket.id}>
//                         <CardContent className="pt-4">
//                           <div className="space-y-2">
//                             <div className="flex items-center justify-between">
//                               <div className="flex items-center gap-2">
//                                 {getStatusIcon(ticket.status)}
//                                 <span className="font-medium">Ticket #{ticket.id}</span>
//                               </div>
//                               <div className="flex items-center gap-2">
//                                 <Badge className={`text-white ${getPriorityColor(ticket.priority)}`}>
//                                   {ticket.priority}
//                                 </Badge>
//                                 <Badge variant="outline">
//                                   {ticket.status}
//                                 </Badge>
//                               </div>
//                             </div>
//                             <p className="text-sm text-muted-foreground line-clamp-2">
//                               {ticket.query}
//                             </p>
//                             {ticket.developer_name && (
//                               <p className="text-xs text-muted-foreground">
//                                 Assigned to: {ticket.developer_name}
//                               </p>
//                             )}
//                             <p className="text-xs text-muted-foreground">
//                               Created: {format(new Date(ticket.created_at), "MMM d, yyyy HH:mm")}
//                             </p>
//                             {ticket.reply && (
//                               <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-500">
//                                 <p className="text-sm text-green-800">{ticket.reply}</p>
//                               </div>
//                             )}
//                           </div>
//                         </CardContent>
//                       </Card>
//                     ))
//                   )}
//                 </div>
//               </ScrollArea>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </DashboardLayout>
//   )
// }


"use client"

import { useState, useEffect, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useTickets } from "@/lib/ticket-context"
import { apiService } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Send, 
  Bot, 
  User, 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Sparkles
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ClientTicket {
  id: number
  query: string
  reply: string | null
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  created_at: string
}

export default function ClientDashboard() {
  const { user } = useAuth()
  const { subscribeToTicketUpdates } = useTickets()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [tickets, setTickets] = useState<ClientTicket[]>([])
  const [sessionId, setSessionId] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadClientTickets()
    loadChatHistory()
    // Generate session ID for this chat session
    setSessionId(`session_${user?.id}_${Date.now()}`)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Subscribe to real-time ticket updates
  useEffect(() => {
    const unsubscribe = subscribeToTicketUpdates(() => {
      // Refresh client tickets when updates occur
      loadClientTickets()
    })

    return unsubscribe
  }, [subscribeToTicketUpdates])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadClientTickets = async () => {
    try {
      const response = await apiService.getClientTickets()
      setTickets(response.tickets || [])
    } catch (error) {
      console.error("Failed to load tickets:", error)
    }
  }

  const loadChatHistory = async () => {
    try {
      const response = await apiService.getChatHistory()
      const history = response.chat_history || []
      
      const historyMessages: Message[] = []
      
      // Add welcome message
      historyMessages.push({
        id: "welcome",
        content: `Namaste, Jai Shree Krishna ${user?.username || 'there'}! 🙏 I'm your AI support assistant powered by advanced AI. How can I help you today?`,
        role: "assistant",
        timestamp: new Date()
      })
      
      history.reverse().forEach((chat: any) => {
        historyMessages.push({
          id: `history-user-${chat.id}`,
          content: chat.message,
          role: "user",
          timestamp: new Date(chat.created_at)
        })
        historyMessages.push({
          id: `history-ai-${chat.id}`,
          content: chat.response,
          role: "assistant",
          timestamp: new Date(chat.created_at)
        })
      })
      
      setMessages(historyMessages)
    } catch (error) {
      console.error("Failed to load chat history:", error)
      // Set default welcome message if history fails
      setMessages([{
        id: "welcome",
        content: `Namaste, Jai Shree Krishna ! 🙏 I'm your AI support assistant powered by advanced AI. How can I help you today?`,
        role: "assistant",
        timestamp: new Date()
      }])
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      role: "user",
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage("")
    setIsLoading(true)

    try {
      // Call the frontend Next.js API route instead of backend
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.slice(-10) // Send last 10 messages for context
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant",
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Show different notifications based on response type
      if (data.greeting) {
        toast.success("🙏 Greeting Received", {
          description: "AI responded to your greeting warmly!"
        })
      } else {
        toast.success("🤖 AI Response", {
          description: "Got an intelligent response from AI assistant."
        })
      }
      
    } catch (error) {
      console.error("Failed to send message:", error)
      
      // Try to create a ticket as fallback
      try {
        const ticketResponse = await apiService.createTicket({
          query: userMessage.content,
          priority: "MEDIUM"
        })
        
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I'm having trouble with my AI service right now, but I've created a support ticket for you. Our team will help you soon!",
          role: "assistant",
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        
        toast.success("🎫 Support Ticket Created", {
          description: "AI is unavailable, but we've created a ticket for you."
        })
        
        loadClientTickets() // Refresh tickets
        
      } catch (ticketError) {
        console.error("Failed to create fallback ticket:", ticketError)
        
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I'm having trouble connecting right now. Please try again later or contact support directly.",
          role: "assistant",
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        
        toast.error("Connection failed")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "OPEN").length,
    inProgress: tickets.filter(t => t.status === "IN_PROGRESS").length,
    closed: tickets.filter(t => t.status === "CLOSED").length
  }

  return (
    <DashboardLayout allowedRoles={["client"]}>
      <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 max-w-5xl mx-auto">
        
        {/* Header & Stats Compact Row */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support Assistant</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered help desk. We create tickets automatically if needed.
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 shadow-sm">
              <Ticket className="h-4 w-4" />
              <span className="text-sm font-medium">{ticketStats.total} Total</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full border border-orange-100 shadow-sm">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">{ticketStats.open} Open</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 shadow-sm">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{ticketStats.closed} Solved</span>
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-md">
          <CardHeader className="py-4 px-6 border-b bg-slate-50/50 flex flex-row items-center gap-3 space-y-0 shrink-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base">Support Bot</CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-muted-foreground">Online & Ready to help</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-0 overflow-hidden relative flex flex-col">
            <ScrollArea className="flex-1 p-4 md:p-6 bg-slate-50/30">
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-1">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    
                    <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <div
                        className={`rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${
                          message.role === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                        }`}
                      >
                        {message.content}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1 px-1">
                        {format(message.timestamp, "h:mm a")}
                      </span>
                    </div>

                    {message.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 mt-1">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-4 justify-start">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-1">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 bg-white border-t shrink-0">
              <div className="max-w-3xl mx-auto flex gap-3 relative">
                <Input
                  placeholder="Type your issue here..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="pr-12 h-12 rounded-xl border-slate-200 focus-visible:ring-indigo-500 shadow-sm"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={isLoading || !inputMessage.trim()}
                  className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 p-0 shadow-sm transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                AI can make mistakes. Critical issues are automatically forwarded to support staff.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  )
}