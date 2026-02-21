"""
LLM Memory Management
Implements a Sliding Window approach to keep API latency low and enforce the persistent system prompt.
"""

from typing import List, Dict

# The strict, persistent system prompt for EventHorizon AI
SYSTEM_PROMPT_TEXT = (
    "You are EventHorizon AI, an expert agricultural assistant designed specifically for Indian farmers. "
    "You must ONLY answer questions related to agriculture, farming techniques, agricultural vehicles, "
    "government schemes, and crop/mandi prices. If a user asks a question NOT related to agriculture, "
    "you must politely decline and steer the conversation back to agriculture."
)

SYSTEM_PROMPT = {
    "role": "system",
    "content": SYSTEM_PROMPT_TEXT
}

def process_and_trim_history(
    conversation_history: List[Dict[str, str]], 
    new_user_text: str, 
    max_conversational_items: int = 6
) -> List[Dict[str, str]]:
    """
    Appends a new user message to the conversation history and trims it 
    to ensure it does not exceed the allowed limit, while always preserving 
    the system prompt at index 0.
    
    Args:
        conversation_history: The existing list of message dicts `[{"role": "...", "content": "..."}]`.
                              (This should be the persistent session history for the user).
        new_user_text: The new message from the user.
        max_conversational_items: The maximum number of conversational messages to keep 
                                  (default 6, i.e., 3 user / 3 assistant).
                                        
    Returns:
        list: A new, trimmed list ready to be safely sent to the LLM.
    """
    
    # 1. Ensure the persistent System Prompt is always at Index 0
    if not conversation_history or conversation_history[0].get("role") != "system":
        # Insert the system prompt at the beginning if missing
        conversation_history.insert(0, SYSTEM_PROMPT.copy())
    else:
        # Enforce the strict text just in case it was altered
        conversation_history[0]["content"] = SYSTEM_PROMPT_TEXT
        
    # 2. Append the new user message
    conversation_history.append({"role": "user", "content": new_user_text})
    
    # 3. Sliding Window Logic: Trim the history if it exceeds the limit
    # Total allowed items = 1 (System) + max_conversational_items
    total_allowed_length = 1 + max_conversational_items
    
    if len(conversation_history) > total_allowed_length:
        # Slice out the oldest conversational messages.
        # Keep Index 0 (System Prompt), and take the last `max_conversational_items` from the end.
        first_item = conversation_history[0]
        recent_items = list(conversation_history[-max_conversational_items:])
        conversation_history = [first_item] + recent_items
        
    return conversation_history

# ==============================================================================
# Example API Integration Usage
# ==============================================================================

def example_chat_endpoint_logic(session_db_history: List[Dict[str, str]], incoming_user_message: str) -> str:
    """
    Example of passing the trimmed, highly-optimized history list to the LLM.
    """
    
    # 1. Get the perfectly trimmed history list (Max 7 items: 1 System + 6 Context)
    trimmed_history = process_and_trim_history(
        conversation_history=session_db_history, 
        new_user_text=incoming_user_message, 
        max_conversational_items=6
    )
    
    # 2. Send exclusively the 'trimmed_history' to the LLM API (e.g., OpenAI)
    """
    import openai
    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=trimmed_history,
        temperature=0.7
    )
    assistant_reply = response.choices[0].message.content
    """
    
    assistant_reply = "This is a mock response about agriculture." # Replace with actual LLM call
    
    # 3. Finally, append the assistant's reply to the persistent session history
    # so it remembers the answer for the next turn.
    session_db_history.append({"role": "assistant", "content": assistant_reply})
    
    # 4. Save `session_db_history` back to your database or session state here
    
    return assistant_reply
