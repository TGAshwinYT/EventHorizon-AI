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
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
}

const Sidebar = ({ activeTab, setActiveTab, labels, username, displayName, avatarUrl }: SidebarProps) => {
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

            <div className="mb-8 scale-110">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold border-2 border-white/20 shadow-[0_0_20px_rgba(59,130,246,0.3)] overflow-hidden">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        displayName?.charAt(0).toUpperCase() || username?.charAt(0).toUpperCase() || 'A'
                    )}
                </div>
            </div>

            <nav className="flex-1 flex flex-col gap-6 w-full px-3">
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const getIconFill = () => {
                        if (item.id === 'home') return "currentColor";
                        if (item.id === 'agriculture' || item.id === 'skills') return "url(#icon-gradient)";
                        if (item.id === 'settings') return "#6b7280";
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
                                stroke={item.id === 'home' || item.id === 'settings' ? 'currentColor' : 'none'} // Remove default stroke for gradient icons for a pure fill shape, or keep for others to not destroy shape.
                            />
                            <span className="text-[11px] font-semibold tracking-wide">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
