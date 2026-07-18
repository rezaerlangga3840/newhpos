
// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk melihat, menambah, dan mengedit data transaksi penjualan secara manual.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, TransactionItem, Branch, Stok, ProductVariant as ProductVariantType, Unit, User as UserType, Karyawan, BOMEntry, Customer, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/penjualan/transaksi';

// Helper functions for date and time formatting
const formatISODatetimeToDisplay = (isoString?: string): string => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - userTimezoneOffset);
    const displayDate = localDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const displayTime = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\./g, ':');
    return `${displayDate} ${displayTime}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
};

const formatISOToDatetimeLocalInput = (isoString?: string): string => {
  const date = isoString ? new Date(isoString) : new Date();
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - userTimezoneOffset);
  return localDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
};

interface FormTransactionItem extends TransactionItem {
    error?: string;
}

const createNewTransactionItem = (): FormTransactionItem => ({
    id_transaction_item: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    id_stok: '',
    id_variant_product: null,
    quantity: 1,
    harga_satuan: 0,
    total_harga_item: 0,
    error: undefined,
});

const defaultTransactionData: Omit<Transaction, 'id_transaksi' | 'id_user' | 'items'> & { items: FormTransactionItem[] } = {
  id_reff: null,
  id_cabang: '',
  id_grup: '',
  datetime: new Date().toISOString(),
  id_pelanggan: null,
  asal_data: 'Form Transaksi',
  items: [createNewTransactionItem()],
  total_keseluruhan: 0,
  metode_pembayaran: 'Tunai',
  catatan: '',
  status_pembayaran: 'lunas',
  tanggal_jatuh_tempo: null,
};

const TransaksiPage: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [pageData, setPageData] = useState({
        branches: [] as Branch[],
        users: [] as UserType[],
        karyawan: [] as Karyawan[],
        stocks: [] as Stok[],
        productVariants: [] as ProductVariantType[],
        boms: [] as BOMEntry[],
        customers: [] as Customer[],
        grups: [] as Grup[],
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { selectedBranchId: globalSelectedBranchId, selectedGroupId: globalSelectedGroupId, userRoleType, selectableBranches } = useBranch();
    const { currentUser: authUser } = useAuth();
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
    const [formData, setFormData] = useState<Omit<Transaction, 'id_transaksi' | 'id_user' | 'items'> & { items: FormTransactionItem[] }>(deepClone(defaultTransactionData));
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getTransaksiPageData();
            setTransactions(data.transactions);
            setPageData({
                branches: data.branches,
                users: data.users,
                karyawan: data.karyawan,
                stocks: data.stocks,
                productVariants: data.productVariants,
                boms: data.boms,
                customers: data.customers,
                grups: data.grups,
            });
        } catch (error) {
            console.error("Failed to load transaction page data:", error);
            alert("Gagal memuat data transaksi.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAccessDataLoaded) {
            fetchData();
        }
    }, [isAccessDataLoaded, fetchData]);

    const userDisplayMap = useMemo(() => {
        const map = new Map<string, string>();
        pageData.users.forEach(user => {
            if (user.id_karyawan) {
                const karyawan = pageData.karyawan.find(k => k.id_karyawan === user.id_karyawan);
                map.set(user.id_user, karyawan ? karyawan.nama_lengkap : user.username);
            } else {
                map.set(user.id_user, user.username);
            }
        });
        return map;
    }, [pageData.users, pageData.karyawan]);

    const branchMap = useMemo(() => pageData.branches.reduce((map, b) => { map[b.id_cabang] = b.Nama; return map; }, {} as Record<string, string>), [pageData.branches]);
    const grupMap = useMemo(() => pageData.grups.reduce((map, g) => { map[g.id_grup] = g.nama_grup; return map; }, {} as Record<string, string>), [pageData.grups]);
    const customerMap = useMemo(() => pageData.customers.reduce((map, c) => { map[c.id_pelanggan] = c.nama_pelanggan; return map; }, {} as Record<string, string>), [pageData.customers]);

    const displayedTransactions = useMemo(() => {
        let list = [...transactions];
        if (globalSelectedBranchId) {
            list = list.filter(t => t.id_cabang === globalSelectedBranchId);
        } else if (globalSelectedGroupId) {
            list = list.filter(t => t.id_grup === globalSelectedGroupId);
        }
        return list.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    }, [transactions, globalSelectedBranchId, globalSelectedGroupId]);

    const itemSelectionGroups = useMemo(() => {
        if (!formData.id_cabang) return [];
        const allItemsInBranch = pageData.stocks.filter(s => s.id_cabang === formData.id_cabang && s.type === 'product');
        const allProductVariants = pageData.productVariants.filter(pv => pv.id_cabang === formData.id_cabang);
        const groups: { label: string; options: { value: string; label: string; }[] }[] = [];
        const singleProducts = allItemsInBranch.filter(p => !allProductVariants.some(v => v.id_stok_product === p.id_stok));
        if (singleProducts.length > 0) {
            groups.push({ label: 'Produk Tunggal', options: singleProducts.map(p => ({ value: p.id_stok, label: `${p.nama_stok} (${p.id_stok})` })) });
        }
        const productsWithVariants = allItemsInBranch.filter(p => allProductVariants.some(v => v.id_stok_product === p.id_stok));
        productsWithVariants.forEach(parent => {
            const variants = allProductVariants.filter(v => v.id_stok_product === parent.id_stok);
            if (variants.length > 0) {
                 groups.push({ label: `${parent.nama_stok} (${parent.id_stok})`, options: variants.map(v => ({ value: `${v.id_stok_product}:${v.id_variant_product}`, label: `${v.nama_variant_product || v.id_variant_product} (${v.id_variant_product})` })) });
            }
        });
        return groups;
    }, [formData.id_cabang, pageData.stocks, pageData.productVariants]);
    
    useEffect(() => {
        const newTotal = formData.items.reduce((sum, item) => sum + item.total_harga_item, 0);
        if(newTotal !== formData.total_keseluruhan) {
          setFormData(prev => ({...prev, total_keseluruhan: newTotal}));
        }
    }, [formData.items, formData.total_keseluruhan]);

    const handleOpenModal = useCallback((mode: 'add' | 'edit', trx?: Transaction) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
        setModalMode(mode);
        if (mode === 'edit' && trx) {
            setCurrentTransaction(trx);
            const itemsWithState = trx.items.map(item => ({...item, error: undefined}));
            setFormData(deepClone({...trx, items: itemsWithState}));
        } else {
            setCurrentTransaction(null);
            const initialBranch = globalSelectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : '');
            const selectedBranch = pageData.branches.find(b => b.id_cabang === initialBranch);
            setFormData({ ...deepClone(defaultTransactionData), id_cabang: initialBranch, id_grup: selectedBranch?.id_grup || '' });
        }
        setIsModalOpen(true);
    }, [canInsert, canUpdate, globalSelectedBranchId, defaultTransactionData, selectableBranches, pageData.branches]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setCurrentTransaction(null);
        setFormData(deepClone(defaultTransactionData));
    }, [defaultTransactionData]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const newFormData = {...formData, [name]: value === '' ? null : value};
        if(name === 'id_cabang'){
            newFormData.items = [createNewTransactionItem()];
            const selectedBranch = pageData.branches.find(b => b.id_cabang === value);
            newFormData.id_grup = selectedBranch ? selectedBranch.id_grup : '';
        }
        setFormData(newFormData);
    };

    const handleCombinedItemChange = (index: number, value: string) => {
        const newItems = deepClone(formData.items);
        const item = newItems[index];
        let newStokId = ''; let newVariantId: string | null = null; let harga = 0;
        let error: string | undefined = undefined;

        if (!value) {
            newStokId = ''; newVariantId = null; harga = 0;
        } else if (value.includes(':')) {
            const [stokId, variantId] = value.split(':');
            newStokId = stokId; newVariantId = variantId;
            const productVariant = pageData.productVariants.find(v => v.id_cabang === formData.id_cabang && v.id_stok_product === stokId && v.id_variant_product === variantId);
            harga = productVariant?.harga_jual || 0;

            const bomExists = pageData.boms.some(b => 
                b.id_cabang === formData.id_cabang &&
                b.id_stok_product === stokId &&
                b.id_variant_product === variantId
            );
            if (!bomExists) {
                error = `Konfigurasi BOM untuk varian produk "${stokId}:${variantId}" tidak ditemukan.`;
            }
        } else {
            newStokId = value; newVariantId = null;
            const product = pageData.stocks.find(p => p.id_cabang === formData.id_cabang && p.id_stok === newStokId);
            harga = product?.harga || 0;
        }
        item.id_stok = newStokId;
        item.id_variant_product = newVariantId;
        item.harga_satuan = harga;
        item.total_harga_item = item.quantity * item.harga_satuan;
        item.error = error;
        setFormData(prev => ({ ...prev, items: newItems }));
    };
    
    const handleItemChange = (index: number, field: keyof Pick<TransactionItem, 'quantity' | 'harga_satuan'>, value: any) => {
        const newItems = deepClone(formData.items);
        const item = newItems[index];
        (item as any)[field] = Number(value) >= 0 ? Number(value) : 0;
        item.total_harga_item = item.quantity * item.harga_satuan;
        setFormData(prev => ({ ...prev, items: newItems }));
    };
    
    const handleAddItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, createNewTransactionItem()] }));
    const handleRemoveItem = (index: number) => { if (formData.items.length <= 1) return; setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) })); };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!authUser) return;

        if (formData.items.some(item => !!item.error)) {
            alert('Harap perbaiki semua kesalahan pada item transaksi sebelum menyimpan.');
            return;
        }

        if (formData.items.some(item => !item.id_stok || item.quantity <= 0)) {
            alert('Setiap item harus memiliki produk terpilih dan kuantitas lebih dari 0.');
            return;
        }
        
        setIsSubmitting(true);
        const transactionToSave: Omit<Transaction, 'id_transaksi'> = {
            ...formData,
            id_user: authUser.id_user,
        };
        
        try {
            let response;
            if (modalMode === 'add') {
                response = await api.createPosTransaction(transactionToSave);
            } else if (currentTransaction) {
                response = await api.updateTransaction(currentTransaction.id_transaksi, transactionToSave);
            }

            if (response && response.success) {
                await fetchData();
                handleCloseModal();
            } else {
                throw new Error(response?.message || 'Gagal menyimpan transaksi.');
            }
        } catch (error) {
            console.error("Gagal menyimpan transaksi:", error);
            alert(`Terjadi kesalahan: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteClick = useCallback((trx: Transaction) => {
        if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
        setTransactionToDelete(trx);
        setIsDeleteConfirmOpen(true);
    }, [canDelete]);

    const confirmDelete = async () => {
        if (transactionToDelete) {
            setIsSubmitting(true);
            try {
                const response = await api.deleteTransaction(transactionToDelete.id_transaksi);
                if (!response.success) throw new Error(response.message);
                await fetchData();
            } catch(error) {
                 console.error("Gagal menghapus transaksi:", error);
                 alert(`Terjadi kesalahan: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsSubmitting(false);
                setIsDeleteConfirmOpen(false);
                setTransactionToDelete(null);
            }
        }
    };

    const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setTransactionToDelete(null); }, []);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (isModalOpen) handleCloseModal(); if (isDeleteConfirmOpen) cancelDelete(); } };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isModalOpen, isDeleteConfirmOpen, handleCloseModal, cancelDelete]);

    const columns = useMemo<ColumnDef<Transaction>[]>(() => [
        { header: 'ID Transaksi', accessor: 'id_transaksi', sortable: true },
        { header: 'ID Reff', accessor: 'id_reff', sortable: true, render: t => t.id_reff || '-' },
        { header: 'Grup', accessor: t => grupMap[t.id_grup] || t.id_grup, sortable: true },
        { header: 'Cabang', accessor: t => branchMap[t.id_cabang] || t.id_cabang, sortable: true },
        { header: 'Pelanggan', accessor: t => customerMap[t.id_pelanggan || ''] || 'Umum', sortable: true },
        { header: 'Tanggal', accessor: 'datetime', sortable: true, render: t => formatISODatetimeToDisplay(t.datetime) },
        { header: 'User', accessor: t => userDisplayMap.get(t.id_user) || t.id_user, sortable: true },
        { header: 'Total', accessor: 'total_keseluruhan', sortable: true, render: t => <div className="text-right">Rp {t.total_keseluruhan.toLocaleString('id-ID')}</div> },
    ], [branchMap, userDisplayMap, customerMap, grupMap]);

    const renderActions = useCallback((trx: Transaction) => (
        <div className="space-x-2">
            <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', trx); }} disabled={!canUpdate(PAGE_PATH)} className="text-sky-600 disabled:opacity-50 p-1">
                <PencilSquareIcon className="w-5 h-5"/>
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(trx); }} disabled={!canDelete(PAGE_PATH)} className="text-red-600 disabled:opacity-50 p-1">
                <TrashIcon className="w-5 h-5"/>
            </button>
        </div>
    ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

    const headerActions = useMemo(() => (
        canInsert(PAGE_PATH) && (
            <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center text-sm">
                <PlusCircleIcon className="w-5 h-5 mr-2" />Tambah Transaksi
            </button>
        )
    ), [canInsert, handleOpenModal]);

    if (isLoading || !isAccessDataLoaded) {
        return <div className="p-6 bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)] flex justify-center items-center">
            <SpinnerIcon className="w-8 h-8 text-sky-500" />
        </div>;
    }

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <TabelFiturStandar data={displayedTransactions} columns={columns} uniqueIdKey="id_transaksi" title="Daftar Transaksi" renderActions={renderActions} headerActions={headerActions}/>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                            <h2 id="modal-title-trx" className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Transaksi Manual' : 'Edit Transaksi'}</h2>
                        <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-5 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group">
                                <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap">ID Transaksi</legend>
                            <input type="text" value={modalMode === 'add' ? '(Akan digenerate)' : currentTransaction?.id_transaksi} readOnly className="block w-full py-2.5 outline-none bg-slate-100 text-sm font-mono"/>
                            </fieldset>
                            </div>
                            <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1 group-focus-within:text-sky-600">ID Referensi (Opsional)</legend>
                            <input type="text" name="id_reff" value={formData.id_reff || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent text-sm" />
                            </fieldset>
                            </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1 group-focus-within:text-sky-600">Cabang*</legend>
                            <select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none">
                                <option value="">Pilih Cabang</option>{selectableBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama} ({b.id_cabang})</option>)}</select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1">
                            <ChevronDownIcon className="h-4 w-4"/>
                            </div>
                            </fieldset>
                            </div>
                            <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1">Pelanggan</legend>
                            <select name="id_pelanggan" value={formData.id_pelanggan || ''} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none">
                                <option value="">-- Pelanggan Umum --</option>{pageData.customers.map(c => <option key={c.id_pelanggan} value={c.id_pelanggan}>{c.nama_pelanggan}</option>)}</select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1">
                            <ChevronDownIcon className="h-4 w-4"/>
                            </div>
                            </fieldset>
                            </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1 group-focus-within:text-sky-600">Tanggal & Waktu*</legend>
                            <input type="datetime-local" name="datetime" value={formatISOToDatetimeLocalInput(formData.datetime)} onChange={e => setFormData({...formData, datetime: new Date(e.target.value).toISOString()})} required className="block w-full py-2.5 outline-none bg-transparent text-sm"/>
                            </fieldset>
                            </div>
                            <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1">Status Pembayaran</legend>
                            <select name="status_pembayaran" value={formData.status_pembayaran} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none">
                                <option value="lunas">Lunas</option>
                            <option value="belum lunas">Belum Lunas</option>
                            <option value="sebagian">Sebagian</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1">
                            <ChevronDownIcon className="h-4 w-4"/>
                            </div>
                            </fieldset>
                            </div>
                            </div>
                            <fieldset className="border border-slate-300 rounded-md p-3">
                                <legend className="text-xs font-medium text-slate-500 px-1">Item Transaksi</legend>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 mb-2 px-2">
                                <div className="col-span-7">Item</div>
                            <div className="col-span-1 text-center">Qty</div>
                            <div className="col-span-2 text-right">Harga Satuan</div>
                            <div className="col-span-2 text-right">Subtotal</div>
                            </div>
                            <div className="space-y-2">{formData.items.map((item, index) => (<div key={item.id_transaction_item}>
                                <div className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-md">
                                    <div className="col-span-7">
                                        <select value={item.id_variant_product ? `${item.id_stok}:${item.id_variant_product}` : item.id_stok} onChange={e => handleCombinedItemChange(index, e.target.value)} required className="form-select w-full text-xs py-1.5">
                                            <option value="">-- Pilih Item --</option>{itemSelectionGroups.map(group => (<optgroup key={group.label} label={group.label}>{group.options.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}</optgroup>))}
                                            </select>
                            </div>
                            <div className="col-span-1">
                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} required className="form-input w-full text-xs py-1.5 text-center" min="1"/>
                            </div>
                            <div className="col-span-2">
                                <input type="number" value={item.harga_satuan} onChange={e => handleItemChange(index, 'harga_satuan', e.target.value)} required className="form-input w-full text-xs py-1.5 text-right" min="0"/>
                            </div>
                            <div className="col-span-2 flex items-center justify-end space-x-1">
                                <span className="text-slate-700 text-right text-xs">Rp {item.total_harga_item.toLocaleString('id-ID')}</span>
                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 p-1 rounded hover:bg-red-100 disabled:opacity-50" disabled={formData.items.length <= 1}>
                            <TrashIcon className="w-4 h-4"/>
                            </button>
                            </div>
                            </div>{item.error && (<div className="px-2 pt-1">
                                <div className="bg-red-100 text-red-700 text-xs rounded-md p-2 border border-red-200">{item.error}</div>
                            </div>)}</div>))}{" "}<button type="button" onClick={handleAddItem} className="mt-3 text-sky-600 flex items-center text-sm font-medium p-1 hover:bg-sky-50 rounded">
                                <PlusCircleIcon className="w-5 h-5 mr-1"/> Tambah Item</button>
                            </fieldset>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1">Metode Pembayaran</legend>
                             <select name="metode_pembayaran" value={formData.metode_pembayaran} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none">
                                <option>Tunai</option>
                             <option>Kartu Debit/Kredit</option>
                             <option>QRIS</option>
                             <option>Lainnya</option>
                             </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1">
                             <ChevronDownIcon className="h-4 w-4"/>
                             </div>
                             </fieldset>
                             </div>
                             <div className="relative md:col-span-1">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                <legend className="text-xs font-medium text-slate-500 px-1">Catatan</legend>
                             <textarea name="catatan" value={formData.catatan || ''} onChange={handleInputChange} rows={1} className="block w-full py-2.5 outline-none bg-transparent resize-none">
                                </textarea>
                             </fieldset>
                             </div>
                             </div>
                            <div className="flex justify-end items-center mt-4">
                                <span className="text-slate-600 font-medium">Total Keseluruhan:</span>
                            <span className="text-2xl font-bold text-slate-800 ml-4">Rp {formData.total_keseluruhan.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="pt-5 mt-auto border-t flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                                <button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border rounded-md">Batal</button>
                            <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Transaksi' : 'Update Transaksi')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isDeleteConfirmOpen && transactionToDelete && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h2>
            <p className="mb-6 text-sm">Yakin ingin menghapus transaksi ID "{transactionToDelete.id_transaksi}"? Stok akan dikembalikan.</p>
            <div className="flex justify-end space-x-2">
                <button onClick={cancelDelete} disabled={isSubmitting} className="px-3 py-2 border rounded-md text-xs">Batal</button>
            <button onClick={confirmDelete} disabled={isSubmitting} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs flex items-center">{isSubmitting && <SpinnerIcon className="w-4 h-4 mr-2"/>}{isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button>
            </div>
            </div>
            </div>)}
        </div>
    );
};

export default TransaksiPage;
