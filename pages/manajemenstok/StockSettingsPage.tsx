// FRONTEND: Komponen ini mengelola UI untuk pengaturan terkait stok, seperti Manajemen Unit.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Unit, Grup, Branch } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, ScaleIcon, PlusCircleIcon, SpinnerIcon, ChevronDownIcon, MagnifyingGlassIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/stock-management/settings'; // Path for permission checks

const StockSettingsPage: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
  const { selectedGroupId, selectedBranchId, selectableBranches, userRoleType } = useBranch();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isUnitModalOpen, setIsUnitModalOpen] = useState<boolean>(false);
  const [unitModalMode, setUnitModalMode] = useState<'add' | 'edit'>('add');
  const [currentUnitToEdit, setCurrentUnitToEdit] = useState<Unit | null>(null);
  const defaultUnitFormData: Omit<Unit, 'id_unit'> = { id_grup: '', id_cabang: null, nama_unit: '', deskripsi_unit: '' };
  const [unitFormData, setUnitFormData] = useState<Omit<Unit, 'id_unit'>>(deepClone(defaultUnitFormData));
  
  const [isUnitDeleteConfirmOpen, setIsUnitDeleteConfirmOpen] = useState<boolean>(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  // Optimized: Server-side filtering
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          search: searchTerm
      };
      
      const [unitsData, grupsData, branchesData] = await Promise.all([
          api.getUnits(params),
          // FIX: Pass params to getGrups for server-side filtering
          api.getGrups({ branchId: selectedBranchId, groupId: selectedGroupId }),
          api.getBranches({ groupId: selectedGroupId }),
      ]);
      setUnits(unitsData);
      setGrups(grupsData);
      setBranches(branchesData);
    } catch (error) {
      console.error("Failed to fetch units:", error);
      alert("Gagal memuat data unit.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);
  
  // Debounce search
  useEffect(() => {
    if (isAccessDataLoaded) {
      const timer = setTimeout(() => {
        fetchData();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchData]);

  const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);

  // Data already filtered by API
  const displayedUnits = units;
  
  const modalBranches = useMemo(() => {
    if (!unitFormData.id_grup) return [];
    return branches.filter(b => b.id_grup === unitFormData.id_grup);
  }, [unitFormData.id_grup, branches]);

  const handleOpenUnitModal = (mode: 'add' | 'edit', unit?: Unit) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) {
      alert("Akses ditolak.");
      return;
    }
    setUnitModalMode(mode);
    if (mode === 'edit' && unit) {
      setCurrentUnitToEdit(unit);
      setUnitFormData({ 
          id_grup: unit.id_grup,
          id_cabang: unit.id_cabang,
          nama_unit: unit.nama_unit, 
          deskripsi_unit: unit.deskripsi_unit || '' 
      });
    } else {
      setCurrentUnitToEdit(null);
      const initialGrupId = selectedGroupId || (grups.length > 0 ? grups[0].id_grup : '');
      const branchInSelectedGroup = branches.find(b => b.id_cabang === selectedBranchId && b.id_grup === initialGrupId);
      const initialCabangId = branchInSelectedGroup ? selectedBranchId : null;

      setUnitFormData({ 
          ...deepClone(defaultUnitFormData), 
          id_grup: initialGrupId,
          id_cabang: initialCabangId
      });
    }
    setIsUnitModalOpen(true);
  };
  
  const handleCloseUnitModal = useCallback(() => {
    setIsUnitModalOpen(false);
    setCurrentUnitToEdit(null);
    setUnitFormData(deepClone(defaultUnitFormData));
  }, [defaultUnitFormData]);
  
  const handleUnitInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setUnitFormData(prev => {
          const newState = { ...prev, [name]: value };
          if (name === 'id_grup') {
              newState.id_cabang = null; // Reset branch when group changes
          }
          if (name === 'id_cabang') {
              newState.id_cabang = value === '__SEMUA__' ? null : value;
          }
          return newState;
      });
  };
  
  const handleUnitSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!unitFormData.nama_unit.trim() || !unitFormData.id_grup) {
      alert('Nama Unit dan Grup wajib diisi!');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let response;
      const unitDataToSave: Omit<Unit, 'id_unit'> = {
        id_grup: unitFormData.id_grup,
        id_cabang: unitFormData.id_cabang,
        nama_unit: unitFormData.nama_unit.trim(),
        deskripsi_unit: unitFormData.deskripsi_unit?.trim() || undefined
      };
      
      if (unitModalMode === 'add') {
        response = await api.createUnit(unitDataToSave);
      } else if (currentUnitToEdit) {
        response = await api.updateUnit(currentUnitToEdit.id_unit, unitDataToSave);
      }

      if (response && response.success) {
        await fetchData();
        handleCloseUnitModal();
      } else {
        alert(response?.message || 'Gagal menyimpan unit.');
      }
    } catch (error) {
      console.error("Failed to save unit:", error);
      alert("Terjadi kesalahan saat menyimpan unit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnitDeleteClick = (unit: Unit) => {
    if (!canDelete(PAGE_PATH)) {
      alert("Akses ditolak.");
      return;
    }
    setUnitToDelete(unit);
    setIsUnitDeleteConfirmOpen(true);
  };

  const confirmUnitDelete = async () => {
    if (unitToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteUnit(unitToDelete.id_unit);
        if (response.success) {
          await fetchData();
        } else {
          alert(response.message || 'Gagal menghapus unit.');
        }
      } catch (error) {
        console.error("Error deleting unit:", error);
        alert("Terjadi kesalahan saat menghapus unit.");
      } finally {
        setIsSubmitting(false);
        setIsUnitDeleteConfirmOpen(false);
        setUnitToDelete(null);
      }
    }
  };
  
  const cancelUnitDelete = useCallback(() => {
    setIsUnitDeleteConfirmOpen(false);
    setUnitToDelete(null);
  }, []);
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isUnitModalOpen) handleCloseUnitModal();
        if (isUnitDeleteConfirmOpen) cancelUnitDelete();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isUnitModalOpen, handleCloseUnitModal, isUnitDeleteConfirmOpen, cancelUnitDelete]);
  
  const unitColumns = useMemo<ColumnDef<Unit>[]>(() => [
    { header: 'ID Unit', accessor: 'id_unit', sortable: true },
    { header: 'Cabang', accessor: 'id_cabang', sortable: true, render: (item) => item.id_cabang ? (branchMap.get(item.id_cabang) || item.id_cabang) : <span className="italic text-slate-500">Semua Cabang (Grup)</span> },
    { header: 'Nama Unit', accessor: 'nama_unit', sortable: true },
    { header: 'Deskripsi', accessor: 'deskripsi_unit', sortable: false, render: (item) => item.deskripsi_unit || '-' },
  ], [branchMap]);

  const renderUnitActions = useCallback((unit: Unit) => (
    <div className="space-x-2">
      <button
        onClick={() => handleOpenUnitModal('edit', unit)}
        className={`text-sky-600 hover:text-sky-800 transition-colors duration-150 p-1 ${!canUpdate(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!canUpdate(PAGE_PATH)} title="Edit Unit"
      >
        <PencilSquareIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => handleUnitDeleteClick(unit)}
        className={`text-red-600 hover:text-red-800 transition-colors duration-150 p-1 ${!canDelete(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!canDelete(PAGE_PATH)} title={!canDelete(PAGE_PATH) ? "Akses ditolak" : "Hapus Unit"}
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  ), [canUpdate, canDelete, handleOpenUnitModal, handleUnitDeleteClick]);
  
  const unitHeaderActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari unit..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button
          onClick={() => handleOpenUnitModal('add')}
          className={`w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-150 ease-in-out transform hover:scale-105 text-sm flex items-center ${!canInsert(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!canInsert(PAGE_PATH)}
          title={!canInsert(PAGE_PATH) ? "Akses ditolak" : "Tambah Unit"}
        >
          <PlusCircleIcon className="w-5 h-5 mr-2" />
          Tambah Unit
        </button>
    </div>
  ), [canInsert, handleOpenUnitModal, searchTerm]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 bg-white shadow-xl rounded-xl flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500" /></div>;
  }

  return (
    <div className="bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)]">
      <div className="border-b border-slate-200">
        <nav className="flex -mb-px px-4 sm:px-6 space-x-1 sm:space-x-2" aria-label="Tabs for Stock Settings">
          <button
            className={`px-4 sm:px-6 py-3 text-sm font-medium rounded-t-lg focus:outline-none transition-colors duration-150 ease-in-out border-b-2 flex items-center space-x-2 border-sky-600 text-sky-600 bg-white`}
            aria-current="page"
          >
            <ScaleIcon className="w-5 h-5" aria-hidden="true" />
            <span>Unit</span>
          </button>
        </nav>
      </div>

      <div className="p-6 md:p-8">
        <TabelFiturStandar
          data={displayedUnits}
          columns={unitColumns}
          uniqueIdKey="id_unit"
          renderActions={renderUnitActions}
          headerActions={unitHeaderActions}
          title="Daftar Unit"
        />
      </div>

      {isUnitModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40 transition-opacity duration-300" role="dialog" aria-modal="true" aria-labelledby="unit-modal-title">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-center mb-6">
              <h2 id="unit-modal-title" className="text-2xl font-semibold text-slate-800">
                {unitModalMode === 'add' ? 'Tambah Unit Baru' : 'Edit Unit'}
              </h2>
              <button onClick={handleCloseUnitModal} className="text-slate-400 hover:text-slate-600" aria-label="Close modal">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUnitSubmit} className="space-y-5">
              <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group">
                  <legend className="text-xs font-medium text-slate-500 px-1">Grup*</legend>
                  <select name="id_grup" value={unitFormData.id_grup} onChange={handleUnitInputChange} required disabled={unitModalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100">
                      <option value="" disabled>Pilih Grup</option>
                      {grups.map(g => (<option key={g.id_grup} value={g.id_grup}>{g.nama_grup}</option>))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4" /></div>
                </fieldset>
              </div>
               <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group">
                  <legend className="text-xs font-medium text-slate-500 px-1">Cabang (Opsional)</legend>
                  <select name="id_cabang" value={unitFormData.id_cabang || '__SEMUA__'} onChange={handleUnitInputChange} disabled={unitModalMode === 'edit' || !unitFormData.id_grup} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100">
                      <option value="__SEMUA__">Semua Cabang (di Grup Ini)</option>
                      {modalBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div>
                </fieldset>
                <p className="text-xs text-slate-500 mt-1 pl-1">Kosongkan untuk membuat unit yang berlaku untuk semua cabang di dalam grup yang dipilih.</p>
              </div>
              <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                  <legend className="text-xs font-medium text-slate-500 px-1 group-focus-within:text-sky-600">Nama Unit*</legend>
                  <input type="text" name="nama_unit" value={unitFormData.nama_unit} onChange={handleUnitInputChange} required className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400 text-sm" placeholder="Contoh: kg, pcs, ml" aria-label="Nama Unit"/>
                </fieldset>
              </div>
              <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                  <legend className="text-xs font-medium text-slate-500 px-1 group-focus-within:text-sky-600">Deskripsi Unit (Opsional)</legend>
                  <textarea name="deskripsi_unit" value={unitFormData.deskripsi_unit || ''} onChange={handleUnitInputChange} rows={2} className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400 text-sm resize-none" placeholder="Deskripsi singkat mengenai unit" aria-label="Deskripsi Unit"/>
                </fieldset>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={handleCloseUnitModal}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 flex justify-center items-center disabled:opacity-70"
                >
                   {isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2" />}
                   {isSubmitting ? 'Menyimpan...' : (unitModalMode === 'add' ? 'Simpan Unit' : 'Update Unit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {isUnitDeleteConfirmOpen && unitToDelete && (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="alertdialog" aria-modal="true" aria-labelledby="delete-unit-dialog-title" aria-describedby="delete-unit-dialog-description-unit">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md">
            <h2 id="delete-unit-dialog-title" className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus</h2>
            <p id="delete-unit-dialog-description-unit" className="text-slate-600 mb-6"> Anda yakin ingin menghapus unit "{unitToDelete.nama_unit}" (ID: {unitToDelete.id_unit})? Tindakan ini tidak dapat diurungkan. </p>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button onClick={cancelUnitDelete} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" aria-label="Batalkan penghapusan unit"> Batal </button>
              <button onClick={confirmUnitDelete} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex justify-center items-center" aria-label={`Konfirmasi hapus unit ${unitToDelete.nama_unit}`}>
                 {isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2" />}
                 {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSettingsPage;