import os
import json
from typing import Tuple

# Optional OpenAI import (for DeepSeek compatibility)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

# Configuration
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "knowledge_base.json")

client = None
# Initialize DeepSeek client (OpenAI-compatible API)
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
if OPENAI_AVAILABLE and deepseek_api_key:
    client = OpenAI(
        api_key=deepseek_api_key,
        base_url="https://api.deepseek.com"  # DeepSeek API endpoint
    )

# Router Keywords (Triggers for Path B: Escalation)
ESCALATION_KEYWORDS = {
    "error", "crash", "bug", "fail", "broken", "down", 
    "payment", "billing", "charge", "deploy", "server", 
    "database", "critical", "urgent", "hack", "security",
    "not working", "doesn't work", "can't access", "unable to",
    "help me", "stuck", "problem", "issue", "trouble"
}

def load_knowledge_base():
    """Load the knowledge base from JSON file"""
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading KB: {e}")
        return []

def save_knowledge_base(kb):
    """Save the knowledge base to JSON file"""
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w") as f:
            json.dump(kb, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving KB: {e}")
        return False

def add_knowledge_entry(keywords, answer, category="general"):
    """Add a new entry to the knowledge base"""
    kb = load_knowledge_base()
    
    # Normalize keywords
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",")]
    
    entry = {
        "keywords": keywords,
        "answer": answer,
        "category": category
    }
    kb.append(entry)
    save_knowledge_base(kb)
    return entry

def retrieve_context(query):
    """
    Search the knowledge base for relevant context.
    Returns the best matching answer or None.
    """
    kb = load_knowledge_base()
    q_lower = query.lower()
    
    best_match = None
    max_score = 0
    
    for entry in kb:
        score = 0
        for keyword in entry["keywords"]:
            if keyword.lower() in q_lower:
                # Basic scoring: length of keyword * 2 (prioritize specific matches)
                score += len(keyword) * 2
        
        if score > max_score:
            max_score = score
            best_match = entry["answer"]
            
    return best_match

def ask_ai_deepseek(query: str, context: str = None) -> Tuple[str, float]:
    """
    Use DeepSeek API for intelligent responses
    """
    if not client:
        return "DeepSeek API is not available. Please contact support.", 0.3
    
    try:
        # Construct system prompt
        system_prompt = """You are a helpful IT support assistant. Provide clear, concise solutions to technical problems. 
        If you can solve the issue, provide step-by-step instructions. 
        If the issue requires human intervention, suggest creating a support ticket.
        Keep responses under 200 words and be professional."""
        
        if context:
            system_prompt += f"\n\nRELEVANT KNOWLEDGE BASE INFO:\n{context}\n\nUse this information if relevant, but you can also use your general knowledge."
        
        response = client.chat.completions.create(
            model="deepseek-chat",  # DeepSeek's chat model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.3,
            max_tokens=300
        )
        
        answer = response.choices[0].message.content
        confidence = 0.85  # High confidence for DeepSeek responses
        
        return answer, confidence
        
    except Exception as e:
        print(f"DeepSeek API Error: {e}")
        return f"I'm having trouble connecting to my advanced AI system. Please try again or contact support.", 0.3
def ask_ai_hybrid(q: str) -> Tuple[str, float]:
    """
    Hybrid AI approach: Knowledge Base first, then DeepSeek API
    """
    context = retrieve_context(q)
    
    # First try: Knowledge base (fast, basic solution)
    if context:
        return f"💡 {context}", 0.75
    
    # Second try: DeepSeek API (intelligent response)
    if client:
        return ask_ai_deepseek(q, context)
    
    # Fallback
    return "I'm not sure about that. Please provide more details or I can create a support ticket for you.", 0.4

def ask_ai(q: str) -> Tuple[str, float]:
    """
    Legacy function - now uses hybrid approach
    """
    return ask_ai_hybrid(q)

def needs_human(q, conf):
    """
    Router Agent Logic.
    Decides if the query should be escalated to a human (Path B).
    """
    q_lower = q.lower()
    
    # Check for escalation keywords
    has_keywords = any(k in q_lower for k in ESCALATION_KEYWORDS)
    
    # Low confidence AI response also triggers escalation
    is_low_confidence = conf < 0.6
    
    return has_keywords or is_low_confidence
