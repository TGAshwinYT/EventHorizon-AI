"""Test: UniversalCasualIndianVoice with natural SSML speech."""
import sys, os, time
sys.path.insert(0, "app")
from dotenv import load_dotenv
load_dotenv()

import logging
logging.basicConfig(level=logging.INFO, format="%(message)s")

SEP = "=" * 60
LINE = "-" * 60

print(SEP)
print("  UniversalCasualIndianVoice — NATURAL SSML TEST")
print(SEP)

t_init = time.perf_counter()
from app.services.azure_tts_engine import UniversalCasualIndianVoice
engine = UniversalCasualIndianVoice(pre_warm_voices=["ta"])
init_ms = (time.perf_counter() - t_init) * 1000

print(f"\n[INIT] Warm-up: {init_ms:.0f}ms | Pool: {engine.warm_voices}")

# TEST: Tamil with natural SSML
print(f"\n{LINE}")
print("  Tamil — Natural Casual Speech")
print(LINE)
out = "audio_output/tamil_casual_natural.wav"
t1 = time.perf_counter()
a1 = engine.speak_natural(
    "வணக்கம் நண்பர்களே! இன்று வானிலை நன்றாக இருக்கிறது, உங்கள் பயிர்கள் நன்றாக வளரும்.",
    lang_code="ta",
    output_path=out,
)
e1 = (time.perf_counter() - t1) * 1000
if a1 and len(a1) > 46:
    print(f"  => OK: {len(a1):,} bytes | {e1:.0f}ms")
    print(f"  => File: {os.path.abspath(out)}")
else:
    print(f"  => FAILED ({e1:.0f}ms)")

print(f"\n{SEP}")
print(f"  Init={init_ms:.0f}ms | Tamil={e1:.0f}ms")
print(SEP)

engine.shutdown()
