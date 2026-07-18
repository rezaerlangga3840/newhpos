

// FRONTEND: Komponen ini menampilkan antarmuka Kitchen Display System (KDS).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, Stok, ProductVariant as ProductVariantType, TransactionItem, Meja, Customer } from '../../types';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAccess } from '../../contexts/AccessContext';
import { SpinnerIcon, ClockIcon, ClipboardDocumentListIcon, ChevronDownIcon, CubeIcon, ComputerDesktopIcon } from '../../components/icons';
import { useModuleActivation } from '../../contexts/ModuleActivationContext';

const PAGE_PATH = '/dapur/kds';

const useTimer = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return now;
};

const formatDuration = (startTime: string, now: Date): string => {
  const start = new Date(startTime);
  const diffSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const KDSPage: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const { canRead, canUpdate, isAccessDataLoaded } = useAccess();
  const { isKdsActive, isModuleDataLoaded } = useModuleActivation();
  
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [allStocks, setAllStocks] = useState<Stok[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariantType[]>([]);
  const [allTables, setAllTables] = useState<Meja[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [stations, setStations] = useState<string[]>(['Semua']);
  const [selectedStation, setSelectedStation] = useState<string>('Semua');
  const [highlightedItemKey, setHighlightedItemKey] = useState<string | null>(null);

  const now = useTimer();

  const fetchData = useCallback(async () => {
    if (!selectedBranchId) {
        setOrders([]);
        setIsLoading(false);
        return;
    }
    // Don't set loading for polls
    // setIsLoading(true);
    setError(null);
    try {
        const kdsOrders = await api.getKdsOrders({ branchId: selectedBranchId, station: selectedStation });
        setOrders(kdsOrders);
    } catch (err) {
        setError("Gagal memuat data pesanan.");
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [selectedBranchId, selectedStation]);
  
  // Initial data fetch for stations and other display data
  useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const data = await api.getKdsPageData();
            setAllStocks(data.stocks);
            setProductVariants(data.productVariants);
            setAllTables(data.tables);
            setAllCustomers(data.customers);

            const uniqueStations = ['Semua', ...Array.from(new Set(data.stocks.map(s => s.stasiun_dapur).filter(Boolean))) as string[]];
            setStations(uniqueStations);
        } catch (err) {
            setError("Gagal memuat data pendukung KDS.");
        }
    };
    if (isAccessDataLoaded) {
        fetchInitialData();
    }
  }, [isAccessDataLoaded]);

  // Polling for orders
  useEffect(() => {
    if (isAccessDataLoaded && canRead(PAGE_PATH) && isKdsActive(selectedBranchId)) {
      fetchData(); // Initial fetch
      const intervalId = setInterval(fetchData, 10000); // Poll every 10 seconds
      return () => clearInterval(intervalId);
    }
  }, [fetchData, isAccessDataLoaded, canRead, isKdsActive, selectedBranchId]);

  const handleStatusUpdate = async (transactionId: string, currentStatus: Transaction['status_pesanan']) => {
    if (!canUpdate(PAGE_PATH)) return;

    const newStatus = currentStatus === 'menunggu_persiapan' ? 'sedang_dibuat' : 'selesai';
    
    // Optimistic UI update - remove immediately on 'selesai'
    setOrders(prev => newStatus === 'selesai' 
        ? prev.filter(o => o.id_transaksi !== transactionId)
        : prev.map(o => o.id_transaksi === transactionId ? {...o, status_pesanan: newStatus} : o)
    );

    try {
        const response = await api.updateOrderStatus({ transactionId, newStatus });
        if (!response.success) {
            // Revert on failure by re-fetching
            fetchData(); 
            alert("Gagal memperbarui status pesanan.");
        }
    } catch (err) {
        console.error("Failed to update order status:", err);
        fetchData(); // Revert on error
        alert("Terjadi kesalahan saat memperbarui status pesanan.");
    }
  };

  const getItemName = useCallback((item: TransactionItem, branchId: string): string => {
      const product = allStocks.find(s => s.id_stok === item.id_stok && s.id_cabang === branchId);
      if (item.id_variant_product) {
          const variant = productVariants.find(v => v.id_variant_product === item.id_variant_product && v.id_cabang === branchId);
          return `${product?.nama_stok || 'Produk'} - ${variant?.nama_variant_product || 'Varian'}`;
      }
      return product?.nama_stok || 'Produk tidak dikenal';
  }, [allStocks, productVariants]);
  
  const getOrderTitleAndInfo = useCallback((order: Transaction): { title: string, info: { line1: string; line2?: string } } => {
    const customer = order.id_pelanggan ? allCustomers.find(c => c.id_pelanggan === order.id_pelanggan) : null;
    let customerName = customer?.nama_pelanggan;
  
    // Default to Take Away information structure
    let title = 'TAKE AWAY';
    let line1 = `Antrian #${order.id_transaksi.slice(-4)}`;
    let line2: string | undefined = undefined;

    if (customerName) {
        line1 = customerName;
    } else if (order.catatan?.startsWith("Pesanan Takeaway - ")) {
        line1 = order.catatan.replace("Pesanan Takeaway - ", "");
    }
  
    // Override for Dine-in
    if (order.asal_data === 'POS Dine-in') {
        const table = allTables.find(t => t.id_pesanan_aktif === order.id_transaksi);
        title = 'DINE-IN';
        line1 = table ? table.nama_meja : 'Meja?';
        const nameOnTicket = customerName || table?.nama_pelanggan_reservasi;
        if(nameOnTicket) {
            line2 = nameOnTicket;
        }
    }
    
    return { title, info: { line1, line2 } };
  }, [allCustomers, allTables]);


  const orderSummary = useMemo(() => {
    const summary = new Map<string, { key: string; name: string; quantity: number }>();

    orders.forEach(order => {
        order.items.forEach(item => {
            const key = `${order.id_cabang}:${item.id_variant_product || item.id_stok}`;
            const itemName = getItemName(item, order.id_cabang);

            if (summary.has(key)) {
                summary.get(key)!.quantity += item.quantity;
            } else {
                summary.set(key, { key: key, name: itemName, quantity: item.quantity });
            }
        });
    });

    return Array.from(summary.values()).sort((a, b) => b.quantity - a.quantity);
  }, [orders, getItemName]);


  if (isLoading && orders.length === 0) {
    return <div className="p-8 flex justify-center items-center h-full"><SpinnerIcon className="w-10 h-10 text-sky-500" /></div>;
  }
  
  if (!isKdsActive(selectedBranchId)) {
    return (
        <div className="p-8 flex flex-col justify-center items-center h-full text-center">
            <ComputerDesktopIcon className="w-16 h-16 text-slate-400 mb-4" />
            <h2 className="text-2xl font-bold text-slate-700">Modul Dapur (KDS) Dinonaktifkan</h2>
            <p className="text-slate-500 mt-2 max-w-md">
                Modul ini tidak aktif untuk cabang yang dipilih. Jika Anda memerlukan fitur ini, silakan hubungi administrator sistem untuk mengaktifkannya di halaman Pengaturan Modul.
            </p>
        </div>
    );
  }

  if (!selectedBranchId) {
    return <div className="p-8 text-center text-slate-500">Pilih cabang terlebih dahulu untuk melihat KDS.</div>;
  }
  
  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="bg-slate-200 h-full flex flex-col">
        <header className="flex-shrink-0 bg-white shadow-md p-4 sticky top-0 z-10 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800 flex items-center">
                <ClipboardDocumentListIcon className="w-6 h-6 mr-3 text-sky-600"/> Kitchen Display System
            </h1>
            <div className="relative">
                <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)} className="form-select pl-3 pr-8 py-2 text-sm border-slate-300 rounded-md shadow-sm">
                    {stations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDownIcon className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>
        </header>

        <main className="flex-grow p-4 overflow-hidden flex space-x-4">
            {/* Production Summary Panel */}
            <aside className="w-1/3 lg:w-1/4 xl:w-1/5 flex-shrink-0 flex flex-col">
                <div className="bg-slate-800 text-white rounded-lg shadow-lg h-full flex flex-col">
                    <h2 className="p-4 text-lg font-bold border-b border-slate-700 flex items-center flex-shrink-0">
                        <CubeIcon className="w-5 h-5 mr-3 text-sky-400"/>
                        Ringkasan Produksi
                    </h2>
                    <div className="flex-grow overflow-y-auto p-4 space-y-2">
                        {orderSummary.length > 0 ? orderSummary.map(item => (
                            <button
                                key={item.key}
                                onClick={() => setHighlightedItemKey(prev => prev === item.key ? null : item.key)}
                                className={`w-full text-left flex justify-between items-center p-2 rounded-md transition-colors ${highlightedItemKey === item.key ? 'bg-sky-500' : 'bg-slate-700/80 hover:bg-slate-700'}`}
                            >
                                <span className="font-medium text-sm text-slate-100 truncate pr-2" title={item.name}>{item.name}</span>
                                <span className={`font-bold text-lg px-3 py-1 rounded-full text-center min-w-[40px] flex-shrink-0 ${highlightedItemKey === item.key ? 'bg-white text-sky-600' : 'bg-slate-900/50 text-sky-300'}`}>{item.quantity}</span>
                            </button>
                        )) : (
                            <div className="text-center text-sm text-slate-400 pt-10">
                                <p>Tidak ada item untuk disiapkan.</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Order Tickets (main area) */}
            <div className="flex-grow overflow-y-auto">
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <ClipboardDocumentListIcon className="w-24 h-24 mb-4 text-slate-400"/>
                        <p className="text-xl font-semibold">Tidak ada pesanan aktif</p>
                        <p>Pesanan baru dari POS akan muncul di sini.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orders.map(order => {
                            const duration = formatDuration(order.datetime, now);
                            const [minutes] = duration.split(':').map(Number);
                            const { title, info } = getOrderTitleAndInfo(order);
                            let bgColor = 'bg-white';
                            let textColor = 'text-slate-800';
                            if (order.status_pesanan === 'sedang_dibuat') {
                                bgColor = 'bg-amber-100 border-amber-300';
                            }
                            if (minutes >= 10) {
                                bgColor = 'bg-red-100 border-red-300 animate-pulse';
                            } else if (minutes >= 5) {
                                bgColor = 'bg-orange-100 border-orange-300';
                            }
                            return (
                                <div key={order.id_transaksi} className={`rounded-lg shadow-lg flex flex-col border ${bgColor}`}>
                                    <header className={`p-3 rounded-t-lg flex justify-between items-center ${order.status_pesanan === 'sedang_dibuat' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white'}`}>
                                        <h2 className="font-bold text-xs truncate uppercase" title={title}>{title}</h2>
                                        <div className="flex items-center space-x-4 text-lg font-mono font-semibold tracking-wider flex-shrink-0">
                                            <span className="text-sm font-normal text-slate-300 opacity-80">#{order.id_transaksi.slice(-6)}</span>
                                            <div className="flex items-center space-x-2">
                                                <ClockIcon className="w-5 h-5"/>
                                                <span>{duration}</span>
                                            </div>
                                        </div>
                                    </header>
                                    <div className="p-3 flex-grow overflow-y-auto min-h-[120px]">
                                        <ul className="space-y-2">
                                            {order.items.map(item => {
                                                const itemKey = `${order.id_cabang}:${item.id_variant_product || item.id_stok}`;
                                                const isHighlighted = itemKey === highlightedItemKey;
                                                return (
                                                    <li key={item.id_transaction_item} className={`p-1.5 rounded-md transition-all duration-300 ${isHighlighted ? 'bg-sky-100 ring-2 ring-sky-400 ring-offset-2' : ''}`}>
                                                        <div className="flex items-baseline">
                                                            <span className="font-bold text-lg mr-2 w-8 flex-shrink-0 text-right">{item.quantity}x</span>
                                                            <p className="font-semibold text-sm leading-tight">{getItemName(item, order.id_cabang)}</p>
                                                        </div>
                                                        {item.catatan_item && <p className="text-xs text-red-600 italic mt-0.5 pl-10">Catatan: {item.catatan_item}</p>}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                    <footer className="p-2">
                                        <button 
                                            onClick={() => handleStatusUpdate(order.id_transaksi, order.status_pesanan)}
                                            disabled={!canUpdate(PAGE_PATH)}
                                            className={`w-full py-3 px-4 font-bold rounded-md transition-colors text-white flex justify-between items-center ${
                                                order.status_pesanan === 'menunggu_persiapan' ? 'bg-sky-600 hover:bg-sky-700' :
                                                'bg-emerald-600 hover:bg-emerald-700'
                                            } disabled:bg-slate-400`}
                                        >
                                            <div className="text-left">
                                                <span className="block text-sm font-medium leading-tight truncate" title={info.line1}>{info.line1}</span>
                                                {info.line2 && <span className="block text-xs font-normal leading-tight truncate" title={info.line2}>{info.line2}</span>}
                                            </div>
                                            <span className="text-right text-sm font-semibold flex-shrink-0 ml-2">{order.status_pesanan === 'menunggu_persiapan' ? 'MULAI BUAT' : 'SELESAI'}</span>
                                        </button>
                                    </footer>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </main>
    </div>
  );
};

export default KDSPage;