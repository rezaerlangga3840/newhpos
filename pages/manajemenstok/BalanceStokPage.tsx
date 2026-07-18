// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk melihat riwayat pergerakan stok (Balance Stok).
// Fungsinya adalah menampilkan log keluar-masuk stok dengan fitur filter tanggal untuk performa cepat.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BalanceStok, Stok, MaterialVariant, Unit, Branch, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon, DocumentDuplicateIcon, CalendarDaysIcon, MagnifyingGlassIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/stock-management/stock-balance';

// Define extended type to handle joined data from backend
interface EnrichedBalanceStok extends BalanceStok {
    item_name: string;
    unit_name: string;
    user_name: string;
}

const formatISOToDatetimeLocalInput = (isoString?: string): string => {
  const date = isoString ? new Date(isoString) : new Date();
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - userTimezoneOffset);
  return localDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
};

const defaultFormDataTemplate = {
    id_cabang: '',
    type: '' as '' | 'stok masuk' | 'stok keluar',
    item_id: '',
    item_is_variant: false,
    quantity: 0,
    unit_id: '',
    id_transaksi: null,
    tanggal: new Date().toISOString()
};


const BalanceStokPage: React.FC = () => {
    // Main Data
    const [balanceStoks, setBalanceStoks] = useState<EnrichedBalanceStok[]>([]);
    
    // Master Data for Dropdowns (Lazy Loaded)
    const [stocks, setStocks] = useState<Stok[]>([]);
    const [materialVariants, setMaterialVariants] = useState<MaterialVariant[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [grups, setGrups] = useState<Grup[]>([]);
    
    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [isMasterDataLoaded, setIsMasterDataLoaded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Filter States
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); // Default last 30 days
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');

    const { selectedBranchId, selectedGroupId, selectableBranches } = useBranch();
    const { currentUser } = useAuth();
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'duplicate'>('add');
    const [modalTitle, setModalTitle] = useState('Tambah Entri Manual');
    const [currentItem, setCurrentItem] = useState<BalanceStok | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<BalanceStok | null>(null);
    const [formData, setFormData] = useState(defaultFormDataTemplate);
    
    // 1. Fetch Balance Data (Filtered)
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {
                branchId: selectedBranchId,
                groupId: selectedGroupId,
                startDate,
                endDate
            };
            const bsData = await api.getBalanceStoks(params);
            
            // Client-side search (lightweight since list is already filtered by date/branch)
            let filteredData = bsData;
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                filteredData = bsData.filter(item => 
                    item.item_name.toLowerCase().includes(lower) ||
                    item.id_transaksi?.toLowerCase().includes(lower) ||
                    item.type.toLowerCase().includes(lower)
                );
            }
            
            setBalanceStoks(filteredData);
            
            // Only fetch minimal required branches info for mapping table if not loaded
            if (branches.length === 0) {
                 const branchData = await api.getBranches();
                 setBranches(branchData);
                 const grupsData = await api.getGrups();
                 setGrups(grupsData);
            }

        } catch (error) {
            console.error("Gagal memuat data balance stok:", error);
            alert("Gagal memuat data. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId, selectedGroupId, startDate, endDate, searchTerm]); // Removed branches.length from dependency to avoid loop

    useEffect(() => {
        if (isAccessDataLoaded) fetchData();
    }, [isAccessDataLoaded, fetchData]);

    // 2. Lazy Load Master Data (Only when Modal Opens)
    const loadMasterData = async () => {
        if (isMasterDataLoaded) return;
        try {
            const [sData, mvData, uData] = await Promise.all([
                api.getStocks(),
                api.getMaterialVariants(),
                api.getUnits(),
            ]);
            setStocks(sData);
            setMaterialVariants(mvData);
            setUnits(uData);
            setIsMasterDataLoaded(true);
        } catch (e) {
            console.error("Failed to load master data for modal", e);
        }
    };

    const branchesMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, `${b.Nama} (${b.id_cabang})`])), [branches]);
    const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);
    const branchToGrupMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.id_grup])), [branches]);
    const unitMap = useMemo(() => new Map(units.map(u => [u.id_unit, u.nama_unit])), [units]);


    const itemOptionsForModal = useMemo(() => {
        if (!formData.id_cabang || !isMasterDataLoaded) return [];
        
        const stokTunggalGroup = {
          label: 'Stok Tunggal',
          options: stocks
            .filter(s => 
              s.id_cabang === formData.id_cabang && 
              s.type !== 'product' && // Assuming manual balance usually for materials/wip, or non-variant products
              !materialVariants.some(mv => mv.id_stok === s.id_stok && mv.id_cabang === s.id_cabang)
            )
            .map(s => ({
              value: `stok:${s.id_stok}`,
              label: `${s.nama_stok} (${s.id_stok})`
            }))
        };

        const materialGroups = stocks
          .filter(s => s.id_cabang === formData.id_cabang && (s.type === 'material' || s.type === 'wip'))
          .map(parent => {
            const variants = materialVariants.filter(mv => mv.id_stok === parent.id_stok && mv.id_cabang === parent.id_cabang);
            if (variants.length > 0) {
              return {
                label: `${parent.nama_stok} (${parent.id_stok})`,
                options: variants.map(v => ({
                  value: `variant:${v.id_variant_material}`,
                  label: `${v.nama_variant} (${v.id_variant_material})`
                }))
              };
            }
            return null;
          })
          .filter((g): g is { label: string; options: { value: string, label: string }[] } => g !== null);

        return [stokTunggalGroup, ...materialGroups];
    }, [formData.id_cabang, stocks, materialVariants, isMasterDataLoaded]);

    const unitForSelectedItem = useMemo(() => {
        if (!formData.item_id || !isMasterDataLoaded) return '';
        const [type, id] = formData.item_id.split(':');
        
        let unitId = '';
        if (type === 'variant') {
             const v = materialVariants.find(mv => mv.id_variant_material === id);
             if (v) unitId = v.unit;
        } else {
             const s = stocks.find(st => st.id_stok === id);
             if (s) unitId = s.unit;
        }
        return unitId ? (unitMap.get(unitId) || unitId) : '';
    }, [formData.item_id, stocks, materialVariants, unitMap, isMasterDataLoaded]);
    
    const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const [type, id] = value.split(':');
        
        // Find unit ID
        let unitId = '';
        if (type === 'variant') {
            const v = materialVariants.find(mv => mv.id_variant_material === id);
            if (v) unitId = v.unit;
        } else {
            const s = stocks.find(st => st.id_stok === id);
            if (s) unitId = s.unit;
        }

        setFormData(p => ({
            ...p,
            item_id: value,
            item_is_variant: type === 'variant',
            unit_id: unitId,
        }));
    };

    const handleOpenModal = async (mode: 'add' | 'edit' | 'duplicate', item?: EnrichedBalanceStok) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH)) || (mode === 'duplicate' && !canInsert(PAGE_PATH))) {
            alert("Akses ditolak."); return;
        }
        
        await loadMasterData(); // Ensure dropdowns are populated

        setModalMode(mode);
         setModalTitle(
            mode === 'add' ? 'Tambah Entri Manual' :
            mode === 'edit' ? 'Edit Entri Manual' :
            'Duplikat Entri Manual'
        );

        if (mode === 'edit' && item) {
            setCurrentItem(item);
            setFormData({
                id_cabang: item.id_cabang,
                type: item.type as 'stok masuk' | 'stok keluar',
                item_id: `${item.item_is_variant ? 'variant' : 'stok'}:${item.item_id}`,
                item_is_variant: item.item_is_variant,
                quantity: item.quantity,
                unit_id: item.unit_id,
                id_transaksi: null,
                tanggal: item.tanggal,
            });
        } else if (mode === 'duplicate' && item) {
             setCurrentItem(null);
             setModalMode('add');
             setFormData({
                id_cabang: item.id_cabang,
                type: item.type as 'stok masuk' | 'stok keluar',
                item_id: `${item.item_is_variant ? 'variant' : 'stok'}:${item.item_id}`,
                item_is_variant: item.item_is_variant,
                quantity: item.quantity,
                unit_id: item.unit_id,
                id_transaksi: null,
                tanggal: new Date().toISOString(),
            });
        } else {
            setCurrentItem(null);
            const initialBranchId = selectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : '');
            setFormData({ ...defaultFormDataTemplate, id_cabang: initialBranchId, tanggal: new Date().toISOString() });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData(defaultFormDataTemplate);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.item_id || formData.quantity <= 0 || !currentUser || !formData.type) {
            alert('Semua field wajib diisi dan kuantitas harus lebih dari 0.');
            return;
        }
        
        setIsSubmitting(true);
        const [type, id] = formData.item_id.split(':');
        
        const dataToSend = {
            id_cabang: formData.id_cabang,
            type: formData.type,
            item_id: id,
            item_is_variant: type === 'variant',
            quantity: formData.quantity,
            unit_id: formData.unit_id, // Calculated in handleItemChange
            id_user: currentUser.id_user,
            id_transaksi: null,
            tanggal: formData.tanggal,
        };

        try {
            if (modalMode === 'add') {
                await api.createBalanceStok(dataToSend);
            } else if (currentItem) {
                await api.updateBalanceStok(currentItem.id_balance_stok, dataToSend);
            }
            await fetchData();
            handleCloseModal();
        } catch (error) {
            alert(`Gagal menyimpan: ${error instanceof Error ? error.message : "Error tidak diketahui"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await api.deleteBalanceStok(itemToDelete.id_balance_stok);
            await fetchData();
            setIsDeleteConfirmOpen(false);
        } catch (error) {
             alert(`Gagal menghapus: ${error instanceof Error ? error.message : "Error tidak diketahui"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns: ColumnDef<EnrichedBalanceStok>[] = [
        { header: 'ID Log', accessor: 'id_balance_stok', sortable: true },
        { 
            header: 'Grup', 
            accessor: (item) => {
                const grupId = branchToGrupMap.get(item.id_cabang);
                return grupId ? grupMap.get(grupId) || grupId : 'N/A';
            }, 
            sortable: true 
        },
        { header: 'Cabang', accessor: 'id_cabang', sortable: true, render: (item) => branchesMap.get(item.id_cabang) || item.id_cabang },
        { header: 'Tanggal', accessor: 'tanggal', sortable: true, render: (item) => new Date(item.tanggal).toLocaleString('id-ID', { day: '2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) },
        { header: 'Tipe', accessor: 'type', sortable: true, render: (item) => {
            const isMasuk = item.type.includes('masuk') || item.type.includes('nambah');
            return <span className={`capitalize px-2 py-0.5 text-xs rounded-full ${isMasuk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.type}</span>
        }},
        { header: 'Nama Item', accessor: 'item_name', sortable: true },
        { 
            header: 'Qty', 
            accessor: 'quantity', 
            sortable: true, 
            render: (item) => {
                const isMasuk = item.type.includes('masuk') || item.type.includes('nambah');
                const sign = isMasuk ? '+' : '-';
                const colorClass = isMasuk ? 'text-green-600' : 'text-red-600';
                return <div className={`text-right font-semibold ${colorClass}`}>{sign}{item.quantity}</div>
            }
        },
        { header: 'Unit', accessor: 'unit_name', sortable: true },
        { header: 'User', accessor: 'user_name', sortable: true },
        { header: 'Referensi', accessor: 'id_transaksi', sortable: true, render: (item) => item.id_transaksi || '-' },
    ];

    const headerActions = (
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 items-center">
             <div className="flex items-center space-x-2">
                <div className="relative">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input py-1.5 px-3 text-sm border-slate-300 rounded-md shadow-sm"/>
                </div>
                <span className="text-slate-500">-</span>
                <div className="relative">
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input py-1.5 px-3 text-sm border-slate-300 rounded-md shadow-sm"/>
                </div>
            </div>
            
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input 
                    type="text" 
                    placeholder="Cari item..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input pl-9 pr-4 py-1.5 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
                />
            </div>
            
            {canInsert(PAGE_PATH) && (
                <button onClick={() => handleOpenModal('add')} disabled={selectableBranches.length === 0} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center text-sm disabled:opacity-50" title={selectableBranches.length === 0 ? "Tidak ada cabang yang bisa dipilih" : "Tambah Entri Manual"}>
                    <PlusCircleIcon className="w-5 h-5 mr-2"/>Tambah Entri
                </button>
            )}
        </div>
    );

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <TabelFiturStandar
                data={balanceStoks}
                columns={columns}
                uniqueIdKey="id_balance_stok"
                title="Balance Stok"
                headerActions={headerActions}
                renderActions={(item) => {
                    const isManual = item.type === 'stok masuk' || item.type === 'stok keluar';
                    return isManual && (
                        <div className="space-x-1">
                            {canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('duplicate', item)} className="p-1 text-slate-500 hover:text-slate-700" title="Duplikat Entri"><DocumentDuplicateIcon className="w-5 h-5"/></button>}
                            {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenModal('edit', item)} className="p-1 text-sky-600 hover:text-sky-800" title="Edit Entri"><PencilSquareIcon className="w-5 h-5"/></button>}
                            {canDelete(PAGE_PATH) && <button onClick={() => { setItemToDelete(item); setIsDeleteConfirmOpen(true); }} className="p-1 text-red-600 hover:text-red-800" title="Hapus Entri"><TrashIcon className="w-5 h-5"/></button>}
                        </div>
                    )
                }}
            />
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity duration-300" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-2xl transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">{modalTitle}</h2>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600" aria-label="Close modal"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                <div className="relative">
                                    <fieldset className="border border-slate-300 rounded-md px-3 group">
                                        <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap">Cabang*</legend>
                                        <select name="id_cabang" value={formData.id_cabang} onChange={(e) => setFormData(p => ({...p, id_cabang: e.target.value, item_id: ''}))} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none disabled:bg-slate-100 disabled:cursor-not-allowed">
                                            {selectableBranches.length === 0 ? (<option value="">Tidak ada cabang</option>) : (<>{selectableBranches.length > 1 && modalMode !== 'edit' && <option value="" disabled>Pilih Cabang</option>}{selectableBranches.map(b => (<option key={b.id_cabang} value={b.id_cabang}>{branchesMap.get(b.id_cabang) || b.id_cabang}</option>))}</>)}
                                        </select>
                                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 h-4"/></div>
                                    </fieldset>
                                </div>
                                <div className="relative">
                                    <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                        <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600">Tanggal*</legend>
                                        <input type="datetime-local" name="tanggal" value={formatISOToDatetimeLocalInput(formData.tanggal)} onChange={e => setFormData({...formData, tanggal: new Date(e.target.value).toISOString()})} required className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400 text-sm"/>
                                    </fieldset>
                                </div>
                            </div>
                            <div className="relative">
                                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                    <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600">Tipe*</legend>
                                    <select name="type" value={formData.type} onChange={(e) => setFormData(p => ({...p, type: e.target.value as any}))} required className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none">
                                        <option value="" disabled>Pilih Entri</option><option value="stok masuk">Stok Masuk</option><option value="stok keluar">Stok Keluar</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 h-4"/></div>
                                </fieldset>
                            </div>
                            <fieldset className="border border-slate-300 rounded-md p-4 pt-2">
                                <legend className="text-sm font-medium text-slate-500 px-2">Item & Kuantitas*</legend>
                                <div className="space-y-4">
                                    <div className="relative">
                                        <select name="item_id" value={formData.item_id} onChange={handleItemChange} required className="form-select w-full text-sm py-2.5">
                                            <option value="">-- Pilih Item --</option>
                                            {itemOptionsForModal.map(group => group && (
                                                <optgroup key={group.label} label={group.label}>{group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                                        <div className="relative">
                                            <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                                <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600">Quantity*</legend>
                                                <input type="number" name="quantity" placeholder="0" value={formData.quantity} onChange={(e) => setFormData(p => ({...p, quantity: Number(e.target.value) || 0}))} min="0" required className="block w-full py-2.5 outline-none bg-transparent text-sm" />
                                            </fieldset>
                                        </div>
                                        <div className="relative">
                                            <fieldset className="border border-slate-300 rounded-md px-3 group">
                                                <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap">Unit</legend>
                                                <input type="text" value={unitForSelectedItem} readOnly disabled className="block w-full py-2.5 outline-none bg-slate-100 text-sm" />
                                            </fieldset>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                            <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                                <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-6 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSubmitting}>Batal</button>
                                <button type="submit" className="w-full sm:w-auto px-8 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center disabled:opacity-70" disabled={isSubmitting}>{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
                            </div>
                        </form>
                    </div>
                 </div>
            )}
            {isDeleteConfirmOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus entri ini? Kuantitas stok akan dikembalikan.</p><div className="flex justify-end space-x-2"><button onClick={() => setIsDeleteConfirmOpen(false)} disabled={isSubmitting} className="px-3 py-2 border rounded-md text-xs">Batal</button><button onClick={handleDelete} disabled={isSubmitting} className="px-3 py-2 bg-red-600 text-white rounded-md text-xs flex items-center">{isSubmitting && <SpinnerIcon className="w-4 h-4 mr-2"/>}Ya, Hapus</button></div></div></div>)}
        </div>
    );
};

export default BalanceStokPage;