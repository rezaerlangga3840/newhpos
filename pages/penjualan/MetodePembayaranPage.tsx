// FRONTEND: Komponen ini mengelola UI khusus untuk pengaturan Metode Pembayaran.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PaymentMethod, Grup, Branch } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, XMarkIcon, SpinnerIcon, PhotoIcon, XCircleIcon, CurrencyDollarIcon, ChevronDownIcon } from '../../components/icons';
import { deepClone } from '../../utils';

const PAGE_PATH = '/penjualan/settings';

const MetodePembayaranPage: React.FC = () => {
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
    const { selectedGroupId, selectedBranchId, selectableGrups } = useBranch();

    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [grups, setGrups] = useState<Grup[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentItem, setCurrentItem] = useState<PaymentMethod | null>(null);
    const defaultFormData: Omit<PaymentMethod, 'id_metode'> = { id_grup: '', id_cabang: null, nama_metode: '', tipe_metode: 'Lainnya', aktif: true, logo_url: null, qris_image_url: null, nomor_pembayaran: null, nama_rekening: null, biaya_layanan: null };
    const [formData, setFormData] = useState(defaultFormData);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<PaymentMethod | null>(null);
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getPenjualanSettingsPageData();
            setPaymentMethods(data.paymentMethods);
            setGrups(data.grups);
            setBranches(data.branches);
        } catch (error) {
             console.error("Failed to load payment methods:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if(isAccessDataLoaded) {
            fetchData();
        }
    }, [isAccessDataLoaded, fetchData]);

    const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);
    const branchToGrupMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.id_grup])), [branches]);

    const displayedPaymentMethods = useMemo(() => {
        let list = [...paymentMethods];
        if (selectedBranchId) {
            const branchGrupId = branchToGrupMap.get(selectedBranchId);
            list = list.filter(pm => pm.id_cabang === selectedBranchId || (pm.id_grup === branchGrupId && pm.id_cabang === null));
        } else if (selectedGroupId) {
            list = list.filter(pm => pm.id_grup === selectedGroupId);
        }
        return list;
    }, [paymentMethods, selectedBranchId, selectedGroupId, branchToGrupMap]);

    const ImageUploadField: React.FC<{
        label: string;
        imageUrl: string | null | undefined;
        onImageChange: (base64: string | null) => void;
    }> = ({ label, imageUrl, onImageChange }) => {
        const fileInputRef = useRef<HTMLInputElement>(null);
        const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => { onImageChange(reader.result as string); };
                reader.readAsDataURL(file);
            }
        };
        const handleRemoveImage = () => { onImageChange(null); };

        return (
            <fieldset className="border border-slate-300 rounded-md p-3 group">
                <legend className="text-xs font-medium text-slate-500 px-1">{label}</legend>
                <div className="flex items-center space-x-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-md flex items-center justify-center overflow-hidden border">
                        {imageUrl ? <img src={imageUrl} alt={label} className="w-full h-full object-contain" /> : <PhotoIcon className="w-8 h-8 text-slate-400" />}
                    </div>
                    <div className="space-y-2">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50">Ganti Gambar</button>
                        {imageUrl && <button type="button" onClick={handleRemoveImage} className="text-xs flex items-center text-red-600 hover:text-red-800"><XCircleIcon className="w-4 h-4 mr-1" /> Hapus</button>}
                    </div>
                </div>
            </fieldset>
        );
    };

    const handleOpenModal = (mode: 'add' | 'edit', item?: PaymentMethod) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
        setModalMode(mode);
        if (mode === 'edit' && item) {
            setCurrentItem(item);
            setFormData({ ...item, id_cabang: item.id_cabang || '__SEMUA__' });
        } else {
            setCurrentItem(null);
            const initialGrupId = selectedGroupId || (selectableGrups.length > 0 ? selectableGrups[0].id_grup : '');
            if (!initialGrupId) {
                alert("Pilih grup di header untuk menambahkan metode pembayaran.");
                return;
            }
            setFormData({ ...defaultFormData, id_grup: initialGrupId, id_cabang: selectedBranchId || '__SEMUA__' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(p => {
            let finalValue: any = value;
            if (name === 'biaya_layanan') { finalValue = value === '' ? null : parseFloat(value); } 
            else if (type === 'checkbox') { finalValue = checked; }
            else if (name === 'id_cabang') { finalValue = value === '__SEMUA__' ? null : value; }
            
            const newState = { ...p, [name]: finalValue };
            if (name === 'id_grup') { newState.id_cabang = null; }
            return newState;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nama_metode.trim() || !formData.id_grup) { alert("Nama Metode dan Grup wajib diisi."); return; }
        setIsSubmitting(true);
        try {
            const dataToSubmit = { ...formData, id_cabang: formData.id_cabang === '__SEMUA__' ? null : formData.id_cabang };
            const response = modalMode === 'add'
                ? await api.createPaymentMethod(dataToSubmit)
                : await api.updatePaymentMethod(currentItem!.id_metode, dataToSubmit);
            
            if (response.success) {
                await fetchData();
                handleCloseModal();
            } else {
                alert(response.message || 'Gagal menyimpan data.');
            }
        } catch (error) {
            alert(`Terjadi kesalahan: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteClick = (item: PaymentMethod) => {
        if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (itemToDelete) {
            setIsSubmitting(true);
            try {
                await api.deletePaymentMethod(itemToDelete.id_metode);
                await fetchData();
            } catch (error) {
                alert(`Terjadi kesalahan: ${error}`);
            } finally {
                setIsSubmitting(false);
                setIsDeleteConfirmOpen(false);
                setItemToDelete(null);
            }
        }
    };

    const cancelDelete = useCallback(() => setIsDeleteConfirmOpen(false), []);

    const columns = useMemo<ColumnDef<PaymentMethod>[]>(() => [
        { header: 'Grup', accessor: item => grupMap.get(item.id_grup) || item.id_grup, sortable: true },
        { header: 'Cabang', accessor: item => item.id_cabang ? (branchMap.get(item.id_cabang) || item.id_cabang) : <span className="italic text-slate-500">Semua Cabang</span>, sortable: true },
        { header: 'Logo', accessor: 'logo_url', sortable: false, render: item => <div className="flex justify-center items-center h-8 w-8">{item.logo_url ? <img src={item.logo_url} alt={item.nama_metode} className="max-h-full max-w-full object-contain" /> : <CurrencyDollarIcon className="w-5 h-5 text-slate-400" />}</div>},
        { header: 'Nama Metode', accessor: 'nama_metode', sortable: true },
        { header: 'Tipe', accessor: 'tipe_metode', sortable: true },
        { header: 'Status', accessor: 'aktif', sortable: true, render: item => <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{item.aktif ? 'Aktif' : 'Nonaktif'}</span> },
    ], [grupMap, branchMap]);

    const renderActions = useCallback((item: PaymentMethod) => (
        <div className="space-x-2">
            {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenModal('edit', item)} className="p-1 text-sky-600"><PencilSquareIcon className="w-5 h-5"/></button>}
            {canDelete(PAGE_PATH) && <button onClick={() => handleDeleteClick(item)} className="p-1 text-red-600"><TrashIcon className="w-5 h-5"/></button>}
        </div>
    ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

    const headerActions = useMemo(() => (
        canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md text-sm shadow-sm flex items-center"><PlusCircleIcon className="w-5 h-5 mr-2"/>Tambah Metode</button>
    ), [canInsert, handleOpenModal]);
    
    const modalBranches = useMemo(() => branches.filter(b => b.id_grup === formData.id_grup), [branches, formData.id_grup]);

    if (isLoading || !isAccessDataLoaded) {
        return <div className="p-6 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
    }

    return (
        <div className="p-6 md:p-8">
            <TabelFiturStandar data={displayedPaymentMethods} columns={columns} uniqueIdKey="id_metode" renderActions={renderActions} headerActions={headerActions} title="Manajemen Metode Pembayaran" />
            {isModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">{modalMode === 'add' ? 'Tambah' : 'Edit'} Metode Pembayaran</h3><button onClick={handleCloseModal}><XMarkIcon className="w-5 h-5"/></button></div><form onSubmit={handleSubmit} className="space-y-4 text-sm flex-grow overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Grup*</legend><select name="id_grup" value={formData.id_grup} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100"><option value="" disabled>Pilih Grup</option>{selectableGrups.map(g => <option key={g.id_grup} value={g.id_grup}>{g.nama_grup}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Cabang</legend><select name="id_cabang" value={formData.id_cabang || '__SEMUA__'} onChange={handleInputChange} disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100"><option value="__SEMUA__">Semua Cabang (Grup Ini)</option>{modalBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nama Metode*</legend><input type="text" name="nama_metode" value={formData.nama_metode} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Tipe</legend><select name="tipe_metode" value={formData.tipe_metode} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option>Cash</option><option>Card</option><option>E-Wallet</option><option>Transfer</option><option>Lainnya</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nomor Rekening/Pembayaran</legend><input type="text" name="nomor_pembayaran" value={formData.nomor_pembayaran || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., 1234567890"/></fieldset></div>
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nama Rekening (a/n)</legend><input type="text" name="nama_rekening" value={formData.nama_rekening || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., PT Anda"/></fieldset></div>
                </div>
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Biaya Layanan</legend><input type="number" name="biaya_layanan" value={formData.biaya_layanan ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g. 1.5 (untuk %) atau 2500 (untuk flat)" step="any"/></fieldset></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <ImageUploadField label="Logo Metode" imageUrl={formData.logo_url} onImageChange={base64 => setFormData(p => ({...p, logo_url: base64}))} />
                     <ImageUploadField label="Gambar QRIS" imageUrl={formData.qris_image_url} onImageChange={base64 => setFormData(p => ({...p, qris_image_url: base64}))} />
                </div>
                <div className="flex items-center"><input type="checkbox" name="aktif" id="pm-aktif" checked={formData.aktif} onChange={handleInputChange} className="form-checkbox h-4 w-4 rounded mr-2"/><label htmlFor="pm-aktif">Aktifkan metode pembayaran ini</label></div>
                <div className="flex justify-end space-x-2 pt-4 border-t mt-auto"><button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md text-sm">Batal</button><button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm" disabled={isSubmitting}>Simpan</button></div>
            </form></div></div>)}
            {isDeleteConfirmOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus "{itemToDelete?.nama_metode}"?</p><div className="flex justify-end space-x-2"><button onClick={cancelDelete} className="px-3 py-2 border rounded-md text-xs">Batal</button><button onClick={confirmDelete} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs">Ya, Hapus</button></div></div></div>)}
        </div>
    );
};

export default MetodePembayaranPage;