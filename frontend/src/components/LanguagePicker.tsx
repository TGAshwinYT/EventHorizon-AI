import { useUserStore } from '../store/userStore';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  subText: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🌴', subText: 'தமிழ்நாடு' },
  { code: 'ta-en', name: 'Tanglish', nativeName: 'Tamil + Eng', flag: '🗣️', subText: 'Conversational' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🌾', subText: 'उत्तर भारत' },
  { code: 'hi-en', name: 'Hinglish', nativeName: 'Hindi + Eng', flag: '💬', subText: 'Conversational' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🍯', subText: 'ஆந்திரா / தெலங்கானா' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🌻', subText: 'கர்நாடகா' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🥥', subText: 'கேரளா' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🐟', subText: 'மேற்கு வங்கம்' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🌅', subText: 'மகாராஷ்டிரா' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '☀️', subText: 'பஞ்சாப்' }
];

export default function LanguagePicker({ onNext }: { onNext: () => void }) {
  const activeLanguage = useUserStore((state) => state.activeLanguage);
  const setActiveLanguage = useUserStore((state) => state.setActiveLanguage);

  const handleSelect = (code: string) => {
    setActiveLanguage(code);
    onNext();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-[#1A4731] tracking-tight">
          உங்களது மொழியைத் தேர்ந்தெடுக்கவும்
        </h2>
        <p className="mt-2 text-[#5a6e5a] font-medium text-lg">
          Select your language to begin talking with Horizon
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {LANGUAGES.map((lang) => {
          const isSelected = activeLanguage === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`relative flex flex-col items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 text-left cursor-pointer group shadow-sm hover:shadow-md ${
                isSelected
                  ? 'border-[#1A4731] bg-[#eef7f2] scale-102'
                  : 'border-[#eaeae0] bg-white hover:border-[#F5A623] hover:bg-[#fafaf7]'
              }`}
            >
              {/* Selected Badge */}
              {isSelected && (
                <span className="absolute top-2 right-2 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A4731] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#1A4731]"></span>
                </span>
              )}

              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                {lang.flag}
              </div>

              <div className="text-center w-full">
                <div className="font-bold text-[#1A4731] text-lg mb-0.5">
                  {lang.nativeName}
                </div>
                <div className="text-xs font-semibold text-[#8b9b8b] uppercase tracking-wider">
                  {lang.name}
                </div>
                <div className="text-[10px] text-[#b0c0b0] mt-1 italic">
                  {lang.subText}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
