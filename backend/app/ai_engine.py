"""
AI Engine Module
Handles AI-powered responses using knowledge base and DeepSeek API
"""

import json
import os
from typing import Optional, Dict, List, Tuple

# Optional OpenAI import (for DeepSeek compatibility)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

class AIEngine:
    """AI Engine for processing support queries"""
    
    # Keywords that trigger escalation to human support
    ESCALATION_KEYWORDS = {
        "error", "crash", "bug", "fail", "broken", "down",
        "payment", "billing", "charge", "deploy", "server",
        "database", "critical", "urgent", "hack", "security",
        "not working", "help", "emergency"
    }
    
    def __init__(self, knowledge_base_path: str = None):
        self.knowledge_base = []
        self.kb_path = knowledge_base_path or os.path.join(
            os.path.dirname(__file__), 
            "data", 
            "knowledge_base.json"
        )
        self._load_knowledge_base()
        
        # Initialize DeepSeek client
        self.client = None
        deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        if OPENAI_AVAILABLE and deepseek_api_key:
            self.client = OpenAI(
                api_key=deepseek_api_key,
                base_url="https://api.deepseek.com"
            )
    
    def _load_knowledge_base(self):
        """Load knowledge base from JSON file"""
        if os.path.exists(self.kb_path):
            try:
                with open(self.kb_path, "r") as f:
                    self.knowledge_base = json.load(f)
            except Exception as e:
                print(f"Error loading knowledge base: {e}")
                self.knowledge_base = []
    
    def reload_knowledge_base(self):
        """Reload knowledge base from file"""
        self._load_knowledge_base()
    
    def get_response(self, query: str) -> Optional[Dict]:
        """
        Get AI response for a query
        Returns the best matching answer from knowledge base
        """
        query_lower = query.lower()
        
        best_match = None
        max_score = 0
        
        for entry in self.knowledge_base:
            score = 0
            keywords = entry.get("keywords", [])
            
            # Handle both list and string keywords
            if isinstance(keywords, str):
                keywords = [k.strip() for k in keywords.split(",")]
            
            for keyword in keywords:
                keyword_lower = keyword.lower()
                if keyword_lower in query_lower:
                    # Score based on keyword length (longer = more specific)
                    score += len(keyword) * 2
                    
                    # Bonus for exact word match
                    if f" {keyword_lower} " in f" {query_lower} ":
                        score += 5
            
            if score > max_score:
                max_score = score
                best_match = entry
        
        return best_match if max_score > 0 else None
    
    def needs_escalation(self, query: str, confidence: float = 0.0) -> bool:
        """
        Determine if query should be escalated to human support
        """
        query_lower = query.lower()
        
        # Check for escalation keywords
        has_escalation_keyword = any(
            keyword in query_lower 
            for keyword in self.ESCALATION_KEYWORDS
        )
        
        # Low confidence also triggers escalation
        is_low_confidence = confidence < 0.6
        
        return has_escalation_keyword or is_low_confidence
    
    def categorize_query(self, query: str) -> str:
        """
        Categorize the query type
        """
        query_lower = query.lower()
        
        # Technical keywords
        technical_keywords = ["error", "bug", "crash", "not working", "broken", "server", "database", "code"]
        if any(kw in query_lower for kw in technical_keywords):
            return "technical"
        
        # Billing keywords
        billing_keywords = ["payment", "billing", "invoice", "charge", "subscription", "price", "cost"]
        if any(kw in query_lower for kw in billing_keywords):
            return "billing"
        
        # Account keywords
        account_keywords = ["password", "login", "account", "register", "email", "profile"]
        if any(kw in query_lower for kw in account_keywords):
            return "account"
        
        return "general"
    
    def add_entry(self, keywords: List[str], answer: str, category: str = "general") -> bool:
        """
        Add new entry to knowledge base
        """
        entry = {
            "keywords": keywords,
            "answer": answer,
            "category": category
        }
        
        self.knowledge_base.append(entry)
        
        # Save to file
        try:
            os.makedirs(os.path.dirname(self.kb_path), exist_ok=True)
            with open(self.kb_path, "w") as f:
                json.dump(self.knowledge_base, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving knowledge base: {e}")
            return False
    
    async def process_query(self, query: str, user_id: int, user_role: str, 
                          conversation_id: str, context: Dict = None) -> Dict:
        """
        Process a query and return AI analysis result
        """
        # Get AI response from knowledge base
        ai_response = self.get_response(query)
        
        # Determine classification
        if ai_response:
            classification = "auto_resolvable"
            confidence = 0.8
            solution = ai_response["answer"]
        else:
            # Check if needs escalation
            if self.needs_escalation(query):
                classification = "requires_developer"
                confidence = 0.3
                solution = None
            else:
                classification = "unclear"
                confidence = 0.5
                solution = "I'm not sure how to help with that. Could you provide more details?"
        
        # Categorize the query
        category = self.categorize_query(query)
        
        return {
            "classification": classification,
            "confidence": confidence,
            "solution": solution,
            "category": category,
            "original_query": query,
            "suggested_priority": "HIGH" if "urgent" in query.lower() or "critical" in query.lower() else "MEDIUM",
            "analysis": f"Query classified as {classification} with {confidence:.1%} confidence",
            "processing_time_ms": 100,  # Mock processing time
            "knowledge_base_used": ai_response is not None,
            "pattern_matched": ai_response is not None,
            "suggested_actions": [
                "Check the solution provided",
                "Try the suggested steps",
                "Contact support if issue persists"
            ] if ai_response else [
                "Provide more details about the issue",
                "Include error messages if any",
                "Describe what you were trying to do"
            ]
        }

    def ask_ai_deepseek(self, query: str, context: str = None) -> Tuple[str, float]:
        """
        Use DeepSeek API for intelligent responses
        """
        if not self.client:
            return "DeepSeek API is not available. Please contact support.", 0.3
        
        try:
            # Construct system prompt
            system_prompt = """You are a helpful IT support assistant. Provide clear, concise solutions to technical problems. 
            If you can solve the issue, provide step-by-step instructions. 
            If the issue requires human intervention, suggest creating a support ticket.
            Keep responses under 200 words and be professional."""
            
            if context:
                system_prompt += f"\n\nRELEVANT KNOWLEDGE BASE INFO:\n{context}\n\nUse this information if relevant, but you can also use your general knowledge."
            
            response = self.client.chat.completions.create(
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

# Standalone functions for backward compatibility
def ask_ai_deepseek(query: str, context: str = None) -> Tuple[str, float]:
    """Standalone function for DeepSeek API calls"""
    # Create a temporary AIEngine instance
    engine = AIEngine()
    return engine.ask_ai_deepseek(query, context)

def retrieve_context(query: str) -> Optional[str]:
    """Standalone function to retrieve context from knowledge base"""
    engine = AIEngine()
    result = engine.get_response(query)
    return result["answer"] if result else None
