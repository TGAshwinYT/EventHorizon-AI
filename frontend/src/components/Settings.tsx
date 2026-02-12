import { useState } from 'react';
import { Save, User, Globe, FileText, Download, Trash2, ArrowLeft } from 'lucide-react';
import LanguageSelector from './LanguageSelector'; // Reuse existing component

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

interface SettingsProps {
    onBack: () => void;
    messages: Message[];
    onDeleteMessage: (id: string) => void;
    onClearHistory: () => void;
    currentLanguage: string;
    onLanguageChange: (lang: string) => void;
    username: string | null;
    onUpdateProfile: (name: string, avatar?: string) => void;
    onLogout: () => void;
}


const Settings = ({ onBack, messages, onDeleteMessage, onClearHistory, currentLanguage, onLanguageChange, username, onUpdateProfile, onLogout }: SettingsProps) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'language' | 'data'>('profile');
    const [newUsername, setNewUsername] = useState(username || '');
    const [status, setStatus] = useState('');

    const handleSaveProfile = () => {
        onUpdateProfile(newUsername);
        setStatus('Profile updated!');
        setTimeout(() => setStatus(''), 2000);
    };

    const handleDownloadData = () => {
        const data = {
            username,
            language: currentLanguage,
            history: messages
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eventhorizon_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('Data downloaded!');
        setTimeout(() => setStatus(''), 2000);
    };

    return (
        <div className="w-full max-w-4xl mx-auto my-auto backdrop-blur-md bg-black/40 rounded-3xl p-6 border border-white/10 text-white h-[80vh] flex flex-col shadow-2xl animate-fade-in">
            <header className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">Settings</h2>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 border-r border-white/10 pr-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-white/5'}`}
                    >
                        <User className="w-5 h-5" />
                        <span>Profile</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-gray-400 hover:bg-white/5'}`}
                    >
                        <FileText className="w-5 h-5" />
                        <span>History</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('language')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'language' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:bg-white/5'}`}
                    >
                        <Globe className="w-5 h-5" />
                        <span>Language</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'data' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:bg-white/5'}`}
                    >
                        <Download className="w-5 h-5" />
                        <span>Data & Privacy</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 pl-8 overflow-y-auto custom-scrollbar">
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-slide-up">
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <User className="w-6 h-6 text-blue-400" />
                                My Profile
                            </h3>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-6 mb-6">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold border-4 border-black/50 shadow-lg">
                                        {username?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                                        <input
                                            type="text"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500/50 w-full max-w-xs"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveProfile}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <button onClick={onLogout} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                    <Trash2 className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="h-full flex flex-col animate-slide-up">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FileText className="w-6 h-6 text-purple-400" />
                                    Conversation History
                                </h3>
                                {messages.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to delete all history? This action cannot be undone.')) onClearHistory();
                                        }}
                                        className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 rounded-lg text-sm transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Clear All
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto pb-4 pr-2 custom-scrollbar">
                                {messages.length === 0 ? (
                                    <div className="text-center text-gray-500 py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        No conversation history found.
                                    </div>
                                ) : (
                                    messages.slice().reverse().map((msg) => ( // Show newest first
                                        <div key={msg.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-start group hover:bg-white/10 transition-colors">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold uppercase ${msg.sender === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                        {msg.sender}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {msg.timestamp.toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-gray-300 text-sm line-clamp-2 md:line-clamp-3">{msg.text}</p>
                                            </div>
                                            <button
                                                onClick={() => onDeleteMessage(msg.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete Message"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'language' && (
                        <div className="space-y-6 animate-slide-up">
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <Globe className="w-6 h-6 text-emerald-400" />
                                Language Preferences
                            </h3>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <p className="text-gray-400 mb-6">Select your preferred language. This will be the default language whenever you open the application.</p>

                                <div className="flex items-start">
                                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10 inline-block">
                                        <label className="block text-sm text-gray-400 mb-2">Default Language</label>
                                        <LanguageSelector currentLanguage={currentLanguage} onLanguageChange={onLanguageChange} />
                                    </div>
                                </div>
                                <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                                    <span className="font-bold">Note:</span> Your preference is automatically saved.
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-6 animate-slide-up">
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                                <Download className="w-6 h-6 text-amber-400" />
                                Data & Privacy
                            </h3>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <h4 className="font-bold text-lg mb-2">Download Your Data</h4>
                                <p className="text-gray-400 mb-6">You can download a copy of your profile information and conversation history in JSON format.</p>
                                <button
                                    onClick={handleDownloadData}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-5 h-5" />
                                    Download My Data
                                </button>
                            </div>
                        </div>
                    )}

                    {status && (
                        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg animate-bounce-in flex items-center gap-2 z-50">
                            <Save className="w-5 h-5" />
                            {status}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
