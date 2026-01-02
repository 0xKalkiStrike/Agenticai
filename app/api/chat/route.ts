import { NextRequest, NextResponse } from "next/server"

// You can replace this with your actual API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "your-api-key-here"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ChatRequest {
  message: string
  history: Message[]
}

export async function POST(request: NextRequest) {
  console.log("Chat API: Received request")
  
  try {
    const { message, history }: ChatRequest = await request.json()
    console.log("Chat API: Message received:", message)
    console.log("Chat API: History length:", history?.length || 0)

    if (!message?.trim()) {
      console.log("Chat API: Empty message, returning error")
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    console.log("Chat API: Using OpenAI API key:", OPENAI_API_KEY ? "Present" : "Missing")

    // Check for common greetings and provide quick responses
    const lowerMessage = message.toLowerCase().trim()
    const greetingPatterns = [
      { pattern: /^(jai shree krishna|jai shri krishna|jay shree krishna|jay shri krishna)!?$/i, response: "Jai Shree Krishna! 🙏 How can I help you today?" },
      { pattern: /^(namaste|namaskar)!?$/i, response: "Namaste! 🙏 How may I assist you today?" },
      { pattern: /^(assalam alaikum|as-salamu alaikum|assalamu alaikum)!?$/i, response: "Wa alaikum assalam! 🤲 How can I help you today?" },
      { pattern: /^(sat sri akal|sat shri akal)!?$/i, response: "Sat Sri Akal! 🙏 How can I assist you today?" },
      { pattern: /^(adab|adaab)!?$/i, response: "Adab! How may I help you today?" },
      { pattern: /^(vanakkam|vanakam)!?$/i, response: "Vanakkam! 🙏 How can I assist you today?" },
      { pattern: /^(hello|hi|hey|good morning|good afternoon|good evening)!?$/i, response: "Hello! 👋 How can I help you today?" }
    ]

    // Check if message matches any greeting pattern
    for (const { pattern, response } of greetingPatterns) {
      if (pattern.test(lowerMessage)) {
        console.log("Chat API: Detected greeting, sending quick response")
        return NextResponse.json({
          response: response,
          success: true,
          greeting: true
        })
      }
    }

    // Prepare messages for OpenAI API
    const messages = [
      {
        role: "system",
        content: `You are a helpful AI assistant for a technical support system. You help users with their technical questions and provide solutions.

Guidelines:
- Be friendly, professional, and culturally respectful
- ALWAYS respond appropriately to greetings - if someone says "Hello", "Hi", "Namaste", "Jai Shree Krishna", "Assalam Alaikum", or any other greeting, respond with the same greeting back warmly
- For religious/cultural greetings like "Jai Shree Krishna", respond with "Jai Shree Krishna! How can I help you today?"
- For "Namaste", respond with "Namaste! How may I assist you?"
- For "Assalam Alaikum", respond with "Wa alaikum assalam! How can I help you?"
- For general greetings like "Hello" or "Hi", respond warmly like "Hello! How can I assist you today?"
- Be culturally sensitive and respectful of all traditions
- After greeting, always ask how you can help them
- Provide practical solutions when possible
- If you can solve the issue, provide step-by-step instructions
- If the issue is complex or you're unsure, acknowledge that and suggest they may need human support
- Focus on common technical issues like software problems, connectivity issues, account problems, etc.
- Always be helpful and try to provide value

Remember: You're the first line of support, so be warm, respectful, and helpful!`
      },
      // Add conversation history (last 10 messages for context)
      ...history.slice(-10).map(msg => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
      })),
      {
        role: "user",
        content: message
      }
    ]

    console.log("Chat API: Calling OpenAI with", messages.length, "messages")

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    })

    console.log("Chat API: OpenAI response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Chat API: OpenAI API error:", response.status, response.statusText, errorText)
      
      // Return error details for debugging
      return NextResponse.json({
        error: "AI service unavailable",
        details: `OpenAI API error: ${response.status} ${response.statusText}`,
        response: "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again later or I can create a support ticket for you."
      }, { status: 503 })
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."

    console.log("Chat API: Successfully got AI response, length:", aiResponse.length)

    return NextResponse.json({
      response: aiResponse,
      success: true
    })

  } catch (error) {
    console.error("Chat API: Unexpected error:", error)
    
    return NextResponse.json({
      error: "Internal server error",
      response: "I'm sorry, something went wrong on my end. Please try again later."
    }, { status: 500 })
  }
}