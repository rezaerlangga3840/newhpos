// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Laporan Penjualan.
// Fungsinya adalah untuk mengambil dan memfilter data transaksi berdasarkan rentang tanggal
// dan cabang yang dipilih, lalu menampilkannya dalam bentuk ringkasan statistik dan tabel detail.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useBranch } from '../../contexts/BranchContext';
import { ChartBarIcon, CurrencyDollarIcon, ShoppingCartIcon, SpinnerIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { Transaction } from '../../types';

interface ReportData {
    transactions: Transaction[];
    summaryStats: { 
        totalRevenue: number; 
        totalProfit: number;
        transactionCount: number; 
        averageTransaction: number; 
    };
    userDisplayMap: Record<string, string>;
    branchMap: Record<string, string>;
}

const SalesReportPage: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    const [startDate, setStartDate] = useState(oneWeekAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getSalesReport({ startDate, endDate, branchId: selectedBranchId });
            setReportData(data);
        } catch (error) {
            console.error("Failed to fetch sales report:", error);
            alert("Gagal memuat laporan penjualan.");
            setReportData(null);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, selectedBranchId]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);
    
    const { summaryStats, transactions, userDisplayMap, branchMap } = reportData || {
        summaryStats: { totalRevenue: 0, totalProfit: 0, transactionCount: 0, averageTransaction: 0 },
        transactions: [],
        userDisplayMap: {},
        branchMap: {}
    };

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-2">Laporan Penjualan</h1>
            <p className="text-slate-500 mb-6">Analisis performa penjualan berdasarkan periode dan cabang.</p>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-full sm:w-auto">
                    <label htmlFor="start-date" className="block text-sm font-medium text-slate-700">Tanggal Mulai</label>
                    <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input mt-1 w-full text-sm"/>
                </div>
                 <div className="w-full sm:w-auto">
                    <label htmlFor="end-date" className="block text-sm font-medium text-slate-700">Tanggal Akhir</label>
                    <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input mt-1 w-full text-sm"/>
                </div>
            </div>
            
            {isLoading ? (
                 <div className="flex justify-center items-center py-20">
                    <SpinnerIcon className="w-10 h-10 text-sky-500" />
                 </div>
            ) : (
             <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-green-50 p-5 rounded-xl border border-green-200">
                        <h3 className="text-sm font-medium text-green-700">Total Pendapatan</h3>
                        <p className="text-3xl font-bold text-green-800 mt-1">Rp {summaryStats.totalRevenue.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-sky-50 p-5 rounded-xl border border-sky-200">
                        <h3 className="text-sm font-medium text-sky-700">Total Laba Kotor</h3>
                        <p className="text-3xl font-bold text-sky-800 mt-1">Rp {summaryStats.totalProfit.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-purple-50 p-5 rounded-xl border border-purple-200">
                        <h3 className="text-sm font-medium text-purple-700">Jumlah Transaksi</h3>
                        <p className="text-3xl font-bold text-purple-800 mt-1">{summaryStats.transactionCount}</p>
                    </div>
                    <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                        <h3 className="text-sm font-medium text-indigo-700">Rata-rata Transaksi</h3>
                        <p className="text-3xl font-bold text-indigo-800 mt-1">Rp {summaryStats.averageTransaction.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                </div>

                <h2 className="text-xl font-semibold text-slate-700 mb-4">Daftar Transaksi</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID Transaksi</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cabang</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tanggal</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total HPP</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Laba Kotor</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Margin</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {transactions.map(t => {
                                const margin = t.total_keseluruhan > 0 ? (((t.laba_kotor || 0) / t.total_keseluruhan) * 100).toFixed(1) + '%' : '-';
                                return (
                                <tr key={t.id_transaksi}>
                                    <td className="px-4 py-3 text-sm font-medium">{t.id_transaksi}</td>
                                    <td className="px-4 py-3 text-sm">{branchMap[t.id_cabang] || t.id_cabang}</td>
                                    <td className="px-4 py-3 text-sm">{new Date(t.datetime).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-sm text-right">Rp {t.total_keseluruhan.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-sm text-right">Rp {(t.total_hpp || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-sm text-right font-semibold">Rp {(t.laba_kotor || 0).toLocaleString('id-ID')}</td>
                                    <td className={`px-4 py-3 text-sm text-right font-semibold ${(t.laba_kotor || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{margin}</td>
                                </tr>
                                )
                            })}
                            {transactions.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-10 text-slate-500">Tidak ada data transaksi pada periode ini.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </>
            )}
        </div>
    );
};

export default SalesReportPage;