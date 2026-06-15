import React, { useState, useEffect, memo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceHistoryChartProps {
    data: {
        date: string;
        price: number;
    }[];
}

const MobilePriceHistoryChart: React.FC<PriceHistoryChartProps> = memo(({ data }) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <div className="w-full h-48 bg-black/20 rounded-xl p-2 relative min-w-0">
            <div className="w-full h-full min-w-0">
                {data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[10px] border border-dashed border-white/5 rounded-xl">
                        No data available
                    </div>
                ) : isMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorPriceMobile" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00FF7F" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#00FF7F" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.3} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#666', fontSize: 9 }}
                                dy={5}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#666', fontSize: 9 }}
                                tickFormatter={(value) => `₹${value}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '10px', padding: '4px' }}
                                itemStyle={{ color: '#00FF7F', padding: '0px' }}
                                formatter={(value: any) => [`₹${value}`, '']}
                                labelStyle={{ color: '#666', marginBottom: '2px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke="#00FF7F"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorPriceMobile)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : null}
            </div>
        </div>
    );
});

export default MobilePriceHistoryChart;
