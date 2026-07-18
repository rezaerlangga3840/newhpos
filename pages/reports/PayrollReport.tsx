// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Laporan Penggajian.
// Fungsinya adalah untuk mengambil dan memfilter data penggajian berdasarkan periode (bulan dan tahun)
// dan cabang yang dipilih, lalu menampilkannya dalam bentuk ringkasan dan tabel detail.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useBranch } from '../../contexts/BranchContext';
import { Payroll } from '../../types';
import { CurrencyDollarIcon, SpinnerIcon } from '../../components/icons';
import * as api from '../../backend/api';


const PayrollReportPage: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState<{
        payrolls: Payroll[];
        summaryStats: { totalPaid: number; employeeCount: number; };
        karyawanMap: Record<string, string>;
        branchMap: Record<string, string>;
    } | null>(null);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);
    const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) })), []);
    
    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getPayrollReport({ year: selectedYear, month: selectedMonth, branchId: selectedBranchId });
            setReportData(data);
        } catch (error) {
            console.error("Failed to fetch payroll report:", error);
            alert("Gagal memuat laporan penggajian.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, selectedMonth, selectedBranchId]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const { payrolls = [], summaryStats = { totalPaid: 0, employeeCount: 0 }, karyawanMap = {}, branchMap = {} } = reportData || {};

    const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-2">Laporan Penggajian</h1>
            <p className="text-slate-500 mb-6">Melihat riwayat penggajian yang telah diproses.</p>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                 <div className="w-full sm:w-auto">
                    <label htmlFor="filter-month" className="block text-sm font-medium text-slate-700">Bulan</label>
                    <select id="filter-month" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="form-select mt-1 w-full text-sm">
                         {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                    </select>
                </div>
                 <div className="w-full sm:w-auto">
                    <label htmlFor="filter-year" className="block text-sm font-medium text-slate-700">Tahun</label>
                    <select id="filter-year" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="form-select mt-1 w-full text-sm">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <SpinnerIcon className="w-10 h-10 text-sky-500" />
                </div>
            ) : (
             <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
                        <h3 className="text-sm font-medium text-blue-700">Total Gaji Dibayarkan</h3>
                        <p className="text-3xl font-bold text-blue-800 mt-1">{formatRupiah(summaryStats.totalPaid)}</p>
                    </div>
                    <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                        <h3 className="text-sm font-medium text-indigo-700">Jumlah Karyawan Digaji</h3>
                        <p className="text-3xl font-bold text-indigo-800 mt-1">{summaryStats.employeeCount}</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID Payroll</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Karyawan</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cabang</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gaji Bersih</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tgl Dibayar</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {payrolls.map(p => (
                                <tr key={p.id_payroll}>
                                    <td className="px-4 py-3 text-sm font-medium">{p.id_payroll}</td>
                                    <td className="px-4 py-3 text-sm">{karyawanMap[p.id_karyawan] || p.id_karyawan}</td>
                                    <td className="px-4 py-3 text-sm">{branchMap[p.id_cabang] || p.id_cabang}</td>
                                    <td className="px-4 py-3 text-sm text-right">{formatRupiah(p.total_gaji_bersih)}</td>
                                    <td className="px-4 py-3 text-sm text-center">
                                        <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${
                                            p.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                                            p.status === 'published' ? 'bg-blue-100 text-blue-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>{p.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{p.tanggal_pembayaran ? new Date(p.tanggal_pembayaran).toLocaleDateString('id-ID') : '-'}</td>
                                </tr>
                            ))}
                            {payrolls.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-10 text-slate-500">Tidak ada data penggajian pada periode ini.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </>
            )}
        </div>
    );
};

export default PayrollReportPage;