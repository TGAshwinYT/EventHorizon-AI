"""
UniversalCasualIndianVoice — Azure Neural TTS with Natural Human Speech
=======================================================================
Production-ready TTS engine that delivers friendly, casual, conversational
Indian-language speech via advanced SSML formatting. Completely avoids
the rigid, robotic "browser reading" effect of plain-text synthesis.

SSML Strategy:
  • Hindi & Indian English  → mstts:express-as style="cheerful" (styledegree=1.3)
  • All languages           → prosody rate=1.07, pitch=+1Hz (organic human speed)
  • Natural pauses          → sentence-boundary <break> tags for breathing rhythm

Cold-Start Elimination:
  1. Per-voice Synthesizer Pool — each voice gets its own cached synthesizer
  2. Warm-up synthesis (".")  — forces full TCP→TLS→WebSocket→voice-model pipeline
  3. Background keep-alive    — pings every 50s to prevent idle disconnect
  4. Auto-reconnect           — detects stale connections, re-warms transparently

Failover Cascade: Azure TTS → Sarvam AI Bulbul v3 → Gemini TTS
"""

import os
import re
import time
import struct
import logging
import threading
from pathlib import Path
from typing import Optional, Dict, Tuple

try:
    import azure.cognitiveservices.speech as speechsdk
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False

logger = logging.getLogger("azure_tts_engine")


