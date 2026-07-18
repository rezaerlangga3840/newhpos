
// FRONTEND: Komponen ini menyediakan antarmuka Point of Sale (POS) untuk membuat transaksi secara cepat.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SelfOrder, Stok, ProductVariant as ProductVariantType, Unit, Promo, DayOfWeek, Customer, Transaction, Branch, TransactionItem, Meja, Karyawan, PaymentMethod as PaymentMethodType, BOMEntry } from '../../types';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePersonalization } from '../../contexts/PersonalizationContext';
// FIX: Import ChevronRightIcon to resolve 'Cannot find name' error.
import {
  ShoppingCartIcon, TrashIcon, PlusCircleIcon, XMarkIcon, PackageIcon, InformationCircleIcon,
  MinusCircleIcon, CheckCircleIcon, CurrencyDollarIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, SpinnerIcon, ClockIcon, XCircleIcon,
  PencilSquareIcon, SparklesIcon, CameraIcon, UserCircleIcon, UsersIcon, PrinterIcon, EnvelopeIcon, ShareIcon, WhatsAppIcon, AnnotationIcon, ComputerDesktopIcon, BriefcaseIcon, CalendarDaysIcon,
  ChevronDownIcon,
  ChairIcon,
  PhoneIcon,
  QrCodeIcon,
  TagIcon // Import TagIcon for vouchers
} from '../../components/icons';
import { deepClone } from '../../utils';
import QRCode from 'qrcode';


interface CartItem {
  id_transaction_item: string;
  id_stok: string;
  nama_stok: string;
  id_variant_product: string | null;
  nama_varian_produk?: string;
  quantity: number;
  harga_satuan: number;
  total_harga_item: number;
  photo_url?: string | null;
  unit_nama?: string;
  catatan_item?: string | null;
  diskon_item?: number | null; // Discount amount for this specific item line
  // New field to link to the source Stok/ProductVariant objects
  stok: Stok;
  variant: ProductVariantType | null;
}

interface ModalOption {
  id: string; // MaterialVariant.id_variant_material
  name: string; // MaterialVariant.nama_variant
  price?: number; // Price if this option completes a ProductVariant
  isFinalChoice: boolean;
  productVariantToBuy?: ProductVariantType;
}

interface OnHoldOrder {
    name: string;
    items: CartItem[];
    heldAt: number;
    customer: Customer | null;
    temporaryCustomerName: string | null;
    guestCount?: number;
}

// Barcode Scanner Modal Component
const BarcodeScannerModal: React.FC<{
  onClose: () => void;
  onScan: (barcode: string) => void;
}> = ({ onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: number | undefined;

    const startScanner = async () => {
      // Check for browser support
      if (!('BarcodeDetector' in window)) {
        setError('Fitur Barcode Detector tidak didukung di browser ini.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Type assertion for BarcodeDetector since it might not be in default TS DOM lib
          const BarcodeDetector = (window as any).BarcodeDetector;
          const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] });
          
          intervalId = window.setInterval(async () => {
            if (videoRef.current && !videoRef.current.paused && videoRef.current.readyState === 4) {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                onScan(barcodes[0].rawValue);
              }
            }
          }, 200);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError(`Gagal mengakses kamera: ${(err as Error).message}. Pastikan izin telah diberikan.`);
      }
    };

    startScanner();

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative overflow-hidden border-4 border-white">
        <video ref={videoRef} className="w-full h-auto block" playsInline />
        {error && <div className="absolute bottom-4 left-4 right-4 bg-red-100 text-red-700 p-2 rounded text-xs">{error}</div>}
        <div className="absolute top-2 right-2 z-10">
            <button onClick={onClose} className="p-2 bg-black/50 text-white rounded-full hover:bg-black/75 transition-colors"><XMarkIcon className="w-6 h-6"/></button>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3/4 h-1/2 border-4 border-sky-400 rounded-lg shadow-lg" style={{boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'}}></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent text-center">
            <p className="text-white font-semibold drop-shadow">Posisikan barcode di dalam kotak</p>
        </div>
      </div>
    </div>
  );
};

const SingleReceiptPreview: React.FC<{
  mainTransaction: Transaction;
  billItems: TransactionItem[];
  billSubtotal: number;
  billDiscount: number;
  billTotal: number;
  billNumber?: string;
  branch: Branch | null;
  logo: string;
  customerName?: string | null;
  username: string;
  stockMap: Map<string, Stok>;
  productVariantMap: Map<string, ProductVariantType>;
  billDiscountLabel: string | null;
  billPayments: { method: string; amount: number }[];
}> = ({ mainTransaction, billItems, billSubtotal, billDiscount, billTotal, billNumber, branch, logo, customerName, username, stockMap, productVariantMap, billDiscountLabel, billPayments }) => {
    
    const isSplit = billNumber !== undefined;

    const formatRupiah = (val: number | null | undefined) => (val || 0).toLocaleString('id-ID');

    const getItemName = (item: TransactionItem): string => {
        const product = stockMap.get(item.id_stok);
        if (!product) return "Item Tidak Dikenal";

        if (item.id_variant_product) {
            const variant = productVariantMap.get(item.id_variant_product);
            const variantName = variant?.nama_variant_product || variant?.id_variant_product || 'Varian';
            return `${product.nama_stok} - ${variantName}`;
        }
        return product.nama_stok;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "Invalid Date";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };
    
    const totalPaidForBill = billPayments.reduce((sum, p) => sum + p.amount, 0);
    const changeForBill = totalPaidForBill - billTotal;

    return (
        <div className="receipt-container font-mono w-[80mm] mx-auto p-2 text-black text-xs bg-white">
            {billNumber && (
                <div className="text-center font-bold text-lg my-2 border-b border-dashed border-black py-1">
                    TAGIHAN {billNumber}
                </div>
            )}
            <div className="flex items-start mb-2 space-x-2">
                <img src={logo} alt="Logo" className="w-12 h-12 object-cover flex-shrink-0"/>
                <div className="flex-grow">
                    <h1 className="font-bold text-base leading-tight">{branch?.Nama || 'H-POS'}</h1>
                    <p className="text-xs leading-tight">{branch?.Alamat}</p>
                </div>
            </div>
            <div className="text-center font-semibold text-sm my-2">{mainTransaction.id_transaksi}</div>
            
            <div className="flex justify-between text-xs my-1">
                <span>{username}</span>
                <span>{formatDate(mainTransaction.datetime)}</span>
            </div>
            
            <div className="border-t border-dashed border-black my-1"></div>
            
            <div className="flex justify-between font-semibold my-1">
                <span>ITEM</span>
                <span>JUMLAH</span>
            </div>

            <div className="my-2">
                {billItems.map(item => (
                    <div key={item.id_transaction_item} className="mb-1">
                        <div>{getItemName(item)}</div>
                        <div className="flex justify-between items-start">
                            <div className="text-slate-600 pl-2">{item.quantity} x {formatRupiah(item.harga_satuan)}</div>
                            <div className="font-medium text-right flex-shrink-0">{formatRupiah(item.total_harga_item)}</div>
                        </div>
                        {item.catatan_item && (<div className="text-xs text-slate-500 pl-2 italic mt-0.5 border-l-2 border-slate-300">Catatan: {item.catatan_item}</div>)}
                    </div>
                ))}
            </div>

            <div className="border-t border-dashed border-black my-1"></div>

            <div className="my-2 space-y-1">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatRupiah(billSubtotal)}</span>
                </div>

                {billDiscount > 0 && (
                    <div className="flex justify-between">
                        <span>{billDiscountLabel || 'Diskon'}</span>
                        <span>- {formatRupiah(billDiscount)}</span>
                    </div>
                )}
            </div>
            
            <div className="border-t border-dashed border-black my-1"></div>
            
            <div className="my-2 space-y-1">
                <div className="flex justify-between font-bold">
                    <span>TOTAL TAGIHAN</span>
                    <span>{formatRupiah(billTotal)}</span>
                </div>
                
                {billPayments.map((p, i) => (
                    <div key={i} className="flex justify-between">
                        <span>Bayar ({p.method})</span>
                        <span>{formatRupiah(p.amount)}</span>
                    </div>
                ))}
                
                {changeForBill > 0 && (
                    <div className="flex justify-between">
                        <span>Kembalian</span>
                        <span>{formatRupiah(changeForBill)}</span>
                    </div>
                )}
            </div>
            
            <div className="text-center mt-2">
                Terima kasih atas kunjungan Anda!
            </div>
             {customerName && (<div className="text-center mt-4 font-medium">{customerName}</div>)}
        </div>
    );
};

const ReceiptModal: React.FC<{
  transaction: Transaction;
  onNewTransaction: () => void;
  branch: Branch | null;
  logo: string;
  customerName?: string | null;
  stockMap: Map<string, Stok>;
  productVariantMap: Map<string, ProductVariantType>;
  activePromos: Promo[];
}> = ({ transaction, onNewTransaction, branch, logo, customerName, stockMap, productVariantMap, activePromos }) => {
    const { currentUser } = useAuth();
    
    const handlePrint = () => {
        window.print();
    };

    const isSplit = transaction.checkout_details?.split_method !== 'none' && (transaction.checkout_details?.split_bills?.length ?? 0) > 1;
    const billsToRender = isSplit
        ? transaction.checkout_details!.split_bills!
        : [{ items: transaction.items, subtotal: transaction.subtotal_sebelum_diskon || 0, discount: (transaction.subtotal_sebelum_diskon || 0) - transaction.total_keseluruhan, total: transaction.total_keseluruhan, payments: transaction.checkout_details?.payments || [] }];
    
    const appliedPromo = transaction.id_promo_applied 
        ? activePromos.find(p => p.id_promo === transaction.id_promo_applied) 
        : null;
    const discountLabel = appliedPromo ? appliedPromo.nama_promo : "Diskon";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 receipt-print-area">
            <div className="bg-slate-100 rounded-xl shadow-2xl w-full max-w-4xl h-[95vh] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                <div className="no-print w-full lg:w-1/2 bg-slate-100 p-6 flex flex-col justify-between lg:overflow-y-auto">
                    <div><CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-3"/><h2 className="text-2xl font-bold text-slate-800 text-center">Transaksi Berhasil</h2><p className="text-slate-500 text-center mt-1">ID Transaksi: {transaction.id_transaksi}</p></div>
                    <div className="space-y-4"><div className="flex justify-center gap-4"><button onClick={handlePrint} title="Cetak Struk" className="flex items-center justify-center w-16 h-16 bg-white rounded-lg shadow-sm hover:bg-sky-50 hover:shadow-md transition-all"><PrinterIcon className="w-7 h-7 text-sky-600"/></button><button onClick={() => alert('Simulasi: Struk dikirim via Email.')} title="Kirim via Email" className="flex items-center justify-center w-16 h-16 bg-white rounded-lg shadow-sm hover:bg-sky-50 hover:shadow-md transition-all"><EnvelopeIcon className="w-7 h-7 text-sky-600"/></button><button onClick={() => alert('Simulasi: Struk dikirim via WhatsApp.')} title="Bagikan via WhatsApp" className="flex items-center justify-center w-16 h-16 bg-white rounded-lg shadow-sm hover:bg-green-50 hover:shadow-md transition-all"><WhatsAppIcon className="w-7 h-7 text-green-600"/></button></div></div>
                    <button onClick={onNewTransaction} className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition-colors shadow-lg mt-8">Transaksi Baru</button>
                </div>
                
                <div className="w-full lg:w-1/2 bg-white p-4 lg:overflow-y-auto flex-shrink-0 flex flex-col space-y-4">
                    {billsToRender.map((bill, index) => (
                        <SingleReceiptPreview
                            key={index}
                            mainTransaction={transaction}
                            billItems={bill.items}
                            billSubtotal={bill.subtotal}
                            billDiscount={bill.discount}
                            billTotal={bill.total}
                            billNumber={isSplit ? `${index + 1} dari ${billsToRender.length}` : undefined}
                            branch={branch}
                            logo={logo}
                            customerName={customerName}
                            username={currentUser?.username || 'Kasir'}
                            stockMap={stockMap}
                            productVariantMap={productVariantMap}
                            billDiscountLabel={discountLabel}
                            billPayments={bill.payments}
                        />
                    ))}
                </div>

            </div>
        </div>
    );
};

