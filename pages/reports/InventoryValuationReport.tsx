// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Laporan Valuasi Stok.
// Fungsinya adalah untuk menghitung dan menampilkan nilai total dari semua inventaris
// berdasarkan harga beli dan kuantitas, serta memberikan rincian per item.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useBranch } from '../../contexts/BranchContext';
import { CubeIcon, CurrencyDollarIcon, SpinnerIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { InventoryValuationData } from '../../types';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

interface ReportData {
    valuationList: InventoryValuationData[];
    summaryStats: {
        totalValue: number;
        itemCount: number;
    };
}

const InventoryValuationReport: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getInventoryValuationReport({ branchId: selectedBranchId });
            setReportData(data);
        } catch (error) {
            console.error("Failed to fetch inventory valuation report:", error);
            alert("Gagal memuat laporan valuasi stok.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const { valuationList = [], summaryStats = { totalValue: 0, itemCount: 0 } } = reportData || {};
    
    const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

    const columns = useMemo<ColumnDef<InventoryValuationData>[]>(() => [
        { header: 'Cabang', accessor: 'nama_cabang', sortable: true },
        { header: 'ID Item', accessor: 'item_id', sortable: true },
        { header: 'Nama Item', accessor: 'nama_item', sortable: true },
        { header: 'Tipe', accessor: 'tipe', sortable: true },
        { header: 'Qty', accessor: 'quantity', sortable: true, render: item => <div className="text-right">{item.quantity}</div> },
        { header: 'Harga Beli', accessor: 'harga_beli', sortable: true, render: item => <div className="text-right">{formatRupiah(item.harga_beli)}</div> },
        { header: 'Total Nilai', accessor: 'total_value', sortable: true, render: item => <div className="text-right font-bold">{formatRupiah(item.total_value)}</div> },
    ], []);

    if (isLoading) {
        return (
            <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center">
                <SpinnerIcon className="w-10 h-10 text-sky-500" />
            </div>
        );
    }

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-2">Laporan Valuasi Stok</h1>
            <p className="text-slate-500 mb-6">Melihat nilai total inventaris Anda berdasarkan harga beli.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                    <h3 className="text-sm font-medium text-indigo-700">Total Nilai Inventaris</h3>
                    <p className="text-3xl font-bold text-indigo-800 mt-1">{formatRupiah(summaryStats.totalValue)}</p>
                </div>
                <div className="bg-cyan-50 p-5 rounded-xl border border-cyan-200">
                    <h3 className="text-sm font-medium text-cyan-700">Jumlah Item Tervalidasi</h3>
                    <p className="text-3xl font-bold text-cyan-800 mt-1">{summaryStats.itemCount.toLocaleString('id-ID')}</p>
                </div>
            </div>

            <TabelFiturStandar
                data={valuationList}
                columns={columns}
                uniqueIdKey="id"
                title="Rincian Nilai Stok"
            />
        </div>
    );
};

export default InventoryValuationReport;