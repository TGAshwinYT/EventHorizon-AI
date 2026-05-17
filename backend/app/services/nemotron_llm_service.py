"""
The Brain - Nemotron LLM Service - EventHorizon AI

NVIDIA NIM Nemotron (primary) with Gemini 2.5 Flash fallback.
Supports streaming token generation and sentence chunking for TTS pipelining.
"""

import os
import json
import logging
from typing import Optional, List, Dict, AsyncGenerator
from datetime import datetime

import httpx

logger = logging.getLogger("eventhorizon.llm")

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_NIM_LLM_URL = os.getenv("NVIDIA_NIM_LLM_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
NVIDIA_LLM_MODEL = os.getenv("NVIDIA_LLM_MODEL", "nvidia/nemotron-mini-4b-instruct")

# Sentence delimiters including Hindi purna viram
SENTENCE_DELIMITERS = {'.', '!', '?', '।', '॥', '\n'}
MIN_SENTENCE_LENGTH = 15  # Minimum chars before emitting a sentence chunk

# ── The Intelligence Core Instruction Set ──
# This is injected as the system prompt into every LLM call (NIM + Gemini fallback).
# It defines HOW the AI talks to the farmer.
SYSTEM_PROMPT = (
    "You are the intelligence core of EventHorizon AI, a highly empathetic, "
    "localized agricultural expert designed to assist smallholder farmers.\n\n"

    "YOUR DIRECTIVES:\n\n"

    "1. TONE & EMPATHY: Speak warmly, respectfully, and simply. Treat the farmer "
    "as a respected professional. Avoid highly academic soil science jargon "
    '(e.g., do not say "electrical conductivity," say "salt buildup in the dirt").\n\n'

    "2. LANGUAGE HANDLING: If the user speaks in a regional dialect or code-mixes "
    "English and Hindi/Tamil, reply in the same localized, natural way.\n\n"

    "3. ACTIONABLE PRECISION: You may receive JSON data regarding the farmer's "
    "soil temperature, NPK, and physical soil crusting status. Do NOT read the "
    "data to the farmer. Instead, translate that data into a single, immediate "
    "financial or agricultural action.\n\n"

    "4. BREVITY FOR VOICE: Your output will be spoken aloud via TTS. Keep your "
    "answers incredibly brief — under 3 sentences.\n\n"

    "5. INDIGENOUS PRIORITIZATION: If a problem is detected (like low Nitrogen), "
    "always recommend a zero-cost, localized organic solution (like Jeevamrutha) "
    "BEFORE suggesting commercial synthetic fertilizers.\n\n"

    f"Today is {datetime.now().strftime('%A, %B %d, %Y')}."
)



class NemotronLLMService:
    """
    Dual-tier LLM:
      Tier 1: NVIDIA NIM (Nemotron) — streaming
      Tier 2: Gemini 2.5 Flash — batch (existing service)
    """
    def __init__(self):
        self._nim_available = bool(NVIDIA_API_KEY)
        self._gemini_service = None  # Lazy import
        logger.info(f"[LLM] NIM: {'available' if self._nim_available else 'unavailable (using Gemini fallback)'}")

    async def generate_streaming(
        self,
        user_text: str,
        language: str = "hi",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream LLM response token-by-token.
        Yields sentence chunks suitable for TTS pipelining.
        """
        # Tier 1: NVIDIA NIM streaming
        if self._nim_available:
            try:
                async for chunk in self._nim_stream(user_text, language, history):
                    yield chunk
                return
            except Exception as e:
                logger.warning(f"[LLM/NIM] Streaming failed: {e}. Falling back to Gemini.")

        # Tier 2: Gemini batch (yield whole response at once)
        try:
            full_response = await self._gemini_generate(user_text, language, history)
            if full_response:
                # Split into sentence chunks for TTS
                for sentence in self._split_sentences(full_response):
                    yield sentence
                return
        except Exception as e:
            logger.error(f"[LLM/Gemini] Failed: {e}")

        yield "I'm having trouble processing your request right now. Please try again."

    async def generate_batch(
        self,
        user_text: str,
        language: str = "hi",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Non-streaming generation. Returns full response text."""
        full_text = ""
        async for chunk in self.generate_streaming(user_text, language, history):
            full_text += chunk
        return full_text

    # -----------------------------------------------------------------------
    # Tier 1: NVIDIA NIM Streaming
    # -----------------------------------------------------------------------

    async def _nim_stream(
        self,
        user_text: str,
        language: str,
        history: Optional[List[Dict[str, str]]],
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from NVIDIA NIM and yield sentence chunks."""
        messages = self._build_messages(user_text, language, history)

        sentence_buffer = ""

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                NVIDIA_NIM_LLM_URL,
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                json={
                    "model": NVIDIA_LLM_MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 512,
                    "stream": True,
                },
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    raise Exception(f"NIM LLM {response.status_code}: {error_body.decode()[:200]}")

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break

                    try:
                        data = json.loads(data_str)
                        delta = data.get("choices", [{}])[0].get("delta", {})
                        token = delta.get("content", "")
                        if not token:
                            continue

                        sentence_buffer += token

                        # Check for sentence boundary
                        if (len(sentence_buffer) >= MIN_SENTENCE_LENGTH and
                                any(sentence_buffer.rstrip().endswith(d) for d in SENTENCE_DELIMITERS)):
                            yield sentence_buffer.strip()
                            sentence_buffer = ""

                    except json.JSONDecodeError:
                        continue

        # Flush remaining buffer
        if sentence_buffer.strip():
            yield sentence_buffer.strip()

    # -----------------------------------------------------------------------
    # Tier 2: Gemini Fallback
    # -----------------------------------------------------------------------

    async def _gemini_generate(
        self,
        user_text: str,
        language: str,
        history: Optional[List[Dict[str, str]]],
    ) -> str:
        """Generate using existing GeminiService (synchronous, wrapped in async)."""
        if self._gemini_service is None:
            from app.services.gemini_service import gemini_service
            self._gemini_service = gemini_service

        from app.llm_memory_manager import process_and_trim_history

        LANGUAGE_NAMES = {
            'en': 'English', 'hi': 'Hindi', 'bn': 'Bengali', 'te': 'Telugu',
            'mr': 'Marathi', 'ta': 'Tamil', 'gu': 'Gujarati', 'kn': 'Kannada', 'ml': 'Malayalam'
        }
        lang_name = LANGUAGE_NAMES.get(language, 'Hindi')

        instruction = (
            f"Respond concisely in {lang_name} (2-4 sentences max, suitable for voice output). "
            f"If the user speaks in a mix of languages, respond in the same mix."
        )
        final_query = f"{user_text}\n\n{instruction}"

        conv_history = list(history) if history else []
        trimmed = process_and_trim_history(conv_history, final_query, max_conversational_items=6)

        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: self._gemini_service.generate_response(
                message="", context="agriculture", history=trimmed
            )
        )
        return result

    # -----------------------------------------------------------------------
    # Utilities
    # -----------------------------------------------------------------------

    def _build_messages(
        self,
        user_text: str,
        language: str,
        history: Optional[List[Dict[str, str]]],
    ) -> List[Dict[str, str]]:
        """Build OpenAI-compatible message list for NIM."""
        LANGUAGE_NAMES = {
            'en': 'English', 'hi': 'Hindi', 'bn': 'Bengali', 'te': 'Telugu',
            'mr': 'Marathi', 'ta': 'Tamil', 'gu': 'Gujarati', 'kn': 'Kannada', 'ml': 'Malayalam'
        }
        lang_name = LANGUAGE_NAMES.get(language, 'Hindi')

        system_msg = SYSTEM_PROMPT + f" Respond in {lang_name} or match the user's language."

        messages = [{"role": "system", "content": system_msg}]

        if history:
            for msg in history[-6:]:  # Keep last 6 turns
                role = msg.get("role", "user")
                if role == "system":
                    continue
                if role == "assistant":
                    role = "assistant"
                messages.append({"role": role, "content": msg.get("content", "")})

        messages.append({"role": "user", "content": user_text})
        return messages

    @staticmethod
    def _split_sentences(text: str) -> List[str]:
        """Split text into sentences for progressive TTS."""
        sentences = []
        current = ""
        for char in text:
            current += char
            if char in SENTENCE_DELIMITERS and len(current.strip()) >= MIN_SENTENCE_LENGTH:
                sentences.append(current.strip())
                current = ""
        if current.strip():
            sentences.append(current.strip())
        return sentences


nemotron_llm_service = NemotronLLMService()