const AssignServerModal: React.FC<{
  table: Meja;
  servers: Karyawan[];
  allCustomers: Customer[];
  onClose: () => void;
  onConfirm: (tableId: string, serverId: string | null, guestCount: number, customerName: string) => void;
}> = ({ table, servers, allCustomers, onClose, onConfirm }) => {
  const [serverId, setServerId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return allCustomers.filter(c =>
      c.nama_pelanggan.toLowerCase().includes(term) ||
      (c.telepon && c.telepon.includes(term))
    ).slice(0, 5);
  }, [allCustomers, searchTerm]);

  useEffect(() => {
    if (table) {
      setGuestCount(table.jumlah_tamu_reservasi || (table.kapasitas > 0 ? 1 : 0));
      setSearchTerm(table.nama_pelanggan_reservasi || '');
      if (table.nama_pelanggan_reservasi) {
          const matchingCustomer = allCustomers.find(c => c.nama_pelanggan.toLowerCase() === table.nama_pelanggan_reservasi!.toLowerCase());
          setSelectedCustomer(matchingCustomer || null);
      }
    }
  }, [table, allCustomers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(table.id_meja, serverId, guestCount, searchTerm);
  };
  
  const handleCustomerSelect = (customer: Customer) => {
      setSelectedCustomer(customer);
      setSearchTerm(customer.nama_pelanggan);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-slate-800">Mulai Pesanan di {table.nama_meja}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close modal"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                    <legend className="text-xs font-medium text-slate-500 px-1">Nama Pelanggan</legend>
                    <input type="text" id="customerName" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onBlur={() => { if (searchTerm !== (selectedCustomer?.nama_pelanggan || '')) setSelectedCustomer(null); }} placeholder="(Opsional)" className="block w-full py-2.5 outline-none bg-transparent text-sm"/>
                </fieldset>
                {filteredCustomers.length > 0 && !selectedCustomer && (
                    <ul className="absolute z-30 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                            <li key={customer.id_pelanggan} onMouseDown={() => handleCustomerSelect(customer)} className="p-2 text-sm hover:bg-sky-50 cursor-pointer">
                                <p className="font-medium">{customer.nama_pelanggan}</p>
                                <p className="text-xs text-slate-500">{customer.telepon}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                    <legend className="text-xs font-medium text-slate-500 px-1">Jumlah Tamu*</legend>
                    <input type="number" id="guestCount" value={guestCount} onChange={e => setGuestCount(Number(e.target.value))} min="1" max={table.kapasitas} required className="block w-full py-2.5 outline-none bg-transparent text-sm"/>
                </fieldset>
            </div>
            <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                    <legend className="text-xs font-medium text-slate-500 px-1">Pramusaji (Opsional)</legend>
                    <select id="serverId" value={serverId || ''} onChange={e => setServerId(e.target.value || null)} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none text-sm">
                        <option value="">-- Pilih Pramusaji --</option>
                        {servers.map(s => (<option key={s.id_karyawan} value={s.id_karyawan}>{s.nama_lengkap}</option>))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div>
                </fieldset>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center">Mulai Pesanan</button>
            </div>
        </form>
      </div>
    </div>
  );
};

const ReservationModal: React.FC<{
  table: Meja;
  allCustomers: Customer[];
  onClose: () => void;
  onConfirm: (tableId: string, details: { customerName: string, customerPhone: string, guestCount: number }) => void;
}> = ({ table, allCustomers, onClose, onConfirm }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestCount, setGuestCount] = useState<number>(1);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return allCustomers.filter(c =>
      c.nama_pelanggan.toLowerCase().includes(term) ||
      (c.telepon && c.telepon.includes(term))
    ).slice(0, 5);
  }, [allCustomers, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      alert("Nama pelanggan reservasi wajib diisi.");
      return;
    }
    onConfirm(table.id_meja, { customerName: searchTerm, customerPhone, guestCount });
  };
  
  const handleCustomerSelect = (customer: Customer) => {
      setSelectedCustomer(customer);
      setSearchTerm(customer.nama_pelanggan);
      setCustomerPhone(customer.telepon || '');
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-slate-800">Reservasi Meja {table.nama_meja}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close modal"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                    <legend className="text-xs font-medium text-slate-500 px-1">Nama Pelanggan*</legend>
                    <input type="text" id="customerName" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onBlur={() => { if (searchTerm !== (selectedCustomer?.nama_pelanggan || '')) setSelectedCustomer(null); }} required className="block w-full py-2.5 outline-none bg-transparent text-sm" />
                </fieldset>
                {filteredCustomers.length > 0 && !selectedCustomer && (
                    <ul className="absolute z-30 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                            <li key={customer.id_pelanggan} onMouseDown={() => handleCustomerSelect(customer)} className="p-2 text-sm hover:bg-sky-50 cursor-pointer">
                                <p className="font-medium">{customer.nama_pelanggan}</p>
                                <p className="text-xs text-slate-500">{customer.telepon}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                    <legend className="text-xs font-medium text-slate-500 px-1">No. Telepon</legend>
                    <input type="tel" id="customerPhone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="block w-full py-2.5 outline-none bg-transparent text-sm" />
                </fieldset>
            </div>
            <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                    <legend className="text-xs font-medium text-slate-500 px-1">Jumlah Tamu</legend>
                    <input type="number" id="guestCountRes" value={guestCount} onChange={e => setGuestCount(Number(e.target.value))} min="1" max={table.kapasitas} required className="block w-full py-2.5 outline-none bg-transparent text-sm" />
                </fieldset>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center">Simpan Reservasi</button>
            </div>
        </form>
      </div>
    </div>
  );
};

// --- START: NEW BARCODE PREVIEW MODAL COMPONENT ---
const BarcodePreviewModal: React.FC<{
  branchId: string;
  tableId: string;
  tableName: string;
  onClose: () => void;
}> = ({ branchId, tableId, tableName, onClose }) => {
  const selfOrderUrl = tableId
    ? `${window.location.origin}${window.location.pathname}#/self-order?branchId=${branchId}&tableId=${tableId}`
    : `${window.location.origin}${window.location.pathname}#/self-order?branchId=${branchId}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalTitle = tableId ? "Scan untuk Pesan dari Meja" : "Scan untuk Pesan Langsung";

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, selfOrderUrl, { width: 256, margin: 2, errorCorrectionLevel: 'H' }, (error: any) => {
        if (error) console.error("QR Code generation error:", error);
      });
    }
  }, [selfOrderUrl]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 barcode-print-area">
      <div className="barcode-container bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[95vh] flex flex-col relative overflow-hidden">
        <div className="barcode-content-wrapper flex-grow overflow-y-auto p-6 text-center flex flex-col items-center justify-center">
          <h3 className="text-xl font-semibold text-slate-800">{modalTitle}</h3>
          <p className={`mb-4 ${tableId ? 'text-3xl font-bold text-sky-600' : 'text-xl font-semibold text-slate-700'}`}>
            {tableName}
          </p>
          <div className="my-4 flex justify-center bg-white p-4 rounded-lg border-4 border-slate-200">
            <canvas ref={canvasRef} />
          </div>
          <p className="font-mono text-center text-xs text-slate-500 break-all p-2 bg-slate-50 rounded-md">
            {selfOrderUrl}
          </p>
        </div>
        <div className="no-print mt-auto p-4 bg-slate-100 border-t flex items-center justify-between gap-2">
           <a
                href={selfOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm font-medium bg-white text-slate-700 px-3 py-2 rounded-md hover:bg-slate-200 transition-colors border border-slate-300"
              >
                  <UsersIcon className="w-4 h-4 mr-2" />
                  Buka Halaman
            </a>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="px-4 py-2 border border-slate-300 bg-white rounded-md text-sm font-medium hover:bg-slate-100">Cetak</button>
            <button onClick={onClose} className="px-5 py-2 bg-slate-700 text-white rounded-md text-sm font-semibold hover:bg-slate-800">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
};

type PosTab = 'pos' | 'dinein' | 'selforder';

// --- NEW TYPES FOR CHECKOUT MODAL ---
type Payment = { method: PaymentMethodType, amount: number };
type Bill = { items: CartItem[], subtotal: number, discount: number, total: number, payments: Payment[], remaining: number, qrisCodeApplied?: number };
type CheckoutState = {
  view: 'main' | 'split_item';
  bills: Bill[];
  unassignedItems: CartItem[];
  activeBillIndex: number;
  splitEvenCount: number;
  paymentMethod: PaymentMethodType;
  paymentAmount: string;
};

// --- START: NEW CHECKOUT MODAL COMPONENT ---
const CheckoutModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  checkoutState: CheckoutState;
  setCheckoutState: React.Dispatch<React.SetStateAction<CheckoutState>>;
  onFinalize: () => void;
  isProcessing: boolean;
  error: string | null;
  handleSplitEven: () => void;
  handleStartSplitByItem: () => void;
  handleFinishSplitByItem: () => void;
  handleMoveItemToBill: (item: CartItem, targetBillIndex: number) => void;
  handleMoveItemFromBill: (item: CartItem, fromBillIndex: number) => void;
  handleAddNewBill: () => void;
  handleAddPayment: () => void;
  handleCancelSplitByItem: () => void;
  paymentMethods: PaymentMethodType[];
  subtotal: number;
  discountAmount: number;
  appliedPromoName: string | null;
}> = ({
  isOpen, onClose, checkoutState, setCheckoutState, onFinalize, isProcessing, error,
  handleSplitEven, handleStartSplitByItem, handleFinishSplitByItem,
  handleMoveItemToBill, handleMoveItemFromBill, handleAddNewBill, handleAddPayment,
  handleCancelSplitByItem, paymentMethods, subtotal, discountAmount, appliedPromoName
}) => {
  if (!isOpen) return null;

  const totalRemaining = checkoutState.bills.reduce((sum, bill) => sum + bill.remaining, 0);
  const change = totalRemaining < 0 ? Math.abs(totalRemaining) : 0;
  
  const activeBill = checkoutState.bills[checkoutState.activeBillIndex];

  const getPaymentMethodIcon = (tipe: PaymentMethodType['tipe_metode']) => {
      switch (tipe) {
          case 'Cash': return <CurrencyDollarIcon className="w-5 h-5" />;
          case 'Card': return <BriefcaseIcon className="w-5 h-5" />;
          case 'E-Wallet': return <PhoneIcon className="w-5 h-5" />;
          case 'Transfer': return <ComputerDesktopIcon className="w-5 h-5" />;
          default: return <CurrencyDollarIcon className="w-5 h-5" />;
      }
  };

  const quickCashOptions = useMemo(() => {
    if (!activeBill) return [];
    const remaining = activeBill.remaining;
    const options = [50000, 100000, 200000];
    const uniqueOptions = new Set<number>();
    
    // Exact amount is always first
    if (remaining > 0) {
      uniqueOptions.add(Math.ceil(remaining));
    }
    
    // Add options that are greater than remaining amount
    for (const opt of options) {
      if (opt > remaining) {
        uniqueOptions.add(opt);
      }
    }
    return Array.from(uniqueOptions).slice(0, 4);
  }, [activeBill]);

  const groupedBillItems = useMemo(() => {
    const billForGrouping = checkoutState.bills[checkoutState.activeBillIndex];
    if (!billForGrouping) return [];
    
    const itemMap = new Map<string, {
        id_stok: string;
        id_variant_product: string | null;
        nama_stok: string;
        nama_varian_produk?: string;
        displayQuantity: number;
    }>();

    billForGrouping.items.forEach(item => {
        const key = `${item.id_stok}:${item.id_variant_product}`;
        if (itemMap.has(key)) {
            itemMap.get(key)!.displayQuantity += 1;
        } else {
            itemMap.set(key, { 
                id_stok: item.id_stok,
                id_variant_product: item.id_variant_product,
                nama_stok: item.nama_stok,
                nama_varian_produk: item.nama_varian_produk,
                displayQuantity: 1 
            });
        }
    });
    return Array.from(itemMap.values());
  }, [checkoutState.bills, checkoutState.activeBillIndex]);


  const renderMainView = () => {
    const activeBill = checkoutState.bills[checkoutState.activeBillIndex];
    const formatRupiah = (val: number) => val.toLocaleString('id-ID');

    // A special case for split-even, the item list is a placeholder
    const isSplitEven = checkoutState.bills.length > 1 && activeBill.items.length === 1 && activeBill.items[0].id_stok === 'SPLIT';
    
    const totalPaidForActiveBill = activeBill.payments.reduce((sum, p) => sum + p.amount, 0);
    const changeForActiveBill = totalPaidForActiveBill - activeBill.total;

    return (
    <div className="flex-grow flex flex-col md:flex-row gap-6">
      {/* Left Column: Bill Details */}
      <div className="md:w-3/5 flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Rincian Tagihan {checkoutState.bills.length > 1 ? `(${checkoutState.activeBillIndex + 1}/${checkoutState.bills.length})` : ''}</h3>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {activeBill.items.map(item => (
            <div key={item.id_transaction_item} className="flex justify-between text-sm">
              <div>
                <p className="font-medium text-slate-700">{item.nama_stok}{item.nama_varian_produk && ` - ${item.nama_varian_produk}`}</p>
                 {!isSplitEven && (
                  <p className="text-slate-500 text-xs">{item.quantity} x Rp {formatRupiah(item.harga_satuan)}</p>
                )}
              </div>
              <p className="font-semibold text-slate-800">Rp {formatRupiah(item.total_harga_item)}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-200 mt-auto space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span>Rp {formatRupiah(activeBill.subtotal)}</span>
            </div>
            {activeBill.discount > 0.01 && (
                <div className="flex justify-between text-sm text-green-600">
                    <span>Diskon {appliedPromoName ? `(${appliedPromoName})` : ''}</span>
                    <span>- Rp {formatRupiah(activeBill.discount)}</span>
                </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200/60 mt-2">
                <span className="text-slate-800">Total Tagihan</span>
                <span className="text-slate-800">Rp {formatRupiah(activeBill.total)}</span>
            </div>
             <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
                {activeBill.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-600">Bayar ({p.method.nama_metode})</span>
                        <span className="font-medium text-slate-700">Rp {formatRupiah(p.amount)}</span>
                    </div>
                ))}
                {changeForActiveBill > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-sky-600">
                        <span>Kembalian</span>
                        <span>Rp {formatRupiah(changeForActiveBill)}</span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Right Column: Payment Actions */}
      <div className="md:w-2/5 flex flex-col h-full">
        {checkoutState.bills.length > 1 && (
          <div className="flex border-b border-slate-200 mb-4 flex-shrink-0">
            {checkoutState.bills.map((bill, index) => (
              <button key={index} onClick={() => setCheckoutState(p => ({ ...p, activeBillIndex: index, paymentAmount: bill.remaining > 0 ? bill.remaining.toString() : '' }))} className={`px-4 py-2 text-sm font-medium border-b-2 ${checkoutState.activeBillIndex === index ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                Tagihan {index + 1}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 flex-grow">
          {checkoutState.bills.length === 1 && (
            <div className="pb-4 border-b border-slate-200">
              <h4 className="text-sm font-semibold mb-2">Opsi Pisah Tagihan</h4>
              <div className="flex space-x-2">
                  <input type="number" value={checkoutState.splitEvenCount} onChange={e => setCheckoutState(p => ({...p, splitEvenCount: Number(e.target.value)}))} min="2" className="form-input w-20 text-center text-sm"/>
                  <button onClick={handleSplitEven} className="flex-grow bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium py-2 px-3 rounded-lg">Bagi Rata</button>
                  <button onClick={handleStartSplitByItem} className="flex-grow bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium py-2 px-3 rounded-lg">Pisah per Item</button>
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-500">Metode Pembayaran</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {paymentMethods.map(method => (
                <button key={method.id_metode} onClick={() => setCheckoutState(p => ({ ...p, paymentMethod: method }))} className={`p-2 rounded-lg border-2 text-sm font-semibold flex items-center justify-center space-x-2 transition-all ${checkoutState.paymentMethod.id_metode === method.id_metode ? 'bg-sky-50 border-sky-500 text-sky-700 ring-2 ring-sky-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                  {getPaymentMethodIcon(method.tipe_metode)}
                  <span>{method.nama_metode}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">Jumlah Bayar</p>
            <input type="number" placeholder="0" value={checkoutState.paymentAmount} onChange={e => setCheckoutState(p => ({ ...p, paymentAmount: e.target.value }))} className="form-input w-full text-2xl font-bold text-right p-3 mt-2" disabled={activeBill.remaining <= 0.01}/>
          </div>
          
          {checkoutState.paymentMethod.tipe_metode === 'Cash' && activeBill.remaining > 0 && (
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCheckoutState(p => ({...p, paymentAmount: Math.ceil(activeBill.remaining).toString()}))} className="py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700">Uang Pas</button>
                {quickCashOptions.slice(1).map(opt => (
                    <button key={opt} onClick={() => setCheckoutState(p => ({...p, paymentAmount: opt.toString()}))} className="py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium text-slate-700">Rp {formatRupiah(opt)}</button>
                ))}
            </div>
          )}
          
          {activeBill.remaining > 0.01 && (
            <button onClick={handleAddPayment} className="w-full bg-sky-500 text-white font-semibold py-3 rounded-lg text-sm hover:bg-sky-600 shadow-sm">
              Tambah Pembayaran
            </button>
          )}

        </div>
        
        <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-3">
            <div className="flex justify-between text-lg font-bold"><span className="text-slate-600">Total Sisa Bayar:</span><span className={totalRemaining > 0.01 ? 'text-red-600' : 'text-green-600'}>Rp {formatRupiah(totalRemaining > 0 ? totalRemaining : 0)}</span></div>
            {change > 0 && (<div className="flex justify-between text-lg font-bold text-sky-600 bg-sky-50 p-2 rounded-lg"><span>Total Kembalian:</span><span>Rp {formatRupiah(change)}</span></div>)}
            <button onClick={onFinalize} disabled={isProcessing || totalRemaining > 0.01} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-emerald-600 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center">
                {isProcessing ? <SpinnerIcon className="w-5 h-5 mr-2"/> : null}
                {isProcessing ? 'Memproses...' : 'Selesaikan Transaksi'}
            </button>
        </div>
      </div>
    </div>
  )};

  const renderSplitItemView = () => {
    return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
        {/* Unassigned Items */}
        <div className="flex flex-col overflow-hidden bg-slate-50 p-2 rounded-lg">
          <h4 className="font-semibold text-sm mb-2 p-2">Item Belum Ditagih ({checkoutState.unassignedItems.reduce((sum, item) => sum + item.quantity, 0)})</h4>
          <div className="overflow-y-auto space-y-2">
             {checkoutState.unassignedItems.map(item => (
                <button 
                    key={item.id_transaction_item}
                    onClick={() => handleMoveItemToBill(item, checkoutState.activeBillIndex)} 
                    className="w-full text-left p-2 bg-white rounded shadow-sm hover:bg-sky-50 text-xs flex justify-between items-center"
                >
                    <span>{item.nama_stok}{item.nama_varian_produk && ` - ${item.nama_varian_produk}`}</span>
                    <span className="font-semibold bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">x{item.quantity}</span>
                </button>
            ))}
          </div>
        </div>
        
        {/* Bills */}
        <div className="flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-200 mb-2 items-center">
                {checkoutState.bills.map((bill, index) => (
                    <button key={index} onClick={() => setCheckoutState(p => ({...p, activeBillIndex: index}))} className={`px-3 py-1.5 text-xs font-medium border-b-2 ${checkoutState.activeBillIndex === index ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500'}`}>
                        Tagihan {index + 1} ({bill.items.length})
                    </button>
                ))}
                <button onClick={handleAddNewBill} className="ml-auto text-sky-600 p-1"><PlusCircleIcon className="w-5 h-5"/></button>
            </div>
            <div className="overflow-y-auto bg-slate-50 p-2 rounded-lg space-y-2 flex-grow">
                {activeBill && groupedBillItems.map(groupedItem => {
                    const originalItemToMove = activeBill.items.find(
                        i => i.id_stok === groupedItem.id_stok && i.id_variant_product === groupedItem.id_variant_product
                    );
                    
                    return (
                        <button 
                            key={`${groupedItem.id_stok}:${groupedItem.id_variant_product}`} 
                            onClick={() => originalItemToMove && handleMoveItemFromBill(originalItemToMove, checkoutState.activeBillIndex)} 
                            className="w-full text-left p-2 bg-white rounded shadow-sm hover:bg-red-50 text-xs flex justify-between items-center"
                        >
                            <span>{groupedItem.nama_stok}{groupedItem.nama_varian_produk && ` - ${groupedItem.nama_varian_produk}`}</span>
                            <span className="font-semibold bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">x{groupedItem.displayQuantity}</span>
                        </button>
                    )
                })}
            </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t flex justify-end space-x-3">
          <button onClick={handleCancelSplitByItem} className="px-4 py-2 border rounded-md text-sm">Batal</button>
          <button onClick={handleFinishSplitByItem} className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm">Selesai Pisah Tagihan</button>
      </div>
    </>
  )};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg md:max-w-5xl max-h-[90vh] flex flex-col">
            <header className="p-4 border-b flex justify-between items-center flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800">{checkoutState.view === 'main' ? 'Pembayaran' : 'Pisah Tagihan per Item'}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6"/></button>
            </header>
            <div className="p-6 flex-grow overflow-y-auto">
                {error && <div className="mb-3 p-3 bg-red-100 text-red-700 text-sm rounded-md">{error}</div>}
                {checkoutState.view === 'main' ? renderMainView() : renderSplitItemView()}
            </div>
        </div>
    </div>
  )
};
// --- END: NEW CHECKOUT MODAL COMPONENT ---

const POSPage: React.FC = () => {
  const { selectedBranchId, selectedBranch, selectedGroupId } = useBranch();
  const { currentUser } = useAuth();
  const { logo } = usePersonalization();

  const [activeTab, setActiveTab] = useState<PosTab>('pos');

  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Stok[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariantType[]>([]);
  const [allStocks, setAllStocks] = useState<Stok[]>([]);
  const [materialVariants, setMaterialVariants] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [boms, setBoms] = useState<BOMEntry[]>([]);
  const [activePromos, setActivePromos] = useState<Promo[]>([]);
  const [topSellingItems, setTopSellingItems] = useState<(Stok | ProductVariantType)[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tables, setTables] = useState<Meja[]>([]);
  const [karyawan, setKaryawan] = useState<Karyawan[]>([]);
  const [selfOrders, setSelfOrders] = useState<SelfOrder[]>([]);
  const [isLoadingSelfOrders, setIsLoadingSelfOrders] = useState(true);
  const [pageData, setPageData] = useState<any>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [showVariantModal, setShowVariantModal] = useState<Stok | null>(null);
  const [currentSelectionPath, setCurrentSelectionPath] = useState<string[]>([]);


  const [successfulTransaction, setSuccessfulTransaction] = useState<Transaction | null>(null);
  const [showConfirmClearCart, setShowConfirmClearCart] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  const [onHoldOrders, setOnHoldOrders] = useState<OnHoldOrder[]>([]);
  const [showHoldModal, setShowHoldModal] = useState<boolean>(false);
  const [holdOrderName, setHoldOrderName] = useState<string>('');
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);

  // --- NEW DINE-IN STATES ---
  const [dineInOrders, setDineInOrders] = useState<Record<string, OnHoldOrder>>({}); // key: id_meja
  const [selectedTable, setSelectedTable] = useState<Meja | null>(null);
  const [assignModalState, setAssignModalState] = useState<{ isOpen: boolean; table: Meja | null }>({ isOpen: false, table: null });
  const [isReservationMode, setIsReservationMode] = useState<boolean>(false);
  const [reservationModalState, setReservationModalState] = useState<{ isOpen: boolean; table: Meja | null }>({ isOpen: false, table: null });
  const [activeLocationFilter, setActiveLocationFilter] = useState<string>('Semua');
  const [cleanTableConfirmState, setCleanTableConfirmState] = useState<{ isOpen: boolean; table: Meja | null }>({ isOpen: false, table: null });
  // --- Merge/Move Table States ---
  const [isMergeMode, setIsMergeMode] = useState<boolean>(false);
  const [sourceTableIds, setSourceTableIds] = useState<string[]>([]);
  const [destinationTableId, setDestinationTableId] = useState<string | null>(null);
  const [mergeConfirmState, setMergeConfirmState] = useState<{ isOpen: boolean; sources: Meja[]; destination: Meja | null }>({ isOpen: false, sources: [], destination: null });


  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<'persentase' | 'nominal'>('nominal');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [manualAppliedDiscount, setManualAppliedDiscount] = useState<{ type: 'persentase' | 'nominal'; value: number } | null>(null);
  const [autoAppliedPromo, setAutoAppliedPromo] = useState<{ promo: Promo; discount: number } | null>(null);
  const [appliedPackagePromo, setAppliedPackagePromo] = useState<Promo | null>(null);

  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  
  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ nama_pelanggan: '', telepon: '', email: '', alamat: '' });
  
  const [editingNote, setEditingNote] = useState<{ itemId: string; currentNote: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

   // --- CHECKOUT MODAL STATE ---
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const initialCheckoutState: CheckoutState = {
    view: 'main', bills: [], unassignedItems: [], activeBillIndex: 0, splitEvenCount: 2, 
    // FIX: Add `id_grup` and `id_cabang` to the placeholder object to match the `PaymentMethodType` interface, resolving a type error.
    paymentMethod: { id_metode: 'PM1', id_grup: 'GR1', id_cabang: null, nama_metode: 'Tunai', tipe_metode: 'Cash', aktif: true }, // Placeholder
    paymentAmount: ''
  };
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(initialCheckoutState);
  const [qrisUniqueCode, setQrisUniqueCode] = useState<number | null>(null);
  const [originalBillTotal, setOriginalBillTotal] = useState<number | null>(null);

  // --- VOUCHER STATES ---
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ promo: Promo; discount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const calculateDuration = (table: Meja): React.ReactNode => {
    if (!table.waktu_terisi) return null;
  
    const start = new Date(table.waktu_terisi);
    const now = currentTime;
    const diffMs = now.getTime() - start.getTime();
    const diffMinsTotal = Math.floor(diffMs / 60000);
  
    if (table.durasi_maksimal_menit && table.durasi_maksimal_menit > 0) {
      const end = new Date(start.getTime() + table.durasi_maksimal_menit * 60000);
      const remainingMs = end.getTime() - now.getTime();
      const remainingMins = Math.floor(remainingMs / 60000);
  
      let durationText: string;
      let colorClass = 'text-blue-700'; // Corresponds to the 'Terisi' status color
      let animationClass = '';
  
      if (remainingMins > 15) {
        durationText = `- ${remainingMins} mnt`;
      } else if (remainingMins > 0) {
        durationText = `- ${remainingMins} mnt`;
        colorClass = 'text-yellow-800 font-bold';
        animationClass = 'animate-blink-warning';
      } else {
        durationText = `+ ${Math.abs(remainingMins)} mnt`;
        colorClass = 'text-red-700 font-bold';
        animationClass = 'animate-blink-warning';
      }
  
      const tooltip = `Akan berakhir pukul ${end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  
      return (
        <span title={tooltip} className={`text-xs ${colorClass} ${animationClass}`}>
          {durationText}
        </span>
      );
    } else {
      let durationText: string;
      if (diffMinsTotal < 1) durationText = '< 1 mnt';
      else if (diffMinsTotal < 60) durationText = `${diffMinsTotal} mnt`;
      else {
        const diffHours = Math.floor(diffMinsTotal / 60);
        const remainingMins = diffMinsTotal % 60;
        durationText = `${diffHours}j ${remainingMins}m`;
      }
      return (
        <span className="text-xs text-blue-700 opacity-90">
          {diffMinsTotal} mnt
        </span>
      );
    }
  };


  const resetCartAndCustomer = () => {
    setCartItems([]);
    setManualAppliedDiscount(null);
    setAutoAppliedPromo(null);
    setAppliedVoucher(null); // Reset voucher
    setVoucherError(null);
    setVoucherCodeInput('');
    setAppliedPackagePromo(null);
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const handleLepasMeja = async () => {
    if (!selectedTable) return;

    const tableToRelease = selectedTable;
    
    // Clear the selected table from the cart view immediately for responsiveness
    setSelectedTable(null);

    try {
        const response = await api.updateTableState(tableToRelease.id_meja, {
            status: 'Tersedia',
            id_pesanan_aktif: null,
            waktu_terisi: null,
            id_server: null,
            nama_pelanggan_reservasi: null,
            jumlah_tamu_reservasi: null,
            telepon_pelanggan_reservasi: null
        });

        if (response.success && response.table) {
            // Update the main tables list to reflect the change on the Dine-in tab
            setTables(prevTables => 
                prevTables.map(t => t.id_meja === tableToRelease.id_meja ? response.table! : t)
            );
            // Remove the order from the local dine-in orders state
            setDineInOrders(prevOrders => {
                const newOrders = { ...prevOrders };
                delete newOrders[tableToRelease.id_meja];
                return newOrders;
            });
        } else {
            // Revert UI change on failure
            setSelectedTable(tableToRelease);
            alert("Gagal mengubah status meja. Silakan coba lagi.");
        }
    } catch (error) {
        console.error("Error releasing table:", error);
        // Revert UI change on error
        setSelectedTable(tableToRelease);
        alert("Terjadi kesalahan saat mengubah status meja.");
    }
  };
  
  const handleKosongkan = () => {
    clearCartAndPromos();
  };


  const clearCartAndPromos = () => {
    setCartItems([]);
    setManualAppliedDiscount(null);
    setAutoAppliedPromo(null);
    setAppliedVoucher(null);
    setVoucherError(null);
    setVoucherCodeInput('');
    setAppliedPackagePromo(null);
  };

  const fetchDataForBranch = useCallback(async (branchId: string) => {
    setIsLoading(true);
    // Reset state on branch change
    resetCartAndCustomer();
    setOnHoldOrders([]);
    setSelectedTable(null);
    try {
      const data = await api.getPosPageData(branchId);
      setPageData(data);
      setProducts(data.products);
      setProductVariants(data.productVariants);
      setAllStocks(data.allStocks);
      setMaterialVariants(data.materialVariants);
      setUnits(data.units);
      setBoms(data.boms);
      setActivePromos(data.promos);
      setTopSellingItems(data.topSellingItems);
      setCustomers(data.customers);
      setTables(data.tables);
      setKaryawan(data.karyawan);
      setDineInOrders(data.activeDineInOrders || {}); // THE FIX
    } catch (error) {
      console.error("Failed to fetch POS data for branch:", branchId, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchDataForBranch(selectedBranchId);
      searchInputRef.current?.focus();
    } else {
      // Clear all data if no branch is selected
      setProducts([]);
      setProductVariants([]);
      setAllStocks([]);
      setMaterialVariants([]);
      setUnits([]);
      setBoms([]);
      setActivePromos([]);
      setCartItems([]);
      setTopSellingItems([]);
      setCustomers([]);
      setTables([]);
      setKaryawan([]);
      setManualAppliedDiscount(null);
      setAutoAppliedPromo(null);
      setAppliedVoucher(null);
      setAppliedPackagePromo(null);
      setOnHoldOrders([]);
      setDineInOrders({});
      setSelectedCustomer(null);
      setSelectedTable(null);
      setIsLoading(false);
    }
    setShowVariantModal(null);
    setCurrentSelectionPath([]);
    setSelectedCategory(null);
  }, [selectedBranchId, fetchDataForBranch]);

  const unitMap = useMemo(() => new Map(units.map(u => [u.id_unit, u.nama_unit])), [units]);

  const productCategories = useMemo(() => {
    const categories = new Set(products.map(p => p.kategori).filter(Boolean));
    return ['Semua', ...Array.from(categories)] as (string | null)[];
  }, [products]);
  
  const packagePromos = useMemo(() => {
    return activePromos.filter(p => p.tipe_promo === 'paket' && p.aktif && p.paket_item_ids && p.paket_harga_total);
  }, [activePromos]);

  const materialVariantDetailsMap = useMemo(() => {
    const map = new Map<string, { name: string; parentStockId: string; parentStockName: string }>();
    materialVariants.forEach(mv => {
      const parentStock = allStocks.find(s => s.id_stok === mv.id_stok);
      map.set(mv.id_variant_material, {
        name: mv.nama_variant,
        parentStockId: parentStock?.id_stok || "UNKNOWN_PARENT_ID",
        parentStockName: parentStock?.nama_stok || "Varian Kustom"
      });
    });
    return map;
  }, [materialVariants, allStocks]);

  const stockMap = useMemo(() => {
      const map = new Map<string, Stok>();
      allStocks.forEach(stock => map.set(stock.id_stok, stock));
      return map;
  }, [allStocks]);

  const productVariantMap = useMemo(() => {
      const map = new Map<string, ProductVariantType>();
      productVariants.forEach(variant => map.set(variant.id_variant_product, variant));
      return map;
  }, [productVariants]);


  const filteredProducts = useMemo(() => {
    let items = [...products];
    if (selectedCategory && selectedCategory !== 'Semua') {
      items = items.filter(p => p.kategori === selectedCategory);
    }
    if (searchTerm) {
      items = items.filter(p => p.nama_stok.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return items;
  }, [products, searchTerm, selectedCategory]);

  const filteredCustomers = useMemo(() => {
    let groupFilteredCustomers = customers;
    if (selectedGroupId) {
        groupFilteredCustomers = customers.filter(c => c.id_grup === selectedGroupId);
    }

    if (!customerSearchTerm) return [];
    const term = customerSearchTerm.toLowerCase();
    return groupFilteredCustomers.filter(c =>
      c.nama_pelanggan.toLowerCase().includes(term) ||
      (c.telepon && c.telepon.includes(term))
    ).slice(0, 5); // Limit results for performance
  }, [customers, customerSearchTerm, selectedGroupId]);

  const getVariantsForProduct = useCallback((productId: string): ProductVariantType[] => {
    return productVariants.filter(pv => pv.id_stok_product === productId);
  }, [productVariants]);
  
  const generateNewTransactionItemId = useCallback(() => `TI-POS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, []);

  const checkStockForMultipleItems = useCallback((itemsToAdd: { product: Stok, variant: ProductVariantType | null, quantity: number }[]): { success: boolean, message?: string } => {
    // 1. Create a temporary cart representing the final state
    const tempCart: Partial<CartItem>[] = deepClone(cartItems);
    itemsToAdd.forEach(itemToAdd => {
        const existingItemIndex = tempCart.findIndex(item => item.id_stok === itemToAdd.product.id_stok && item.id_variant_product === (itemToAdd.variant?.id_variant_product || null));
        if (existingItemIndex > -1) {
            tempCart[existingItemIndex].quantity! += itemToAdd.quantity;
        } else {
            tempCart.push({
                id_stok: itemToAdd.product.id_stok,
                id_variant_product: itemToAdd.variant?.id_variant_product || null,
                quantity: itemToAdd.quantity,
            });
        }
    });

    // 2. Component demand calculation
    const componentDemand = new Map<string, { required: number, name: string }>();

    const processItem = (item: { id_stok?: string, id_variant_product?: string | null, quantity?: number }) => {
        if (!item.id_stok || !item.quantity) return;

        const itemBoms = boms.filter(b => 
            b.id_cabang === selectedBranchId &&
            b.id_stok_product === item.id_stok &&
            b.id_variant_product === item.id_variant_product
        );

        if (itemBoms.length === 0) {
            const componentKey = `stok:${item.id_stok}`;
            const currentDemand = componentDemand.get(componentKey)?.required || 0;
            const productName = allStocks.find(s => s.id_stok === item.id_stok)?.nama_stok || item.id_stok;
            componentDemand.set(componentKey, { required: currentDemand + item.quantity, name: productName });
        } else {
            for (const bomEntry of itemBoms) {
                const required = item.quantity * bomEntry.quantity_komponen;
                let componentKey: string;
                let componentName: string;
                const komponen = bomEntry.komponen;

                if (komponen.type === 'material_variant') {
                    componentKey = `variant:${komponen.id_variant_material}`;
                    const mv = materialVariants.find(v => v.id_variant_material === komponen.id_variant_material);
                    const parent = allStocks.find(s => s.id_stok === mv?.id_stok);
                    componentName = mv ? `${parent?.nama_stok} - ${mv.nama_variant}` : componentKey;
                } else {
                    componentKey = `stok:${komponen.id_stok}`;
                    componentName = allStocks.find(s => s.id_stok === komponen.id_stok)?.nama_stok || componentKey;
                }
                const currentDemand = componentDemand.get(componentKey)?.required || 0;
                componentDemand.set(componentKey, { required: currentDemand + required, name: componentName });
            }
        }
    };

    tempCart.forEach(processItem);

    // 3. Check demand against available stock
    for (const [key, demand] of componentDemand.entries()) {
        const [type, id] = key.split(':');
        let availableStock: number | null | undefined = null;
        let stockRecord;

        if (type === 'variant') {
            stockRecord = materialVariants.find(mv => mv.id_variant_material === id);
            availableStock = stockRecord?.quantity;
        } else { // 'stok'
            stockRecord = allStocks.find(s => s.id_stok === id && s.id_cabang === selectedBranchId);
            availableStock = stockRecord?.quantity;
        }

        if (availableStock === null || availableStock === undefined || availableStock < demand.required) {
             const message = stockRecord && 'nama_stok' in stockRecord && stockRecord.quantity === null ?
                `Produk "${demand.name}" harus dijual melalui varian yang memiliki BOM.` :
                `Stok untuk "${demand.name}" tidak mencukupi. Tersisa: ${availableStock ?? 0}, Dibutuhkan: ${demand.required}.`;
            return { success: false, message };
        }
    }
    
    return { success: true };
  }, [cartItems, boms, selectedBranchId, allStocks, materialVariants]);

  const checkStockAvailability = useCallback((productToAdd: Stok, variantToAdd: ProductVariantType | undefined, quantityToAdd: number): { success: boolean, message?: string } => {
      return checkStockForMultipleItems([{ product: productToAdd, variant: variantToAdd || null, quantity: quantityToAdd }]);
  }, [checkStockForMultipleItems]);

  const addToCart = (product: Stok, variant?: ProductVariantType) => {
    const availabilityCheck = checkStockAvailability(product, variant, 1);
    if (!availabilityCheck.success) {
        alert(availabilityCheck.message);
        return;
    }
    
    // Jika ada promo paket aktif, hapus dulu
    if (appliedPackagePromo) {
        setAppliedPackagePromo(null);
    }

    const existingCartItemIndex = cartItems.findIndex(
      item => item.id_stok === product.id_stok && item.id_variant_product === (variant?.id_variant_product || null)
    );

    const hargaSatuan = variant ? variant.harga_jual : (product.harga || 0);
    
    if (existingCartItemIndex > -1) {
      const updatedCartItems = [...cartItems];
      updatedCartItems[existingCartItemIndex].quantity += 1;
      updatedCartItems[existingCartItemIndex].total_harga_item = updatedCartItems[existingCartItemIndex].quantity * updatedCartItems[existingCartItemIndex].harga_satuan;
      setCartItems(updatedCartItems);
    } else {
      const newCartItem: CartItem = {
        id_transaction_item: generateNewTransactionItemId(),
        id_stok: product.id_stok,
        nama_stok: product.nama_stok,
        id_variant_product: variant?.id_variant_product || null,
        nama_varian_produk: variant?.nama_variant_product,
        quantity: 1,
        harga_satuan: hargaSatuan,
        total_harga_item: hargaSatuan,
        photo_url: variant?.photo_url || product.photo_url,
        unit_nama: unitMap.get(product.unit) || product.unit,
        catatan_item: null,
        diskon_item: 0,
        stok: product, // Include full object
        variant: variant || null,
      };
      setCartItems(prevItems => [...prevItems, newCartItem]);
    }
    setShowVariantModal(null);
    setCurrentSelectionPath([]);
  };

  const handleAddPackageToCart = useCallback((promo: Promo) => {
    if (!promo.paket_item_ids || !promo.paket_harga_total || !selectedBranchId) return;

    // 1. Prepare items to add
    const itemsToAdd: { product: Stok, variant: ProductVariantType | null, quantity: number }[] = [];
    const itemCountsInPackage = new Map<string, number>();
    promo.paket_item_ids.forEach(itemId => {
        itemCountsInPackage.set(itemId, (itemCountsInPackage.get(itemId) || 0) + 1);
    });

    for (const [itemId, quantity] of itemCountsInPackage.entries()) {
        let product: Stok | undefined;
        let variant: ProductVariantType | null = null;
        
        if (itemId.includes(':')) {
            const [stokId, variantId] = itemId.split(':');
            product = allStocks.find(p => p.id_stok === stokId && p.id_cabang === selectedBranchId);
            variant = productVariants.find(v => v.id_variant_product === variantId && v.id_cabang === selectedBranchId) || null;
        } else {
            product = allStocks.find(p => p.id_stok === itemId && p.id_cabang === selectedBranchId);
        }

        if (!product) {
            alert(`Item dengan ID "${itemId}" dalam paket tidak ditemukan.`);
            return;
        }
        itemsToAdd.push({ product, variant, quantity });
    }
    
    // 2. Check stock availability for the whole package at once
    const availabilityCheck = checkStockForMultipleItems(itemsToAdd);
    if (!availabilityCheck.success) {
        alert(availabilityCheck.message);
        return;
    }

    // 3. Add items to cart if stock is available
    setCartItems(prevCartItems => {
        const updatedCartItems = deepClone(prevCartItems);
        itemsToAdd.forEach(itemToAdd => {
            const existingItemIndex = updatedCartItems.findIndex(item => item.id_stok === itemToAdd.product.id_stok && item.id_variant_product === (itemToAdd.variant?.id_variant_product || null));
            const hargaSatuan = itemToAdd.variant ? itemToAdd.variant.harga_jual : (itemToAdd.product.harga || 0);

            if (existingItemIndex > -1) {
                updatedCartItems[existingItemIndex].quantity += itemToAdd.quantity;
                updatedCartItems[existingItemIndex].total_harga_item = updatedCartItems[existingItemIndex].quantity * updatedCartItems[existingItemIndex].harga_satuan;
            } else {
                updatedCartItems.push({
                    id_transaction_item: generateNewTransactionItemId(),
                    id_stok: itemToAdd.product.id_stok,
                    nama_stok: itemToAdd.product.nama_stok,
                    id_variant_product: itemToAdd.variant?.id_variant_product || null,
                    nama_varian_produk: itemToAdd.variant?.nama_variant_product,
                    quantity: itemToAdd.quantity,
                    harga_satuan: hargaSatuan,
                    total_harga_item: hargaSatuan * itemToAdd.quantity,
                    photo_url: itemToAdd.variant?.photo_url || itemToAdd.product.photo_url,
                    unit_nama: unitMap.get(itemToAdd.product.unit) || itemToAdd.product.unit,
                    catatan_item: null,
                    diskon_item: 0,
                    stok: itemToAdd.product,
                    variant: itemToAdd.variant,
                });
            }
        });
        return updatedCartItems;
    });

    // Remove any conflicting promos
    setManualAppliedDiscount(null);
    setAppliedVoucher(null);
    setVoucherError(null);
    setVoucherCodeInput('');
    setAppliedPackagePromo(promo);
}, [
    selectedBranchId, allStocks, productVariants, unitMap, 
    checkStockForMultipleItems, generateNewTransactionItemId
]);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return; 

    const itemToUpdate = cartItems.find(item => item.id_transaction_item === itemId);
    if (!itemToUpdate) return;
    
    const product = products.find(p => p.id_stok === itemToUpdate.id_stok);
    const variant = itemToUpdate.id_variant_product ? productVariants.find(v => v.id_variant_product === itemToUpdate.id_variant_product) : undefined;
    if (!product) return;

    // We check the availability for the *change* in quantity.
    const quantityChange = newQuantity - itemToUpdate.quantity;
    if (quantityChange > 0) {
        const availabilityCheck = checkStockAvailability(product, variant, quantityChange);
        if (!availabilityCheck.success) {
            alert(availabilityCheck.message);
            return;
        }
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id_transaction_item === itemId
          ? { ...item, quantity: newQuantity, total_harga_item: newQuantity * item.harga_satuan }
          : item
      )
    );
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id_transaction_item !== itemId));
  };

  const confirmClearCart = () => {
     clearCartAndPromos();
     setShowConfirmClearCart(false);
     setSearchTerm('');
  }

  const subtotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.total_harga_item, 0);
  }, [cartItems]);

  const calculatePromoDiscount = useCallback((now: Date, promo: Promo, cartItemsForCalc: CartItem[], subtotalForCalc: number): number => {
    // Validasi promo berdasarkan grup dan cabang
    if (selectedBranch && promo.id_grup !== selectedBranch.id_grup) {
      return 0; // Promo ini tidak berlaku untuk grup cabang saat ini.
    }
    if (promo.id_cabang !== null && selectedBranch && promo.id_cabang !== selectedBranch.id_cabang) {
        return 0; // Promo ini berlaku untuk cabang spesifik yang lain.
    }
  
    // General conditions
    const startDate = new Date(promo.tanggal_mulai);
    const endDate = new Date(promo.tanggal_berakhir);
    endDate.setHours(23, 59, 59, 999);
    if (now < startDate || now > endDate) return 0;
  
    const relevantItems = (promo.item_berlaku_ids && promo.item_berlaku_ids.length > 0)
      ? cartItemsForCalc.filter(ci => {
          const variantId = `${ci.id_stok}:${ci.id_variant_product}`;
          return promo.item_berlaku_ids!.includes(ci.id_stok) || (ci.id_variant_product && promo.item_berlaku_ids!.includes(variantId));
        })
      : cartItemsForCalc;
  
    if (relevantItems.length === 0 && promo.item_berlaku_ids && promo.item_berlaku_ids.length > 0) return 0;
    
    const relevantSubtotal = relevantItems.reduce((sum, item) => sum + item.total_harga_item, 0);
    const relevantQuantity = relevantItems.reduce((sum, item) => sum + item.quantity, 0);
  
    if (promo.minimal_pembelian_total && subtotalForCalc < promo.minimal_pembelian_total) return 0;
    if (promo.minimal_pembelian_item_qty && relevantQuantity < promo.minimal_pembelian_item_qty) return 0;
  
    // Type-specific logic
    switch (promo.tipe_promo) {
      case 'persentase':
      case 'happy_hour': {
          if(promo.tipe_promo === 'happy_hour') {
              const dayMap: DayOfWeek[] = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
              const todayDayName = dayMap[now.getDay()];
              const timeIsInRange = promo.waktu_mulai && promo.waktu_berakhir && now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) >= promo.waktu_mulai && now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) <= promo.waktu_berakhir;
              const dayIsValid = !promo.hari_berlaku || promo.hari_berlaku.length === 0 || promo.hari_berlaku.includes(todayDayName);
              if (!timeIsInRange || !dayIsValid) return 0;
          }
  
          const discountValue = promo.nilai_diskon_persen || 0;
          if (discountValue <= 0) return 0;
  
          if (!promo.berulang) {
              return (relevantSubtotal * discountValue) / 100;
          } else {
              let multiplier = 0;
              let totalDiscount = 0;

              if (promo.minimal_pembelian_total && promo.minimal_pembelian_total > 0) {
                  multiplier = Math.floor(subtotalForCalc / promo.minimal_pembelian_total);
                  if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                      multiplier = Math.min(multiplier, promo.maksimal_berulang);
                  }
                  const baseValuePerApplication = promo.minimal_pembelian_total;
                  totalDiscount = (baseValuePerApplication * discountValue / 100) * multiplier;

              } else if (promo.minimal_pembelian_item_qty && promo.minimal_pembelian_item_qty > 0) {
                  multiplier = Math.floor(relevantQuantity / promo.minimal_pembelian_item_qty);
                  if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                      multiplier = Math.min(multiplier, promo.maksimal_berulang);
                  }
                  
                  if (relevantQuantity > 0 && multiplier > 0) {
                      const averageItemPrice = relevantSubtotal / relevantQuantity;
                      const valueOfItemsForPromoApplication = promo.minimal_pembelian_item_qty * averageItemPrice;
                      totalDiscount = (valueOfItemsForPromoApplication * discountValue / 100) * multiplier;
                  }

              } else {
                  // Fallback for recurring promo with no valid condition (e.g. recurring happy hour).
                  // Applies once to all relevant items.
                  totalDiscount = (relevantSubtotal * discountValue) / 100;
              }

              return Math.min(totalDiscount, subtotalForCalc);
          }
      }
      
      case 'nominal':
      case 'voucher': {
          const discountValue = promo.nilai_diskon_nominal || 0;
          if (discountValue <= 0) return 0;
  
          if (!promo.berulang) {
              return Math.min(discountValue, relevantSubtotal);
          } else {
              let multiplier = 0;
              if (promo.minimal_pembelian_total && promo.minimal_pembelian_total > 0) {
                  multiplier = Math.floor(subtotalForCalc / promo.minimal_pembelian_total);
              } else if (promo.minimal_pembelian_item_qty && promo.minimal_pembelian_item_qty > 0) {
                  multiplier = Math.floor(relevantQuantity / promo.minimal_pembelian_item_qty);
              } else {
                  return Math.min(discountValue, relevantSubtotal);
              }
  
              if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                  multiplier = Math.min(multiplier, promo.maksimal_berulang);
              }
  
              const totalDiscount = discountValue * multiplier;
              return Math.min(totalDiscount, subtotalForCalc);
          }
      }
      
      case 'loyalitas': {
        // A customer must be selected for any loyalty promo to apply.
        if (!selectedCustomer) {
            return 0;
        }

        // Check if the promo is for a specific list of customers.
        const isForSpecificCustomers = promo.pelanggan_berlaku_ids && promo.pelanggan_berlaku_ids.length > 0;
        
        if (isForSpecificCustomers) {
            // If it is for specific customers, the selected customer must be in the list.
            if (!promo.pelanggan_berlaku_ids.includes(selectedCustomer.id_pelanggan)) {
                return 0; // Not applicable for this customer.
            }
        }
        // If it's not for specific customers (list is empty/null), it applies to ANY selected registered customer.
        // Since we passed the !selectedCustomer check, it applies.

        const discountValue = promo.nilai_diskon_nominal || 0;
        if (discountValue <= 0) return 0;

        if (!promo.berulang) {
            return Math.min(discountValue, relevantSubtotal);
        } else {
            let multiplier = 0;
            if (promo.minimal_pembelian_total && promo.minimal_pembelian_total > 0) {
                multiplier = Math.floor(subtotalForCalc / promo.minimal_pembelian_total);
            } else if (promo.minimal_pembelian_item_qty && promo.minimal_pembelian_item_qty > 0) {
                multiplier = Math.floor(relevantQuantity / promo.minimal_pembelian_item_qty);
            } else {
                return Math.min(discountValue, relevantSubtotal);
            }

            if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                multiplier = Math.min(multiplier, promo.maksimal_berulang);
            }

            const totalDiscount = discountValue * multiplier;
            return Math.min(totalDiscount, subtotalForCalc);
        }
      }

      case 'diskon_bertingkat': {
          if (!promo.tiers) return 0;
          const applicableTier = [...promo.tiers].sort((a, b) => b.minimal_belanja_total_transaksi - a.minimal_belanja_total_transaksi).find(tier => subtotalForCalc >= tier.minimal_belanja_total_transaksi);
          if (applicableTier) {
              if (applicableTier.nilai_diskon_persen) return (subtotalForCalc * applicableTier.nilai_diskon_persen) / 100;
              if (applicableTier.nilai_diskon_nominal) return Math.min(applicableTier.nilai_diskon_nominal, subtotalForCalc);
          }
          return 0;
      }
      
      case 'bogo': {
          if (!promo.bogo_beli_qty || !promo.bogo_dapat_qty) return 0;
          if (relevantQuantity < promo.bogo_beli_qty) return 0;
          
          let numPromosApplied = 1;
  
          if (promo.berulang) {
              numPromosApplied = Math.floor(relevantQuantity / promo.bogo_beli_qty);
              if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                  numPromosApplied = Math.min(numPromosApplied, promo.maksimal_berulang);
              }
          }
          
          const numFreeItems = numPromosApplied * promo.bogo_dapat_qty;
          const sortedEligibleItems = [...relevantItems].sort((a, b) => a.harga_satuan - b.harga_satuan);
          let freeValue = 0;
          let itemsToMakeFree = numFreeItems;
          for (const item of sortedEligibleItems) {
              if (itemsToMakeFree <= 0) break;
              const freeInThisItem = Math.min(itemsToMakeFree, item.quantity);
              freeValue += freeInThisItem * item.harga_satuan;
              itemsToMakeFree -= freeInThisItem;
          }
          return freeValue;
      }
      default: return 0;
    }
  }, [selectedCustomer, selectedBranch]);

  useEffect(() => {
    // Dont run auto-promo logic if any other type of discount is active
    if (appliedVoucher || manualAppliedDiscount || appliedPackagePromo) {
      setAutoAppliedPromo(null);
      return;
    };
    
    if (cartItems.length === 0 || activePromos.length === 0) {
      setAutoAppliedPromo(null);
      return;
    }

    let bestPromo: Promo | null = null;
    let maxDiscount = 0;
    
    const automaticPromos = activePromos.filter(p => p.tipe_promo !== 'voucher' && p.tipe_promo !== 'paket');
    const now = new Date();

    for (const promo of automaticPromos) {
      const discount = calculatePromoDiscount(now, promo, cartItems, subtotal);
      if (discount > maxDiscount) {
        maxDiscount = discount;
        bestPromo = promo;
      }
    }

    if (bestPromo && maxDiscount > 0) {
      setAutoAppliedPromo({ promo: bestPromo, discount: maxDiscount });
    } else {
      setAutoAppliedPromo(null);
    }
  }, [cartItems, activePromos, subtotal, appliedVoucher, manualAppliedDiscount, appliedPackagePromo, calculatePromoDiscount]);

    // Effect to auto-remove a package promo if its conditions are no longer met
    useEffect(() => {
        if (!appliedPackagePromo) return;

        const requiredItems = new Map<string, number>();
        (appliedPackagePromo.paket_item_ids || []).forEach(id => {
            const itemId = id.includes(':') ? id : `${id}:base`;
            requiredItems.set(itemId, (requiredItems.get(itemId) || 0) + 1);
        });

        if (requiredItems.size === 0) {
            setAppliedPackagePromo(null);
            return;
        }

        const cartQuantities = new Map<string, number>();
        cartItems.forEach(item => {
            const itemId = item.variant ? `${item.stok.id_stok}:${item.variant.id_variant_product}` : `${item.stok.id_stok}:base`;
            cartQuantities.set(itemId, (cartQuantities.get(itemId) || 0) + item.quantity);
        });

        let isStillValid = true;
        for (const [itemId, requiredQty] of requiredItems.entries()) {
            const cartQty = cartQuantities.get(itemId) || 0;
            if (cartQty < requiredQty) {
                isStillValid = false;
                break;
            }
        }

        if (!isStillValid) {
            setAppliedPackagePromo(null);
            alert(`Promo paket "${appliedPackagePromo.nama_promo}" tidak lagi valid karena item di keranjang tidak mencukupi.`);
        }
    }, [cartItems, appliedPackagePromo]);
  
  // Re-validate applied voucher when cart changes
  useEffect(() => {
    if (appliedVoucher) {
        // FIX: Pass the `promo` object from the state, not the entire state object.
        const discount = calculatePromoDiscount(new Date(), appliedVoucher.promo, cartItems, subtotal);
        if (discount > 0) {
            // Update discount amount if it changes (e.g., for percentage-based vouchers)
            setAppliedVoucher(prev => prev ? { ...prev, discount } : null);
        } else {
            // Invalidate voucher if conditions are no longer met
            // FIX: Access `kode_voucher` from the nested `promo` object.
            setVoucherError(`Voucher "${appliedVoucher.promo.kode_voucher}" tidak lagi valid untuk keranjang saat ini dan telah dihapus.`);
            setAppliedVoucher(null);
        }
    }
  }, [cartItems, subtotal, appliedVoucher, calculatePromoDiscount]);
  
  const handleApplyVoucher = useCallback(() => {
    setVoucherError(null);
    if (!voucherCodeInput.trim()) return;

    if (manualAppliedDiscount || appliedPackagePromo) {
        setVoucherError("Hapus diskon manual atau paket terlebih dahulu untuk menggunakan voucher.");
        return;
    }

    const promo = activePromos.find(p => p.tipe_promo === 'voucher' && p.kode_voucher?.toLowerCase() === voucherCodeInput.trim().toLowerCase());
    const now = new Date();

    if (!promo) {
        setVoucherError("Kode voucher tidak valid.");
        return;
    }
    
    const discount = calculatePromoDiscount(now, promo, cartItems, subtotal);
    
    if (discount > 0) {
        setAppliedVoucher({ promo, discount });
        setManualAppliedDiscount(null); // Ensure manual discount is removed
        setVoucherCodeInput('');
    } else {
        setVoucherError(`Voucher tidak dapat diterapkan. Pastikan syarat terpenuhi (misal: min. belanja Rp ${promo.minimal_pembelian_total?.toLocaleString()}).`);
    }
  }, [voucherCodeInput, manualAppliedDiscount, appliedPackagePromo, activePromos, cartItems, subtotal, calculatePromoDiscount]);
  
  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError(null);
  };
  
  const { finalTotal, discountAmount, formattedDiscount, appliedPromoName, appliedPromoId, diskon_tipe, diskon_nilai, cartItemsWithDiscount } = useMemo(() => {
    let result = {
      finalTotal: subtotal,
      discountAmount: 0,
      formattedDiscount: '',
      appliedPromoName: null as string | null,
      appliedPromoId: null as string | null,
      diskon_tipe: null as 'persentase' | 'nominal' | null,
      diskon_nilai: null as number | null,
    };
    
    // Package promo has the highest priority and sets its own total
    if (appliedPackagePromo && appliedPackagePromo.paket_harga_total) {
        // ... (existing complex package logic from POSPage) ...
        // For simplicity in this self-order context, we'll assume a simpler calculation.
        const discount = subtotal - appliedPackagePromo.paket_harga_total;
        if (discount > 0) {
            result = {
                finalTotal: appliedPackagePromo.paket_harga_total,
                discountAmount: discount,
                formattedDiscount: `- Rp ${discount.toLocaleString('id-ID')}`,
                appliedPromoName: appliedPackagePromo.nama_promo,
                appliedPromoId: appliedPackagePromo.id_promo,
                diskon_tipe: 'nominal', // Treat package as a fixed nominal discount
                diskon_nilai: discount,
            };
        }
    } else {
        const promoToUse = appliedVoucher || autoAppliedPromo;
        const manualDiscount = manualAppliedDiscount;

        let calculatedDiscount = 0;
        let promoName: string | null = null;
        let promoId: string | null = null;
        let finalDiskonTipe: 'persentase' | 'nominal' | null = null;
        let finalDiskonNilai: number | null = null;

        if (promoToUse) {
            calculatedDiscount = promoToUse.discount;
            promoName = promoToUse.promo.nama_promo;
            promoId = promoToUse.promo.id_promo;
            finalDiskonTipe = promoToUse.promo.nilai_diskon_persen ? 'persentase' : 'nominal';
            finalDiskonNilai = promoToUse.promo.nilai_diskon_persen || promoToUse.promo.nilai_diskon_nominal;
        } else if (manualDiscount) {
            if (manualDiscount.type === 'nominal') {
                calculatedDiscount = Math.min(manualDiscount.value, subtotal);
            } else { // percentage
                calculatedDiscount = (subtotal * manualDiscount.value) / 100;
            }
            promoName = 'Diskon Manual';
            finalDiskonTipe = manualDiscount.type;
            finalDiskonNilai = manualDiscount.value;
        }

        if (calculatedDiscount > 0) {
            result = {
                finalTotal: Math.max(0, subtotal - calculatedDiscount),
                discountAmount: calculatedDiscount,
                formattedDiscount: `- Rp ${calculatedDiscount.toLocaleString('id-ID')}`,
                appliedPromoName: promoName,
                appliedPromoId: promoId,
                diskon_tipe: finalDiskonTipe,
                diskon_nilai: finalDiskonNilai,
            };
        }
    }

    // Now, distribute the final discount amount across items
    const finalCartItemsWithDiscount: CartItem[] = deepClone(cartItems);
    if (result.discountAmount > 0) {
        const appliedPromo = appliedPackagePromo || appliedVoucher?.promo || autoAppliedPromo?.promo;
        let eligibleItems = finalCartItemsWithDiscount;
        if (appliedPromo && appliedPromo.item_berlaku_ids && appliedPromo.item_berlaku_ids.length > 0) {
            eligibleItems = finalCartItemsWithDiscount.filter(ci => {
                const variantId = `${ci.id_stok}:${ci.id_variant_product}`;
                return appliedPromo.item_berlaku_ids!.includes(ci.id_stok) || (ci.id_variant_product && appliedPromo.item_berlaku_ids!.includes(variantId));
            });
        }
        
        const totalEligibleValue = eligibleItems.reduce((sum, item) => sum + item.total_harga_item, 0);
        if (totalEligibleValue > 0) {
            eligibleItems.forEach(item => {
                const proportion = item.total_harga_item / totalEligibleValue;
                item.diskon_item = proportion * result.discountAmount;
            });
        }
    } else {
        finalCartItemsWithDiscount.forEach(item => { item.diskon_item = 0; });
    }

    return { ...result, cartItemsWithDiscount: finalCartItemsWithDiscount };

  }, [subtotal, autoAppliedPromo, manualAppliedDiscount, appliedVoucher, appliedPackagePromo, cartItems]);

  useEffect(() => {
    if (!isCheckoutModalOpen || checkoutState.view !== 'main') {
      if (qrisUniqueCode !== null) {
        setQrisUniqueCode(null);
        setOriginalBillTotal(null);
      }
      return;
    }
  
    const isQrisSelected = checkoutState.paymentMethod.nama_metode === 'QRIS';
    const activeBill = checkoutState.bills[checkoutState.activeBillIndex];
  
    const billHasCodeApplied = (activeBill as Bill)?.qrisCodeApplied;
  
    if (isQrisSelected && !billHasCodeApplied) {
      const newCode = Math.floor(Math.random() * (500 - 200 + 1)) + 200;
      setQrisUniqueCode(newCode); 
      setOriginalBillTotal(activeBill.total); 
  
      setCheckoutState(prev => {
        const newBills = deepClone(prev.bills) as Bill[];
        const billToUpdate = newBills[prev.activeBillIndex];
        
        billToUpdate.total += newCode;
        billToUpdate.remaining += newCode;
        billToUpdate.qrisCodeApplied = newCode;
  
        return { ...prev, bills: newBills, paymentAmount: billToUpdate.remaining > 0 ? billToUpdate.remaining.toString() : '' };
      });
    } else if (!isQrisSelected && billHasCodeApplied) {
      setCheckoutState(prev => {
        const newBills = deepClone(prev.bills) as Bill[];
        const billToUpdate = newBills[prev.activeBillIndex];
        
        const codeToRemove = billToUpdate.qrisCodeApplied!;
        billToUpdate.total -= codeToRemove;
        billToUpdate.remaining -= codeToRemove;
        delete billToUpdate.qrisCodeApplied;
  
        return { ...prev, bills: newBills, paymentAmount: billToUpdate.remaining > 0 ? billToUpdate.remaining.toString() : '' };
      });
      
      setQrisUniqueCode(null);
      setOriginalBillTotal(null);
    }
  }, [isCheckoutModalOpen, checkoutState.paymentMethod, checkoutState.activeBillIndex, checkoutState.bills, checkoutState.view]);

  const handleCashCheckout = async () => {
    // FIX: Add check for selectedBranch
    if (cartItems.length === 0 || !selectedBranchId || !currentUser || !selectedBranch) return;
    
    setIsProcessing(true);
    setCheckoutError(null);

    const temporaryCustomerName = !selectedCustomer && customerSearchTerm.trim() ? customerSearchTerm.trim() : null;
    let transactionNote: string | undefined;

    if (selectedTable) {
        let noteParts = [`Meja: ${selectedTable.nama_meja}`];
        if (temporaryCustomerName) noteParts.push(temporaryCustomerName);
        transactionNote = noteParts.join(' - ');
    } else if (temporaryCustomerName) {
        transactionNote = `Takeaway: ${temporaryCustomerName}`;
    }
    
    const payload: Omit<Transaction, 'id_transaksi'> = {
        datetime: new Date().toISOString(),
        id_cabang: selectedBranchId,
        // FIX: Add required id_grup property
        id_grup: selectedBranch.id_grup,
        id_user: currentUser.id_user,
        id_pelanggan: selectedCustomer?.id_pelanggan || null,
        items: cartItemsWithDiscount.map(({ nama_stok, nama_varian_produk, photo_url, unit_nama, stok, variant, ...item }) => item),
        total_keseluruhan: finalTotal,
        subtotal_sebelum_diskon: subtotal,
        diskon_tipe: diskon_tipe,
        diskon_nilai: diskon_nilai,
        id_promo_applied: appliedPromoId,
        catatan: transactionNote,
        metode_pembayaran: 'Tunai',
        status_pembayaran: 'lunas',
        asal_data: selectedTable ? 'POS Dine-in' : 'POS',
        status_pesanan: selectedTable ? 'selesai' : undefined, // Mark as finished for KDS
        checkout_details: {
          payments: [{ method: 'Tunai', amount: finalTotal }],
          split_method: 'none',
        },
    };
    
    try {
        const response = await api.createPosTransaction(payload);
        if (response.success && response.transaction) {
            setSuccessfulTransaction(response.transaction);

            // If it was a dine-in order, update table status
            if (selectedTable) {
                const tableUpdate = await api.updateTableState(selectedTable.id_meja, { 
                    status: 'Perlu Dibersihkan', 
                    id_pesanan_aktif: null, 
                    waktu_terisi: null, 
                    id_server: null,
                    nama_pelanggan_reservasi: null,
                    jumlah_tamu_reservasi: null
                });
                if (tableUpdate.success && tableUpdate.table) {
                    setTables(prev => prev.map(t => t.id_meja === selectedTable.id_meja ? tableUpdate.table! : t));
                }
                setDineInOrders(prev => {
                    const newOrders = {...prev};
                    delete newOrders[selectedTable.id_meja];
                    return newOrders;
                });
            }
        } else {
            setCheckoutError(response.message || 'Terjadi kesalahan saat checkout.');
        }
    } catch (error) {
        console.error("Cash checkout failed:", error);
        setCheckoutError('Terjadi kesalahan koneksi saat checkout.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCheckout = (orderSource: 'pos' | 'dinein' = 'pos') => {
    if (cartItems.length === 0) return;
    const defaultPaymentMethod = pageData?.paymentMethods.find((pm: { nama_metode: string; }) => pm.nama_metode === 'Tunai') || pageData?.paymentMethods[0];
    if (!defaultPaymentMethod) {
        setCheckoutError("Metode pembayaran tidak tersedia.");
        return;
    }
    const mainBill: Bill = {
        items: cartItemsWithDiscount,
        subtotal: subtotal,
        discount: discountAmount,
        total: finalTotal,
        payments: [],
        remaining: finalTotal
    };
    setQrisUniqueCode(null);
    setOriginalBillTotal(null);
    setCheckoutState({
        ...initialCheckoutState,
        paymentMethod: defaultPaymentMethod,
        bills: [mainBill],
        activeBillIndex: 0,
        paymentAmount: finalTotal > 0 ? finalTotal.toString() : ''
    });
    setIsCheckoutModalOpen(true);
  };
  
  const handleFinalizeTransaction = async () => {
      // FIX: Add check for selectedBranch
      if (!selectedBranchId || !currentUser || !selectedBranch) {
        setCheckoutError('Cabang atau user tidak valid.');
        return;
      }
      if (checkoutState.bills.reduce((sum, bill) => sum + bill.remaining, 0) > 0.01) {
        setCheckoutError('Masih ada tagihan yang belum lunas.');
        return;
      }

      setIsProcessing(true);
      setCheckoutError(null);

      const allPayments = checkoutState.bills.flatMap(b => b.payments);
      const mainPaymentMethod = allPayments.length > 1 ? 'Partial' : (allPayments[0]?.method.nama_metode || 'Tunai');

      let transactionNote = checkoutState.bills.length > 1 ? `Pembayaran Split (${checkoutState.bills.length} tagihan)` : 'Pembayaran Normal';
      const temporaryCustomerName = !selectedCustomer && customerSearchTerm.trim() ? customerSearchTerm.trim() : null;
      if (temporaryCustomerName) {
          transactionNote = `Pesanan Takeaway - ${temporaryCustomerName}`;
      }
      
      const totalQrisCode = checkoutState.bills.reduce((sum, bill) => sum + (bill.qrisCodeApplied || 0), 0);
      if (totalQrisCode > 0) {
        transactionNote = `${transactionNote} (QRIS Code: ${totalQrisCode})`;
      }

      const payload: Omit<Transaction, 'id_transaksi'> = {
        datetime: new Date().toISOString(),
        id_cabang: selectedBranchId,
        // FIX: Add required id_grup property
        id_grup: selectedBranch.id_grup,
        id_user: currentUser.id_user,
        id_pelanggan: selectedCustomer?.id_pelanggan || null,
        items: cartItemsWithDiscount.map(({ nama_stok, nama_varian_produk, photo_url, unit_nama, stok, variant, ...item }) => item),
        total_keseluruhan: finalTotal,
        subtotal_sebelum_diskon: subtotal,
        diskon_tipe: diskon_tipe,
        diskon_nilai: diskon_nilai,
        id_promo_applied: appliedPromoId,
        catatan: transactionNote,
        metode_pembayaran: mainPaymentMethod,
        status_pembayaran: 'lunas',
        checkout_details: {
          payments: allPayments.map(p => ({ ...p, method: p.method.nama_metode })),
          split_method: checkoutState.view === 'split_item' ? 'item' : (checkoutState.bills.length > 1 ? 'even' : 'none'),
          split_count: checkoutState.bills.length > 1 ? checkoutState.bills.length : undefined,
          split_bills: checkoutState.bills.length > 1 ? checkoutState.bills.map(b => ({items: b.items.map(({ nama_stok, nama_varian_produk, photo_url, unit_nama, stok, variant, ...item }) => item), subtotal: b.subtotal, discount: b.discount, total: b.total, payments: b.payments.map(p => ({ method: p.method.nama_metode, amount: p.amount }))})) : undefined,
          unique_code_amount: totalQrisCode > 0 ? totalQrisCode : undefined,
        },
      };

      try {
        const response = await api.createPosTransaction(payload);
        if (response.success && response.transaction) {
            setSuccessfulTransaction(response.transaction);
            setIsCheckoutModalOpen(false);
            if (selectedTable) {
                const tableUpdate = await api.updateTableState(selectedTable.id_meja, { 
                    status: 'Perlu Dibersihkan',
                    id_pesanan_aktif: null,
                    waktu_terisi: null,
                    id_server: null,
                    nama_pelanggan_reservasi: null,
                    jumlah_tamu_reservasi: null
                });
                if (tableUpdate.success && tableUpdate.table) {
                    setTables(prev => prev.map(t => t.id_meja === selectedTable.id_meja ? tableUpdate.table! : t));
                }
                setDineInOrders(prev => {
                    const newOrders = {...prev};
                    delete newOrders[selectedTable.id_meja];
                    return newOrders;
                });
            }
        } else {
            setCheckoutError(response.message || 'Terjadi kesalahan saat checkout.');
        }
      } catch (error) {
          console.error("Checkout failed:", error);
          setCheckoutError('Terjadi kesalahan koneksi saat checkout.');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleNewTransaction = () => {
    setSuccessfulTransaction(null);
    resetCartAndCustomer();
    setSelectedTable(null);
    setShowConfirmClearCart(false);
    setSearchTerm('');
    
    if (selectedBranchId) {
      const refreshDataAfterCheckout = async () => {
        setIsLoading(true);
        try {
          // Re-fetch only dynamic data like stocks and tables
          const [stockData, tablesData] = await Promise.all([
            api.getStocks(),
            api.getTables()
          ]);
          setAllStocks(stockData);
          setProducts(stockData.filter(s => s.id_cabang === selectedBranchId && s.type === 'product'));
          setTables(tablesData.filter(t => t.id_cabang === selectedBranchId));
        } catch (error) {
          console.error("Failed to refresh POS data after transaction:", error);
        } finally {
          setIsLoading(false);
        }
      };
      refreshDataAfterCheckout();
    }
    
    searchInputRef.current?.focus();
  };


  const handleProductClick = (product: Stok) => {
    const variants = getVariantsForProduct(product.id_stok);
    const hasConfigurableVariants = variants.some(v => v.id_varian_detail && v.id_varian_detail.split(',').length > 0);

    if (hasConfigurableVariants || (variants.length > 0 && (product.harga === null || product.harga === 0))) {
      setShowVariantModal(product);
      setCurrentSelectionPath([]);
    } else {
      addToCart(product);
    }
  };
  
  const handleQuickAddItemClick = (item: Stok | ProductVariantType) => {
    if ('id_stok_product' in item) { // It's a ProductVariant
      const parentProduct = products.find(p => p.id_stok === item.id_stok_product);
      if (parentProduct) {
        addToCart(parentProduct, item);
      }
    } else { // It's a Stok
      handleProductClick(item);
    }
  };

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!barcode) return;
    
    // 1. Check product variants first
    let foundVariant = productVariants.find(pv => pv.barcode === barcode);
    if (foundVariant) {
        const parentProduct = products.find(p => p.id_stok === foundVariant!.id_stok_product);
        if (parentProduct) {
            addToCart(parentProduct, foundVariant);
            setSearchTerm('');
            searchInputRef.current?.focus();
            return;
        }
    }
    
    // 2. Check parent products
    const foundProduct = products.find(p => p.barcode === barcode);
    if (foundProduct) {
        handleProductClick(foundProduct);
        setSearchTerm('');
        searchInputRef.current?.focus();
        return;
    }

    alert(`Produk dengan barcode "${barcode}" tidak ditemukan.`);
    setSearchTerm('');
    searchInputRef.current?.focus();
  }, [products, productVariants, addToCart, handleProductClick]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeScan(searchTerm.trim());
      searchInputRef.current?.focus();
    }
  };
  
  const handleAddNewCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCustomerData.nama_pelanggan.trim()) {
        alert("Nama pelanggan wajib diisi.");
        return;
    }
    if (!selectedBranch) {
        alert("Cabang tidak dipilih. Tidak dapat menambahkan pelanggan.");
        return;
    }
    setIsProcessing(true); // Reuse spinner state
    try {
        const newCust = await api.createCustomer({
            id_grup: selectedBranch.id_grup,
            nama_pelanggan: newCustomerData.nama_pelanggan,
            telepon: newCustomerData.telepon || null,
            email: newCustomerData.email || null,
            alamat: newCustomerData.alamat || null,
        });
        setCustomers(prev => [...prev, newCust]);
        setSelectedCustomer(newCust);
        setIsAddCustomerModalOpen(false);
        setNewCustomerData({ nama_pelanggan: '', telepon: '', email: '', alamat: '' });
    } catch (error) {
        console.error("Failed to create customer:", error);
        alert("Gagal menambahkan pelanggan baru.");
    } finally {
        setIsProcessing(false);
    }
};

  const productVariantsForModal = useMemo(() => {
    if (!showVariantModal) return [];
    return getVariantsForProduct(showVariantModal.id_stok);
  }, [showVariantModal, getVariantsForProduct]);

  const currentLevelIndex = currentSelectionPath.length;

  const currentLevelOptions = useMemo((): ModalOption[] => {
    if (!showVariantModal) return [];

    const optionsMap = new Map<string, ModalOption>();

    productVariantsForModal.forEach(pv => {
      if (!pv.id_varian_detail) return;
      const detailIds = pv.id_varian_detail.split(',').map(id => id.trim());

      let isPrefix = true;
      if (currentSelectionPath.length > detailIds.length) {
          isPrefix = false;
      } else {
        for (let i = 0; i < currentSelectionPath.length; i++) {
          if (currentSelectionPath[i] !== detailIds[i]) {
            isPrefix = false;
            break;
          }
        }
      }
      
      if (isPrefix && detailIds.length > currentLevelIndex) {
        const nextComponentId = detailIds[currentLevelIndex];
        if (!optionsMap.has(nextComponentId)) {
          const mvDetail = materialVariantDetailsMap.get(nextComponentId);
          const isFinalChoice = detailIds.length === currentLevelIndex + 1;
          optionsMap.set(nextComponentId, {
            id: nextComponentId,
            name: mvDetail?.name || nextComponentId,
            isFinalChoice: isFinalChoice,
            productVariantToBuy: isFinalChoice ? pv : undefined,
            price: isFinalChoice ? pv.harga_jual : undefined,
          });
        }
      }
    });
    return Array.from(optionsMap.values());
  }, [showVariantModal, currentSelectionPath, productVariantsForModal, materialVariantDetailsMap, currentLevelIndex]);


  const currentLevelTitle = useMemo((): string => {
    if (!showVariantModal || currentLevelOptions.length === 0) return "Pilih Varian";
    const firstOptionMvId = currentLevelOptions[0].id;
    const mvDetail = materialVariantDetailsMap.get(firstOptionMvId);
    return `Pilih ${mvDetail?.parentStockName || "Varian"}`;
  }, [showVariantModal, currentLevelOptions, materialVariantDetailsMap]);

  const handleVariantOptionSelect = (option: ModalOption) => {
    if (!showVariantModal) return;

    if (option.isFinalChoice && option.productVariantToBuy) {
      addToCart(showVariantModal, option.productVariantToBuy);
    } else {
      setCurrentSelectionPath(prev => [...prev, option.id]);
    }
  };
  
  const handleBackInModal = () => {
    setCurrentSelectionPath(prev => prev.slice(0, -1));
  };
  
  const handleHoldTakeawayCart = () => {
    if (cartItems.length === 0) return;
  
    const customerIdentifier = selectedCustomer?.nama_pelanggan || customerSearchTerm.trim();
  
    if (customerIdentifier) {
      let finalHoldName = customerIdentifier;
      let counter = 2;
      while (onHoldOrders.some(order => order.name === finalHoldName)) {
        finalHoldName = `${customerIdentifier} (${counter})`;
        counter++;
      }
  
      setOnHoldOrders(prev => [...prev, {
        name: finalHoldName,
        items: cartItems,
        heldAt: Date.now(),
        customer: selectedCustomer,
        temporaryCustomerName: selectedCustomer ? null : customerIdentifier
      }]);
  
      resetCartAndCustomer();
    } else {
      setHoldOrderName('');
      setShowHoldModal(true);
    }
  };

  const confirmHoldTakeawayCart = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHoldName = holdOrderName.trim();
    if (!trimmedHoldName) {
      alert('Silakan masukkan nama pesanan.');
      return;
    }

    let finalHoldName = trimmedHoldName;
    let counter = 2;
    while (onHoldOrders.some(order => order.name === finalHoldName)) {
        finalHoldName = `${trimmedHoldName} (${counter})`;
        counter++;
    }

    setOnHoldOrders(prev => [...prev, {
        name: finalHoldName,
        items: cartItems,
        heldAt: Date.now(),
        customer: selectedCustomer,
        temporaryCustomerName: selectedCustomer ? null : trimmedHoldName
    }]);

    resetCartAndCustomer();
    setHoldOrderName('');
    setShowHoldModal(false);
  };

  const handleRecallTakeawayOrder = (orderToRecall: OnHoldOrder) => {
    setCartItems(orderToRecall.items);
    setSelectedCustomer(orderToRecall.customer);
    setCustomerSearchTerm(orderToRecall.customer?.nama_pelanggan || orderToRecall.temporaryCustomerName || '');
    setOnHoldOrders(prev => prev.filter(order => order.name !== orderToRecall.name));
    setShowRecallModal(false);
  };

  const handleDeleteHeldOrder = (orderNameToDelete: string) => {
    setOnHoldOrders(prev => prev.filter(order => order.name !== orderNameToDelete));
  };
  
  const handleCustomerSearchBlur = () => {
    if (customerSearchTerm !== (selectedCustomer?.nama_pelanggan || '')) {
      setSelectedCustomer(null);
    }
  };

  const handleApplyManualDiscount = (e: React.FormEvent) => {
      e.preventDefault();
      const value = parseFloat(discountValue);
      if (isNaN(value) || value <= 0) {
          alert("Nilai diskon harus lebih dari 0.");
          return;
      }
      setManualAppliedDiscount({ type: discountType, value });
      setAppliedVoucher(null); // Remove voucher if manual discount is applied
      setAppliedPackagePromo(null);
      setShowDiscountModal(false);
      setDiscountValue('');
  };

  const handleRemoveManualDiscount = () => {
      setManualAppliedDiscount(null);
  };

  const handleOpenNoteModal = (item: CartItem) => {
      setEditingNote({ itemId: item.id_transaction_item, currentNote: item.catatan_item || '' });
  };

  const handleSaveNote = () => {
      if (!editingNote) return;
      setCartItems(prev => prev.map(item =>
          item.id_transaction_item === editingNote.itemId
              ? { ...item, catatan_item: editingNote.currentNote.trim() || null }
              : item
      ));
      setEditingNote(null);
  };

  // --- DINE-IN HANDLERS ---
  const handleTableClick = (table: Meja) => {
      if (isMergeMode) {
          if (table.status === 'Terisi') {
              setSourceTableIds(prev =>
                  prev.includes(table.id_meja)
                      ? prev.filter(id => id !== table.id_meja)
                      : [...prev, table.id_meja]
              );
          } else if (table.status === 'Tersedia') {
              if (sourceTableIds.length === 0) {
                  alert("Pilih meja sumber (yang terisi) terlebih dahulu.");
                  return;
              }
              setDestinationTableId(table.id_meja);
              const sourceTables = tables.filter(t => sourceTableIds.includes(t.id_meja));
              setMergeConfirmState({ isOpen: true, sources: sourceTables, destination: table });
          }
          return;
      }

      if (isReservationMode) {
          if (table.status === 'Tersedia') {
              setReservationModalState({ isOpen: true, table: table });
          } else {
              alert(`Meja ${table.nama_meja} tidak tersedia untuk reservasi.`);
          }
          return;
      }

      switch (table.status) {
          case 'Tersedia':
          case 'Dipesan':
              setAssignModalState({ isOpen: true, table });
              break;
          case 'Terisi':
              if (dineInOrders[table.id_meja]) {
                  const order = dineInOrders[table.id_meja];
                  setCartItems(order.items);
                  setSelectedCustomer(order.customer);
                  setCustomerSearchTerm(order.customer?.nama_pelanggan || order.temporaryCustomerName || '');
                  setSelectedTable(table);
                  setActiveTab('pos');
              } else {
                  // If order not found in local state, create a new one
                  setSelectedTable(table);
                  resetCartAndCustomer();
                  setActiveTab('pos');
              }
              break;
          case 'Perlu Dibersihkan':
              setCleanTableConfirmState({ isOpen: true, table: table });
              break;
      }
  };
  
  const handleStartOrder = async (tableId: string, serverId: string | null, guestCount: number, customerName: string) => {
      const response = await api.updateTableState(tableId, {
          status: 'Terisi',
          id_server: serverId,
          waktu_terisi: new Date().toISOString(),
          id_pesanan_aktif: `DINEIN-${tableId}-${Date.now()}`,
          jumlah_tamu_reservasi: guestCount,
          nama_pelanggan_reservasi: customerName, // Use reservation field to store active customer for now
      });

      if (response.success && response.table) {
          setTables(prev => prev.map(t => t.id_meja === tableId ? response.table! : t));
          setDineInOrders(prev => ({
              ...prev,
              [tableId]: {
                  name: response.table!.nama_meja,
                  items: [],
                  heldAt: Date.now(),
                  customer: null,
                  temporaryCustomerName: customerName.trim() || null,
                  guestCount: guestCount
              }
          }));
          setSelectedTable(response.table);
          resetCartAndCustomer();
          setAssignModalState({ isOpen: false, table: null });
          setActiveTab('pos');
          
          // New logic to populate customer search
          if (customerName.trim()) {
            const trimmedName = customerName.trim();
            setCustomerSearchTerm(trimmedName);
            const matchingCustomer = customers.find(c => c.nama_pelanggan.toLowerCase() === trimmedName.toLowerCase());
            setSelectedCustomer(matchingCustomer || null);
          }

      } else {
          alert('Gagal memulai pesanan di meja ini.');
      }
  };

  const handleSaveReservation = async (tableId: string, details: { customerName: string; customerPhone: string; guestCount: number }) => {
      const response = await api.updateTableState(tableId, { 
          status: 'Dipesan',
          nama_pelanggan_reservasi: details.customerName,
          telepon_pelanggan_reservasi: details.customerPhone,
          jumlah_tamu_reservasi: details.guestCount,
      });
      if (response.success && response.table) {
          setTables(prev => prev.map(t => t.id_meja === tableId ? response.table! : t));
          setReservationModalState({ isOpen: false, table: null });
          setIsReservationMode(false);
      } else {
          alert('Gagal membuat reservasi.');
      }
  };

  const handleMarkTableAsAvailable = async (tableId: string) => {
    setIsProcessing(true);
    try {
        const response = await api.updateTableState(tableId, { status: 'Tersedia' });
        if(response.success && response.table) {
            setTables(prev => prev.map(t => t.id_meja === tableId ? response.table! : t));
        } else {
            alert('Gagal mengubah status meja.');
        }
    } catch (error) {
        console.error("Failed to mark table as available:", error);
        alert('Terjadi kesalahan saat mengubah status meja.');
    } finally {
        setIsProcessing(false);
        setCleanTableConfirmState({ isOpen: false, table: null });
    }
  };

  const handleSaveToTable = async () => {
    if (!selectedTable || cartItems.length === 0 || !currentUser) {
        alert("Pilih meja dan tambahkan item terlebih dahulu.");
        return;
    }
    setIsProcessing(true);
    try {
        const payload = {
            tableId: selectedTable.id_meja,
            items: cartItems.map(({ nama_stok, nama_varian_produk, photo_url, unit_nama, stok, variant, ...item }) => item),
            customerId: selectedCustomer?.id_pelanggan || null,
            userId: currentUser.id_user,
        };
        const response = await api.saveDineInOrder(payload);

        if (response.success && response.transaction) {
            const customerForState = selectedCustomer || (customerSearchTerm.trim() ? null : null);
            const tempCustomerName = selectedCustomer ? null : customerSearchTerm.trim() || null;
            
            setDineInOrders(prev => ({
                ...prev,
                [selectedTable.id_meja]: {
                    ...prev[selectedTable.id_meja],
                    name: selectedTable.nama_meja,
                    items: response.transaction!.items.map(ti => {
                        const product = allStocks.find(p => p.id_stok === ti.id_stok);
                        const variant = ti.id_variant_product ? productVariants.find(v => v.id_variant_product === ti.id_variant_product) : undefined;
                        return {
                            ...ti,
                            nama_stok: product?.nama_stok || 'N/A',
                            nama_varian_produk: variant?.nama_variant_product,
                            photo_url: variant?.photo_url || product?.photo_url,
                            unit_nama: unitMap.get(product?.unit || '') || 'N/A',
                            stok: product!,
                            variant: variant || null
                        };
                    }),
                    heldAt: Date.now(),
                    customer: customerForState,
                    temporaryCustomerName: tempCustomerName,
                }
            }));

            resetCartAndCustomer();
            setSelectedTable(null);
            alert("Pesanan berhasil disimpan & dikirim ke dapur!");
        } else {
            throw new Error(response.message || "Gagal menyimpan pesanan ke meja.");
        }

    } catch (error) {
        console.error("Failed to save to table:", error);
        alert(`Terjadi kesalahan: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const handlePosTabClick = () => {
    if (selectedTable) {
        handleLepasMeja();
    }
    setActiveTab('pos');
  }

  const CardPlaceholderIcon = () => <PackageIcon className="w-full h-16 object-cover text-slate-300" />;

  const tabButtonStyle = (isActive: boolean): string =>
    `relative px-4 sm:px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2 flex items-center space-x-2
     ${
       isActive
         ? 'border-[var(--primary-color)] text-[var(--primary-color)] bg-white'
         : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
     }`;
     
  const SelfOrderContent: React.FC<{ tables: Meja[], selfOrders: SelfOrder[], pageData: any }> = ({ tables, selfOrders, pageData }) => {
    const [isConfirming, setIsConfirming] = useState<string | null>(null);
    const [selectedSelfOrderTableId, setSelectedSelfOrderTableId] = useState<string>('');
    const { selectedBranchId, selectedBranch } = useBranch();
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const selectedTableName = useMemo(() => {
        if (!selectedSelfOrderTableId) {
            return selectedBranch?.Nama || 'Pesan Langsung';
        }
        return tables.find(t => t.id_meja === selectedSelfOrderTableId)?.nama_meja || selectedSelfOrderTableId;
    }, [selectedSelfOrderTableId, tables, selectedBranch]);

    const handleConfirm = async (orderId: string) => {
        if (!currentUser) return;
        setIsConfirming(orderId);
        try {
            const response = await api.confirmSelfOrderPayment(orderId, currentUser.id_user);
            if (response.success) {
                const confirmedOrder = selfOrders.find(o => o.id_self_order === orderId);
                if (confirmedOrder && confirmedOrder.customer_phone) {
                    let phoneNumber = confirmedOrder.customer_phone.replace(/[^0-9]/g, '');
                    if (phoneNumber.startsWith('0')) {
                        phoneNumber = '62' + phoneNumber.substring(1);
                    } else if (!phoneNumber.startsWith('62')) {
                        phoneNumber = '62' + phoneNumber;
                    }
                    
                    const branchName = pageData?.branch?.Nama || 'toko kami';
                    const message = `*PEMBAYARAN BERHASIL*\n\nHalo ${confirmedOrder.customer_name},\nPembayaran Anda sebesar Rp ${confirmedOrder.total.toLocaleString('id-ID')} untuk pesanan #${confirmedOrder.id_self_order.slice(-6)} di ${branchName} sudah kami terima dan sedang disiapkan.\n\nTerima kasih!`;
                    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                }
            } else {
                alert(response.message || 'Gagal mengonfirmasi pesanan.');
            }
        } catch (error) {
            console.error("Failed to confirm self-order:", error);
            alert('Terjadi kesalahan saat mengonfirmasi pesanan.');
        } finally {
            setIsConfirming(null);
        }
    };
  
    const renderContent = () => {
        if (isLoadingSelfOrders) {
            return <div className="p-8 flex justify-center items-center h-full"><SpinnerIcon className="w-10 h-10 text-sky-500" /></div>;
        }

        if (selfOrders.length === 0) {
            return (
                <div className="p-8 flex flex-col justify-center items-center h-full text-center text-slate-500">
                    <SparklesIcon className="w-16 h-16 text-slate-400 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-700">Tidak Ada Pesanan Masuk</h2>
                    <p className="mt-2 max-w-md">Saat ini tidak ada pesanan mandiri (self-order) yang menunggu konfirmasi pembayaran. Halaman ini akan diperbarui secara otomatis.</p>
                </div>
            );
        }

        return (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {selfOrders.map(order => (
                    <div key={order.id_self_order} className="bg-white rounded-lg shadow-md border flex flex-col">
                        <div className="p-4 border-b">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-800">{order.id_self_order}</h3>
                                <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full capitalize">{order.order_type === 'meja' ? `Meja ${order.id_meja}` : 'Takeaway'}</span>
                            </div>
                            <p className="text-sm text-slate-500">{order.customer_name} &bull; {order.customer_phone}</p>
                        </div>
                        <ul className="p-4 flex-grow space-y-2 text-sm overflow-y-auto max-h-48">
                            {order.items.map(item => (
                                <li key={item.id_transaction_item} className="flex justify-between">
                                    <div>
                                        <span className="font-semibold">{item.quantity}x</span> {stockMap.get(item.id_stok)?.nama_stok || item.id_stok}
                                        {item.id_variant_product && <span className="text-xs text-slate-500 block pl-6">- {productVariantMap.get(item.id_variant_product)?.nama_variant_product}</span>}
                                    </div>
                                    <span className="font-mono">{(item.quantity * item.harga_satuan).toLocaleString('id-ID')}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="p-4 border-t bg-slate-50 rounded-b-lg">
                            <div className="flex justify-between items-center text-sm mb-3">
                                <span className="font-medium text-slate-600">Metode Pembayaran</span>
                                <span className="font-semibold uppercase">{order.payment_method}</span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-medium text-slate-600">Total Bayar</span>
                                <span className="font-bold text-xl text-sky-600">Rp {order.total.toLocaleString('id-ID')}</span>
                            </div>
                            <button onClick={() => handleConfirm(order.id_self_order)} disabled={isConfirming === order.id_self_order} className="w-full bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center">
                                {isConfirming === order.id_self_order ? <SpinnerIcon className="w-5 h-5 mr-2" /> : <CheckCircleIcon className="w-5 h-5 mr-2" />}
                                {isConfirming === order.id_self_order ? 'Mengonfirmasi...' : 'Konfirmasi & Kirim ke Dapur'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
      <div className="h-full flex flex-col">
          <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-white flex flex-wrap items-center gap-4">
              <div className="relative flex-grow sm:flex-grow-0">
                  <label htmlFor="self-order-table-select" className="sr-only">Pilih Meja</label>
                  <select
                    id="self-order-table-select"
                    value={selectedSelfOrderTableId}
                    onChange={e => setSelectedSelfOrderTableId(e.target.value)}
                    className="form-select appearance-none w-full pl-3 pr-8 py-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                  >
                      <option value="">Pickup/Delivery</option>
                      {tables.map(table => (
                          <option key={table.id_meja} value={table.id_meja}>{table.nama_meja}</option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                    <ChevronDownIcon className="h-4 w-4"/>
                  </div>
              </div>
              <button 
                onClick={() => setIsBarcodeModalOpen(true)}
                disabled={!selectedBranchId}
                className="flex items-center text-sm font-medium bg-slate-100 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <QrCodeIcon className="w-5 h-5 mr-2" />
                  Preview Barcode
              </button>
          </div>
          <div className="flex-grow overflow-y-auto">
              {renderContent()}
          </div>
           {isBarcodeModalOpen && selectedBranchId && (
            <BarcodePreviewModal
              branchId={selectedBranchId}
              tableId={selectedSelfOrderTableId}
              tableName={selectedTableName}
              onClose={() => setIsBarcodeModalOpen(false)}
            />
          )}
      </div>
    );
  };
  

  // --- DINE-IN DERIVED STATES ---
  const tableLocations = useMemo(() => ['Semua', ...Array.from(new Set(tables.map(t => t.lokasi)))], [tables]);
  const filteredTables = useMemo(() => {
      if (activeLocationFilter === 'Semua') return tables;
      return tables.filter(t => t.lokasi === activeLocationFilter);
  }, [tables, activeLocationFilter]);
  const servers = useMemo(() => karyawan.filter(k => k.status_karyawan === 'aktif'), [karyawan]);
  const karyawanMap = useMemo(() => new Map(karyawan.map(k => [k.id_karyawan, k.nama_lengkap])), [karyawan]);

  const getStatusInfo = (table: Meja): { color: string; bgColor: string; text: string } => {
    const isOrderAssociated = !!dineInOrders[table.id_meja];
    switch (table.status) {
        case 'Tersedia': return { color: 'text-green-700', bgColor: 'bg-green-100', text: 'Tersedia' };
        case 'Terisi': return { color: 'text-blue-700', bgColor: 'bg-blue-100', text: 'Terisi' };
        case 'Dipesan': return { color: 'text-gray-700', bgColor: 'bg-gray-200', text: 'Dipesan' };
        case 'Perlu Dibersihkan': return { color: 'text-yellow-700', bgColor: 'bg-yellow-100', text: 'Bersihkan' };
        default: return { color: 'text-slate-700', bgColor: 'bg-slate-200', text: 'Unknown' };
    }
  };

  const handleConfirmMerge = async () => {
    if (!destinationTableId || sourceTableIds.length === 0) return;

    setIsProcessing(true);
    try {
        // 1. Combine frontend order data
        const combinedItems: CartItem[] = [];
        let firstCustomer: Customer | null = null;
        let firstTempCustomerName: string | null = null;
        let totalGuests = 0;

        for (const id of sourceTableIds) {
            const order = dineInOrders[id];
            if (order) {
                combinedItems.push(...order.items);
                if (!firstCustomer && !firstTempCustomerName) {
                    firstCustomer = order.customer;
                    firstTempCustomerName = order.temporaryCustomerName;
                }
                totalGuests += order.guestCount || 0;
            }
        }

        // 2. Call backend API
        const response = await api.mergeTables(sourceTableIds, destinationTableId);

        if (response.success && response.updatedTables) {
            // 3. Update frontend state
            // Update table statuses
            setTables(prevTables => {
                const newTables = [...prevTables];
                response.updatedTables!.forEach(updatedTable => {
                    const index = newTables.findIndex(t => t.id_meja === updatedTable.id_meja);
                    if (index > -1) newTables[index] = updatedTable;
                });
                return newTables;
            });
            
            // Update dineInOrders state
            setDineInOrders(prevOrders => {
                const newOrders = { ...prevOrders };
                // Remove source orders
                sourceTableIds.forEach(id => delete newOrders[id]);
                // Add new destination order
                const destTableDetails = response.updatedTables!.find(t => t.id_meja === destinationTableId)!;
                newOrders[destinationTableId] = {
                    name: destTableDetails.nama_meja,
                    items: combinedItems,
                    heldAt: Date.now(),
                    customer: firstCustomer,
                    temporaryCustomerName: firstTempCustomerName,
                    guestCount: totalGuests,
                };
                return newOrders;
            });

            alert('Meja berhasil digabung/dipindah!');
        } else {
            throw new Error(response.message || 'Gagal menggabungkan meja.');
        }

    } catch (error) {
        console.error("Merge failed:", error);
        alert(`Terjadi kesalahan: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        // 4. Reset states
        setIsProcessing(false);
        setMergeConfirmState({ isOpen: false, sources: [], destination: null });
        setIsMergeMode(false);
        setSourceTableIds([]);
        setDestinationTableId(null);
    }
};

const handleSplitEven = () => {
    setQrisUniqueCode(null);
    setOriginalBillTotal(null);
    const count = checkoutState.splitEvenCount;
    if (count < 2 || finalTotal <= 0) return;
    const splitAmount = finalTotal / count;
    const splitSubtotal = subtotal / count;
    const splitDiscount = discountAmount / count;

    const newBills: Bill[] = Array.from({ length: count }, (_, i) => ({
        items: [{
            id_transaction_item: `split-ref-${i}`,
            nama_stok: `Tagihan Dibagi Rata ${i + 1}`,
            id_stok: 'SPLIT', id_variant_product: null,
            quantity: 1, harga_satuan: splitAmount, total_harga_item: splitSubtotal,
            stok: {} as Stok, variant: null
        } as CartItem], // Cast to CartItem to satisfy type, although it's a placeholder
        subtotal: splitSubtotal,
        discount: splitDiscount,
        total: splitAmount,
        payments: [],
        remaining: splitAmount,
    }));
    setCheckoutState(prev => ({
        ...prev,
        bills: newBills,
        activeBillIndex: 0,
        paymentAmount: splitAmount.toFixed(0)
    }));
};

const handleStartSplitByItem = () => {
    setQrisUniqueCode(null);
    setOriginalBillTotal(null);
    setCheckoutState(prev => ({
        ...prev,
        view: 'split_item',
        unassignedItems: deepClone(cartItemsWithDiscount),
        bills: [{ items: [], subtotal: 0, discount: 0, total: 0, payments: [], remaining: 0 }],
        activeBillIndex: 0,
    }));
};

const handleFinishSplitByItem = () => {
    if (checkoutState.unassignedItems.reduce((sum, item) => sum + item.quantity, 0) > 0) {
        alert("Masih ada item yang belum dimasukkan ke tagihan.");
        return;
    }

    // The new logic: calculate subtotal and discount directly from the items in each bill.
    const finalBills = checkoutState.bills.map(bill => {
        const billSubtotal = bill.items.reduce((sum, i) => sum + i.total_harga_item, 0);
        // SUM the individual item discounts for THIS bill. This is the key change.
        const billDiscount = bill.items.reduce((sum, i) => sum + (i.diskon_item || 0), 0);
        const finalBillTotal = billSubtotal - billDiscount;
        
        return { ...bill, subtotal: billSubtotal, discount: billDiscount, total: finalBillTotal, remaining: finalBillTotal };
    }).filter(bill => bill.items.length > 0);

    if (finalBills.length === 0) {
        handleCancelSplitByItem();
        return;
    }

    setCheckoutState(prev => ({
        ...prev,
        view: 'main',
        bills: finalBills,
        activeBillIndex: 0,
        paymentAmount: finalBills[0].remaining > 0 ? finalBills[0].remaining.toString() : ''
    }));
  };

const handleCancelSplitByItem = () => {
    const mainBill: Bill = {
        items: cartItemsWithDiscount,
        subtotal: subtotal,
        discount: discountAmount,
        total: finalTotal,
        payments: [],
        remaining: finalTotal
    };
    setCheckoutState({
        ...initialCheckoutState,
        bills: [mainBill],
        paymentAmount: finalTotal > 0 ? finalTotal.toString() : ''
    });
};

const handleMoveItemToBill = (itemToMove: CartItem, targetBillIndex: number) => {
    setCheckoutState(prev => {
        const newBills = deepClone(prev.bills);
        const newUnassigned = deepClone(prev.unassignedItems);

        const unassignedItemRef = newUnassigned.find(item => item.id_stok === itemToMove.id_stok && item.id_variant_product === itemToMove.id_variant_product);
        if (!unassignedItemRef || unassignedItemRef.quantity < 1) return prev;

        const singleItemDiscount = (unassignedItemRef.diskon_item || 0) / unassignedItemRef.quantity;

        const singleUnitItem: CartItem = { 
            ...itemToMove, 
            quantity: 1, 
            total_harga_item: itemToMove.harga_satuan, 
            id_transaction_item: `${itemToMove.id_transaction_item}-split-${Math.random()}`,
            diskon_item: singleItemDiscount
        };
        
        const targetBill = newBills[targetBillIndex];
        targetBill.items.push(singleUnitItem);
        
        targetBill.subtotal = targetBill.items.reduce((sum, i) => sum + i.total_harga_item, 0);
        targetBill.discount = targetBill.items.reduce((sum, i) => sum + (i.diskon_item || 0), 0);
        targetBill.total = targetBill.subtotal - targetBill.discount;
        const paidForTarget = targetBill.payments.reduce((s, p) => s + p.amount, 0);
        targetBill.remaining = targetBill.total - paidForTarget;
        
        unassignedItemRef.quantity -= 1;
        unassignedItemRef.total_harga_item = unassignedItemRef.quantity * unassignedItemRef.harga_satuan;
        unassignedItemRef.diskon_item = (unassignedItemRef.diskon_item || 0) - singleItemDiscount;

        const finalUnassigned = newUnassigned.filter(item => item.quantity > 0);
        
        return { ...prev, unassignedItems: finalUnassigned, bills: newBills };
    });
};

const handleMoveItemFromBill = (itemToMove: CartItem, fromBillIndex: number) => {
    setCheckoutState(prev => {
        const newBills = deepClone(prev.bills);
        const newUnassigned = deepClone(prev.unassignedItems);

        const bill = newBills[fromBillIndex];
        const itemIndexInBill = bill.items.findIndex(i => i.id_transaction_item === itemToMove.id_transaction_item);
        if (itemIndexInBill === -1) return prev;
        
        const [movedItem] = bill.items.splice(itemIndexInBill, 1);

        bill.subtotal = bill.items.reduce((sum, i) => sum + i.total_harga_item, 0);
        bill.discount = bill.items.reduce((sum, i) => sum + (i.diskon_item || 0), 0);
        bill.total = bill.subtotal - bill.discount;
        const paidForBill = bill.payments.reduce((s, p) => s + p.amount, 0);
        bill.remaining = bill.total - paidForBill;

        const unassignedItemRef = newUnassigned.find(item => item.id_stok === movedItem.id_stok && item.id_variant_product === movedItem.id_variant_product);
        
        if (unassignedItemRef) {
            unassignedItemRef.quantity += 1;
            unassignedItemRef.total_harga_item = unassignedItemRef.quantity * unassignedItemRef.harga_satuan;
            unassignedItemRef.diskon_item = (unassignedItemRef.diskon_item || 0) + (movedItem.diskon_item || 0);
        } else {
            const originalCartItem = cartItemsWithDiscount.find(ci => ci.id_stok === movedItem.id_stok && ci.id_variant_product === movedItem.id_variant_product)!;
            newUnassigned.push({
                ...originalCartItem,
                quantity: 1,
                total_harga_item: originalCartItem.harga_satuan,
                diskon_item: (originalCartItem.diskon_item || 0) / originalCartItem.quantity,
            });
        }
        
        return { ...prev, unassignedItems: newUnassigned, bills: newBills };
    });
};

const handleAddNewBill = () => {
    setCheckoutState(prev => ({
        ...prev,
        bills: [...prev.bills, { items: [], subtotal: 0, discount: 0, total: 0, payments: [], remaining: 0 }],
        activeBillIndex: prev.bills.length
    }));
};

const handleAddPayment = () => {
    let amount = parseFloat(checkoutState.paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setCheckoutState(prev => {
        const newBills = deepClone(prev.bills) as Bill[];
        const activeBill = newBills[prev.activeBillIndex];
        
        // Prevent overpayment for non-cash methods
        if (prev.paymentMethod.nama_metode !== 'Tunai' && amount > activeBill.remaining) {
            amount = activeBill.remaining;
        }

        const newPayment: Payment = { method: prev.paymentMethod, amount: amount };
        
        const updatedPayments = [...activeBill.payments, newPayment];
        const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
        const newRemaining = activeBill.total - totalPaid;

        newBills[prev.activeBillIndex] = {
            ...activeBill,
            payments: updatedPayments,
            remaining: newRemaining
        };
        
        let nextActiveIndex = prev.activeBillIndex;
        let nextPaymentAmount = '';

        if (newRemaining <= 0) {
            const nextUnpaidIndex = newBills.findIndex((bill, index) => index > prev.activeBillIndex && bill.remaining > 0);
            
            if (nextUnpaidIndex !== -1) {
                nextActiveIndex = nextUnpaidIndex;
                nextPaymentAmount = newBills[nextUnpaidIndex].remaining > 0 ? newBills[nextUnpaidIndex].remaining.toString() : '';
            } else {
                const anyUnpaidIndex = newBills.findIndex(bill => bill.remaining > 0);
                if (anyUnpaidIndex !== -1) {
                     nextActiveIndex = anyUnpaidIndex;
                     nextPaymentAmount = newBills[anyUnpaidIndex].remaining > 0 ? newBills[anyUnpaidIndex].remaining.toString() : '';
                } else {
                    nextPaymentAmount = '';
                }
            }
        } else {
            nextPaymentAmount = newRemaining > 0 ? newRemaining.toString() : '';
        }
        
        return { 
            ...prev, 
            bills: newBills, 
            activeBillIndex: nextActiveIndex,
            paymentAmount: nextPaymentAmount
        };
    });
};

// --- SELF ORDER POLLING ---
  useEffect(() => {
    if (activeTab !== 'selforder' || !selectedBranchId) {
        return;
    }

    const fetchSelfOrders = async () => {
        setIsLoadingSelfOrders(true);
        try {
            const orders = await api.getSelfOrders();
            // Filter by current branch
            setSelfOrders(orders.filter(o => o.id_cabang === selectedBranchId));
        } catch (error) {
            console.error("Failed to poll self-orders:", error);
        } finally {
            setIsLoadingSelfOrders(false);
        }
    };
    
    fetchSelfOrders(); // Initial fetch
    const intervalId = setInterval(fetchSelfOrders, 60000); // Poll every 1 minute
    
    return () => clearInterval(intervalId);
  }, [activeTab, selectedBranchId]);

     
  return (
    <div className="h-full flex flex-col">
        {/* Tabs Header */}
        <div className="flex-shrink-0 p-4 pb-0 border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
          <nav className="flex -mb-px space-x-2 sm:space-x-4" aria-label="Tabs">
            <button onClick={handlePosTabClick} className={tabButtonStyle(activeTab === 'pos')}>
                <ComputerDesktopIcon className="w-5 h-5"/> <span>POS</span>
            </button>
            <button onClick={() => setActiveTab('dinein')} className={tabButtonStyle(activeTab === 'dinein')}>
                <BriefcaseIcon className="w-5 h-5"/> <span>Dine-in</span>
            </button>
            <button onClick={() => setActiveTab('selforder')} className={tabButtonStyle(activeTab === 'selforder')}>
                <SparklesIcon className="w-5 h-5"/> 
                <span>Self Order</span>
                {selfOrders.length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">{selfOrders.length}</span>
                )}
            </button>
          </nav>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-grow min-h-0 overflow-y-auto">
            {activeTab === 'pos' && (
                <>
                {selectedBranchId ? (
                    <div className="flex flex-col lg:flex-row">
                        {/* Main Content Panel */}
                        <div className="w-full lg:w-3/5 xl:w-2/3">
                            <div className="p-4">
                                <div className="mb-4 space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <div className="relative flex-grow">
                                        <input ref={searchInputRef} type="text" placeholder="Cari produk atau scan barcode..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchKeyDown} className="w-full p-3 pl-10 border border-slate-300 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                                        <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2"/>
                                        </div>
                                        <button onClick={() => setIsScannerOpen(true)} className="flex-shrink-0 p-3 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" title="Pindai Barcode">
                                            <CameraIcon className="w-5 h-5 text-slate-600"/>
                                        </button>
                                    </div>
                                    <div className="flex items-center space-x-2 overflow-x-auto pb-2 -mb-2">
                                        {productCategories.map((category, index) => {
                                        const currentCat = category === 'Semua' ? null : category;
                                        const isActive = selectedCategory === currentCat;
                                        return (<button key={index} onClick={() => { setSelectedCategory(currentCat); }} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${isActive ? 'bg-[var(--primary-color)] text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>{category}</button>);
                                        })}
                                    </div>
                                </div>
                                
                                {isLoading ? (<div className="flex-grow flex items-center justify-center"><SpinnerIcon className="w-10 h-10 text-sky-500"/></div>) :
                                (
                                  <>
                                    {packagePromos.length > 0 && (
                                      <div className="mb-6">
                                        <div className="flex space-x-3 overflow-x-auto pb-4 -mx-4 px-4">
                                            {packagePromos.map(promo => {
                                                const originalPrice = (promo.paket_item_ids || []).reduce((sum, itemId) => {
                                                    const isVariant = itemId.includes(':');
                                                    const stockId = isVariant ? itemId.split(':')[0] : itemId;
                                                    const variantId = isVariant ? itemId.split(':')[1] : null;
                                                    const product = stockMap.get(stockId);
                                                    const variant = variantId ? productVariantMap.get(variantId) : null;
                                                    const price = variant ? variant.harga_jual : product?.harga || 0;
                                                    return sum + price;
                                                }, 0);
                                                const discountedPrice = promo.paket_harga_total || 0;
                                                const discountPercentage = originalPrice > 0 ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : 0;
                                                const representativeImage = promo.banner_url || (promo.paket_item_ids && promo.paket_item_ids.length > 0 ? (
                                                    (() => {
                                                        const firstItemId = promo.paket_item_ids![0];
                                                        const isVariant = firstItemId.includes(':');
                                                        const stockId = isVariant ? firstItemId.split(':')[0] : firstItemId;
                                                        const variantId = isVariant ? firstItemId.split(':')[1] : null;
                                                        const product = stockMap.get(stockId);
                                                        const variant = variantId ? productVariantMap.get(variantId) : null;
                                                        return variant?.photo_url || product?.photo_url || 'https://picsum.photos/seed/product/200/200';
                                                    })()
                                                ) : 'https://picsum.photos/seed/product/200/200');

                                                return (
                                                    <div key={promo.id_promo} onClick={() => handleAddPackageToCart(promo)} className="flex-shrink-0 w-40 bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex flex-col cursor-pointer p-2 h-full">
                                                        <div className="relative">
                                                            <img src={representativeImage} alt={promo.nama_promo} className="w-full h-16 object-cover rounded-md mb-2" />
                                                            <div className="absolute top-1 right-1 bg-purple-100 text-purple-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow-sm">
                                                                PAKET
                                                            </div>
                                                            {discountPercentage > 0 && (
                                                                <div className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                                                                    -{discountPercentage}%
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col flex-grow text-center">
                                                            <h3 className="text-xs font-semibold text-slate-700 flex-grow leading-tight line-clamp-2" title={promo.nama_promo}>
                                                                {promo.nama_promo}
                                                            </h3>
                                                            <div className="text-[10px] text-slate-500 mt-1 my-1 min-h-[2.5rem] text-left px-1">
                                                                {(promo.paket_item_ids || []).slice(0, 3).map(itemId => {
                                                                    const isVariant = itemId.includes(':');
                                                                    const stockId = isVariant ? itemId.split(':')[0] : itemId;
                                                                    const variantId = isVariant ? itemId.split(':')[1] : null;
                                                                    const product = stockMap.get(stockId);
                                                                    const variant = variantId ? productVariantMap.get(variantId) : null;
                                                                    const name = variant ? (variant.nama_variant_product || product?.nama_stok) : product?.nama_stok;
                                                                    return <p key={itemId} className="truncate leading-tight">+ {name || itemId}</p>;
                                                                })}
                                                            </div>
                                                            <div className="mt-auto">
                                                                {originalPrice > discountedPrice && (
                                                                    <p className="text-[10px] text-slate-400 line-through">
                                                                        Rp {originalPrice.toLocaleString('id-ID')}
                                                                    </p>
                                                                )}
                                                                <p className="text-xs font-bold text-sky-600 mt-0.5">
                                                                    Rp {discountedPrice.toLocaleString('id-ID')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="col-span-full border-b my-4"></div>
                                      </div>
                                    )}
                                  
                                    {filteredProducts.length === 0 ? (<div className="flex-grow flex flex-col items-center justify-center text-slate-500"><PackageIcon className="w-20 h-20 mb-4 text-slate-400"/><p className="text-lg">Produk tidak ditemukan.</p></div>)
                                    : (<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
                                    {filteredProducts.map(product => (
                                        <button key={product.id_stok} onClick={() => handleProductClick(product)} className="bg-white p-2 rounded-lg shadow hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-sky-500 active:bg-sky-50 flex flex-col items-center text-center h-full">
                                        {product.photo_url ? <img src={product.photo_url} alt={product.nama_stok} className="w-full h-16 object-cover rounded-md mb-2"/> : <div className="w-full h-16 bg-slate-100 rounded-md mb-2 flex items-center justify-center"><CardPlaceholderIcon /></div>}
                                        <h3 className="text-xs font-semibold text-slate-700 flex-grow leading-tight line-clamp-2">{product.nama_stok}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">{unitMap.get(product.unit) || product.unit}</p>
                                        <p className="text-xs font-bold text-sky-600 mt-1">{getVariantsForProduct(product.id_stok).length > 0 ? (product.harga === null || product.harga === 0 ? "Pilih Varian" : `Rp ${product.harga.toLocaleString('id-ID')} / Mulai dari`) : `Rp ${(product.harga || 0).toLocaleString('id-ID')}`}</p>
                                        </button>
                                    ))}
                                    </div>)
                                  }
                                </>
                                )
                            }
                            </div>
                        </div>

                        {/* Cart Panel */}
                        <div className="w-full lg:w-2/5 xl:w-1/3 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col flex-shrink-0">
                            <div className="p-4 border-b border-slate-200">
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-2">
                                        <h2 className="text-lg font-semibold text-slate-800 flex items-center"><UsersIcon className="w-6 h-6 mr-2 text-sky-600"/>Pelanggan</h2>
                                        <button onClick={() => setIsAddCustomerModalOpen(true)} className="flex items-center text-xs bg-sky-50 text-sky-700 font-semibold px-2 py-1 rounded-md hover:bg-sky-100"><PlusCircleIcon className="w-4 h-4 mr-1"/>Baru</button>
                                    </div>
                                    {selectedCustomer ? (
                                        <div className="p-2 bg-sky-50 rounded-lg flex justify-between items-center text-sm">
                                            <div className="flex items-center"><UserCircleIcon className="w-5 h-5 mr-2 text-sky-600"/><span className="font-semibold text-slate-700">{selectedCustomer.nama_pelanggan}</span></div>
                                            <button onClick={() => {setSelectedCustomer(null); setCustomerSearchTerm('')}} className="p-1 text-slate-400 hover:text-red-500"><XCircleIcon className="w-4 h-4"/></button>
                                        </div>
                                    ) : (
                                        <input type="text" placeholder="Cari atau masukkan nama pelanggan..." value={customerSearchTerm} onChange={e => setCustomerSearchTerm(e.target.value)} onBlur={handleCustomerSearchBlur} className="w-full p-2 pl-4 border border-slate-300 rounded-lg text-sm"/>
                                    )}
                                    {filteredCustomers.length > 0 && !selectedCustomer && (<ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">{filteredCustomers.map(customer => (<li key={customer.id_pelanggan} onClick={() => { setSelectedCustomer(customer); setCustomerSearchTerm(customer.nama_pelanggan); }} className="p-2 text-sm hover:bg-sky-50 cursor-pointer"><p className="font-medium">{customer.nama_pelanggan}</p><p className="text-xs text-slate-500">{customer.telepon}</p></li>))}</ul>)}
                                </div>
                            </div>

                            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                                    <ShoppingCartIcon className="w-6 h-6 mr-2 text-sky-600"/>
                                    Keranjang
                                    {selectedTable && (<span className="ml-2 text-sm font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">{selectedTable.nama_meja}</span>)}
                                </h2>
                                <div className="flex items-center space-x-4">
                                    {selectedTable ? (
                                        <div className="flex space-x-2">
                                            <button onClick={handleLepasMeja} disabled={!selectedTable} className="text-xs text-slate-500 hover:text-red-700 font-medium flex items-center disabled:opacity-50" title="Lepas Meja"><XCircleIcon className="w-3.5 h-3.5 mr-1"/>Lepas Meja</button>
                                            <button onClick={handleKosongkan} disabled={cartItems.length === 0} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center disabled:opacity-50" title="Kosongkan Keranjang"><TrashIcon className="w-3.5 h-3.5 mr-1"/>Kosongkan</button>
                                        </div>
                                    ) : (
                                        <>
                                            {onHoldOrders.length > 0 && (<button onClick={() => setShowRecallModal(true)} className="relative text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold mr-1.5">{onHoldOrders.length}</span>Buka Pesanan</button>)}
                                            {cartItems.length > 0 && (<button onClick={() => setShowConfirmClearCart(true)} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center"><TrashIcon className="w-3.5 h-3.5 mr-1"/>Kosongkan</button>)}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex-grow p-4 space-y-3 overflow-y-auto">
                            {cartItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <ShoppingCartIcon className="w-16 h-16 mb-3"/>
                                <p className="text-sm">{selectedTable ? 'Pilih item untuk meja ini.' : 'Keranjang masih kosong.'}</p>
                                </div>
                            ) : (
                                cartItems.map(item => (
                                <div key={item.id_transaction_item} className="flex items-start p-3 bg-slate-50 rounded-lg shadow-sm space-x-3">
                                    <div className="relative flex-shrink-0">
                                        <button 
                                            onClick={() => removeFromCart(item.id_transaction_item)} 
                                            className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1" 
                                            aria-label="Hapus item">
                                            <XMarkIcon className="w-3.5 h-3.5"/>
                                        </button>
                                        {item.photo_url 
                                            ? <img src={item.photo_url} alt={item.nama_stok} className="w-16 h-16 object-cover rounded-md"/> 
                                            : <div className="w-16 h-16 bg-slate-200 rounded-md flex items-center justify-center"><PackageIcon className="w-8 h-8 text-slate-400"/></div>
                                        }
                                    </div>

                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-semibold text-slate-700 line-clamp-2 leading-tight pr-4" title={`${item.nama_stok}${item.nama_varian_produk ? ` - ${item.nama_varian_produk}` : ''}`}>
                                            {item.nama_stok}{item.nama_varian_produk && <span className="font-normal"> - {item.nama_varian_produk}</span>}
                                            {appliedPackagePromo && <span title={`Bagian dari: ${appliedPackagePromo.nama_promo}`}><TagIcon className="w-3 h-3 text-sky-600 inline-block ml-1.5" /></span>}
                                        </p>
                                        
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center">
                                                <div className="flex items-center">
                                                    <button onClick={() => updateQuantity(item.id_transaction_item, item.quantity - 1)} className="p-1 text-slate-500 hover:text-sky-600 disabled:text-slate-300" disabled={item.quantity <= 1} aria-label="Kurangi kuantitas"><MinusCircleIcon className="w-5 h-5"/></button>
                                                    <span className="mx-1 text-sm font-semibold w-8 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id_transaction_item, item.quantity + 1)} className="p-1 text-slate-500 hover:text-sky-600" aria-label="Tambah kuantitas"><PlusCircleIcon className="w-5 h-5"/></button>
                                                </div>
                                                <div className="text-xs text-slate-500 whitespace-nowrap ml-4">
                                                    @ {item.harga_satuan.toLocaleString('id-ID')} / {item.unit_nama}
                                                </div>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800 flex-shrink-0">
                                                Rp {item.total_harga_item.toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                        
                                        <div className="min-w-0 mt-2">
                                            {item.catatan_item ? (
                                                <div onClick={() => handleOpenNoteModal(item)} className="text-xs text-sky-700 bg-sky-100 p-1.5 rounded-md cursor-pointer hover:bg-sky-200 border border-sky-200 truncate" title={item.catatan_item}>
                                                    <span className="font-semibold">Catatan:</span> {item.catatan_item}
                                                </div>
                                            ) : (
                                                <button onClick={() => handleOpenNoteModal(item)} className="text-xs text-slate-500 hover:text-sky-600 flex items-center p-1 rounded-md hover:bg-slate-100 transition-colors w-full text-left">
                                                    <AnnotationIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0"/> <span className="truncate">Tambah Catatan</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                ))
                            )}
                            </div>

                            {cartItems.length > 0 && (
                            <div className="mt-auto flex-shrink-0 p-4 border-t border-slate-200 bg-white">
                                {checkoutError && <div className="mb-3 p-3 bg-red-100 text-red-700 text-sm rounded-md">{checkoutError}</div>}
                                
                                <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center"><span className="text-sm text-slate-600">Subtotal:</span><span className="text-sm font-medium text-slate-700">Rp {subtotal.toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setShowDiscountModal(true)} disabled={cartItems.length === 0 || !!appliedVoucher || !!appliedPackagePromo} className="text-sm text-slate-600 font-medium hover:text-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label={manualAppliedDiscount ? "Ubah Diskon" : "Tambah Diskon Manual"}>Diskon:</button>
                                        {appliedPromoName && (<span className={`text-xs font-semibold px-2 py-0.5 rounded-md flex items-center ${appliedPackagePromo ? 'bg-purple-50 text-purple-600' : (appliedVoucher ? 'bg-indigo-50 text-indigo-600' : (autoAppliedPromo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'))}`}>{appliedPackagePromo ? <SparklesIcon className="w-4 h-4 mr-1.5"/> : (appliedVoucher ? <TagIcon className="w-4 h-4 mr-1.5"/> : (autoAppliedPromo && <SparklesIcon className="w-4 h-4 mr-1.5"/>))}{appliedPromoName}</span>)}
                                        {manualAppliedDiscount && (<button onClick={handleRemoveManualDiscount} className="p-1 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors" title="Hapus Diskon Manual"><XCircleIcon className="w-4 h-4"/></button>)}
                                    </div>
                                    <span className={`text-sm font-medium ${discountAmount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{discountAmount > 0 ? formattedDiscount : '-'}</span>
                                </div>
                                
                                {/* VOUCHER SECTION */}
                                <div className="pt-2 border-t mt-2">
                                {appliedVoucher ? (
                                    <div className="bg-indigo-50 p-3 rounded-lg flex justify-between items-center">
                                        <span className="font-semibold text-indigo-800">{appliedVoucher.promo.kode_voucher}</span>
                                        <button onClick={handleRemoveVoucher} className="text-sm font-medium text-red-600 hover:text-red-800">Hapus</button>
                                    </div>
                                ) : (
                                    <>
                                    <div className="flex space-x-2">
                                        <input
                                        type="text"
                                        value={voucherCodeInput}
                                        onChange={e => setVoucherCodeInput(e.target.value)}
                                        placeholder="Kode Voucher"
                                        className="form-input flex-grow text-xs"
                                        disabled={!!manualAppliedDiscount || !!appliedPackagePromo}
                                        />
                                        <button
                                        type="button"
                                        onClick={handleApplyVoucher}
                                        className="px-3 py-1 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
                                        disabled={!voucherCodeInput.trim() || !!manualAppliedDiscount || !!appliedPackagePromo}
                                        >
                                        Terapkan
                                        </button>
                                    </div>
                                    {voucherError && <p className="text-xs text-red-500 mt-1">{voucherError}</p>}
                                    </>
                                )}
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t mt-2"><span className="text-lg font-bold text-slate-800">Total:</span><span className="text-lg font-bold text-slate-800">Rp {finalTotal.toLocaleString('id-ID')}</span></div>
                                </div>
                                {selectedTable ? (
                                    <div className="flex space-x-3">
                                        <button onClick={handleSaveToTable} disabled={isProcessing || cartItems.length === 0} className="flex-grow py-3 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 font-semibold text-white transition-colors shadow-lg flex items-center justify-center disabled:opacity-70">Simpan ke Meja</button>
                                        <button onClick={handleCashCheckout} disabled={isProcessing || cartItems.length === 0} className="flex-grow py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-semibold text-white transition-colors shadow-lg flex items-center justify-center disabled:opacity-70">
                                            <CurrencyDollarIcon className="w-6 h-6 mr-2"/>Tunai
                                        </button>
                                        <button onClick={() => handleCheckout('dinein')} disabled={isProcessing || cartItems.length === 0} className="h-12 w-12 flex-shrink-0 p-3 rounded-lg bg-slate-600 hover:bg-slate-700 font-semibold text-white transition-colors shadow-lg flex items-center justify-center disabled:opacity-70" title="Pembayaran Lainnya">
                                            {isProcessing ? <SpinnerIcon className="w-6 h-6"/> : <BriefcaseIcon className="w-6 h-6"/>}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex space-x-3">
                                        <button onClick={handleHoldTakeawayCart} disabled={isProcessing || cartItems.length === 0} className="py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 font-semibold text-white transition-colors shadow-lg flex items-center justify-center disabled:opacity-70">Simpan</button>
                                        <button onClick={handleCashCheckout} disabled={isProcessing || cartItems.length === 0} className="flex-grow py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-semibold text-white transition-colors shadow-lg flex items-center justify-center disabled:opacity-70">
                                            <CurrencyDollarIcon className="w-6 h-6 mr-2"/>Tunai
                                        </button>
                                        <button onClick={() => handleCheckout('pos')} disabled={isProcessing || cartItems.length === 0} className="h-12 w-12 flex-shrink-0 p-3 rounded-lg bg-slate-600 hover:bg-slate-700 font-semibold text-white transition-colors shadow-lg flex items-center justify-center disabled:opacity-70" title="Pembayaran Lainnya">
                                            {isProcessing ? <SpinnerIcon className="w-6 h-6"/> : <BriefcaseIcon className="w-6 h-6"/>}
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 bg-white rounded-xl shadow-xl text-center">
                        <InformationCircleIcon className="w-16 h-16 text-sky-500 mb-4" />
                        <h2 className="text-2xl font-semibold text-slate-700 mb-2">POS Tidak Aktif</h2>
                        <p className="text-slate-500">Silakan pilih cabang terlebih dahulu pada menu dropdown di header untuk mengaktifkan POS.</p>
                    </div>
                )}
                </>
            )}

            {activeTab === 'dinein' && (
                <div className="flex flex-col h-full">
                    <div className="flex-shrink-0 sticky top-0 bg-slate-50 z-[5] p-4">
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center"><BriefcaseIcon className="w-6 h-6 mr-2 text-sky-600"/>Denah Meja</h2>
                        <div className="flex items-center gap-2">
                        <button onClick={() => { setIsMergeMode(prev => !prev); setSourceTableIds([]); setDestinationTableId(null); }} className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center ${isMergeMode ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-white hover:bg-slate-50 border'}`}>
                            {isMergeMode ? 'Batal Gabung' : 'Gabung/Pindah Meja'}
                        </button>
                        <button onClick={() => setIsReservationMode(prev => !prev)} className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center ${isReservationMode ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-white hover:bg-slate-50 border'}`}>
                            <CalendarDaysIcon className="w-5 h-5 mr-2"/> {isReservationMode ? 'Batal Reservasi' : 'Buat Reservasi'}
                        </button>
                        </div>
                        </div>
                        <div className="mb-4">
                        <div className="flex items-center space-x-2 overflow-x-auto pb-2 -mb-2 border-b">
                            {tableLocations.map(location => {
                                const isActive = activeLocationFilter === location;
                                return (<button key={location} onClick={() => setActiveLocationFilter(location)} className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors whitespace-nowrap border-b-2 ${isActive ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{location}</button>);
                            })}
                        </div>
                        </div>
                    </div>
                    <div className="flex-grow min-h-0 overflow-y-auto p-4">
                        {isLoading ? (<div className="flex-grow flex items-center justify-center"><SpinnerIcon className="w-10 h-10 text-sky-500"/></div>)
                        : tables.length === 0 ? (<div className="flex-grow flex flex-col items-center justify-center text-slate-500"><BriefcaseIcon className="w-20 h-20 mb-4 text-slate-400"/><p className="text-lg">Tidak ada meja yang terdaftar untuk cabang ini.</p><p className="text-sm">Konfigurasi meja di menu Setting Penjualan.</p></div>)
                        : (<div className="flex flex-wrap gap-3">
                        {filteredTables.map(table => {
                            const { color, bgColor, text } = getStatusInfo(table);
                            const isSource = isMergeMode && sourceTableIds.includes(table.id_meja);
                            const isPotentialDestination = isMergeMode && sourceTableIds.length > 0 && table.status === 'Tersedia';
                            const isUnselectableInMerge = isMergeMode && !['Tersedia', 'Terisi'].includes(table.status);
                            const isClickableInReserveMode = isReservationMode && table.status === 'Tersedia';
                            const isNotClickableInReserveMode = isReservationMode && table.status !== 'Tersedia';
                            const activeOrder = dineInOrders[table.id_meja];
                            const customerNameOnCard = table.nama_pelanggan_reservasi || activeOrder?.temporaryCustomerName;
                            const guestCountOnCard = table.jumlah_tamu_reservasi || activeOrder?.guestCount;

                            return (
                            <button 
                                key={table.id_meja} 
                                onClick={() => handleTableClick(table)} 
                                disabled={isNotClickableInReserveMode || isUnselectableInMerge}
                                className={`p-3 rounded-lg flex flex-col transition-all duration-150 shadow hover:shadow-md active:scale-95 border-2 text-left min-h-[140px] flex-shrink-0
                                ${isSource ? 'ring-4 ring-offset-2 ring-blue-500' : ''}
                                ${isPotentialDestination ? 'ring-4 ring-offset-2 ring-green-500 animate-pulse' : ''}
                                ${isClickableInReserveMode ? 'border-sky-500 border-dashed animate-pulse' : 'border-transparent'}
                                ${(isNotClickableInReserveMode || isUnselectableInMerge) ? 'opacity-40 cursor-not-allowed' : ''}
                                ${table.status === 'Tersedia' ? 'bg-white' : 'bg-slate-50'}
                                `}
                            >
                                <div className="flex items-center w-full mb-1.5">
                                    <BriefcaseIcon className={`w-5 h-5 mr-2 flex-shrink-0 ${table.status === 'Tersedia' ? 'text-slate-500' : color}`} />
                                    <p className="font-bold text-base text-slate-800 whitespace-nowrap">
                                        {table.nama_meja}
                                        <span className="mx-2 text-slate-400 font-light">|</span>
                                        <span className="text-sm text-slate-600 font-normal">{table.kapasitas} kursi</span>
                                    </p>
                                </div>

                                <div className="flex-grow w-full text-xs space-y-1 py-1 min-h-[40px]">
                                    {customerNameOnCard && ( <span className="text-slate-700 font-semibold block truncate">{customerNameOnCard}</span> )}
                                    {guestCountOnCard && ( <span className="text-slate-500 block">{guestCountOnCard} orang</span> )}
                                    {table.status === 'Dipesan' && table.telepon_pelanggan_reservasi && (
                                        <span className="text-slate-500 block mt-1">
                                            {table.telepon_pelanggan_reservasi}
                                        </span>
                                    )}
                                </div>

                                <div className={`w-full mt-auto text-sm font-semibold px-2 py-1 rounded-md ${bgColor} ${color} flex items-center justify-between`}>
                                    <span>{text}</span>
                                    {table.status === 'Terisi' && calculateDuration(table)}
                                </div>
                            </button>
                            )
                        })}
                        </div>)
                        }
                    </div>
                </div>
            )}

            {activeTab === 'selforder' && (
              <SelfOrderContent tables={tables} selfOrders={selfOrders} pageData={pageData} />
            )}
        </div>

        {/* --- MODALS --- */}
        {showVariantModal && (
            <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => { setShowVariantModal(null); setCurrentSelectionPath([]); }}>
                <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col animate-slide-up">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <h2 className="text-2xl font-bold text-slate-800">{showVariantModal.nama_stok}</h2>
                        {currentSelectionPath.length > 0 && (
                            <button onClick={handleBackInModal} className="text-sm font-medium text-sky-600 hover:underline">
                                &larr; Kembali
                            </button>
                        )}
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                        <h3 className="font-semibold text-slate-600 mb-2">{currentLevelTitle}</h3>
                        {currentLevelOptions.map(option => (
                            <button 
                                key={option.id}
                                onClick={() => handleVariantOptionSelect(option)}
                                className="w-full flex justify-between items-center p-4 rounded-lg border border-slate-200 hover:bg-sky-50 hover:border-sky-300 transition-colors"
                            >
                                <span className="font-semibold text-slate-700">{option.name}</span>
                                {option.isFinalChoice ? (
                                    <span className="text-sm font-bold text-sky-600">Rp {option.price?.toLocaleString('id-ID')}</span>
                                ) : (
                                    <ChevronRightIcon className="w-5 h-5 text-slate-400"/>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {isScannerOpen && <BarcodeScannerModal onClose={() => setIsScannerOpen(false)} onScan={(barcode) => { handleBarcodeScan(barcode); setIsScannerOpen(false); }} />}

        {successfulTransaction && pageData && (
            <ReceiptModal
                transaction={successfulTransaction}
                onNewTransaction={handleNewTransaction}
                branch={selectedBranch}
                logo={logo}
                customerName={selectedCustomer?.nama_pelanggan || successfulTransaction.catatan}
                stockMap={stockMap}
                productVariantMap={productVariantMap}
                activePromos={activePromos}
            />
        )}

        {showConfirmClearCart && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-2">Konfirmasi</h3>
                <p className="text-sm text-slate-600 mb-4">Anda yakin ingin mengosongkan keranjang?</p>
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setShowConfirmClearCart(false)} className="px-4 py-2 border rounded-md text-sm">Batal</button>
                    <button onClick={confirmClearCart} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm">Ya, Kosongkan</button>
                </div>
            </div>
        </div>
        )}
        {showHoldModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <form onSubmit={confirmHoldTakeawayCart} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-2">Simpan Pesanan</h3>
                <p className="text-sm text-slate-600 mb-4">Beri nama untuk pesanan yang disimpan ini.</p>
                <input type="text" value={holdOrderName} onChange={e => setHoldOrderName(e.target.value)} placeholder="Contoh: Pesanan Gojek Budi" required className="form-input w-full text-sm"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button type="button" onClick={() => setShowHoldModal(false)} className="px-4 py-2 border rounded-md text-sm">Batal</button>
                    <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm">Simpan</button>
                </div>
            </form>
        </div>
        )}
        {showRecallModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
                <h3 className="text-lg font-semibold mb-4">Buka Pesanan Tersimpan</h3>
                <div className="flex-grow overflow-y-auto -mx-6 px-6">
                    <div className="space-y-2">
                    {onHoldOrders.map(order => (
                        <div key={order.name} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{order.name}</p>
                                <p className="text-xs text-slate-500">{order.items.length} item &bull; Disimpan pada {new Date(order.heldAt).toLocaleTimeString()}</p>
                            </div>
                            <div className="space-x-2">
                                 <button onClick={() => handleDeleteHeldOrder(order.name)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleRecallTakeawayOrder(order)} className="px-3 py-1 bg-sky-600 text-white text-xs font-semibold rounded-md">Buka</button>
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
                <button onClick={() => setShowRecallModal(false)} className="mt-4 w-full py-2 border rounded-md text-sm">Tutup</button>
            </div>
        </div>
        )}
        {assignModalState.isOpen && assignModalState.table && (
            <AssignServerModal 
                table={assignModalState.table}
                servers={servers}
                allCustomers={customers}
                onClose={() => setAssignModalState({ isOpen: false, table: null })}
                onConfirm={handleStartOrder}
            />
        )}
        {reservationModalState.isOpen && reservationModalState.table && (
            <ReservationModal
                table={reservationModalState.table}
                allCustomers={customers}
                onClose={() => setReservationModalState({ isOpen: false, table: null })}
                onConfirm={handleSaveReservation}
            />
        )}
        {cleanTableConfirmState.isOpen && cleanTableConfirmState.table && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                    <h3 className="text-lg font-semibold mb-2">Konfirmasi Meja Bersih</h3>
                    <p className="text-sm text-slate-600 mb-4">Apakah meja "{cleanTableConfirmState.table.nama_meja}" sudah bersih dan siap untuk pelanggan berikutnya?</p>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setCleanTableConfirmState({isOpen: false, table: null})} className="px-4 py-2 border rounded-md text-sm">Batal</button>
                        <button onClick={() => handleMarkTableAsAvailable(cleanTableConfirmState.table!.id_meja)} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm">Ya, Sudah Bersih</button>
                    </div>
                </div>
            </div>
        )}
        {mergeConfirmState.isOpen && mergeConfirmState.destination && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-2">Konfirmasi Gabung/Pindah Meja</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        Pindahkan pesanan dari meja: <span className="font-semibold">{mergeConfirmState.sources.map(s => s.nama_meja).join(', ')}</span> ke meja <span className="font-semibold">{mergeConfirmState.destination.nama_meja}</span>?
                    </p>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setMergeConfirmState({isOpen: false, sources: [], destination: null})} className="px-4 py-2 border rounded-md text-sm">Batal</button>
                        <button onClick={handleConfirmMerge} className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm">Ya, Pindahkan</button>
                    </div>
                </div>
            </div>
        )}
        {isCheckoutModalOpen && pageData && (
            <CheckoutModal 
                isOpen={isCheckoutModalOpen}
                onClose={() => setIsCheckoutModalOpen(false)}
                checkoutState={checkoutState}
                setCheckoutState={setCheckoutState}
                onFinalize={handleFinalizeTransaction}
                isProcessing={isProcessing}
                error={checkoutError}
                handleSplitEven={handleSplitEven}
                handleStartSplitByItem={handleStartSplitByItem}
                handleFinishSplitByItem={handleFinishSplitByItem}
                handleMoveItemToBill={handleMoveItemToBill}
                handleMoveItemFromBill={handleMoveItemFromBill}
                handleAddNewBill={handleAddNewBill}
                handleAddPayment={handleAddPayment}
                handleCancelSplitByItem={handleCancelSplitByItem}
                paymentMethods={pageData.paymentMethods}
                subtotal={subtotal}
                discountAmount={discountAmount}
                appliedPromoName={appliedPromoName}
            />
        )}
        {isAddCustomerModalOpen && selectedBranch && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                    <h3 className="text-lg font-semibold mb-4">Tambah Pelanggan Baru</h3>
                    <form onSubmit={handleAddNewCustomer} className="space-y-4">
                        <input type="text" placeholder="Nama Pelanggan*" value={newCustomerData.nama_pelanggan} onChange={e => setNewCustomerData({...newCustomerData, nama_pelanggan: e.target.value})} required className="form-input w-full text-sm"/>
                        <input type="tel" placeholder="Telepon" value={newCustomerData.telepon} onChange={e => setNewCustomerData({...newCustomerData, telepon: e.target.value})} className="form-input w-full text-sm"/>
                        <input type="email" placeholder="Email" value={newCustomerData.email} onChange={e => setNewCustomerData({...newCustomerData, email: e.target.value})} className="form-input w-full text-sm"/>
                        <textarea placeholder="Alamat" value={newCustomerData.alamat} onChange={e => setNewCustomerData({...newCustomerData, alamat: e.target.value})} className="form-textarea w-full text-sm" rows={2}/>
                        <div className="flex justify-end space-x-2 mt-4">
                            <button type="button" onClick={() => setIsAddCustomerModalOpen(false)} className="px-4 py-2 border rounded-md text-sm">Batal</button>
                            <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm">
                                {isProcessing ? <SpinnerIcon className="w-5 h-5"/> : 'Simpan'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        {editingNote && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                    <h3 className="text-lg font-semibold mb-2">Tambah/Edit Catatan</h3>
                    <textarea
                        value={editingNote.currentNote}
                        onChange={e => setEditingNote({ ...editingNote, currentNote: e.target.value })}
                        className="form-textarea w-full text-sm"
                        rows={4}
                        autoFocus
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                        <button onClick={() => setEditingNote(null)} className="px-4 py-2 border rounded-md text-sm">Batal</button>
                        <button onClick={handleSaveNote} className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm">Simpan</button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default POSPage;
