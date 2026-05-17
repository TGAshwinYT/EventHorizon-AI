"""
LLM Memory Management - EventHorizon AI

KEY FIX: The old hardcoded SYSTEM_PROMPT is REMOVED from here.
Language and persona are now handled entirely by gemini_service.py's
build_system_prompt() which receives detected_language correctly.

This module now ONLY manages conversation history trimming.
"""

from typing import List, Dict


def process_and_trim_history(
    conversation_history: List[Dict[str, str]],
    new_user_text: str,
    max_conversational_items: int = 6
) -> List[Dict[str, str]]:
    """
    Appends a new user message to the conversation history and trims it
    to ensure it does not exceed the allowed limit.

    KEY FIX: The old behaviour of injecting a hardcoded system prompt
    at index 0 is REMOVED. That prompt was:
      - Ignoring detected_language from Groq
      - Always defaulting to English-biased instructions
      - Overriding gemini_service.py's correct language-aware prompt

    Now: gemini_service.build_system_prompt(detected_language) handles
    the system prompt dynamically with the correct language per request.

    Args:
        conversation_history: Existing list of {"role": ..., "content": ...}
        new_user_text: The new message from the user
        max_conversational_items: Max number of messages to keep (default 6)

    Returns:
        Trimmed history list ready to send to the LLM
    """

    # ✅ KEY FIX: Strip out any old injected system messages from history
    # (they may have been saved to DB by older code versions)
    conversation_history = [
        msg for msg in conversation_history
        if msg.get("role") != "system"
    ]

    # Append the new user message
    conversation_history.append({"role": "user", "content": new_user_text})

    # Sliding window: keep only the most recent N conversational items
    if len(conversation_history) > max_conversational_items:
        conversation_history = list(conversation_history[-max_conversational_items:])

    return conversation_history
