// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk daftar, tambah, edit, dan hapus data User.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Role, Branch, Karyawan, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, ChevronDownIcon, PlusCircleIcon, SpinnerIcon, MagnifyingGlassIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';

const PAGE_PATH = '/user-management/users';

const UserPage: React.FC = () => {
  // Main Data State
  const [users, setUsers] = useState<User[]>([]);
  
  // Reference Data State (Dropdowns & Mapping)
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);

  // Loading States
  const [isMainLoading, setIsMainLoading] = useState<boolean>(true);
  const [isRefLoading, setIsRefLoading] = useState<boolean>(true);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentUserToEdit, setCurrentUserToEdit] = useState<User | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    selectedBranchId: globalSelectedBranchId,
    selectedGroupId: globalSelectedGroupId,
    userRoleType,
  } = useBranch();
  const { currentUser: authUser } = useAuth();
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

  const defaultFormData: User = {
    id_user: '',
    id_karyawan: null,
    username: '',
    password: '',
    id_cabang: '',
    id_role: '',
  };
  const [formData, setFormData] = useState<User>(defaultFormData);

  // 1. Fetch Reference Data (Hanya jika Scope berubah, TIDAK saat search)
  useEffect(() => {
    if (!isAccessDataLoaded) return;

    const fetchReferenceData = async () => {
        setIsRefLoading(true);
        try {
            // Params untuk referensi TIDAK menyertakan 'search'
            // Ini agar dropdown tetap penuh meskipun sedang mencari user tertentu
            const refQueryParams = {
                branchId: globalSelectedBranchId,
                groupId: globalSelectedGroupId,
            };

            const [rolesData, branchesData, karyawanData, grupsData] = await Promise.all([
                api.getRoles(refQueryParams), 
                api.getBranches(refQueryParams), 
                api.getKaryawan(refQueryParams), 
                api.getGrups(refQueryParams), 
            ]);

            setRoles(rolesData);
            setBranches(branchesData);
            setKaryawanList(karyawanData);
            setGrups(grupsData);
        } catch (error) {
            console.error("Gagal memuat data referensi user:", error);
        } finally {
            setIsRefLoading(false);
        }
    };

    fetchReferenceData();
  }, [globalSelectedBranchId, globalSelectedGroupId, isAccessDataLoaded]);

  // 2. Fetch Main Data (Users) - Dipanggil saat Scope ATAU Search berubah
  const fetchUsers = useCallback(async () => {
    setIsMainLoading(true);
    try {
        const userQueryParams = {
            branchId: globalSelectedBranchId,
            groupId: globalSelectedGroupId,
            search: searchTerm // Search hanya diterapkan ke API Users
        };

        const usersData = await api.getUsers(userQueryParams);
        
        // Filter out superuser from list unless I am superuser (basic protection)
        const displayableUsers = usersData.filter(user => user.id_role !== 'superuser' || (authUser?.id_role === 'superuser'));
        setUsers(displayableUsers);
    } catch (error) {
      console.error("Gagal memuat data user:", error);
      alert("Gagal memuat data user. Silakan coba lagi.");
    } finally {
      setIsMainLoading(false);
    }
  }, [globalSelectedBranchId, globalSelectedGroupId, searchTerm, authUser]);

  // Debounce search untuk data utama
  useEffect(() => {
    if (isAccessDataLoaded) {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchUsers]);

  const isLoading = isMainLoading || isRefLoading;

  const grupIdToNameMap = useMemo(() => grups.reduce((acc, grup) => ({ ...acc, [grup.id_grup]: grup.nama_grup }), {} as Record<string, string>), [grups]);
  const karyawanMap = useMemo(() => karyawanList.reduce((acc, k) => ({ ...acc, [k.id_karyawan]: k }), {} as Record<string, Karyawan>), [karyawanList]);
  const getKaryawanDisplayName = useCallback((id_karyawan?: string | null) => (id_karyawan && karyawanMap[id_karyawan]) ? karyawanMap[id_karyawan].nama_lengkap : '-', [karyawanMap]);
  
  const branchToGrupMap = useMemo(() => {
    return branches.reduce((acc, branch) => {
      acc[branch.id_cabang] = branch.id_grup;
      return acc;
    }, {} as Record<string, string>);
  }, [branches]);
  
  const branchesForModalDropdown = useMemo(() => branches, [branches]);

  const availableRolesForForm = useMemo(() => {
    if (!formData.id_cabang) return [];
    const selectedBranch = branches.find(b => b.id_cabang === formData.id_cabang);
    if (!selectedBranch) return [];
    const groupId = selectedBranch.id_grup;
    
    return roles.filter(role => 
        (role.id_cabang === formData.id_cabang) || // Roles specific to the branch
        (role.id_cabang === null && role.id_grup === groupId) // Roles for the entire group
    ).filter(role => role.id_role !== 'superuser'); // Exclude superuser from assignment
  }, [roles, branches, formData.id_cabang]);
  
  useEffect(() => {
    if (formData.id_role && !availableRolesForForm.some(r => r.id_role === formData.id_role)) {
      setFormData(prev => ({ ...prev, id_role: '' }));
    }
  }, [formData.id_cabang, availableRolesForForm, formData.id_role]);

  const availableKaryawanForModal = useMemo(() => {
    // Ensure we don't assign an already assigned employee (except the current one being edited)
    const linkedKaryawanIds = users.filter(u => u.id_karyawan && u.id_user !== currentUserToEdit?.id_user).map(u => u.id_karyawan);
    return karyawanList.filter(k => !linkedKaryawanIds.includes(k.id_karyawan) || k.id_karyawan === currentUserToEdit?.id_karyawan);
  }, [users, karyawanList, currentUserToEdit]);

  const handleOpenModal = useCallback((mode: 'add' | 'edit', user?: User) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) {
      alert("Anda tidak memiliki izin untuk melakukan tindakan ini.");
      return;
    }
    setModalMode(mode);
    if (mode === 'edit' && user) {
      setCurrentUserToEdit(user);
      setFormData({ ...user, password: '', id_cabang: user.id_cabang || '', id_karyawan: user.id_karyawan || null });
    } else {
      setCurrentUserToEdit(null);
      let initialModalBranchId = globalSelectedBranchId || '';
      if(branchesForModalDropdown.length === 1) initialModalBranchId = branchesForModalDropdown[0].id_cabang;
      
      setFormData({ ...defaultFormData, id_cabang: initialModalBranchId, id_role: '' });
    }
    setIsModalOpen(true);
  }, [canInsert, canUpdate, branchesForModalDropdown, globalSelectedBranchId, defaultFormData]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false); setCurrentUserToEdit(null); setFormData(defaultFormData);
  }, [defaultFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newFormData = { ...prev, [name]: value };
      if (name === 'id_cabang') newFormData.id_role = '';
      if (name === 'id_karyawan' && value === "") newFormData.id_karyawan = null;
      return newFormData;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.id_cabang || !formData.id_role || (modalMode === 'add' && !formData.password?.trim())) {
      alert('Cabang, Role, Username, dan Password (untuk user baru) wajib diisi!');
      return;
    }
    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        const response = await api.createUser(formData);
        if (!response.success) throw new Error(response.message);
      } else if (currentUserToEdit) {
        const response = await api.updateUser(currentUserToEdit.id_user, formData);
        if (!response.success) throw new Error(response.message);
      }
      await fetchUsers();
      handleCloseModal();
    } catch (error) {
      console.error("Gagal menyimpan user:", error);
      alert(`Gagal menyimpan user: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = useCallback((user: User) => {
    if (!canDelete(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk menghapus user."); return; }
    if (authUser?.id_user === user.id_user) { alert("Anda tidak dapat menghapus akun Anda sendiri."); return; }
    setUserToDelete(user);
    setIsDeleteConfirmOpen(true);
  }, [canDelete, authUser]);

  const confirmDelete = async () => {
    if (userToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteUser(userToDelete.id_user);
        if (!response.success) throw new Error(response.message);
        await fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        alert(`Terjadi kesalahan saat menghapus user: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsSubmitting(false);
        setIsDeleteConfirmOpen(false);
        setUserToDelete(null);
      }
    }
  };

  const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setUserToDelete(null); }, []);

  const getRoleName = useCallback((id_role: string, id_cabang?: string) => {
    const role = roles.find(r => r.id_role === id_role);
    return role ? role.Nama_role : id_role;
  }, [roles]);

  const isAddButtonDisabled = !canInsert(PAGE_PATH) || (branchesForModalDropdown.length === 0 && userRoleType !== 'superuser');
  const isModalBranchDropdownDisabled = modalMode === 'edit' || (modalMode === 'add' && branchesForModalDropdown.length <= 1);

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { 
        header: 'Grup', 
        accessor: (user) => {
            if (!user.id_cabang) return 'N/A (System)';
            const grupId = branchToGrupMap[user.id_cabang];
            return grupId ? grupIdToNameMap[grupId] || grupId : '-';
        }, 
        sortable: true 
    },
    { header: 'ID Cabang', accessor: 'id_cabang', sortable: true, render: (user) => user.id_cabang || 'N/A (System)' },
    { header: 'ID User', accessor: 'id_user', sortable: true },
    { header: 'Nama Karyawan', accessor: 'id_karyawan', sortable: true, render: (user) => getKaryawanDisplayName(user.id_karyawan) },
    { header: 'Username', accessor: 'username', sortable: true },
    { header: 'Role', accessor: 'id_role', sortable: true, render: (user) => getRoleName(user.id_role, user.id_cabang) },
  ], [getKaryawanDisplayName, getRoleName, branchToGrupMap, grupIdToNameMap]);

  const renderActions = useCallback((user: User) => (
    <div className="space-x-2">
      <button onClick={() => handleOpenModal('edit', user)} className="text-sky-600 hover:text-sky-800 p-1 disabled:opacity-50" disabled={!canUpdate(PAGE_PATH)} title="Edit User"><PencilSquareIcon className="w-5 h-5" /></button>
      <button onClick={() => handleDeleteClick(user)} className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50" disabled={!canDelete(PAGE_PATH) || authUser?.id_user === user.id_user} title={authUser?.id_user === user.id_user ? "Cannot delete self" : "Hapus User"}><TrashIcon className="w-5 h-5" /></button>
    </div>
  ), [canUpdate, canDelete, authUser, handleOpenModal, handleDeleteClick]);

  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari user..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button onClick={() => handleOpenModal('add')} className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center disabled:opacity-50" disabled={isAddButtonDisabled} title={!canInsert(PAGE_PATH) ? "Permission denied" : (branchesForModalDropdown.length === 0 && userRoleType !== 'superuser' ? "Tidak ada cabang valid" : "Tambah User")}><PlusCircleIcon className="w-5 h-5 mr-2" />Tambah User</button>
    </div>
  ), [isAddButtonDisabled, handleOpenModal, userRoleType, branchesForModalDropdown.length, canInsert, searchTerm]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500" /></div>;
  }

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
      <TabelFiturStandar data={users} columns={columns} uniqueIdKey="id_user" renderActions={renderActions} headerActions={headerActions} title="Daftar User" />
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah User Baru' : 'Edit User'}</h2><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <input type="hidden" name="id_user" value={formData.id_user} />
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Cabang*</legend><select name="id_cabang" value={formData.id_cabang || ''} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100" disabled={isModalBranchDropdownDisabled} required><option value="">Pilih Cabang</option>{branchesForModalDropdown.map(b => (<option key={b.id_cabang} value={b.id_cabang}>{b.Nama} ({grupIdToNameMap[b.id_grup]})</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-[2px]"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Karyawan (Opsional)</legend><select name="id_karyawan" value={formData.id_karyawan || ''} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="">-- Tidak Terhubung --</option>{availableKaryawanForModal.map(k => (<option key={k.id_karyawan} value={k.id_karyawan}>{k.nama_lengkap} (ID: {k.id_karyawan})</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-[2px]"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Role*</legend><select name="id_role" value={formData.id_role} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none" required disabled={modalMode === 'edit' && currentUserToEdit?.id_role === 'superuser'}><option value="">Pilih Role</option>{availableRolesForForm.map(role => (<option key={role.id_role} value={role.id_role}>{role.Nama_role} ({role.id_cabang ? `Cabang: ${role.id_cabang}` : 'Grup'})</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-[2px]"><ChevronDownIcon className="h-4 w-4" /></div></fieldset>{availableRolesForForm.length === 0 && formData.id_cabang && (<p className="mt-1 text-xs text-red-500">Tidak ada role untuk cabang ini. Buat role terlebih dahulu.</p>)}</div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Username*</legend><input type="text" name="username" value={formData.username} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" required /></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Password*</legend><input type="password" name="password" value={formData.password || ''} onChange={handleInputChange} placeholder={modalMode === 'edit' ? 'Kosongkan jika tidak ingin mengubah' : 'Wajib diisi'} className="block w-full py-2.5 outline-none bg-transparent" required={modalMode === 'add'} /></fieldset></div>
              <div className="pt-2 flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button type="submit" disabled={isSubmitting || (modalMode==='edit' && currentUserToEdit?.id_role === 'superuser')} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan User' : 'Update User')}</button></div>
            </form>
          </div>
        </div>
      )}
      {isDeleteConfirmOpen && userToDelete && (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md"><h2 className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus</h2><p className="text-slate-600 mb-6">Anda yakin ingin menghapus user "{userToDelete.username}" (ID: {userToDelete.id_user})? Tindakan ini tidak dapat diurungkan.</p><div className="flex justify-end space-x-3"><button onClick={cancelDelete} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button></div></div>
        </div>
      )}
    </div>
  );
};

export default UserPage;