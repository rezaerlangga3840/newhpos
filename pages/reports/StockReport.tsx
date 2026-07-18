// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Laporan Stok.
// Fungsinya adalah untuk menggabungkan data stok induk dan varian material,
// memungkinkan pemfilteran berdasarkan tipe dan status kritis, dan menampilkannya dalam format tabel yang informatif.

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useBranch } from '../../contexts/BranchContext';
import { CubeIcon, ExclamationTriangleIcon, SpinnerIcon, QrCodeIcon } from '../../components/icons';
import * as api from '../../backend/api';
import QRCode from 'qrcode';


interface MergedStockItem {
    id: string;
    id_cabang: string;
    nama_cabang: string;
    item_id: string;
    nama_item: string;
    tipe: string;
    quantity: number | null;
    unit: string;
    stok_kritis: number | null;
    is_critical: boolean;
    barcode: string | null;
}

const BarcodePreviewModal: React.FC<{ item: MergedStockItem; onClose: () => void }> = ({ item, onClose }) => {
    const barcodeValue = item.barcode || item.item_id;
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && barcodeValue) {
            QRCode.toCanvas(canvasRef.current, barcodeValue, { width: 256, margin: 2 }, (error) => {
                if (error) console.error("QR Code generation error:", error);
            });
        }
    }, [barcodeValue]);
    
    const handlePrint = () => {
        window.print();
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 barcode-print-area">
             <style>{`
                @media print {
                    body > *:not(.barcode-print-area) {
                        display: none !important;
                    }
                    .barcode-print-area, .barcode-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        overflow: visible !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    .barcode-content-wrapper {
                        padding: 2rem 1.5rem !important;
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
            <div className="barcode-container bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[95vh] flex flex-col relative overflow-hidden">
                <div className="barcode-content-wrapper flex-grow overflow-y-auto p-6 text-center">
                    <h3 className="text-lg font-semibold text-slate-800">{item.nama_item}</h3>
                    <p className="text-sm text-slate-500 mb-6">{item.item_id}</p>
                     <div className="my-4 flex justify-center bg-slate-50 p-4 rounded-lg">
                        <canvas ref={canvasRef} />
                    </div>
                    <p className="font-mono text-center tracking-widest break-all">{barcodeValue}</p>
                </div>
                <div className="no-print mt-auto p-4 bg-slate-100 border-t flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-200">Tutup</button>
                    <button onClick={handlePrint} className="px-5 py-2 bg-sky-600 text-white rounded-md text-sm font-medium hover:bg-sky-700">Cetak Barcode</button>
                </div>
            </div>
        </div>
    );
};

const StockReportPage: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const [filterType, setFilterType] = useState<'all' | 'product' | 'material' | 'wip'>('all');
    const [showOnlyCritical, setShowOnlyCritical] = useState<boolean>(false);
    const [reportData, setReportData] = useState<MergedStockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItemForBarcode, setSelectedItemForBarcode] = useState<MergedStockItem | null>(null);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getStockReport({
                branchId: selectedBranchId,
                filterType,
                showOnlyCritical,
            });
            setReportData(data.mergedStockList);
        } catch (error) {
            console.error("Failed to fetch stock report:", error);
            alert("Gagal memuat laporan stok.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId, filterType, showOnlyCritical]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 mb-2">Laporan Stok</h1>
            <p className="text-slate-500 mb-6">Melihat kondisi stok terkini di seluruh cabang.</p>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div>
                    <label htmlFor="filter-type" className="block text-sm font-medium text-slate-700">Tipe Stok</label>
                    <select id="filter-type" value={filterType} onChange={e => setFilterType(e.target.value as any)} className="form-select mt-1 text-sm">
                        <option value="all">Semua</option>
                        <option value="product">Produk</option>
                        <option value="material">Material (Induk & Varian)</option>
                        <option value="wip">WIP</option>
                    </select>
                </div>
                <div className="flex items-center pt-6">
                    <input type="checkbox" id="show-critical" checked={showOnlyCritical} onChange={e => setShowOnlyCritical(e.target.checked)} className="form-checkbox h-4 w-4 text-amber-600 focus:ring-amber-500"/>
                    <label htmlFor="show-critical" className="ml-2 text-sm font-medium text-slate-700">Hanya tampilkan stok kritis</label>
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
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cabang</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID Item</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nama Item</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipe</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Stok Kritis</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {reportData.map(item => (
                                <tr key={item.id} className={item.is_critical ? 'bg-red-50' : 'hover:bg-slate-50'}>
                                    <td className="px-4 py-3 text-sm">{item.nama_cabang}</td>
                                    <td className="px-4 py-3 text-sm font-medium">{item.item_id}</td>
                                    <td className="px-4 py-3 text-sm">{item.nama_item}</td>
                                    <td className="px-4 py-3 text-sm capitalize">{item.tipe.replace('_', ' ')}</td>
                                    <td className={`px-4 py-3 text-sm text-right font-semibold ${item.is_critical ? 'text-red-600' : ''}`}>{item.quantity ?? '-'}</td>
                                    <td className="px-4 py-3 text-sm">{item.unit}</td>
                                    <td className="px-4 py-3 text-sm text-right">{item.stok_kritis ?? '-'}</td>
                                    <td className="px-4 py-3 text-sm text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedItemForBarcode(item);
                                            }}
                                            className="p-1 text-slate-500 hover:text-sky-600 rounded-md hover:bg-sky-50 transition-colors"
                                            title="Preview Barcode"
                                        >
                                            <QrCodeIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr><td colSpan={8} className="text-center py-10 text-slate-500">Tidak ada data stok yang sesuai dengan filter.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {selectedItemForBarcode && (
                <BarcodePreviewModal item={selectedItemForBarcode} onClose={() => setSelectedItemForBarcode(null)} />
            )}
        </div>
    );
};

export default StockReportPage;