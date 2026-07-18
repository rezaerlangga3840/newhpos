import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Role, Branch, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon, MagnifyingGlassIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_PATH = '/user-management/role-access-config';

interface RolePageProps {
  onRoleSelectForAccessTab?: (role: Role | null) => void;
  activeRoleForAccessTab?: Role | null;
}

const RolePage: React.FC<RolePageProps> = ({ onRoleSelectForAccessTab, activeRoleForAccessTab }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  
  const [isMainLoading, setIsMainLoading] = useState<boolean>(true);
  const [isRefLoading, setIsRefLoading] = useState<boolean>(true);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  
  const defaultFormData: Omit<Role, 'id_role'> = {
    id_grup: '',
    id_cabang: null,
    role: 'user',
    Nama_role: '',
  };
  const [formData, setFormData] = useState<Omit<Role, 'id_role'>>(defaultFormData);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
  const { selectedBranchId, selectedGroupId, userRoleType, selectableGrups } = useBranch();
  const { currentUser } = useAuth();
  
  // 1. Fetch Reference Data (Cabang & Grup) - Only when scope changes
  useEffect(() => {
    if (!isAccessDataLoaded) return;
    
    const fetchRefData = async () => {
        setIsRefLoading(true);
        try {
            const commonParams = {
                branchId: selectedBranchId,
                groupId: selectedGroupId
            };
            const [branchData, grupsData] = await Promise.all([
                api.getBranches(commonParams),
                api.getGrups(commonParams)
            ]);
            setBranches(branchData);
            setGrups(grupsData);
        } catch (error) {
            console.error("Failed to fetch ref data:", error);
        } finally {
            setIsRefLoading(false);
        }
    };
    
    fetchRefData();
  }, [selectedBranchId, selectedGroupId, isAccessDataLoaded]);

  // 2. Fetch Main Data (Roles) - Triggered by Scope OR Search
  const fetchRoles = useCallback(async () => {
    setIsMainLoading(true);
    try {
      const roleParams = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          search: searchTerm
      };

      const roleData = await api.getRoles(roleParams);
      setRoles(roleData.filter(r => r.id_role !== 'superuser')); // Client filter only for hidden superuser
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      alert("Gagal memuat data role.");
    } finally {
      setIsMainLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);

  // Debounce search
  useEffect(() => {
    if (isAccessDataLoaded) {
      const timer = setTimeout(() => {
        fetchRoles();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchRoles]);

  const isLoading = isMainLoading || isRefLoading;

  const branchIdToNameMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);
  const grupIdToNameMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);

  const handleOpenModal = useCallback((mode: 'add' | 'edit', role?: Role) => {
    if (mode === 'add' && !canInsert(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk menambah role."); return; }
    if (mode === 'edit' && !canUpdate(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk mengedit role."); return; }

    setModalMode(mode);
    if (mode === 'edit' && role) {
      setCurrentRole(role);
      setFormData({
        id_grup: role.id_grup,
        id_cabang: role.id_cabang,
        role: role.role,
        Nama_role: role.Nama_role,
      });
    } else {
      setCurrentRole(null);
      const initialGrupId = selectedGroupId || (selectableGrups.length > 0 ? selectableGrups[0].id_grup : '');
      setFormData({...defaultFormData, id_grup: initialGrupId, id_cabang: selectedBranchId || null});
    }
    setIsModalOpen(true);
  }, [canInsert, canUpdate, selectedGroupId, selectedBranchId, selectableGrups, defaultFormData]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false); setCurrentRole(null); setFormData(defaultFormData);
  }, [defaultFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newState = { ...prev, [name]: value };
        if (name === 'id_grup') {
            newState.id_cabang = null;
        }
        if (name === 'id_cabang' && value === '__SEMUA__') {
            newState.id_cabang = null;
        }
        return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.id_grup || !formData.Nama_role.trim()) {
      alert('Grup dan Nama Role wajib diisi!');
      return;
    }
    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        await api.createRole(formData);
      } else if (currentRole) {
        await api.updateRole(currentRole.id_role, {
          Nama_role: formData.Nama_role,
          role: formData.role,
        });
      }
      await fetchRoles();
      handleCloseModal();
    } catch (error) {
      console.error("Failed to save role:", error);
      alert(`Gagal menyimpan data role: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = useCallback((role: Role) => {
    if (!canDelete(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk menghapus role."); return; }
    setRoleToDelete(role);
    setIsDeleteConfirmOpen(true);
  }, [canDelete]);

  const confirmDelete = async () => {
    if (roleToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteRole(roleToDelete.id_role);
        if (response.success) {
          await fetchRoles();
        } else {
          alert(response.message || 'Gagal menghapus role.');
        }
      } catch (error) {
        console.error("Error deleting role:", error);
        alert("Terjadi kesalahan saat menghapus role.");
      } finally {
        setIsSubmitting(false);
        setIsDeleteConfirmOpen(false);
        setRoleToDelete(null);
      }
    }
  };

  const cancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false); setRoleToDelete(null);
  }, []);

  const columns = useMemo<ColumnDef<Role>[]>(() => [
    { header: 'Grup', accessor: (role) => grupIdToNameMap.get(role.id_grup) || role.id_grup, sortable: true },
    { header: 'Cabang', accessor: (role) => (role.id_cabang ? branchIdToNameMap.get(role.id_cabang) : <span className="italic text-slate-500">Semua Cabang</span>) || role.id_cabang, sortable: true },
    { header: 'Nama Role', accessor: 'Nama_role', sortable: true },
    { header: 'Kategori', accessor: 'role', sortable: true, render: (role) => <span className="capitalize">{role.role}</span> },
  ], [branchIdToNameMap, grupIdToNameMap]);

  const renderActions = useCallback((role: Role) => (
    <div className="space-x-2">
      <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', role); }} disabled={!canUpdate(PAGE_PATH)} className="p-1 text-sky-600 hover:text-sky-800 disabled:opacity-50" title="Edit Role"><PencilSquareIcon className="w-5 h-5" /></button>
      <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(role); }} disabled={!canDelete(PAGE_PATH)} className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50" title="Hapus Role"><TrashIcon className="w-5 h-5" /></button>
    </div>
  ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari role..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button onClick={() => handleOpenModal('add')} disabled={!canInsert(PAGE_PATH) || selectableGrups.length === 0} className="bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center transition duration-150 ease-in-out transform hover:scale-105 disabled:opacity-50" title={!canInsert(PAGE_PATH) ? "Permission denied" : (selectableGrups.length === 0 ? "Tidak ada grup tersedia" : "Tambah Role")}><PlusCircleIcon className="w-5 h-5 mr-2" />Tambah Role</button>
    </div>
  ), [canInsert, handleOpenModal, selectableGrups, searchTerm]);

  const modalBranches = useMemo(() => branches.filter(b => b.id_grup === formData.id_grup), [branches, formData.id_grup]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }

  return (
    <div className="p-6 md:p-8">
      <TabelFiturStandar
        data={roles}
        columns={columns}
        uniqueIdKey="id_role"
        renderActions={renderActions}
        headerActions={headerActions}
        title="Daftar Role"
        onRowClick={onRoleSelectForAccessTab}
        activeItem={activeRoleForAccessTab}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Role Baru' : 'Edit Role'}</h2><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Grup*</legend><select name="id_grup" value={formData.id_grup} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100"><option value="" disabled>Pilih Grup</option>{selectableGrups.map(g => (<option key={g.id_grup} value={g.id_grup}>{g.nama_grup}</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Cabang*</legend><select name="id_cabang" value={formData.id_cabang || '__SEMUA__'} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100"><option value="__SEMUA__">Semua Cabang (di Grup Ini)</option>{modalBranches.map(branch => (<option key={branch.id_cabang} value={branch.id_cabang!}>{branch.Nama}</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nama Role*</legend><input type="text" name="Nama_role" value={formData.Nama_role} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., Manajer Cabang, Kasir Senior"/></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Kategori Role*</legend><select name="role" value={formData.role} onChange={handleInputChange} required className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="user">User</option><option value="administrator">Administrator</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
              <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3"><button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button><button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Role' : 'Update Role')}</button></div>
            </form>
          </div>
        </div>
      )}
      {isDeleteConfirmOpen && roleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md"><h2 className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus</h2><p className="text-slate-600 mb-6">Anda yakin ingin menghapus role "{roleToDelete.Nama_role}" (ID: {roleToDelete.id_role})? Tindakan ini tidak dapat diurungkan.</p><div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3"><button onClick={cancelDelete} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex justify-center items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button></div></div>
        </div>
      )}
    </div>
  );
};

export default RolePage;