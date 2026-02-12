import { Globe } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

interface LanguageSelectorProps {
    currentLanguage: string;
    onLanguageChange: (lang: string) => void;
}

const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी (Hindi)' },
    { code: 'bn', label: 'বাংলা (Bengali)' },
    { code: 'te', label: 'తెలుగు (Telugu)' },
    { code: 'mr', label: 'मराठी (Marathi)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
    { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
    { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml', label: 'മലയാളം (Malayalam)' },
];

const LanguageSelector = ({ currentLanguage, onLanguageChange }: LanguageSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const currentLabel = languages.find(l => l.code === currentLanguage)?.label || 'Language';

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-full glass-button text-sm text-gray-300 hover:text-white transition-all"
            >
                <Globe className="w-4 h-4" />
                <span>{currentLabel}</span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-48 py-2 rounded-xl glass-panel border border-white/10 z-50">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    onLanguageChange(lang.code);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    "w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors",
                                    currentLanguage === lang.code ? "text-blue-400" : "text-gray-300"
                                )}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default LanguageSelector;
