import { ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowUpRight } from 'lucide-react';

interface InfoCardProps {
    title: string;
    subtitle: string;
    details: string;
    icon: ReactNode;
    colorClass?: string;
    onClick?: () => void;
}

const InfoCard = ({ title, subtitle, details, icon, colorClass, onClick }: InfoCardProps) => {
    return (
        <div
            onClick={onClick}
            className={clsx(
                "relative w-72 p-5 rounded-2xl glass-panel group cursor-pointer transition-all duration-300 hover:scale-105",
                colorClass ? colorClass : "border-white/10 bg-white/5",
                "border"
            )}
        >
            <div className="absolute top-4 right-4 text-white/50 group-hover:text-white transition-colors">
                <ArrowUpRight size={20} />
            </div>

            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-4 text-white">
                {icon}
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
            <p className="text-2xl font-bold text-white mb-2">{subtitle}</p>

            <div className="text-xs text-gray-400 font-medium tracking-wide items-center gap-1 flex">
                {details}
            </div>

            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
    );
};

export default InfoCard;
