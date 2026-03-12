import { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, ArrowRight } from 'lucide-react';
import api from '../api';

const MandiDashboard = ({ commodity = "Tomato", market = "Azadpur" }: { commodity?: string, market?: string }) => {
  const [recentData, setRecentData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch Recent Data and Percentage Change
        const recentRes = await api.get(`/api/mandi/recent?commodity=${encodeURIComponent(commodity)}&market=${encodeURIComponent(market)}`);
        const recentJson = recentRes.data;
        
        // Fetch 30-day History + 5-day Forecast Data
        const forecastRes = await api.get(`/api/mandi/forecast?commodity=${encodeURIComponent(commodity)}&market=${encodeURIComponent(market)}`);
        const forecastJson = forecastRes.data;

        // Ensure chronological order for Recharts historical area chart
        const rawRecent = recentJson.recent_data || [];
        const sortedRecentHistory = [...rawRecent].reverse();

        setRecentData({
          ...recentJson,
          recent_data_history: sortedRecentHistory
        });
        
        setForecastData(Array.isArray(forecastJson) ? forecastJson : []);
      } catch (err: any) {
        console.error("MandiDashboard Fetch Error:", err);
        const errMsg = err.response?.data?.detail || err.message || "Failed to fetch market data";
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [commodity, market]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center bg-gray-900 rounded-xl border border-gray-800">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent"></div>
        <p className="text-gray-400">Loading Market Data for {commodity} at {market}...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400">
      <h3 className="text-lg font-semibold mb-2">Failed to load Mandi Data</h3>
      <p>{error}</p>
    </div>
  );

  if (!recentData) return null;

  const isPositiveTrend = recentData.percent_change >= 0;

  // Custom Tooltip for Forecast Chart
  const CustomForecastTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl">
          <p className="text-gray-300 font-medium mb-1">{label}</p>
          <p className="text-xl font-bold text-white">
            ₹{data.price} <span className="text-sm font-normal text-gray-400">/ quintal</span>
          </p>
          {data.isForecast && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
              AI Projected
            </span>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 w-full text-gray-100">
      {/* Header & Section 1: The "Today" Card */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-sm">
            {commodity} Market Analysis
          </h2>
          <p className="text-gray-400 flex items-center gap-2 mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
            Live Data from {market} Mandi
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-5 shadow-lg flex items-center gap-6 min-w-[280px]">
          <div>
            <p className="text-sm text-gray-400 mb-1 font-medium">Today's Modal Price</p>
            <h3 className="text-4xl font-black text-white tracking-tight">
              ₹{recentData.today_modal_price.toLocaleString()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">per quintal</p>
          </div>
          <div className="h-16 w-[1px] bg-gray-700"></div>
          <div className="flex flex-col items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
              isPositiveTrend 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {isPositiveTrend ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              <span className="font-bold text-lg">{Math.abs(recentData.percent_change)}%</span>
            </div>
            <span className="text-xs text-gray-400 mt-2">vs Yesterday</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: Recent Prices History */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 shadow-lg flex flex-col h-[450px]">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" />
            5-Day Price History
          </h3>
          
          <div className="h-[200px] w-full mb-6 relative">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentData.recent_data_history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af" 
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="modal_price" 
                  name="Modal Price (₹)"
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 overflow-auto rounded-xl border border-gray-700/50 bg-gray-900/50">
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-gray-400 uppercase bg-gray-800/80 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Min (₹)</th>
                  <th className="px-4 py-3 font-medium text-right">Max (₹)</th>
                  <th className="px-4 py-3 font-semibold text-emerald-400 text-right">Modal (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentData?.recent_data?.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 text-gray-300">{row.date}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{row.min_price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{row.max_price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-300">{row.modal_price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Mandi Forecast */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 shadow-lg flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-400" />
              35-Day Trend & AI Forecast
            </h3>
            <span className="text-xs font-medium px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Linear Regression Model
            </span>
          </div>

          <div className="flex-1 w-full relative">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af" 
                  tick={{fill: '#9ca3af', fontSize: 11}}
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  minTickGap={25}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{fill: '#9ca3af', fontSize: 11}}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomForecastTooltip />} />
                
                {/* Historical Line */}
                <Line 
                  type="monotone" 
                  dataKey={(d) => !d.isForecast ? d.price : null} 
                  name="Historical Data"
                  stroke="#94a3b8" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, fill: '#94a3b8', stroke: '#1e293b', strokeWidth: 2 }}
                />
                
                {/* Forecasted Line connected to the last historical point implicitly by rechart's connectNulls or handling it via unified datakey and mapping colors. 
                    A simpler robust approach in Recharts for two segments is one unified line, colored conditionally via defs, or split lines. 
                    Here we use unified data mapping but render the forecast separately. */}
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  name="AI Projection"
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#1e293b', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
            
            {/* Custom Legend Overlay */}
            <div className="absolute top-2 left-6 flex gap-4 text-xs">
               <div className="flex items-center gap-1.5 text-slate-300">
                  <div className="w-3 h-0.5 bg-slate-400"></div> Historical
               </div>
               <div className="flex items-center gap-1.5 text-blue-300">
                  <div className="w-3 h-0.5 border-t-2 border-dashed border-blue-500"></div> Forecast
               </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
             <div className="bg-blue-500/20 p-2 rounded-full hidden sm:block">
                <ArrowRight size={16} className="text-blue-400" />
             </div>
             <p className="text-sm text-gray-300 leading-relaxed">
               The AI model analyzes the past 30 days of market volatility to estimate short-term trajectory for <strong className="text-white">{commodity}</strong> at <strong className="text-white">{market}</strong>. Estimates are purely indicative.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MandiDashboard;
