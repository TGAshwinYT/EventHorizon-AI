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
        <aside className="w-24 h-full glass-panel flex flex-col items-center py-8 z-20 border-r border-white/10">
            <div className="mb-8">
                <div className="w-14 h-14 rounded-full overflow-hidden shadow-lg shadow-blue-500/20 border-2 border-white/20">
                    <img src="/assets/logo.jpg" alt="EventHorizon" className="w-full h-full object-cover" />
                </div>
            </div>

            <nav className="flex-1 flex flex-col gap-8 w-full px-4">
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-300 w-full group",
                                isActive ? "bg-white/10 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "text-gray-500 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={clsx("w-6 h-6", isActive && "text-blue-400")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                            {isActive && <div className="absolute left-0 w-1 h-8 bg-blue-400 rounded-r-full" />}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
