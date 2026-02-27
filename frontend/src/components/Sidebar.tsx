import { Home, Sprout, GraduationCap, Settings } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    labels: {
        home: string;
        agriculture: string;
        skills: string;
        settings: string;
    };
}

const Sidebar = ({ activeTab, setActiveTab, labels }: SidebarProps) => {
    const menuItems = [
        { id: 'home', icon: Home, label: labels.home || 'Home' },
        { id: 'agriculture', icon: Sprout, label: labels.agriculture || 'Agriculture' },
        { id: 'skills', icon: GraduationCap, label: labels.skills || 'Skills' },
        { id: 'settings', icon: Settings, label: labels.settings || 'Settings' },
    ];

    return (
        <aside className="w-24 h-full bg-white/5 backdrop-blur-md border-r border-white/10 rounded-r-3xl flex flex-col items-center py-8 z-20">
            <svg width="0" height="0" className="absolute">
                <defs>
                    <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#c084fc" /> {/* vibrant purple */}
                        <stop offset="100%" stopColor="#3b82f6" /> {/* vibrant blue */}
                    </linearGradient>
                </defs>
            </svg>



            <nav className="flex-1 flex flex-col w-full px-3">
                <div className="flex-1 flex flex-col justify-center gap-6">
                    {menuItems.filter(i => i.id !== 'settings').map((item) => {
                        const isActive = activeTab === item.id;
                        const getIconFill = () => {
                            if (item.id === 'home') return "currentColor";
                            if (item.id === 'agriculture' || item.id === 'skills') return "url(#icon-gradient)";
                            return "currentColor";
                        };

                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={clsx(
                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-[20px] transition-all duration-300 w-full group",
                                    isActive ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]" : "text-gray-500 hover:text-white hover:bg-white/5 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                                )}
                            >
                                <item.icon
                                    className={clsx("w-7 h-7", isActive && item.id === 'home' && "text-white")}
                                    fill={getIconFill()}
                                    stroke={item.id === 'home' ? 'currentColor' : 'none'}
                                />
                                <span className="text-[11px] font-semibold tracking-wide">{item.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-auto pb-4">
                    {menuItems.filter(i => i.id === 'settings').map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={clsx(
                                    "flex flex-col items-center justify-center gap-2 p-3 rounded-[20px] transition-all duration-300 w-full group",
                                    isActive ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)]" : "text-gray-500 hover:text-white hover:bg-white/5 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                                )}
                            >
                                <item.icon
                                    className="w-7 h-7"
                                    fill="#6b7280"
                                    stroke="currentColor"
                                />
                                <span className="text-[11px] font-semibold tracking-wide">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
