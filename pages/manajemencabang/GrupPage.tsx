import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, SpinnerIcon, MagnifyingGlassIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext'; 

const PAGE_PATH = '/branch/daftar-cabang';

interface GrupPageProps {
  onGrupRowClick?: (grup: Grup) => void;
  activeGrupForFilter?: Grup | null;
}

const GrupPage: React.FC<GrupPageProps> = ({ onGrupRowClick, activeGrupForFilter }) => {
  const [grups, setGrups] = useState<Grup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentGrup, setCurrentGrup] = useState<Grup | null>(null);
  const [formData, setFormData] = useState<Pick<Grup, 'nama_grup' | 'manajer'>>({ 
    nama_grup: '',
    manajer: null,
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [grupToDelete, setGrupToDelete] = useState<Grup | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
  const { selectedGroupId, selectedBranchId } = useBranch();
  
  // Optimized: Only fetch groups relevant to the current context (Server-Side Filtering)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const params = {
            branchId: selectedBranchId,
            groupId: selectedGroupId,
            search: searchTerm
        };
        const grupData = await api.getGrups(params);
        setGrups(grupData);
    } catch (error) {
        console.error("Failed to fetch data:", error);
        alert("Gagal memuat data grup.");
    } finally {
        setIsLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);

  // Debounce for search
  useEffect(() => {
    if (isAccessDataLoaded) {
        const timer = setTimeout(() => {
            fetchData();
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchData]);

  const handleOpenModal = useCallback((mode: 'add' | 'edit', grup?: Grup) => {
    if (mode === 'add' && !canInsert(PAGE_PATH)) {
        alert("Anda tidak memiliki izin untuk menambah grup baru.");
        return;
    }
    if (mode === 'edit' && !canUpdate(PAGE_PATH)) {
        alert("Anda tidak memiliki izin untuk mengedit grup.");
        return;
    }

    setModalMode(mode);
    if (mode === 'edit' && grup) {
      setCurrentGrup(grup);
      setFormData({
        nama_grup: grup.nama_grup,
        manajer: grup.manajer
      });
    } else {
      setCurrentGrup(null);
      setFormData({ 
        nama_grup: '',
        manajer: null,
      });
    }
    setIsModalOpen(true);
  }, [canInsert, canUpdate]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentGrup(null);
    setFormData({ nama_grup: '', manajer: null });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value === '' ? null : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.nama_grup || !formData.nama_grup.trim()) {
      alert('Nama Grup wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
        if (modalMode === 'add') {
            await api.createGrup({
                nama_grup: formData.nama_grup.trim(),
                manajer: formData.manajer || null,
                target_tahunan: 0,
                npwp: null,
                pajak_reg: null,
            });
        } else if (currentGrup) {
            await api.updateGrup(currentGrup.id_grup, {
                ...currentGrup,
                nama_grup: formData.nama_grup.trim(),
                manajer: formData.manajer || null,
            });
        }
        await fetchData();
        handleCloseModal();
    } catch (error) {
        console.error("Failed to save grup:", error);
        alert(`Gagal menyimpan data grup: ${error}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClick = useCallback((grup: Grup) => {
    if (!canDelete(PAGE_PATH)) {
        alert("Anda tidak memiliki izin untuk menghapus grup.");
        return;
    }
    setGrupToDelete(grup);
    setIsDeleteConfirmOpen(true);
  }, [canDelete]);

  const confirmDelete = async () => {
    if (grupToDelete) {
        setIsSubmitting(true);
        try {
            const response = await api.deleteGrup(grupToDelete.id_grup);
            if (response.success) {
                await fetchData();
            } else {
                alert(response.message || 'Gagal menghapus grup.');
            }
        } catch (error) {
            console.error("Error deleting grup:", error);
            alert("Terjadi kesalahan saat menghapus grup.");
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setGrupToDelete(null);
        }
    }
  };

  const cancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setGrupToDelete(null);
  }, []);
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if(isModalOpen) handleCloseModal();
        if(isDeleteConfirmOpen) cancelDelete();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, isDeleteConfirmOpen, handleCloseModal, cancelDelete]);


  const columns = useMemo<ColumnDef<Grup>[]>(() => [
    { header: 'ID Grup', accessor: 'id_grup', sortable: true },
    { header: 'Nama Grup', accessor: 'nama_grup', sortable: true },
    { header: 'PIC', accessor: 'manajer', sortable: false, render: (item) => item.manajer || '-' },
  ], []);

  const renderActions = useCallback((grup: Grup) => (
    <div className="space-x-2">
      <button
        onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', grup); }}
        className={`text-sky-600 hover:text-sky-800 transition-colors duration-150 p-1 ${!canUpdate(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!canUpdate(PAGE_PATH)}
        title={!canUpdate(PAGE_PATH) ? "Permission denied" : "Edit Grup"}
        aria-label={`Edit grup ${grup.nama_grup}`}
      >
        <PencilSquareIcon className="w-5 h-5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDeleteClick(grup); }}
        className={`text-red-600 hover:text-red-800 transition-colors duration-150 p-1 ${!canDelete(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!canDelete(PAGE_PATH)}
        title={!canDelete(PAGE_PATH) ? "Permission denied" : "Hapus Grup"}
        aria-label={`Hapus grup ${grup.nama_grup}`}
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

  const isAddButtonDisabled = !canInsert(PAGE_PATH);
  
  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari grup..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button
            onClick={() => handleOpenModal('add')}
            className={`w-full sm:w-auto bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center transition duration-150 ease-in-out transform hover:scale-105 ${isAddButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isAddButtonDisabled}
            title={isAddButtonDisabled ? "Permission denied" : "Tambah Grup"}
        >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Tambah Grup
        </button>
    </div>
  ), [isAddButtonDisabled, handleOpenModal, searchTerm]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }

  return (
    <div className="p-6 md:p-8">
      <TabelFiturStandar
        data={grups}
        columns={columns}
        uniqueIdKey="id_grup"
        renderActions={renderActions}
        headerActions={headerActions}
        title="Grup"
        onRowClick={onGrupRowClick}
        activeItem={activeGrupForFilter}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40 transition-opacity duration-300" role="dialog" aria-modal="true" aria-labelledby="modal-title-grup">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-center mb-6">
              <h2 id="modal-title-grup" className="text-2xl font-semibold text-slate-800">
                {modalMode === 'add' ? 'Tambah Grup Baru' : 'Edit Grup'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600" aria-label="Close modal">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500 transition-colors duration-150">
                  <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600 transition-colors duration-150">
                    Nama Grup*
                  </legend>
                  <input
                    type="text"
                    name="nama_grup"
                    id="nama_grup_modal_input"
                    value={formData.nama_grup}
                    onChange={handleInputChange}
                    required
                    className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400 text-sm"
                    placeholder="Nama Grup Perusahaan"
                    aria-label="Nama Grup"
                  />
                </fieldset>
              </div>

              <div className="relative">
                <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500 transition-colors duration-150">
                  <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600 transition-colors duration-150">
                    PIC (Penanggung Jawab)
                  </legend>
                  <input
                    type="text"
                    name="manajer"
                    id="manajer_modal_input"
                    value={formData.manajer || ''}
                    onChange={handleInputChange}
                    className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400 text-sm"
                    placeholder="Nama Penanggung Jawab"
                    aria-label="PIC"
                  />
                </fieldset>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
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
                  {isSubmitting ? <SpinnerIcon className="w-5 h-5 mr-2"/> : null}
                  {isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Grup' : 'Update Grup')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {isDeleteConfirmOpen && grupToDelete && (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title-grup" aria-describedby="delete-dialog-description-grup">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md">
            <h2 id="delete-dialog-title-grup" className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus</h2>
            <p id="delete-dialog-description-grup" className="text-slate-600 mb-6">Anda yakin ingin menghapus grup "{grupToDelete.nama_grup}" (ID: {grupToDelete.id_grup})? Tindakan ini tidak dapat diurungkan.</p>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button onClick={cancelDelete} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSubmitting} aria-label="Batalkan penghapusan grup">Batal</button>
              <button onClick={confirmDelete} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex justify-center items-center disabled:opacity-70" disabled={isSubmitting} aria-label={`Konfirmasi hapus grup ${grupToDelete.nama_grup}`}>
                {isSubmitting ? <SpinnerIcon className="w-5 h-5 mr-2"/> : null}
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GrupPage;