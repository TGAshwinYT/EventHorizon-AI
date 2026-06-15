import sys
import os
import time
sys.path.insert(0, "app")
from dotenv import load_dotenv
load_dotenv()

import logging
logging.basicConfig(level=logging.INFO, format="%(message)s")

from app.services.azure_tts_engine import UniversalCasualIndianVoice

def test_mai_resilience():
    print("=" * 60)
    print("Testing UniversalCasualIndianVoice with MAI-Voice-2 & Fallbacks")
    print("=" * 60)
    
    # Initialize engine with MAI voice active (pre-warming hi and ta)
    t_init = time.perf_counter()
    engine = UniversalCasualIndianVoice(use_mai_voice_2=True, pre_warm_voices=["hi", "ta"])
    init_ms = (time.perf_counter() - t_init) * 1000
    print(f"\n[INIT] Engine initialized in {init_ms:.0f}ms")
    print(f"[INIT] Warm voices in pool: {engine.warm_voices}")
    
    # 1. Test Hindi (should use Priya MAI-Voice-2 since it's warmed and short text)
    print("\n------------------------------------------------------------")
    print("Test 1: Hindi (Should resolve to Priya MAI-Voice-2)")
    print("------------------------------------------------------------")
    out_hi = "audio_output/hi_mai_success.wav"
    t1 = time.perf_counter()
    a1 = engine.speak_natural(
        "नमस्ते दोस्तों! आज हम काम कर रहे हैं।",
        lang_code="hi",
        output_path=out_hi,
    )
    e1 = (time.perf_counter() - t1) * 1000
    if a1 and len(a1) > 46:
        print(f"=> Test 1 SUCCESS: {len(a1):,} bytes in {e1:.0f}ms")
        print(f"   Saved to {os.path.abspath(out_hi)}")
    else:
        print(f"=> Test 1 FAILED ({e1:.0f}ms)")
        
    # 2. Test Tamil (no MAI voice exists, should resolve to standard PallaviNeural)
    print("\n------------------------------------------------------------")
    print("Test 2: Tamil (Should resolve to standard PallaviNeural)")
    print("------------------------------------------------------------")
    out_ta = "audio_output/ta_standard_success.wav"
    t2 = time.perf_counter()
    a2 = engine.speak_natural(
        "வணக்கம் நண்பர்களே! இன்று வானிலை நன்றாக இருக்கிறது.",
        lang_code="ta",
        output_path=out_ta,
    )
    e2 = (time.perf_counter() - t2) * 1000
    if a2 and len(a2) > 46:
        print(f"=> Test 2 SUCCESS: {len(a2):,} bytes in {e2:.0f}ms")
        print(f"   Saved to {os.path.abspath(out_ta)}")
    else:
        print(f"=> Test 2 FAILED ({e2:.0f}ms)")
        
    # 3. Test Fallback (Hindi text that is too long or triggers timeout)
    # We will pass a longer text. Priya MAI-Voice-2 should fail/timeout, 
    # and the engine should transparently fall back to SwaraNeural standard voice.
    print("\n------------------------------------------------------------")
    print("Test 3: Fallback (Long Hindi text triggering MAI timeout -> fallback to Swara)")
    print("------------------------------------------------------------")
    out_fallback = "audio_output/hi_fallback_success.wav"
    long_text = (
        "नमस्ते दोस्तों। आज मौसम बहुत सुहाना है, और हम खेतों में काम कर रहे हैं। "
        "आशा है कि सब कुछ ठीक चल रहा होगा और फसलें बहुत अच्छी होंगी। "
        "हम इसे बहुत ही ध्यान से और प्यार से कर रहे हैं ताकि सब कुछ बहुत ही बढ़िया हो।"
    )
    t3 = time.perf_counter()
    a3 = engine.speak_natural(
        long_text,
        lang_code="hi",
        output_path=out_fallback,
    )
    e3 = (time.perf_counter() - t3) * 1000
    if a3 and len(a3) > 46:
        print(f"=> Test 3 SUCCESS: {len(a3):,} bytes in {e3:.0f}ms")
        print(f"   Saved to {os.path.abspath(out_fallback)}")
    else:
        print(f"=> Test 3 FAILED ({e3:.0f}ms)")
        
    engine.shutdown()

if __name__ == "__main__":
    test_mai_resilience()
