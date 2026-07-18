// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Dashboard.
// Fungsinya adalah untuk mengambil, memproses, dan memvisualisasikan data analitik
// seperti total pendapatan, jumlah transaksi, produk terlaris, dan performa cabang.
// Komponen ini juga memiliki integrasi dengan Gemini AI untuk memberikan insight.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useBranch } from '../contexts/BranchContext';
import { 
    ArrowTrendingUpIcon, 
    ArrowTrendingDownIcon, 
    CurrencyDollarIcon, 
    ShoppingCartIcon, 
    BuildingStorefrontIcon, 
    ScaleIcon,
    TrophyIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
    SpinnerIcon
} from '../components/icons';
import * as api from '../backend/api';
import { GoogleGenAI } from "@google/genai";

const StatCard: React.FC<{
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ElementType;
}> = React.memo(({ title, value, change, isPositive, icon: Icon }) => {
    const changeColor = isPositive ? 'text-emerald-500' : 'text-red-500';
    const TrendIcon = isPositive ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;

    return (
        <div className="bg-white p-5 rounded-xl shadow-lg border border-slate-200/80">
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
                </div>
                <div className={`p-2 rounded-full ${isPositive ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <Icon className={`h-6 w-6 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
                </div>
            </div>
            <div className="flex items-center text-xs mt-3">
                <TrendIcon className={`w-4 h-4 mr-1 ${changeColor}`} />
                <span className={`${changeColor} font-semibold`}>{change}</span>
                <span className="text-slate-500 ml-1">vs periode sebelumnya</span>
            </div>
        </div>
    );
});

// Memoized Chart to prevent heavy SVG recalculations on parent re-renders
const LineChart: React.FC<{ data: { label: string; value: number }[] }> = React.memo(({ data }) => {
    const chartHeight = 250;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = 500;

    // Memoize heavy math calculations
    const { points, maxVal, labelStep } = useMemo(() => {
        const max = Math.max(...data.map(d => d.value), 0);
        const effectiveMax = max === 0 ? 100 : max; // Prevent division by zero
        
        const pts = data.map((d, i) => {
            const x = padding.left + (i / (data.length - 1 || 1)) * (width - padding.left - padding.right);
            const y = chartHeight - padding.bottom - (d.value / effectiveMax) * (chartHeight - padding.top - padding.bottom);
            return `${x},${y}`;
        }).join(' ');

        // Optimize label density based on data length
        const step = data.length > 12 ? Math.ceil(data.length / 6) : 1;
        
        return { points: pts, maxVal: effectiveMax, labelStep: step };
    }, [data]);

    if (data.length < 2) {
        return <div className="flex items-center justify-center h-[250px] text-slate-500">Data tidak cukup untuk menampilkan grafik.</div>;
    }

    return (
        <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full h-auto">
            {/* Y-Axis labels */}
            {[...Array(5)].map((_, i) => {
                const y = chartHeight - padding.bottom - (i / 4) * (chartHeight - padding.top - padding.bottom);
                const val = (i / 4) * maxVal;
                return (
                    <g key={i}>
                        <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-xs fill-slate-500">
                            {val >= 1000000 ? `${(val / 1000000).toFixed(1)}Jt` : val >= 1000 ? `${(val / 1000).toFixed(0)}rb` : val.toFixed(0)}
                        </text>
                        <line x1={padding.left} y1={y} x2={width-padding.right} y2={y} className="stroke-slate-200" strokeDasharray="2" />
                    </g>
                )
            })}
             {/* X-Axis labels */}
            {data.map((d, i) => {
                if (i % labelStep !== 0) return null;
                const x = padding.left + (i / (data.length - 1 || 1)) * (width - padding.left - padding.right);
                return <text key={i} x={x} y={chartHeight - 10} textAnchor="middle" className="text-xs fill-slate-500">{d.label}</text>
            })}
             {/* Line */}
            <polyline fill="none" stroke="var(--primary-color)" strokeWidth="2" points={points} strokeLinejoin="round" />
        </svg>
    )
});


const DashboardPage: React.FC = () => {
    const [timePeriod, setTimePeriod] = useState<1 | 7 | 30 | 90>(1);
    const { selectedGroupId, selectableBranches } = useBranch();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [aiInsight, setAiInsight] = useState<any | null>(null);
    const [isFetchingInsight, setIsFetchingInsight] = useState<boolean>(false);
    const [insightError, setInsightError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const branchIdsInScope = selectableBranches.map(b => b.id_cabang);
        try {
            const data = await api.getDashboardData({ timePeriod, groupId: selectedGroupId, branchIds: branchIdsInScope });
            setDashboardData(data);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [timePeriod, selectedGroupId, selectableBranches]);
    
    useEffect(() => {
        fetchData();
        // Reset AI insight when filters change to avoid stale data
        setAiInsight(null);
        setInsightError(null);
    }, [fetchData]);


    const calculateChange = (current: number, previous: number): string => {
        if (previous === 0) return current > 0 ? '+100%' : '0%';
        const change = ((current - previous) / previous) * 100;
        return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const formatCurrency = (value: number) => {
        if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)} M`;
        if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)} Jt`;
        if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)} rb`;
        return `Rp ${value.toLocaleString('id-ID')}`;
    };

    const handleFetchInsight = async () => {
        if (!dashboardData) return;
        setIsFetchingInsight(true);
        setInsightError(null);
        setAiInsight(null);
        
        const { currentStats, previousStats, bestBranch, topSellingProducts, topProfitableProducts } = dashboardData;

        // Keep prompt data concise to save tokens and reduce latency
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const dataSummary = `
            Period: Last ${timePeriod} days.
            Revenue: ${formatCurrency(currentStats.totalRevenue)} (${calculateChange(currentStats.totalRevenue, previousStats.totalRevenue)} vs prev).
            Tx Count: ${currentStats.transactionCount} (${calculateChange(currentStats.transactionCount, previousStats.transactionCount)} vs prev).
            Best Branch: ${bestBranch ? `${bestBranch.name}` : 'N/A'}.
            Top Product (Vol): ${topSellingProducts[0]?.name || 'N/A'}.
            Top Product (Profit): ${topProfitableProducts[0]?.name || 'N/A'}.
        `;
        
        const prompt = `Act as an expert business analyst. Based on this sales summary: ${dataSummary}. Provide 1 short insight and 1 actionable recommendation. JSON format: { "insight": "...", "recommendation": "..." }. Indonesian language.`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });
            const parsedResponse = JSON.parse(response.text);
            setAiInsight(parsedResponse);
        } catch (error) {
            console.error("Error fetching AI insight:", error);
            setInsightError("Gagal mendapatkan insight.");
        } finally {
            setIsFetchingInsight(false);
        }
    };
    
    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex justify-center items-center h-full">
                <SpinnerIcon className="w-10 h-10 text-sky-500" />
            </div>
        );
    }

    if (!dashboardData) {
        return <div className="p-8 text-center text-slate-500">Gagal memuat data dashboard.</div>
    }

    const { currentStats, previousStats, bestBranch, worstBranch, topSellingProducts, topProfitableProducts, chartData } = dashboardData;
    const revenueChange = calculateChange(currentStats.totalRevenue, previousStats.totalRevenue);
    const transactionCountChange = calculateChange(currentStats.transactionCount, previousStats.transactionCount);
    const avgTransactionChange = calculateChange(currentStats.avgTransaction, previousStats.avgTransaction);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-full">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Dashboard Analitik</h1>
                <div className="flex items-center space-x-2 bg-slate-200 p-1 rounded-lg mt-3 sm:mt-0">
                    {[
                        { label: 'Hari Ini', period: 1 as const },
                        { label: '7 Hari', period: 7 as const },
                        { label: '30 Hari', period: 30 as const },
                        { label: '90 Hari', period: 90 as const }
                    ].map(item => (
                        <button
                            key={item.period}
                            onClick={() => setTimePeriod(item.period)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                timePeriod === item.period ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-300/50'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                <StatCard title="Total Pendapatan" value={formatCurrency(currentStats.totalRevenue)} change={revenueChange} isPositive={currentStats.totalRevenue >= previousStats.totalRevenue} icon={CurrencyDollarIcon} />
                <StatCard title="Total Transaksi" value={currentStats.transactionCount.toLocaleString()} change={transactionCountChange} isPositive={currentStats.transactionCount >= previousStats.transactionCount} icon={ShoppingCartIcon} />
                <StatCard title="Rata-rata Transaksi" value={formatCurrency(currentStats.avgTransaction)} change={avgTransactionChange} isPositive={currentStats.avgTransaction >= previousStats.avgTransaction} icon={ScaleIcon} />
                <StatCard title="Cabang Aktif" value={`${currentStats.activeBranches || 0} / ${selectableBranches.length}`} change={`${(((currentStats.activeBranches || 0) / (selectableBranches.length || 1)) * 100).toFixed(0)}%`} isPositive={true} icon={BuildingStorefrontIcon} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200/80 col-span-1 lg:col-span-3">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Grafik Pendapatan ({timePeriod === 1 ? 'Jam per Jam' : 'Hari per Hari'})</h2>
                    <LineChart data={chartData} />
                </div>
                
                <div className="space-y-6 lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200/80">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Performa Cabang</h2>
                        <div className="space-y-3">
                            {bestBranch ? (
                                <div className="text-sm">
                                    <p className="font-medium text-slate-500 flex items-center"><TrophyIcon className="w-4 h-4 mr-2 text-amber-500"/>Cabang Terbaik</p>
                                    <p className="font-bold text-slate-800 text-base">{bestBranch.name}</p>
                                    <p className="font-semibold text-emerald-600">{formatCurrency(bestBranch.totalRevenue)}</p>
                                </div>
                            ) : (<p className="text-sm text-slate-500 text-center">Data tidak cukup untuk perbandingan cabang.</p>)}
                            {worstBranch && bestBranch?.name !== worstBranch.name && (
                                <div className="text-sm pt-3 border-t border-slate-100">
                                    <p className="font-medium text-slate-500 flex items-center"><ExclamationTriangleIcon className="w-4 h-4 mr-2 text-red-500"/>Perlu Perhatian</p>
                                    <p className="font-bold text-slate-800 text-base">{worstBranch.name}</p>
                                    <p className="font-semibold text-red-600">{formatCurrency(worstBranch.totalRevenue)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200/80 lg:col-span-1">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Produk Terlaris (Unit)</h2>
                    <ul className="space-y-3">
                        {topSellingProducts.map((product: any, index: number) => (
                            <li key={product.id} className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700 truncate pr-2"><span className="font-bold w-6 inline-block">{index+1}.</span>{product.name}</span>
                                <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{product.quantity}</span>
                            </li>
                        ))}
                        {topSellingProducts.length === 0 && <p className="text-sm text-slate-500 text-center">Belum ada penjualan.</p>}
                    </ul>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200/80 lg:col-span-1">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Produk Paling Menguntungkan</h2>
                    <ul className="space-y-3">
                        {topProfitableProducts.map((product: any, index: number) => (
                            <li key={product.name} className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700 truncate pr-2"><span className="font-bold w-6 inline-block">{index+1}.</span>{product.name}</span>
                                <span className="font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-md">{formatCurrency(product.profit)}</span>
                            </li>
                        ))}
                        {topProfitableProducts.length === 0 && <p className="text-sm text-slate-500 text-center">Belum ada penjualan.</p>}
                    </ul>
                </div>

                <div className="bg-gradient-to-br from-sky-500 to-indigo-600 p-6 rounded-xl shadow-lg lg:col-span-3 text-white">
                     <h2 className="text-lg font-bold flex items-center mb-3"><SparklesIcon className="w-6 h-6 mr-2"/> Insight AI Cerdas</h2>
                     {isFetchingInsight ? (
                         <div className="flex items-center justify-center py-8">
                             <SpinnerIcon className="w-8 h-8"/>
                             <p className="ml-3">Menganalisis data...</p>
                         </div>
                     ) : insightError ? (
                         <div className="text-center py-4 bg-red-800/50 p-4 rounded-lg">
                             <p>{insightError}</p>
                             <button onClick={handleFetchInsight} className="mt-2 px-3 py-1 bg-white text-red-700 font-semibold rounded-md text-sm">Coba Lagi</button>
                         </div>
                     ) : aiInsight ? (
                         <div className="space-y-4">
                             <div>
                                 <h3 className="font-semibold uppercase text-xs tracking-wider opacity-80">Insight</h3>
                                 <p className="mt-1">{aiInsight.insight}</p>
                             </div>
                             <div>
                                 <h3 className="font-semibold uppercase text-xs tracking-wider opacity-80">Rekomendasi</h3>
                                 <p className="mt-1 font-medium p-3 bg-white/20 rounded-lg">{aiInsight.recommendation}</p>
                             </div>
                         </div>
                     ) : (
                         <div className="text-center py-4">
                            <p className="mb-3 opacity-90">Dapatkan analisa dan rekomendasi otomatis dari data penjualan Anda saat ini.</p>
                            <button onClick={handleFetchInsight} className="px-4 py-2 bg-white text-sky-700 font-bold rounded-lg shadow-md hover:bg-slate-100 transition-colors">
                                Dapatkan Insight
                            </button>
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;