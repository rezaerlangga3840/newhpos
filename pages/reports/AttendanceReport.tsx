// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Laporan Absensi.
// Fungsinya adalah untuk mengambil dan memfilter data log kehadiran berdasarkan rentang tanggal
// dan cabang yang dipilih, lalu menampilkannya dalam format tabel yang mudah dibaca.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useBranch } from '../../contexts/BranchContext';
import { AbsensiLog, Karyawan } from '../../types';
import { CalendarDaysIcon, SpinnerIcon } from '../../components/icons';
import * as api from '../../backend/api';

const AttendanceReportPage: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState<{
        logs: (AbsensiLog & { duration: string })[];
        karyawanMap: Record<string, Karyawan>;
        branchMap: Record<string, string>;
    } | null>(null);
    
    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getAttendanceReport({ startDate, endDate, branchId: selectedBranchId });
            setReportData(data);
        } catch (error) {
            console.error("Failed to fetch attendance report:", error);
            alert("Gagal memuat laporan absensi.");
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, selectedBranchId]);
    
    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const { logs = [], karyawanMap = {}, branchMap = {} } = reportData || {};

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-2">Laporan Absensi Karyawan</h1>
            <p className="text-slate-500 mb-6">Ringkasan kehadiran karyawan berdasarkan periode dan cabang.</p>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                 <div className="w-full sm:w-auto">
                    <label htmlFor="start-date-att" className="block text-sm font-medium text-slate-700">Tanggal Mulai</label>
                    <input type="date" id="start-date-att" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input mt-1 w-full text-sm"/>
                </div>
                 <div className="w-full sm:w-auto">
                    <label htmlFor="end-date-att" className="block text-sm font-medium text-slate-700">Tanggal Akhir</label>
                    <input type="date" id="end-date-att" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input mt-1 w-full text-sm"/>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <SpinnerIcon className="w-10 h-10 text-sky-500" />
                </div>
            ) : (
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Karyawan</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cabang</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tanggal</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clock In</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Clock Out</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Durasi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {logs.map(log => (
                            <tr key={log.id_absensi_log}>
                                <td className="px-4 py-3 text-sm font-medium">{karyawanMap[log.id_karyawan]?.nama_lengkap || log.id_karyawan}</td>
                                <td className="px-4 py-3 text-sm">{branchMap[log.id_cabang_karyawan] || log.id_cabang_karyawan}</td>
                                <td className="px-4 py-3 text-sm">{new Date(log.waktu_clock_in).toLocaleDateString('id-ID')}</td>
                                <td className="px-4 py-3 text-sm">{new Date(log.waktu_clock_in).toLocaleTimeString('id-ID')}</td>
                                <td className="px-4 py-3 text-sm">{log.waktu_clock_out ? new Date(log.waktu_clock_out).toLocaleTimeString('id-ID') : '-'}</td>
                                <td className="px-4 py-3 text-sm">{log.duration}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-10 text-slate-500">Tidak ada data absensi pada periode ini.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
            )}
        </div>
    );
};

export default AttendanceReportPage;