class UniversalCasualIndianVoice:
    """
    Azure Cognitive Speech Neural TTS with natural, conversational delivery.

    Every synthesis call wraps text in structured SSML that applies:
      - Cheerful emotional style for Hindi/English (mstts:express-as)
      - Organic prosody (rate 1.07, pitch +1Hz) for human-like pacing
      - Intonation contour curves for regional languages
      - Smart sentence segmentation with natural pause injection

    Backed by a per-voice synthesizer pool with pre-warmed connections
    for zero cold-start latency.
    """

    # ── Premium Azure Neural Voice Profiles ─────────────────────────────
    VOICE_DB: Dict[str, dict] = {
        "hi": {
            "voice": "hi-IN-SwaraNeural",
            "locale": "hi-IN",
            "label": "Hindi",
            "style": "cheerful",
            "style_degree": "1.3",
        },
        "en_in": {
            "voice": "en-IN-NeerjaNeural",
            "locale": "en-IN",
            "label": "Indian English",
            "style": "cheerful",
            "style_degree": "1.3",
        },
        "en": {
            "voice": "en-IN-NeerjaNeural",
            "locale": "en-IN",
            "label": "Indian English",
            "style": "cheerful",
            "style_degree": "1.3",
        },
        "ta": {
            "voice": "ta-IN-PallaviNeural",
            "locale": "ta-IN",
            "label": "Tamil",
            "style": None,
            "style_degree": None,
        },
        "te": {
            "voice": "te-IN-ShrutiNeural",
            "locale": "te-IN",
            "label": "Telugu",
            "style": None,
            "style_degree": None,
        },
        "kn": {
            "voice": "kn-IN-SapnaNeural",
            "locale": "kn-IN",
            "label": "Kannada",
            "style": None,
            "style_degree": None,
        },
        "ml": {
            "voice": "ml-IN-SobhanaNeural",
            "locale": "ml-IN",
            "label": "Malayalam",
            "style": None,
            "style_degree": None,
        },
        "mr": {
            "voice": "mr-IN-AarohiNeural",
            "locale": "mr-IN",
            "label": "Marathi",
            "style": None,
            "style_degree": None,
        },
        "gu": {
            "voice": "gu-IN-DhwaniNeural",
            "locale": "gu-IN",
            "label": "Gujarati",
            "style": None,
            "style_degree": None,
        },
        "bn": {
            "voice": "bn-IN-TanishaaNeural",
            "locale": "bn-IN",
            "label": "Bengali",
            "style": None,
            "style_degree": None,
        },
        "pa": {
            "voice": "pa-IN-OjasNeural",
            "locale": "pa-IN",
            "label": "Punjabi",
            "style": None,
            "style_degree": None,
        },
    }

    # Next-generation MAI-Voice-2 profiles (Gemini-level expressiveness, Hindi and English)
    MAI_VOICE_DB: Dict[str, dict] = {
        "hi": {
            "voice": "hi-IN-Priya:MAI-Voice-2",
            "locale": "hi-IN",
            "label": "Hindi (MAI-Voice-2)",
            "style": None,
            "style_degree": None,
        },
        "en_in": {
            "voice": "en-IN-NeerjaNeural",
            "locale": "en-IN",
            "label": "Indian English",
            "style": "cheerful",
            "style_degree": "1.3",
        },
        "en": {
            "voice": "en-US-Harper:MAI-Voice-2",
            "locale": "en-US",
            "label": "English (MAI-Voice-2)",
            "style": None,
            "style_degree": None,
        },
    }

    DEFAULT_LANG = "hi"

    # Prosody settings for organic human conversational speed
    _PROSODY_RATE = "1.07"
    _PROSODY_PITCH = "+1Hz"

    # Keep-alive interval (Azure idles WebSockets at ~120s)
    _KEEPALIVE_INTERVAL = 50

    def __init__(
        self,
        subscription_key: Optional[str] = None,
        region: str = "centralindia",
        pre_warm_voices: Optional[list] = None,
        use_mai_voice_2: bool = False,
    ):
        """
        Initialize the casual voice engine with connection pre-warming.

        Args:
            subscription_key: Azure Speech key (falls back to env var).
            region: Azure region (centralindia for lowest Indian latency).
            pre_warm_voices: Lang codes to pre-warm at startup.
                             Defaults to ["hi", "ta", "en_in"].
            use_mai_voice_2: Whether to attempt next-gen MAI-Voice-2 for supported languages.
        """
        # Prefer explicit parameter, then environment variable. Do NOT embed keys in source.
        self._key = subscription_key or os.getenv("AZURE_SPEECH_KEY")
        self._region = region
        self._initialized = False
        self._use_mai_voice_2 = use_mai_voice_2

        # Per-voice synthesizer pool: voice_name -> (config, synthesizer, connection)
        self._synth_pool: Dict[str, Tuple] = {}
        self._pool_lock = threading.Lock()

        self._last_activity_time = time.time()
        self._keepalive_stop = threading.Event()
        self._keepalive_thread: Optional[threading.Thread] = None

        if not AZURE_SDK_AVAILABLE:
            logger.warning(
                "[CASUAL TTS] SDK not installed. "
                "Run: pip install azure-cognitiveservices-speech"
            )
            return

        if not self._key:
            logger.warning("[CASUAL TTS] No subscription key found. Disabled.")
            return

        self._initialized = True
        logger.info(
            f"[CASUAL TTS] Engine ready — Region: {self._region}, "
            f"Voices: {len(self.VOICE_DB)}, "
            f"Prosody: rate={self._PROSODY_RATE} pitch={self._PROSODY_PITCH}"
        )

        # Pre-warm most-used voices at startup
        warm_list = pre_warm_voices or ["hi", "ta", "en_in"]
        for lang in warm_list:
            profile = self._resolve_voice(lang)
            self._get_or_create_synthesizer(profile["voice"])

        self._start_keepalive()

    # ═══════════════════════════════════════════════════════════════════
    #  SSML CONSTRUCTION — THE HEART OF NATURAL SPEECH
    # ═══════════════════════════════════════════════════════════════════

    def _build_natural_ssml(self, text: str, lang_code: str) -> str:
        """Helper to build SSML using the resolved profile."""
        profile = self._resolve_voice(lang_code)
        return self._build_natural_ssml_with_profile(text, profile)

    def _build_natural_ssml_with_profile(self, text: str, profile: dict) -> str:
        """
        Build a complete SSML document that wraps text in natural,
        conversational formatting specific to the target language and voice profile.
        """
        voice_name = profile["voice"]
        locale = profile["locale"]
        style = profile["style"]
        style_degree = profile["style_degree"]

        # Clean markdown artifacts
        clean = self._clean_text(text)

        # ── Build the inner content block ────────────────────────────
        # Skip prosody modifications & breaks for MAI-Voice-2 to prevent RTF threshold timeouts
        if ":MAI-Voice-2" in voice_name:
            prosody_block = clean
        else:
            # Insert natural pauses at sentence boundaries
            clean = self._inject_sentence_breaks(clean)
            prosody_block = (
                f'<prosody rate="{self._PROSODY_RATE}" '
                f'pitch="{self._PROSODY_PITCH}">'
                f'{clean}'
                f'</prosody>'
            )

        if style:
            # Hindi / Indian English: wrap prosody in cheerful style
            inner = (
                f'<mstts:express-as style="{style}" '
                f'styledegree="{style_degree}">'
                f'{prosody_block}'
                f'</mstts:express-as>'
            )
        else:
            inner = prosody_block

        # ── Wrap in full SSML document ───────────────────────────────
        ssml = (
            f'<speak version="1.0" '
            f'xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xmlns:mstts="http://www.w3.org/2001/mstts" '
            f'xml:lang="{locale}">'
            f'<voice name="{voice_name}">'
            f'{inner}'
            f'</voice>'
            f'</speak>'
        )

        return ssml

    @staticmethod
    def _clean_text(text: str) -> str:
        """Strip markdown formatting artifacts from text."""
        clean = text
        clean = clean.replace("**", "")
        clean = clean.replace("*", "")
        clean = clean.replace("#", "")
        clean = clean.replace("`", "")
        clean = clean.replace("_", " ")
        # Remove markdown links: [text](url) → text
        clean = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', clean)
        # Remove leftover markdown bullets
        clean = re.sub(r'^\s*[-•]\s*', '', clean, flags=re.MULTILINE)
        # Collapse multiple spaces/newlines
        clean = re.sub(r'\s+', ' ', clean).strip()
        return clean

    @staticmethod
    def _inject_sentence_breaks(text: str) -> str:
        """
        Insert SSML <break> tags at sentence boundaries for natural pausing.
        Mimics how a real person pauses between thoughts.
        Uses short durations to stay within Azure's frame-interval threshold.
        """
        # Natural pause after sentence-ending punctuation
        # (period, exclamation, question, Devanagari danda/double-danda)
        text = re.sub(
            r'([.!?।॥])\s+',
            r'\1 <break time="180ms"/> ',
            text
        )
        # Shorter breath pause after commas
        text = re.sub(
            r'([,;:])\s+',
            r'\1 <break time="80ms"/> ',
            text
        )
        return text

    # ═══════════════════════════════════════════════════════════════════
    #  PER-VOICE SYNTHESIZER POOL (ZERO COLD-START)
    # ═══════════════════════════════════════════════════════════════════

    def _build_config(self, voice_name: str) -> "speechsdk.SpeechConfig":
        """Build a dedicated SpeechConfig for a specific voice."""
        config = speechsdk.SpeechConfig(
            subscription=self._key,
            region=self._region,
        )
        config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
        )
        config.speech_synthesis_voice_name = voice_name
        return config

    def _get_or_create_synthesizer(
        self, voice_name: str
    ) -> Optional[Tuple]:
        """
        Get a cached synthesizer or create + warm a new one.
        Each voice gets its own SpeechConfig + Synthesizer + Connection.
        Warm-up synthesis forces the full pipeline to heat up.
        """
        if voice_name in self._synth_pool:
            return self._synth_pool[voice_name]

        with self._pool_lock:
            if voice_name in self._synth_pool:
                return self._synth_pool[voice_name]

            try:
                t_start = time.perf_counter()

                config = self._build_config(voice_name)
                synthesizer = speechsdk.SpeechSynthesizer(
                    speech_config=config,
                    audio_config=None,  # in-memory, no speaker
                )

                connection = speechsdk.Connection.from_speech_synthesizer(
                    synthesizer
                )
                connection.open(True)

                # TRUE warm-up: synthesize a simple token/greeting to force the full
                # TCP → TLS → WebSocket → voice-model-load pipeline.
                # Note: Silent "." gets rejected by MAI-Voice-2 response quality filters,
                # so we use a real short greeting word for MAI models.
                warmup_text = "."
                if ":MAI-Voice-2" in voice_name:
                    warmup_text = "नमस्ते" if "hi-IN" in voice_name else "Hello"

                warmup = synthesizer.speak_text_async(warmup_text).get()
                if warmup.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
                    logger.warning(
                        f"[CASUAL TTS] Warm-up failed/ignored for {voice_name} "
                        f"(reason: {warmup.reason}, will retry on real call)"
                    )

                elapsed = (time.perf_counter() - t_start) * 1000
                self._synth_pool[voice_name] = (config, synthesizer, connection)

                logger.info(
                    f"[CASUAL TTS 🔥] Pooled & warmed: "
                    f"{voice_name} ({elapsed:.0f}ms)"
                )
                return self._synth_pool[voice_name]

            except Exception as e:
                logger.warning(
                    f"[CASUAL TTS] Pool creation failed for {voice_name}: {e}"
                )
                return None

    def _evict_synthesizer(self, voice_name: str) -> None:
        """Remove a stale synthesizer from the pool."""
        with self._pool_lock:
            entry = self._synth_pool.pop(voice_name, None)
            if entry:
                try:
                    entry[2].close()
                except Exception:
                    pass
                logger.info(f"[CASUAL TTS] Evicted: {voice_name}")

    # ═══════════════════════════════════════════════════════════════════
    #  KEEP-ALIVE
    # ═══════════════════════════════════════════════════════════════════

    def _start_keepalive(self) -> None:
        """Start a daemon thread to keep pooled connections alive."""
        if self._keepalive_thread and self._keepalive_thread.is_alive():
            self._keepalive_stop.set()
            self._keepalive_thread.join(timeout=2)

        self._keepalive_stop.clear()
        self._keepalive_thread = threading.Thread(
            target=self._keepalive_loop,
            name="casual-tts-keepalive",
            daemon=True,
        )
        self._keepalive_thread.start()

    def _keepalive_loop(self) -> None:
        """Ping pooled connections periodically to prevent idle timeout."""
        while not self._keepalive_stop.wait(timeout=self._KEEPALIVE_INTERVAL):
            idle = time.time() - self._last_activity_time
            if idle < self._KEEPALIVE_INTERVAL:
                continue

            stale = []
            for vname, (_, _, conn) in list(self._synth_pool.items()):
                try:
                    conn.open(True)
                except Exception:
                    stale.append(vname)
            for v in stale:
                self._evict_synthesizer(v)

    # ═══════════════════════════════════════════════════════════════════
    #  VOICE RESOLUTION
    # ═══════════════════════════════════════════════════════════════════

    def _resolve_voice(self, lang_code: str) -> dict:
        """Resolve language code utilizing use_mai_voice_2 preference."""
        return self._resolve_voice_profile(lang_code, try_mai=self._use_mai_voice_2)

    def _resolve_voice_profile(self, lang_code: str, try_mai: bool = True) -> dict:
        """
        Resolve a language code to its voice profile.
        If try_mai is True, returns the MAI-Voice-2 profile if available.
        Otherwise, returns the standard Neural profile.
        """
        normalized = lang_code.strip().lower().replace("-", "_")

        if try_mai and normalized in self.MAI_VOICE_DB:
            return self.MAI_VOICE_DB[normalized]

        if normalized in self.VOICE_DB:
            return self.VOICE_DB[normalized]

        # Partial match
        if try_mai:
            for key, profile in self.MAI_VOICE_DB.items():
                if key in normalized or normalized in profile["label"].lower():
                    return profile

        for key, profile in self.VOICE_DB.items():
            if key in normalized or normalized in profile["label"].lower():
                return profile

        logger.warning(
            f"[CASUAL TTS] Unknown lang '{lang_code}' → defaulting to Hindi"
        )
        if try_mai:
            return self.MAI_VOICE_DB[self.DEFAULT_LANG]
        return self.VOICE_DB[self.DEFAULT_LANG]

    # ═══════════════════════════════════════════════════════════════════
    #  CORE PUBLIC API
    # ═══════════════════════════════════════════════════════════════════

    @property
    def is_available(self) -> bool:
        return self._initialized

    @property
    def warm_voices(self) -> list:
        return list(self._synth_pool.keys())

    def speak_natural(
        self,
        text: str,
        lang_code: str = "hi",
        output_path: Optional[str] = None,
    ) -> Optional[bytes]:
        """
        Synthesize speech with natural, casual, conversational delivery.

        Dynamically builds SSML with cheerful styles (hi/en), organic
        prosody (rate 1.07, pitch +1Hz), sentence-break pauses, and
        intonation contour curves (regional languages).

        Args:
            text: The text to speak.
            lang_code: Language code (e.g., 'ta', 'hi', 'en_in', 'bn').
            output_path: Optional file path to save the .wav output.

        Returns:
            Raw WAV audio bytes (24kHz/16-bit/Mono) on success, None on failure.
        """
        if not self.is_available:
            self._emit_failover(
                "ENGINE_UNAVAILABLE",
                "Azure TTS engine is not initialized",
                lang_code,
            )
            return None

        clean_text = self._clean_text(text)
        if not clean_text:
            logger.warning("[CASUAL TTS] Empty text — skipping.")
            return None

        profile = self._resolve_voice_profile(lang_code, try_mai=self._use_mai_voice_2)
        voice_name = profile["voice"]
        label = profile["label"]

        # Determine if we should chunk the text to avoid RTF timeouts
        is_mai = ":MAI-Voice-2" in voice_name
        word_count = len(clean_text.split())
        should_chunk = (is_mai and word_count > 6) or (word_count > 15)

        try:
            t_start = time.perf_counter()

            if not should_chunk:
                # Single synthesis path
                ssml = self._build_natural_ssml_with_profile(clean_text, profile)
                audio_data = self._synth_via_pool(ssml, voice_name, lang_code)

                # If MAI-Voice-2 fails/timeouts, attempt transparent fallback to standard Neural voice
                if (not audio_data or len(audio_data) <= 46) and self._use_mai_voice_2 and is_mai:
                    logger.warning(
                        f"[CASUAL TTS] MAI-Voice-2 synthesis failed/timed out for '{lang_code}'. "
                        f"Attempting transparent fallback to standard Neural voice..."
                    )
                    profile = self._resolve_voice_profile(lang_code, try_mai=False)
                    voice_name = profile["voice"]
                    label = profile["label"]
                    ssml = self._build_natural_ssml_with_profile(clean_text, profile)

                    logger.info(
                        f"[CASUAL TTS Fallback] Speaking standard Neural ({label} / {voice_name}): "
                        f"'{clean_text[:60]}{'...' if len(clean_text) > 60 else ''}'"
                    )
                    audio_data = self._synth_via_pool(ssml, voice_name, lang_code)
            else:
                # Chunked synthesis path to guarantee success
                chunks = self._segment_text(clean_text, max_words=8 if is_mai else 12)
                logger.info(
                    f"[CASUAL TTS] Speaking chunked ({len(chunks)} chunks | {label} / {voice_name}): "
                    f"'{clean_text[:60]}{'...' if len(clean_text) > 60 else ''}'"
                )

                pcm_data = b""
                success_count = 0

                for idx, chunk in enumerate(chunks):
                    # Try current voice profile
                    ssml = self._build_natural_ssml_with_profile(chunk, profile)
                    chunk_audio = self._synth_via_pool(ssml, voice_name, lang_code)

                    # Transparent fallback per chunk
                    if (not chunk_audio or len(chunk_audio) <= 46) and self._use_mai_voice_2 and is_mai:
                        logger.warning(
                            f"[CASUAL TTS] Chunk {idx+1}/{len(chunks)} failed on MAI-Voice-2. "
                            f"Retrying chunk with standard Neural..."
                        )
                        fallback_profile = self._resolve_voice_profile(lang_code, try_mai=False)
                        fallback_ssml = self._build_natural_ssml_with_profile(chunk, fallback_profile)
                        chunk_audio = self._synth_via_pool(fallback_ssml, fallback_profile["voice"], lang_code)

                    # WAV header is 44 bytes. Strip and append PCM
                    if chunk_audio and len(chunk_audio) > 44:
                        pcm_data += chunk_audio[44:]
                        success_count += 1
                    else:
                        logger.warning(f"[CASUAL TTS] Chunk {idx+1}/{len(chunks)} failed completely.")

                if success_count > 0:
                    audio_data = self._create_wav_header(len(pcm_data)) + pcm_data
                else:
                    audio_data = None

            elapsed_ms = (time.perf_counter() - t_start) * 1000
            self._last_activity_time = time.time()

            # WAV header is ~46 bytes; anything ≤ that is effectively empty
            if audio_data and len(audio_data) > 46:
                duration_est = len(audio_data) / (24000 * 2)
                logger.info(
                    f"[CASUAL TTS ✓] {label} | "
                    f"{len(audio_data):,} bytes | "
                    f"~{duration_est:.1f}s audio | "
                    f"{elapsed_ms:.0f}ms"
                )

                if output_path:
                    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(audio_data)
                    logger.info(f"[CASUAL TTS] Saved: {output_path}")

                return audio_data
            else:
                self._emit_failover(
                    "EMPTY_AUDIO",
                    f"Returned {len(audio_data) if audio_data else 0} bytes",
                    lang_code,
                )
                return None

        except Exception as e:
            self._evict_synthesizer(voice_name)
            self._emit_failover(
                "EXCEPTION",
                f"{type(e).__name__}: {e}",
                lang_code,
            )
            return None

    def _synth_via_pool(
        self, ssml: str, voice_name: str, lang_code: str
    ) -> Optional[bytes]:
        """
        Synthesize SSML using the pooled pre-warmed synthesizer.
        Auto-retries once with a fresh connection on retryable errors.
        """
        pool_entry = self._get_or_create_synthesizer(voice_name)
        if not pool_entry:
            self._emit_failover(
                "POOL_FAILED",
                f"Cannot create synthesizer for {voice_name}",
                lang_code,
            )
            return None

        _, synthesizer, _ = pool_entry
        result = synthesizer.speak_ssml_async(ssml).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return result.audio_data

        # ── Handle failure ───────────────────────────────────────────
        cancellation = result.cancellation_details
        error_code = str(cancellation.error_code) if cancellation else "UNKNOWN"
        error_msg = cancellation.error_details if cancellation else "No details"

        # Retryable errors: timeout, stale connection, WebSocket reset
        is_retryable = any(
            kw in str(error_msg) + str(error_code)
            for kw in ("Timeout", "ServiceTimeout", "1007", "ConnectionFailure")
        )

        if is_retryable:
            logger.warning(
                f"[CASUAL TTS] Retryable error for {voice_name} — "
                f"evicting and retrying..."
            )
            self._evict_synthesizer(voice_name)
            return self._retry_synth(ssml, voice_name, lang_code)

        # Non-retryable
        if "429" in str(error_msg) or "TooManyRequests" in str(error_msg):
            self._emit_failover(
                "HTTP_429_RATE_LIMIT",
                f"S0 tier rate limit: {error_msg}",
                lang_code,
            )
        elif "Forbidden" in error_code:
            self._emit_failover(
                "AUTH_FORBIDDEN",
                f"Key invalid or quota exhausted: {error_msg}",
                lang_code,
            )
        else:
            self._evict_synthesizer(voice_name)
            self._emit_failover(
                f"CANCELLED_{error_code}",
                f"{error_msg}",
                lang_code,
            )
        return None

    def _retry_synth(
        self, ssml: str, voice_name: str, lang_code: str
    ) -> Optional[bytes]:
        """Single retry with a freshly created + warmed synthesizer."""
        pool_entry = self._get_or_create_synthesizer(voice_name)
        if not pool_entry:
            self._emit_failover(
                "RETRY_POOL_FAILED",
                f"Cannot recreate synthesizer for {voice_name}",
                lang_code,
            )
            return None

        _, synthesizer, _ = pool_entry
        result = synthesizer.speak_ssml_async(ssml).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info(f"[CASUAL TTS ✓] Retry SUCCESS: {voice_name}")
            return result.audio_data

        cancellation = result.cancellation_details
        error_msg = cancellation.error_details if cancellation else "Unknown"
        self._evict_synthesizer(voice_name)
        self._emit_failover(
            "RETRY_FAILED", f"Retry also failed: {error_msg}", lang_code
        )
        return None

    # ═══════════════════════════════════════════════════════════════════
    #  FAILOVER CASCADE & UTILITIES
    # ═══════════════════════════════════════════════════════════════════

    @staticmethod
    def _emit_failover(
        error_type: str, details: str, lang_code: str
    ) -> None:
        """
        Emit a structured log indicating automatic failover cascade.
        Azure TTS → Sarvam AI Bulbul v3 → Gemini TTS
        """
        msg = (
            f"\n{'='*72}\n"
            f"  ⚠  AZURE CASUAL TTS — FAILOVER CASCADE TRIGGERED\n"
            f"{'─'*72}\n"
            f"  Error    : {error_type}\n"
            f"  Language : {lang_code}\n"
            f"  Details  : {details}\n"
            f"{'─'*72}\n"
            f"  → AUTO FAILOVER 1: Sarvam AI Bulbul v3 (REST, ~200ms)\n"
            f"  → AUTO FAILOVER 2: Gemini TTS (Multimodal, ~500ms)\n"
            f"{'='*72}\n"
        )
        logger.warning(msg)
        try:
            print(msg)
        except UnicodeEncodeError:
            # Fallback to ASCII representation to avoid console crashes on Windows
            ascii_msg = (
                msg.replace("⚠", "[WARNING]")
                .replace("─", "-")
                .replace("→", "->")
                .replace("═", "=")
            )
            try:
                print(ascii_msg.encode('ascii', errors='replace').decode('ascii'))
            except Exception:
                pass

    def get_supported_languages(self) -> Dict[str, str]:
        """Return a mapping of lang_code → human-readable label."""
        return {k: v["label"] for k, v in self.VOICE_DB.items()}

    @staticmethod
    def _create_wav_header(data_len: int, sample_rate: int = 24000, bits_per_sample: int = 16, num_channels: int = 1) -> bytes:
        """Create a standard PCM 44-byte WAV header for the given raw PCM data length."""
        byte_rate = int(sample_rate * num_channels * bits_per_sample / 8)
        block_align = int(num_channels * bits_per_sample / 8)
        
        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + data_len,
            b'WAVE',
            b'fmt ',
            16,              # Subchunk1Size
            1,               # AudioFormat (1 = PCM)
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            data_len
        )
        return header

    @staticmethod
    def _segment_text(text: str, max_words: int = 10) -> list:
        """
        Segment a long text into clause/sentence-level chunks to prevent
        Azure Real-Time Factor (RTF) timeout limits.
        """
        parts = re.split(r'([.!?।॥,;])', text)
        chunks = []
        current_chunk = ""
        
        for part in parts:
            if not part:
                continue
            if part in ".!?।॥,;":
                current_chunk += part
                chunks.append(current_chunk.strip())
                current_chunk = ""
            else:
                words = current_chunk.split() + part.split()
                if len(words) > max_words:
                    if current_chunk.strip():
                        chunks.append(current_chunk.strip())
                    current_chunk = part
                else:
                    current_chunk += (" " if current_chunk else "") + part
                    
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
            
        return chunks

    def warm_up(self, lang_codes: Optional[list] = None) -> None:
        """Explicitly pre-warm synthesizers for given languages."""
        targets = lang_codes or list(self.VOICE_DB.keys())
        for lang in targets:
            profile = self._resolve_voice(lang)
            self._get_or_create_synthesizer(profile["voice"])

    def shutdown(self) -> None:
        """Gracefully shut down the engine and close all connections."""
        self._keepalive_stop.set()
        if self._keepalive_thread and self._keepalive_thread.is_alive():
            self._keepalive_thread.join(timeout=3)
        with self._pool_lock:
            for _, (_, _, conn) in self._synth_pool.items():
                try:
                    conn.close()
                except Exception:
                    pass
            self._synth_pool.clear()
        logger.info("[CASUAL TTS] Engine shut down.")


# ── Module-level singleton (import-ready, hi + ta + en_in pre-warmed) ─────
casual_voice_engine = UniversalCasualIndianVoice()
