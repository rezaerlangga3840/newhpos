// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk daftar, tambah, edit, dan hapus data Pelanggan.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Grup } from '../../types';
import { 
    PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, SpinnerIcon,
    ChevronDownIcon, MagnifyingGlassIcon
} from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { deepClone } from '../../utils';

const PAGE_PATH = '/penjualan/pelanggan';

const CustomerPage: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [grups, setGrups] = useState<Grup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Server-side filtering states
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);

    const defaultFormData: Omit<Customer, 'id_pelanggan' | 'tanggal_daftar'> = {
        id_grup: '',
        nama_pelanggan: '',
        telepon: '',
        email: '',
        alamat: '',
    };
    const [formData, setFormData] = useState(deepClone(defaultFormData));
    
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
    const { selectedGroupId } = useBranch();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [data, grupsData] = await Promise.all([
                api.getCustomers({ groupId: selectedGroupId, search: searchTerm }),
                api.getGrups()
            ]);
            setCustomers(data);
            setGrups(grupsData);
        } catch (error) {
            console.error("Gagal memuat data pelanggan:", error);
            alert("Gagal memuat data pelanggan.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedGroupId, searchTerm]);

    // Debounce search
    useEffect(() => {
        if (isAccessDataLoaded) {
            const timer = setTimeout(() => {
                fetchData();
            }, 500); // 500ms delay to reduce server load
            return () => clearTimeout(timer);
        }
    }, [isAccessDataLoaded, fetchData]);

    const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);

    // Filtered by API already
    const displayedCustomers = customers;

    const handleOpenModal = useCallback((mode: 'add' | 'edit', customer?: Customer) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) {
            alert("Anda tidak memiliki izin untuk melakukan tindakan ini.");
            return;
        }
        setModalMode(mode);
        if (mode === 'edit' && customer) {
            setCurrentCustomer(customer);
            setFormData(deepClone(customer));
        } else { // 'add' mode
            if (!selectedGroupId) {
                alert("Silakan pilih grup spesifik di header untuk menambahkan pelanggan baru.");
                return;
            }
            setCurrentCustomer(null);
            setFormData({ ...deepClone(defaultFormData), id_grup: selectedGroupId });
        }
        setIsModalOpen(true);
    }, [canInsert, canUpdate, defaultFormData, selectedGroupId]);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setCurrentCustomer(null);
        setFormData(deepClone(defaultFormData));
    }, [defaultFormData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.nama_pelanggan.trim() || !formData.id_grup) {
            alert('Nama Pelanggan dan Grup wajib diisi!');
            return;
        }
        setIsSubmitting(true);
        try {
            if (modalMode === 'add') {
                const newCustomer = await api.createCustomer(formData);
                if (newCustomer) { // createCustomer returns the new customer object on success
                    await fetchData();
                    handleCloseModal();
                } else {
                    throw new Error('API createCustomer tidak mengembalikan data.');
                }
            } else if (currentCustomer) {
                const response = await api.updateCustomer(currentCustomer.id_pelanggan, formData);
                if (response.success) { // updateCustomer returns { success: true }
                    await fetchData();
                    handleCloseModal();
                } else {
                    throw new Error(response.message || 'Gagal memperbarui pelanggan.');
                }
            }
        } catch (error) {
            console.error("Failed to save customer:", error);
            alert(`Gagal menyimpan data: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = useCallback((customer: Customer) => {
        if (!canDelete(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk menghapus pelanggan."); return; }
        setCustomerToDelete(customer);
        setIsDeleteConfirmOpen(true);
    }, [canDelete]);

    const confirmDelete = async () => {
        if (customerToDelete) {
            setIsSubmitting(true);
            try {
                const response = await api.deleteCustomer(customerToDelete.id_pelanggan);
                if (response.success) {
                    await fetchData();
                } else {
                    alert(response.message || 'Gagal menghapus pelanggan.');
                }
            } catch (error) {
                console.error("Error deleting customer:", error);
                alert(`Terjadi kesalahan: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsSubmitting(false);
                setIsDeleteConfirmOpen(false);
                setCustomerToDelete(null);
            }
        }
    };
    const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setCustomerToDelete(null); }, []);

    const columns = useMemo<ColumnDef<Customer>[]>(() => [
        { header: 'ID Pelanggan', accessor: 'id_pelanggan', sortable: true },
        { header: 'Grup', accessor: (c) => grupMap.get(c.id_grup) || c.id_grup, sortable: true },
        { header: 'Nama Pelanggan', accessor: 'nama_pelanggan', sortable: true },
        { header: 'Telepon', accessor: 'telepon', sortable: false, render: c => c.telepon || '-' },
        { header: 'Email', accessor: 'email', sortable: false, render: c => c.email || '-' },
        { header: 'Alamat', accessor: 'alamat', sortable: false, render: c => c.alamat || '-' },
    ], [grupMap]);

    const renderActions = useCallback((customer: Customer) => (
        <div className="space-x-2">
            <button onClick={() => handleOpenModal('edit', customer)} disabled={!canUpdate(PAGE_PATH)} className="p-1 text-sky-600 hover:text-sky-800 disabled:opacity-50" title="Edit Pelanggan"><PencilSquareIcon className="w-5 h-5" /></button>
            <button onClick={() => handleDeleteClick(customer)} disabled={!canDelete(PAGE_PATH)} className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50" title="Hapus Pelanggan"><TrashIcon className="w-5 h-5" /></button>
        </div>
    ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

    const headerActions = useMemo(() => (
        <div className="flex space-x-3 items-center">
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input 
                    type="text" 
                    placeholder="Cari pelanggan..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
                />
            </div>
            <button 
                onClick={() => handleOpenModal('add')} 
                disabled={!canInsert(PAGE_PATH) || !selectedGroupId} 
                className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center text-sm disabled:opacity-50" 
                title={!canInsert(PAGE_PATH) ? "Akses ditolak" : !selectedGroupId ? "Pilih grup spesifik di header terlebih dahulu" : "Tambah Pelanggan Baru"}
            >
                <PlusCircleIcon className="w-5 h-5 mr-2" />Tambah Pelanggan
            </button>
        </div>
    ), [canInsert, handleOpenModal, selectedGroupId, searchTerm]);

    if (isLoading || !isAccessDataLoaded) {
        return <div className="p-6 bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)] flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500" /></div>;
    }

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <TabelFiturStandar
                data={displayedCustomers}
                columns={columns}
                uniqueIdKey="id_pelanggan"
                renderActions={renderActions}
                headerActions={headerActions}
                title="Manajemen Pelanggan"
            />
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Pelanggan Baru' : 'Edit Pelanggan'}</h2><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button></div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nama Pelanggan*</legend><input type="text" name="nama_pelanggan" value={formData.nama_pelanggan} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent" placeholder="Masukkan nama lengkap pelanggan"/></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Telepon</legend><input type="tel" name="telepon" value={formData.telepon || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., 08123456789"/></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Email</legend><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., email@contoh.com"/></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Alamat</legend><textarea name="alamat" value={formData.alamat || ''} onChange={handleInputChange} rows={3} className="block w-full py-2.5 outline-none bg-transparent resize-none" placeholder="Alamat lengkap pelanggan"></textarea></fieldset></div>
                            <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3"><button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button><button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Pelanggan' : 'Update Pelanggan')}</button></div>
                        </form>
                    </div>
                </div>
            )}
            {isDeleteConfirmOpen && customerToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="alertdialog" aria-modal="true">
                    <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md"><h2 className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus</h2><p className="text-slate-600 mb-6">Anda yakin ingin menghapus pelanggan "{customerToDelete.nama_pelanggan}"? Tindakan ini tidak dapat diurungkan.</p><div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3"><button onClick={cancelDelete} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex justify-center items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button></div></div>
                </div>
            )}
        </div>
    );
};

export default CustomerPage;