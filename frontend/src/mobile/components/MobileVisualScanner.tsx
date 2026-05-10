import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Image, Search, Leaf, ArrowLeft, X, RotateCcw, Volume2, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

interface DiagnosisResult {
  plant_name: string;
  issue_detected: string;
  cause: string;
  severity: string;
  recommended_material: string;
  organic_alternative: string;
  application_method: string;
  confidence: string;
  remedy_price: string | null;
  remedy_link: string | null;
  diagnosis_text: string;
  diagnosis_translated: string;
  audio_url: string | null;
  error: string | null;
}

type ScannerState = 'selection' | 'camera' | 'preview' | 'loading' | 'result';

interface VisualScannerProps {
  language: string;
  token: string | null;
  onBack: () => void;
}

// Localized UI strings (minimal text, icon-heavy)
const LABELS: Record<string, Record<string, string>> = {
  en: { title: 'Crop Scanner', camera: 'Camera', gallery: 'Gallery', analyze: 'Analyze', back: 'Back', retake: 'Retake', thinking: 'AI is analyzing your crop...', healthy: 'Healthy!', buyNow: 'Buy', tryOrganic: 'Try Natural Fix First', chemical: 'Chemical Option', severity: 'Severity', confidence: 'Confidence', error: 'Could not analyze. Try again.' },
  hi: { title: 'फसल स्कैनर', camera: 'कैमरा', gallery: 'गैलरी', analyze: 'जांचें', back: 'वापस', retake: 'दोबारा', thinking: 'AI आपकी फसल की जांच कर रहा है...', healthy: 'स्वस्थ!', buyNow: 'खरीदें', tryOrganic: 'पहले प्राकृतिक उपाय', chemical: 'रासायनिक विकल्प', severity: 'गंभीरता', confidence: 'विश्वास', error: 'जांच नहीं हो सकी। फिर से कोशिश करें।' },
  ta: { title: 'பயிர் ஸ்கேனர்', camera: 'கேமரா', gallery: 'கேலரி', analyze: 'பகுப்பாய்வு', back: 'பின்', retake: 'மீண்டும்', thinking: 'AI உங்கள் பயிரை ஆய்வு செய்கிறது...', healthy: 'ஆரோக்கியம்!', buyNow: 'வாங்கு', tryOrganic: 'முதலில் இயற்கை தீர்வு', chemical: 'ரசாயன விருப்பம்', severity: 'தீவிரம்', confidence: 'நம்பகத்தன்மை', error: 'பகுப்பாய்வு செய்ய முடியவில்லை.' },
  te: { title: 'పంట స్కానర్', camera: 'కెమెరా', gallery: 'గ్యాలరీ', analyze: 'విశ్లేషించు', back: 'వెనుకకు', retake: 'మళ్ళీ', thinking: 'AI మీ పంటను విశ్లేషిస్తోంది...', healthy: 'ఆరోగ్యం!', buyNow: 'కొనండి', tryOrganic: 'ముందు సహజ పరిష్కారం', chemical: 'రసాయన ఎంపిక', severity: 'తీవ్రత', confidence: 'నమ్మకం', error: 'విశ్లేషించలేకపోయింది.' },
  bn: { title: 'ফসল স্ক্যানার', camera: 'ক্যামেরা', gallery: 'গ্যালারি', analyze: 'বিশ্লেষণ', back: 'পিছনে', retake: 'আবার', thinking: 'AI আপনার ফসল বিশ্লেষণ করছে...', healthy: 'সুস্থ!', buyNow: 'কিনুন', tryOrganic: 'প্রথমে প্রাকৃতিক সমাধান', chemical: 'রাসায়নিক বিকল্প', severity: 'তীব্রতা', confidence: 'আত্মবিশ্বাস', error: 'বিশ্লেষণ করা যায়নি।' },
  mr: { title: 'पीक स्कॅनर', camera: 'कॅमेरा', gallery: 'गॅलरी', analyze: 'तपासा', back: 'मागे', retake: 'पुन्हा', thinking: 'AI तुमचे पीक तपासत आहे...', healthy: 'निरोगी!', buyNow: 'खरेदी', tryOrganic: 'आधी नैसर्गिक उपाय', chemical: 'रासायनिक पर्याय', severity: 'तीव्रता', confidence: 'विश्वास', error: 'तपासता आले नाही.' },
  gu: { title: 'પાક સ્કેનર', camera: 'કેમેરા', gallery: 'ગેલેરી', analyze: 'તપાસો', back: 'પાછા', retake: 'ફરીથી', thinking: 'AI તમારા પાકની તપાસ કરી રહ્યું છે...', healthy: 'તંદુરસ્ત!', buyNow: 'ખરીદો', tryOrganic: 'પહેલા કુદરતી ઉપાય', chemical: 'રાસાયણિક વિકલ્પ', severity: 'તીવ્રતા', confidence: 'વિશ્વાસ', error: 'તપાસ થઈ શકી નથી.' },
  kn: { title: 'ಬೆಳೆ ಸ್ಕ್ಯಾನರ್', camera: 'ಕ್ಯಾಮೆರಾ', gallery: 'ಗ್ಯಾಲರಿ', analyze: 'ವಿಶ್ಲೇಷಿಸಿ', back: 'ಹಿಂದೆ', retake: 'ಮತ್ತೆ', thinking: 'AI ನಿಮ್ಮ ಬೆಳೆಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದೆ...', healthy: 'ಆರೋಗ್ಯಕರ!', buyNow: 'ಖರೀದಿಸಿ', tryOrganic: 'ಮೊದಲು ನೈಸರ್ಗಿಕ ಪರಿಹಾರ', chemical: 'ರಾಸಾಯನಿಕ ಆಯ್ಕೆ', severity: 'ತೀವ್ರತೆ', confidence: 'ವಿಶ್ವಾಸ', error: 'ವಿಶ್ಲೇಷಿಸಲಾಗಲಿಲ್ಲ.' },
  ml: { title: 'വിള സ്കാനർ', camera: 'ക്യാമറ', gallery: 'ഗാലറി', analyze: 'വിശകലനം', back: 'തിരികെ', retake: 'വീണ്ടും', thinking: 'AI നിങ്ങളുടെ വിള പരിശോധിക്കുന്നു...', healthy: 'ആരോഗ്യകരം!', buyNow: 'വാങ്ങുക', tryOrganic: 'ആദ്യം പ്രകൃതി പരിഹാരം', chemical: 'രാസ ഓപ്ഷൻ', severity: 'തീവ്രത', confidence: 'ആത്മവിശ്വാസം', error: 'വിശകലനം ചെയ്യാനായില്ല.' },
};

