// FRONTEND: Komponen ini mengelola UI khusus untuk pengaturan Meja (Dine-in).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Meja, Branch, Grup } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, XMarkIcon, ChevronDownIcon, SpinnerIcon } from '../../components/icons';

const PAGE_PATH = '/penjualan/settings';

const MejaPage: React.FC = () => {
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
    const { selectedBranchId, selectableBranches } = useBranch();
    
    const [tables, setTables] = useState<Meja[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [grups, setGrups] = useState<Grup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentTable, setCurrentTable] = useState<Meja | null>(null);
    const defaultFormData = { 
        id_cabang: selectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : ''), 
        id_grup: '',
        nama_meja: '',
        kapasitas: 4,
        lokasi: 'Indoor',
        tipe: 'Persegi',
        durasi_maksimal_menit: null as number | null | undefined,
    };
    const [formData, setFormData] = useState(defaultFormData);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [tableToDelete, setTableToDelete] = useState<Meja | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [tablesData, branchesData, grupsData] = await Promise.all([
                api.getTables(),
                api.getBranches(),
                api.getGrups(),
            ]);
            setTables(tablesData);
            setBranches(branchesData);
            setGrups(grupsData);
        } catch (error) {
            console.error("Failed to load table data:", error);
            alert("Gagal memuat data meja.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAccessDataLoaded) {
            fetchData();
        }
    }, [isAccessDataLoaded, fetchData]);
    
    const displayedTables = useMemo(() => {
        if (!selectedBranchId) return tables;
        return tables.filter(t => t.id_cabang === selectedBranchId);
    }, [tables, selectedBranchId]);
    
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);
    const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);
    const branchToGrupMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.id_grup])), [branches]);

    const handleOpenModal = (mode: 'add' | 'edit', table?: Meja) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
        setModalMode(mode);
        if (mode === 'edit' && table) {
            setCurrentTable(table);
            setFormData({ 
                id_cabang: table.id_cabang, 
                id_grup: table.id_grup,
                nama_meja: table.nama_meja,
                kapasitas: table.kapasitas,
                lokasi: table.lokasi,
                tipe: table.tipe,
                durasi_maksimal_menit: table.durasi_maksimal_menit || null,
            });
        } else {
            setCurrentTable(null);
            const initialBranchId = selectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : '');
            const initialGrupId = branchToGrupMap.get(initialBranchId) || '';
            setFormData({ ...defaultFormData, id_cabang: initialBranchId, id_grup: initialGrupId });
        }
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => setIsModalOpen(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (name === 'id_cabang') {
            const newGrupId = branchToGrupMap.get(value) || '';
            setFormData(p => ({ ...p, id_cabang: value, id_grup: newGrupId }));
        } else if (type === 'number') {
            const numValue = parseInt(value, 10);
            if (name === 'durasi_maksimal_menit') {
                setFormData(p => ({ ...p, [name]: isNaN(numValue) ? null : numValue }));
            } else { // for kapasitas
                setFormData(p => ({ ...p, [name]: isNaN(numValue) ? 0 : numValue }));
            }
        } else {
            setFormData(p => ({ ...p, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nama_meja.trim() || !formData.id_cabang) { alert("Nama meja dan cabang wajib diisi."); return; }
        if (!formData.id_grup) { alert("Grup untuk meja tidak dapat ditemukan. Pilih cabang yang valid."); return; }
        setIsSubmitting(true);
        try {
            const dataToSubmit = {
                id_cabang: formData.id_cabang,
                id_grup: formData.id_grup,
                nama_meja: formData.nama_meja,
                kapasitas: formData.kapasitas,
                lokasi: formData.lokasi,
                tipe: formData.tipe,
                durasi_maksimal_menit: formData.durasi_maksimal_menit,
            };
            let response;
            if (modalMode === 'add') {
                response = await api.createTable(dataToSubmit);
            } else if (currentTable) {
                response = await api.updateTable(currentTable.id_meja, dataToSubmit);
            }
            if (response && response.success) {
                await fetchData();
                handleCloseModal();
            } else {
                alert(response?.message || "Gagal menyimpan meja.");
            }
        } catch (error) {
            alert(`Terjadi kesalahan: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (table: Meja) => {
        if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
        setTableToDelete(table);
        setIsDeleteConfirmOpen(true);
    };
    
    const confirmDelete = async () => {
        if (tableToDelete) {
            setIsSubmitting(true);
            try {
                const response = await api.deleteTable(tableToDelete.id_meja);
                if (response.success) {
                    await fetchData();
                } else {
                    alert(response.message || 'Gagal menghapus meja.');
                }
            } catch (error) {
                 alert(`Terjadi kesalahan: ${error}`);
            } finally {
                setIsSubmitting(false);
                setIsDeleteConfirmOpen(false);
                setTableToDelete(null);
            }
        }
    };
    
    const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setTableToDelete(null); }, []);

    const columns = useMemo<ColumnDef<Meja>[]>(() => [
        { header: 'ID Meja', accessor: 'id_meja', sortable: true },
        { header: 'Nama Meja', accessor: 'nama_meja', sortable: true },
        { header: 'Nama Grup', accessor: (item) => grupMap.get(item.id_grup) || item.id_grup, sortable: true },
        { header: 'Cabang', accessor: 'id_cabang', sortable: true, render: (item) => branchMap.get(item.id_cabang) || item.id_cabang },
        { header: 'Kapasitas', accessor: 'kapasitas', sortable: true, render: item => `${item.kapasitas} orang` },
        { header: 'Lokasi/Area', accessor: 'lokasi', sortable: true },
        { header: 'Tipe', accessor: 'tipe', sortable: true },
        { header: 'Durasi Maks (mnt)', accessor: 'durasi_maksimal_menit', sortable: true, render: item => item.durasi_maksimal_menit || '-' },
    ], [branchMap, grupMap]);

    const renderActions = useCallback((table: Meja) => (
        <div className="space-x-2">
            {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenModal('edit', table)} className="p-1 text-sky-600"><PencilSquareIcon className="w-5 h-5"/></button>}
            {canDelete(PAGE_PATH) && <button onClick={() => handleDeleteClick(table)} className="p-1 text-red-600"><TrashIcon className="w-5 h-5"/></button>}
        </div>
    ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

    const headerActions = useMemo(() => (
        canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md text-sm shadow-sm flex items-center"><PlusCircleIcon className="w-5 h-5 mr-2"/>Tambah Meja</button>
    ), [canInsert, handleOpenModal]);

    if (isLoading || !isAccessDataLoaded) {
        return <div className="p-6 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
    }

    return (
        <div className="p-6 md:p-8">
            <TabelFiturStandar data={displayedTables} columns={columns} uniqueIdKey="id_meja" renderActions={renderActions} headerActions={headerActions} title="Manajemen Meja" />
            {isModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                    <h3 className="text-lg font-semibold mb-4">{modalMode === 'add' ? 'Tambah' : 'Edit'} Meja</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Cabang*</legend><select value={formData.id_cabang} onChange={handleInputChange} name="id_cabang" required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100">{selectableBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nama Meja*</legend><input type="text" name="nama_meja" value={formData.nama_meja} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent" /></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Lokasi/Area*</legend><input type="text" name="lokasi" value={formData.lokasi} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent" placeholder="e.g., Indoor, Teras" /></fieldset></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Tipe Meja*</legend><input type="text" name="tipe" value={formData.tipe} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent" placeholder="e.g., Persegi, Sofa"/></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Kapasitas*</legend><input type="number" name="kapasitas" value={formData.kapasitas} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent" min="1"/></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Durasi Maksimal (Menit)</legend><input type="number" name="durasi_maksimal_menit" value={formData.durasi_maksimal_menit || ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent" min="0" placeholder="Kosongkan jika tidak ada"/></fieldset></div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-2 border-t"><button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md text-sm">Batal</button><button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm" disabled={isSubmitting}>Simpan</button></div>
                    </form>
                </div>
            </div>)}
            {isDeleteConfirmOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus meja "{tableToDelete?.nama_meja}"?</p><div className="flex justify-end space-x-2"><button onClick={cancelDelete} className="px-3 py-2 border rounded-md text-xs">Batal</button><button onClick={confirmDelete} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs">Ya, Hapus</button></div></div></div>)}
        </div>
    );
};

export default MejaPage;
