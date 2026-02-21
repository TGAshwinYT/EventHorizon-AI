import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceHistoryChartProps {
    data: {
        date: string;
        price: number;
    }[];
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ data }) => {
    return (
        <div className="w-full h-64 bg-[#1A1B23] rounded-lg p-4 shadow-lg border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-green-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                </span>
                <h3 className="text-white font-semibold text-lg">Price History</h3>
            </div>
            <div className="w-full h-[250px] relative">
                {data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl">
                        No history data available for this selection in the last 7 days.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 10,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00FF7F" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#00FF7F" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#888', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#888', fontSize: 12 }}
                                tickFormatter={(value) => `₹${value}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                itemStyle={{ color: '#00FF7F' }}
                                formatter={(value: any) => [`₹${value}`, 'Price']}
                                labelStyle={{ color: '#9CA3AF' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke="#00FF7F"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorPrice)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PriceHistoryChart;
