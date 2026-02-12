import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketData {
    name: string;
    price: string;
    trend: 'up' | 'down' | 'stable';
}

interface MarketTickerProps {
    items: MarketData[];
}

const MarketTicker: React.FC<MarketTickerProps> = ({ items }) => {
    return (
        <div className="w-full bg-black/40 backdrop-blur-md border-t border-white/5 py-2 overflow-hidden select-none">
            <div className="flex whitespace-nowrap animate-scroll">
                {/* Duplicate items for seamless loop */}
                {[...items, ...items, ...items].map((item, index) => (
                    <div key={index} className="inline-flex items-center gap-2 px-8 border-r border-white/10 last:border-r-0">
                        <span className="text-gray-400 font-medium">{item.name}:</span>
                        <span className="text-white font-semibold">{item.price}</span>
                        {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                        {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
                        {item.trend === 'stable' && <Minus className="w-4 h-4 text-gray-400" />}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketTicker;
