"""
Opus/WebM → PCM Decoder — EventHorizon AI

Decodes Opus-compressed audio chunks (in WebM container) into
raw LINEAR16 PCM at 16kHz mono — the format required by NVIDIA Riva ASR.

Uses pydub + ffmpeg subprocess for robust format conversion.
Handles both single-chunk and multi-chunk assembly with error resilience.
"""

import io
import os
import tempfile
import subprocess
import logging
from typing import Optional, List

logger = logging.getLogger("eventhorizon.opus_decoder")

# Output PCM format for Riva ASR
TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1
TARGET_SAMPLE_WIDTH = 2  # 16-bit = 2 bytes


def decode_opus_to_pcm(opus_data: bytes, input_format: str = "webm") -> Optional[bytes]:
    """
    Decode Opus/WebM audio bytes to raw LINEAR16 PCM (16kHz, mono).
    
    Args:
        opus_data: Raw bytes of the Opus/WebM audio
        input_format: Container format hint ("webm", "ogg", "opus")
        
    Returns:
        Raw PCM bytes (16kHz, 16-bit, mono) or None on failure
    """
    if not opus_data or len(opus_data) == 0:
        logger.warning("[OpusDec] Empty audio data received")
        return None

    try:
        # Use ffmpeg directly via subprocess for maximum reliability
        # This avoids pydub's import overhead and handles edge cases better
        return _decode_via_ffmpeg(opus_data, input_format)
    except FileNotFoundError:
        logger.error("[OpusDec] ffmpeg not found. Install ffmpeg: https://ffmpeg.org/download.html")
        # Fallback: try pydub (which also needs ffmpeg, but might find it differently)
        return _decode_via_pydub(opus_data, input_format)
    except Exception as e:
        logger.error(f"[OpusDec] Decoding failed: {e}")
        return None


def assemble_chunks_to_pcm(chunks: List[bytes], input_format: str = "webm") -> Optional[bytes]:
    """
    Assemble multiple Opus/WebM chunks into a single PCM buffer.
    
    For WebM containers, chunks must be concatenated first since WebM
    has a container header that spans the first chunk. Individual chunks
    after the first are not valid standalone WebM files.
    
    Args:
        chunks: List of raw Opus/WebM byte chunks
        input_format: Container format
        
    Returns:
        Raw PCM bytes (16kHz, 16-bit, mono) or None on failure
    """
    if not chunks:
        logger.warning("[OpusDec] No chunks to assemble")
        return None

    # Filter out empty chunks
    valid_chunks = [c for c in chunks if c and len(c) > 0]
    if not valid_chunks:
        logger.warning("[OpusDec] All chunks were empty")
        return None

    # Concatenate all chunks — the WebM container header is in the first chunk,
    # subsequent chunks are continuation data
    combined = b"".join(valid_chunks)
    
    logger.info(f"[OpusDec] Assembled {len(valid_chunks)} chunks, "
                f"total {len(combined)} bytes → decoding to PCM")

    return decode_opus_to_pcm(combined, input_format)


def get_pcm_duration_seconds(pcm_data: bytes) -> float:
    """Calculate duration of PCM audio in seconds."""
    if not pcm_data:
        return 0.0
    # bytes / (sample_rate * channels * bytes_per_sample)
    return len(pcm_data) / (TARGET_SAMPLE_RATE * TARGET_CHANNELS * TARGET_SAMPLE_WIDTH)


def _decode_via_ffmpeg(audio_data: bytes, input_format: str) -> Optional[bytes]:
    """
    Decode audio using ffmpeg subprocess directly.
    
    ffmpeg command:
      ffmpeg -i pipe:0 -f s16le -acodec pcm_s16le -ar 16000 -ac 1 pipe:1
    
    Reads from stdin, writes raw PCM to stdout.
    """
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-f", input_format,       # Input format hint
        "-i", "pipe:0",           # Read from stdin
        "-f", "s16le",            # Output format: raw signed 16-bit little-endian
        "-acodec", "pcm_s16le",   # Codec: PCM 16-bit
        "-ar", str(TARGET_SAMPLE_RATE),  # Sample rate: 16kHz
        "-ac", str(TARGET_CHANNELS),     # Channels: mono
        "pipe:1"                  # Write to stdout
    ]

    try:
        result = subprocess.run(
            cmd,
            input=audio_data,
            capture_output=True,
            timeout=10  # 10 second timeout for safety
        )

        if result.returncode != 0:
            stderr_msg = result.stderr.decode("utf-8", errors="replace").strip()
            logger.error(f"[OpusDec] ffmpeg error (code {result.returncode}): {stderr_msg}")
            
            # If format hint failed, try without it (let ffmpeg auto-detect)
            if input_format != "auto":
                logger.info("[OpusDec] Retrying with auto-detect format...")
                return _decode_via_ffmpeg_autodetect(audio_data)
            return None

        pcm_data = result.stdout
        if not pcm_data or len(pcm_data) == 0:
            logger.warning("[OpusDec] ffmpeg produced empty output")
            return None

        duration = get_pcm_duration_seconds(pcm_data)
        logger.info(f"[OpusDec] Decoded {len(audio_data)} bytes → "
                     f"{len(pcm_data)} bytes PCM ({duration:.2f}s)")
        return pcm_data

    except subprocess.TimeoutExpired:
        logger.error("[OpusDec] ffmpeg timed out (>10s)")
        return None


def _decode_via_ffmpeg_autodetect(audio_data: bytes) -> Optional[bytes]:
    """Retry ffmpeg without format hint, using temp file for reliability."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-i", tmp_path,
            "-f", "s16le",
            "-acodec", "pcm_s16le",
            "-ar", str(TARGET_SAMPLE_RATE),
            "-ac", str(TARGET_CHANNELS),
            "pipe:1"
        ]

        result = subprocess.run(cmd, capture_output=True, timeout=10)

        if result.returncode == 0 and result.stdout:
            return result.stdout
        return None

    except Exception as e:
        logger.error(f"[OpusDec] Auto-detect fallback failed: {e}")
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


def _decode_via_pydub(audio_data: bytes, input_format: str) -> Optional[bytes]:
    """Fallback decoder using pydub library."""
    try:
        from pydub import AudioSegment

        audio_io = io.BytesIO(audio_data)
        
        # pydub uses "webm" format string
        fmt = input_format if input_format != "auto" else "webm"
        audio = AudioSegment.from_file(audio_io, format=fmt)

        # Convert to target format
        audio = audio.set_frame_rate(TARGET_SAMPLE_RATE)
        audio = audio.set_channels(TARGET_CHANNELS)
        audio = audio.set_sample_width(TARGET_SAMPLE_WIDTH)

        pcm_data = audio.raw_data
        duration = get_pcm_duration_seconds(pcm_data)
        logger.info(f"[OpusDec/pydub] Decoded {len(audio_data)} bytes → "
                     f"{len(pcm_data)} bytes PCM ({duration:.2f}s)")
        return pcm_data

    except ImportError:
        logger.error("[OpusDec] pydub not installed. Run: pip install pydub")
        return None
    except Exception as e:
        logger.error(f"[OpusDec/pydub] Decoding failed: {e}")
        return None
