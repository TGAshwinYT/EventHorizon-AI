import { Home, Sprout, GraduationCap, Settings, ScanLine, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    labels: {
        home: string;
        agriculture: string;
        scanner: string;
        risk: string;
        skills: string;
        settings: string;
    };
}

const MobileSidebar = ({ activeTab, setActiveTab, labels }: SidebarProps) => {
    const menuItems = [
        { id: 'home', icon: Home, label: labels.home || 'Home' },
        { id: 'agriculture', icon: Sprout, label: labels.agriculture || 'Agri' },
        { id: 'scanner', icon: ScanLine, label: labels.scanner || 'Scan' },
        { id: 'risk', icon: ShieldAlert, label: labels.risk || 'HarvestIQ' },
        { id: 'skills', icon: GraduationCap, label: labels.skills || 'Skills' },
        { id: 'settings', icon: Settings, label: labels.settings || 'Settings' },
    ];

    return (
        <nav className="fixed bottom-0 w-full h-[80px] bg-slate-950/90 backdrop-blur-lg border-t border-white/10 z-50 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            <svg width="0" height="0" className="absolute">
                <defs>
                    <linearGradient id="icon-gradient-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#c084fc" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                </defs>
            </svg>

            {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                const getIconFill = () => {
                    if (item.id === 'home' || item.id === 'settings' || item.id === 'scanner') return "currentColor";
                    if (item.id === 'agriculture' || item.id === 'skills') return "url(#icon-gradient-mobile)";
                    return "currentColor";
                };

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={clsx(
                            "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-300",
                            isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        <div className={clsx("p-1.5 rounded-full transition-all duration-300", isActive && "bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]")}>
                            <item.icon
                                className={clsx("w-6 h-6")}
                                fill={isActive && item.id !== 'settings' && item.id !== 'scanner' ? getIconFill() : 'none'}
                                stroke="currentColor"
                            />
                        </div>
                        <span className={clsx("text-[10px] font-medium tracking-wide", isActive ? "text-white" : "text-gray-500")}>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default MobileSidebar;