/**
 * Compress image via canvas to <50KB JPEG for 2G networks.
 * Resizes to max 480px width, iteratively reduces quality.
 */
async function compressImage(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_W = 480;
      let w = img.width, h = img.height;
      if (w > MAX_W) { h = (h * MAX_W) / w; w = MAX_W; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas failed')); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // Iteratively reduce quality to get under 50KB
      let quality = 0.5;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length * 0.75 > 50000 && quality > 0.1) {
        quality -= 0.05;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      // Strip the data:image/jpeg;base64, prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file instanceof File ? file : file);
  });
}

const MobileVisualScanner = ({ language, token, onBack }: VisualScannerProps) => {
  const [state, setState] = useState<ScannerState>('selection');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedBase64, setCompressedBase64] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const L = LABELS[language] || LABELS['en'];

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Camera ──
  const openCamera = useCallback(async () => {
    setError(null);
    setState('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied');
      setState('selection');
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);

    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const b64 = await compressImage(blob);
        setCompressedBase64(b64);
        setImagePreview(`data:image/jpeg;base64,${b64}`);
        setState('preview');
      } catch (e) {
        console.error('Compression failed:', e);
        setError('Image compression failed');
        setState('selection');
      }
    }, 'image/jpeg', 0.8);
  }, []);

  // ── Gallery ──
  const openGallery = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const b64 = await compressImage(file);
      setCompressedBase64(b64);
      setImagePreview(`data:image/jpeg;base64,${b64}`);
      setState('preview');
    } catch (err) {
      console.error('Gallery compression failed:', err);
      setError('Could not process image');
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Analyze ──
  const analyzeImage = useCallback(async () => {
    if (!compressedBase64) return;
    setState('loading');
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/scanner/diagnose', {
        method: 'POST',
        headers,
        body: JSON.stringify({ image_base64: compressedBase64, language }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: DiagnosisResult = await res.json();

      if (data.error) {
        setError(data.error);
        setState('preview');
      } else {
        setDiagnosis(data);
        setState('result');
        // Auto-play TTS if available
        if (data.audio_url) {
          const audio = new Audio(data.audio_url);
          audioRef.current = audio;
          audio.play().catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('Diagnosis failed:', err);
      if (err.name === 'AbortError') {
        setError('Analysis took too long. Please try again.');
      } else {
        setError(err.message || L.error);
      }
      setState('preview');
    }
  }, [compressedBase64, token, language, L.error]);

  const playAudio = useCallback(() => {
    if (diagnosis?.audio_url) {
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(diagnosis.audio_url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }
  }, [diagnosis]);

  const reset = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setImagePreview(null);
    setCompressedBase64(null);
    setDiagnosis(null);
    setError(null);
    setState('selection');
  }, []);

  // ── Shared styles ──
  const btnBase = "flex items-center justify-center gap-3 min-h-[64px] text-xl font-bold rounded-2xl transition-all duration-200 active:scale-95 select-none";
  const btnPrimary = `${btnBase} bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 px-8 py-5 w-full`;
  const btnSecondary = `${btnBase} glass-button text-gray-200 px-8 py-5 w-full`;
  const btnSmall = "flex items-center justify-center gap-2 min-h-[56px] text-lg font-semibold rounded-xl transition-all duration-200 active:scale-95 px-6 py-3";

  return (
    <div className="flex flex-col h-full w-full text-white overflow-hidden relative">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-3 z-10">
        <button onClick={state === 'selection' ? onBack : reset} className="p-3 rounded-xl glass-button">
          <ArrowLeft className="w-7 h-7 text-gray-300" />
        </button>
        <div className="flex items-center gap-2">
          <Leaf className="w-7 h-7 text-emerald-400" />
          <h1 className="text-xl font-bold text-gray-100">{L.title}</h1>
        </div>
      </header>

      {/* ── Selection State ── */}
      {state === 'selection' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 animate-fade-in z-10">
          <div className="w-28 h-28 rounded-full glass-panel flex items-center justify-center mb-4">
            <Search className="w-14 h-14 text-emerald-400" />
          </div>

          <button id="scanner-camera-btn" onClick={openCamera} className={btnPrimary}>
            <Camera className="w-8 h-8" />
            <span>{L.camera}</span>
          </button>

          <button id="scanner-gallery-btn" onClick={openGallery} className={btnSecondary}>
            <Image className="w-8 h-8" />
            <span>{L.gallery}</span>
          </button>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

          {error && (
            <div className="glass-panel border-red-500/40 rounded-xl px-5 py-3 text-red-300 text-center text-base w-full">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Camera State ── */}
      {state === 'camera' && (
        <div className="flex-1 flex flex-col relative animate-fade-in z-10">
          <video ref={videoRef} autoPlay playsInline muted className="flex-1 object-cover bg-black w-full" />
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
            <div className="flex items-center justify-center gap-6">
              <button onClick={reset} className="p-4 rounded-full glass-button">
                <X className="w-7 h-7 text-gray-300" />
              </button>
              <button id="scanner-capture-btn" onClick={capturePhoto}
                className="w-20 h-20 rounded-full bg-white border-4 border-emerald-400 shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-emerald-300" />
              </button>
              <div className="w-16" /> {/* Spacer */}
            </div>
          </div>
        </div>
      )}

      {/* ── Preview State ── */}
      {state === 'preview' && imagePreview && (
        <div className="flex-1 flex flex-col animate-fade-in min-h-0 z-10">
          <div className="flex-1 relative min-h-0">
            <img src={imagePreview} alt="Captured crop" className="w-full h-full object-contain bg-black/40" />
          </div>
          <div className="p-5 space-y-3 glass-panel shrink-0 border-x-0 border-b-0 rounded-t-3xl">
            {error && (
              <div className="glass-panel border-red-500/40 rounded-xl px-5 py-3 text-red-300 text-center text-base mb-2">
                {error}
              </div>
            )}
            <button id="scanner-analyze-btn" onClick={analyzeImage} className={btnPrimary}>
              <Search className="w-8 h-8" />
              <span>{L.analyze}</span>
            </button>
            <button onClick={reset} className={btnSecondary}>
              <RotateCcw className="w-6 h-6" />
              <span>{L.retake}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Loading State ── */}
      {state === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 animate-fade-in z-10">
          {imagePreview && (
            <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500/30 opacity-60">
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {/* Pulse animation */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-emerald-500/50 flex items-center justify-center">
              <Leaf className="w-8 h-8 text-emerald-100 animate-pulse" />
            </div>
          </div>
          <p className="text-gray-100 text-xl font-medium text-center animate-pulse">{L.thinking}</p>
          <p className="text-gray-400 text-sm text-center">2G network — this may take a moment</p>
        </div>
      )}

      {/* ── Result State ── */}
      {state === 'result' && diagnosis && (
        <div className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar animate-fade-in z-10">
          {/* Diagnosis Card */}
          <div className="glass-panel rounded-3xl p-6 mt-2 space-y-6">
            {/* Status Header */}
            <div className="flex items-center gap-4">
              {diagnosis.issue_detected === 'healthy' ? (
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
              ) : diagnosis.issue_detected === 'not_a_plant' ? (
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{diagnosis.plant_name}</h2>
                <p className={`text-lg font-medium mt-1 ${
                  diagnosis.issue_detected === 'healthy' ? 'text-emerald-400' :
                  diagnosis.issue_detected === 'not_a_plant' ? 'text-yellow-400' : 'text-red-400'
                }`}>{diagnosis.issue_detected === 'healthy' ? L.healthy : diagnosis.issue_detected}</p>
              </div>
            </div>

            {/* Cause + Severity */}
            {diagnosis.issue_detected !== 'healthy' && diagnosis.issue_detected !== 'not_a_plant' && (
              <div className="space-y-4">
                <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
                  <p className="text-gray-300"><span className="text-white font-semibold">{L.severity}:</span> <span className={
                    diagnosis.severity === 'severe' ? 'text-red-400 font-bold' :
                    diagnosis.severity === 'moderate' ? 'text-yellow-400 font-semibold' : 'text-emerald-400'
                  }>{diagnosis.severity}</span></p>
                  <p className="text-gray-300 text-base mt-2 leading-relaxed">{diagnosis.cause}</p>
                </div>

                {/* Organic Fix */}
                {diagnosis.organic_alternative && diagnosis.organic_alternative !== 'N/A' && (
                  <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-5">
                    <p className="text-emerald-400 font-semibold text-sm tracking-wider uppercase mb-2 flex items-center gap-2">
                      <Leaf className="w-4 h-4" /> {L.tryOrganic}
                    </p>
                    <p className="text-gray-200 text-base leading-relaxed">{diagnosis.organic_alternative}</p>
                  </div>
                )}

                {/* Chemical Fix + Price */}
                {diagnosis.recommended_material && diagnosis.recommended_material !== 'N/A' && diagnosis.recommended_material !== 'none_needed' && (
                  <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-5">
                    <p className="text-blue-400 font-semibold text-sm tracking-wider uppercase mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> {L.chemical}
                    </p>
                    <p className="text-white text-lg font-medium">{diagnosis.recommended_material}</p>
                    {diagnosis.application_method && diagnosis.application_method !== 'N/A' && (
                      <p className="text-gray-400 text-sm mt-2">{diagnosis.application_method}</p>
                    )}
                    {diagnosis.remedy_price && (
                      <p className="text-yellow-400 font-bold text-xl mt-4 bg-yellow-500/10 inline-block px-3 py-1 rounded-lg border border-yellow-500/20">{diagnosis.remedy_price}</p>
                    )}
                    {diagnosis.remedy_link && (
                      <a href={diagnosis.remedy_link} target="_blank" rel="noopener noreferrer"
                        className={`${btnSmall} bg-blue-600 hover:bg-blue-500 text-white mt-4 w-full shadow-lg shadow-blue-900/20`}>
                        <ExternalLink className="w-5 h-5" />
                        <span>{L.buyNow}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Translated Summary */}
            <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
              <p className="text-gray-300 text-base leading-relaxed">
                {diagnosis.diagnosis_translated || diagnosis.diagnosis_text}
              </p>
            </div>

            {/* Audio playback */}
            {diagnosis.audio_url && (
              <button onClick={playAudio} className={`${btnSmall} glass-button w-full`}>
                <Volume2 className="w-6 h-6 text-emerald-400" />
                <span className="text-gray-200">Play Audio</span>
              </button>
            )}
          </div>

          {/* Scan Again */}
          <button onClick={reset} className={`${btnPrimary} mt-4`}>
            <RotateCcw className="w-6 h-6" />
            <span>{L.retake}</span>
          </button>
        </div>
      )}

      {/* Background glow aligned with App theme */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
};

export default MobileVisualScanner;
