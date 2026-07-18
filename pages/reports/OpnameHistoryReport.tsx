// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Laporan Riwayat Stok Opname.
// Fungsinya adalah untuk menampilkan daftar semua sesi stok opname yang telah dilakukan,
// memungkinkan pengguna untuk melihat detail item dari setiap sesi dalam sebuah modal.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useBranch } from '../../contexts/BranchContext';
import { StokOpname } from '../../types';
import { EyeIcon, XMarkIcon, SpinnerIcon } from '../../components/icons';
import * as api from '../../backend/api';

const OpnameHistoryReportPage: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState<{
        sessions: StokOpname[];
        userDisplayMap: Record<string, string>;
        branchMap: Record<string, string>;
    } | null>(null);
    const [selectedSession, setSelectedSession] = useState<StokOpname | null>(null);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getOpnameHistoryReport({ branchId: selectedBranchId });
            setReportData(data);
        } catch (error) {
            console.error("Failed to fetch opname history report:", error);
            alert("Gagal memuat riwayat opname.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const statusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-800';
            case 'submitted': return 'bg-blue-100 text-blue-800';
            case 'diperiksa': return 'bg-yellow-100 text-yellow-800';
            case 'draft': return 'bg-amber-100 text-amber-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };
    
    if (isLoading) {
        return (
            <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center">
                <SpinnerIcon className="w-10 h-10 text-sky-500" />
            </div>
        );
    }

    const { sessions = [], userDisplayMap = {}, branchMap = {} } = reportData || {};

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-2">Riwayat Opname Outlet</h1>
            <p className="text-slate-500 mb-6">Melihat kembali hasil dari semua sesi opname outlet yang telah dilakukan.</p>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID Sesi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nama Sesi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cabang</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tanggal Mulai</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Staff</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {sessions.map(s => (
                            <tr key={s.id_stok_opname} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-medium">{s.id_stok_opname}</td>
                                <td className="px-4 py-3 text-sm">{s.nama_opname}</td>
                                <td className="px-4 py-3 text-sm">{branchMap[s.id_cabang] || s.id_cabang}</td>
                                <td className="px-4 py-3 text-sm">{new Date(s.tanggal_opname_mulai).toLocaleString('id-ID')}</td>
                                <td className="px-4 py-3 text-sm">{userDisplayMap[s.id_user_staff] || s.id_user_staff}</td>
                                <td className="px-4 py-3 text-sm text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColor(s.status)}`}>{s.status.toUpperCase()}</span></td>
                                <td className="px-4 py-3 text-sm text-center">
                                    <button onClick={() => setSelectedSession(s)} className="p-1 text-sky-600 hover:text-sky-800" title="Lihat Detail"><EyeIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                        {sessions.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-10 text-slate-500">Tidak ada riwayat opname outlet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedSession && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b">
                            <div>
                                <h3 className="text-xl font-semibold">{selectedSession.nama_opname}</h3>
                                <p className="text-sm text-slate-500">{selectedSession.id_stok_opname}</p>
                            </div>
                            <button onClick={() => setSelectedSession(null)}><XMarkIcon className="w-6 h-6"/></button>
                        </div>
                        <div className="overflow-y-auto">
                           <table className="min-w-full divide-y divide-slate-200">
                               <thead className="bg-slate-100">
                                   <tr>
                                       <th className="px-3 py-2 text-left text-xs font-medium uppercase">Item</th>
                                       <th className="px-3 py-2 text-right text-xs font-medium uppercase">Qty Sistem</th>
                                       <th className="px-3 py-2 text-right text-xs font-medium uppercase">Qty Fisik</th>
                                       <th className="px-3 py-2 text-right text-xs font-medium uppercase">Selisih</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {selectedSession.items.map(item => (
                                       <tr key={item.id_stok_opname_item} className={item.selisih !== 0 ? 'bg-amber-50' : ''}>
                                           <td className="px-3 py-2 text-sm">{item.nama_stok_display}</td>
                                           <td className="px-3 py-2 text-sm text-right">{item.qty_system}</td>
                                           <td className="px-3 py-2 text-sm text-right">{item.qty_fisik}</td>
                                           <td className={`px-3 py-2 text-sm text-right font-bold ${item.selisih < 0 ? 'text-red-600' : 'text-green-600'}`}>{item.selisih}</td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OpnameHistoryReportPage;