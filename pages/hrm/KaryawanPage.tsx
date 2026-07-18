import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Karyawan, Branch, Role, User, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon, PhotoIcon, XCircleIcon, LockClosedIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';

const PAGE_PATH = '/hrm/karyawan';

const KaryawanPage: React.FC = () => {
    const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [grups, setGrups] = useState<Grup[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { selectedBranchId, selectedGroupId } = useBranch();
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [currentKaryawan, setCurrentKaryawan] = useState<Karyawan | null>(null);

    const defaultFormData = {
        id_karyawan: '',
        id_grup: '',
        id_user: null,
        nama_lengkap: '', id_cabang: '', posisi: '', departemen: 'Operasional',
        tanggal_masuk: new Date().toISOString().split('T')[0],
        status_karyawan: 'aktif' as Karyawan['status_karyawan'],
        email: null, telepon: null, alamat: null, tanggal_lahir: null,
        jenis_kelamin: 'L' as Karyawan['jenis_kelamin'],
        foto_url: null, gaji_pokok: null,
        create_user_account: true, username: '', password: '', id_role: ''
    };
    const [formData, setFormData] = useState(deepClone(defaultFormData));
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [karyawanToDelete, setKaryawanToDelete] = useState<Karyawan | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getKaryawanPageData();
            setKaryawanList(data.karyawan);
            setBranches(data.branches);
            setRoles(data.roles);
            setUsers(data.users);
            setGrups(data.grups);
        } catch (error) {
            console.error("Failed to load Karyawan page data:", error);
            alert("Gagal memuat data karyawan.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAccessDataLoaded) {
            fetchData();
        }
    }, [isAccessDataLoaded, fetchData]);

    const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);
    const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);
    
    const displayedKaryawan = useMemo(() => {
        let list = [...karyawanList];
        if (selectedBranchId) {
            list = list.filter(k => k.id_cabang === selectedBranchId);
        } else if (selectedGroupId) {
            list = list.filter(k => k.id_grup === selectedGroupId);
        }
        return list;
    }, [karyawanList, selectedBranchId, selectedGroupId]);

    const { selectableBranches } = useBranch();
    const branchesForModal = selectableBranches;

    const handleOpenModal = (mode: 'add' | 'edit', karyawan?: Karyawan) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) {
            alert("Akses ditolak."); return;
        }
        setModalMode(mode);
        if (mode === 'edit' && karyawan) {
            setCurrentKaryawan(karyawan);
            setFormData({
                ...defaultFormData,
                ...deepClone(karyawan),
                create_user_account: false, // Don't show user creation on edit
            });
        } else {
            setCurrentKaryawan(null);
            const initialBranchId = selectedBranchId || (branchesForModal.length > 0 ? branchesForModal[0].id_cabang : '');
            const initialBranch = branches.find(b => b.id_cabang === initialBranchId);
            setFormData({ ...deepClone(defaultFormData), id_cabang: initialBranchId, id_grup: initialBranch?.id_grup || '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setCurrentKaryawan(null);
        setFormData(deepClone(defaultFormData));
    }, [defaultFormData]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => {
            const newState = {
                ...prev,
                [name]: type === 'checkbox' ? checked : (name === 'gaji_pokok' ? (value === '' ? null : Number(value)) : value)
            };
            if (name === 'id_cabang') {
                const branch = branches.find(b => b.id_cabang === value);
                newState.id_grup = branch ? branch.id_grup : '';
            }
            return newState;
        });
    };
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setFormData(prev => ({ ...prev, foto_url: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };
    
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let response;
            if (modalMode === 'add') {
                response = await api.createKaryawan(formData);
            } else if (currentKaryawan) {
                const branch = branches.find(b => b.id_cabang === formData.id_cabang);
                const karyawanToUpdate: Karyawan = {
                    id_karyawan: currentKaryawan.id_karyawan,
                    id_grup: branch ? branch.id_grup : currentKaryawan.id_grup,
                    id_user: currentKaryawan.id_user,
                    nama_lengkap: formData.nama_lengkap,
                    id_cabang: formData.id_cabang,
                    posisi: formData.posisi,
                    departemen: formData.departemen,
                    tanggal_masuk: formData.tanggal_masuk,
                    status_karyawan: formData.status_karyawan,
                    email: formData.email,
                    telepon: formData.telepon,
                    alamat: formData.alamat,
                    tanggal_lahir: formData.tanggal_lahir,
                    jenis_kelamin: formData.jenis_kelamin,
                    foto_url: formData.foto_url,
                    gaji_pokok: formData.gaji_pokok,
                };
                response = await api.updateKaryawan(currentKaryawan.id_karyawan, karyawanToUpdate);
            }

            if (response && response.success) {
                await fetchData();
                handleCloseModal();
            } else {
                throw new Error(response?.message || 'Gagal menyimpan data.');
            }
        } catch (error) {
            console.error("Failed to save employee:", error);
            alert(`Gagal menyimpan: ${error instanceof Error ? error.message : "Error tidak diketahui"}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteClick = (karyawan: Karyawan) => {
        if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
        setKaryawanToDelete(karyawan);
        setIsDeleteConfirmOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!karyawanToDelete) return;
        setIsSubmitting(true);
        try {
            const response = await api.deleteKaryawan(karyawanToDelete.id_karyawan);
            if (!response.success) throw new Error(response.message);
            await fetchData();
        } catch (error) {
            alert(`Gagal menghapus: ${error instanceof Error ? error.message : "Error tidak diketahui"}`);
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setKaryawanToDelete(null);
        }
    };
    
    const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setKaryawanToDelete(null); }, []);
    
    const rolesForSelectedBranch = useMemo(() => {
        const branch = branches.find(b => b.id_cabang === formData.id_cabang);
        if (!branch) return [];
        return roles.filter(r => (r.id_cabang === formData.id_cabang || r.id_cabang === null) && r.id_grup === branch.id_grup && r.role !== 'administrator');
    }, [roles, formData.id_cabang, branches]);

    const columns = useMemo<ColumnDef<Karyawan>[]>(() => [
        { header: 'ID Karyawan', accessor: 'id_karyawan', sortable: true },
        { header: 'Grup', accessor: k => grupMap.get(k.id_grup) || k.id_grup, sortable: true },
        { header: 'Cabang', accessor: k => branchMap.get(k.id_cabang) || k.id_cabang, sortable: true },
        { 
            header: 'Foto', 
            accessor: 'foto_url', 
            sortable: false, 
            render: (k) => (
                <div className="flex items-center justify-center">
                    <img 
                        src={k.foto_url || `https://i.pravatar.cc/150?u=${k.id_karyawan}`} 
                        alt={k.nama_lengkap} 
                        className="w-10 h-10 rounded-full object-cover" 
                    />
                </div>
            ) 
        },
        { header: 'Nama Lengkap', accessor: 'nama_lengkap', sortable: true },
        { header: 'Departemen', accessor: 'departemen', sortable: true },
        { header: 'Posisi', accessor: 'posisi', sortable: true },
        { 
            header: 'Tgl Masuk', 
            accessor: 'tanggal_masuk', 
            sortable: true, 
            render: (k) => new Date(k.tanggal_masuk).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        },
        { 
            header: 'Status', 
            accessor: 'status_karyawan', 
            sortable: true, 
            render: (k) => <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${k.status_karyawan === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{k.status_karyawan}</span> 
        },
    ], [branchMap, grupMap]);

    const renderActions = (karyawan: Karyawan) => (
        <div className="space-x-1">
            {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenModal('edit', karyawan)} className="p-1 text-sky-600 hover:text-sky-800" title="Edit"><PencilSquareIcon className="w-5 h-5"/></button>}
            {canDelete(PAGE_PATH) && <button onClick={() => handleDeleteClick(karyawan)} className="p-1 text-red-600 hover:text-red-800" title="Hapus"><TrashIcon className="w-5 h-5"/></button>}
        </div>
    );

    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            <TabelFiturStandar
                data={displayedKaryawan}
                columns={columns}
                uniqueIdKey="id_karyawan"
                title="Manajemen Karyawan"
                headerActions={canInsert(PAGE_PATH) ? <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center text-sm"><PlusCircleIcon className="w-5 h-5 mr-2"/>Tambah Karyawan</button> : undefined}
                renderActions={renderActions}
            />
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                         <div className="flex justify-between items-center mb-4 pb-4 border-b"><h3 className="text-xl font-semibold">{modalMode === 'add' ? 'Tambah' : 'Edit'} Karyawan</h3><button onClick={handleCloseModal}><XMarkIcon className="w-5 h-5"/></button></div>
                         <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1 space-y-2">
                                    <p className="block text-xs font-medium text-slate-500 mb-1">Foto Karyawan</p>
                                    <div className="aspect-square w-full bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                                        {formData.foto_url ? (
                                            <img src={formData.foto_url} alt="Foto Karyawan" className="w-full h-full object-cover" />
                                        ) : (
                                            <PhotoIcon className="w-16 h-16 text-slate-300" />
                                        )}
                                    </div>
                                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-center px-3 py-1.5 border border-slate-300 rounded-md shadow-sm text-xs font-medium text-slate-700 hover:bg-slate-50">
                                            Ganti Foto
                                        </button>
                                        {formData.foto_url && (
                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, foto_url: null }))} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md" title="Hapus Foto">
                                                <XCircleIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div className="relative md:col-span-2"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nama Lengkap*</legend><input type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Cabang*</legend><select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100"><option value="">Pilih Cabang</option>{branchesForModal.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Posisi*</legend><input type="text" name="posisi" value={formData.posisi} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Departemen</legend><input type="text" name="departemen" value={formData.departemen} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Tgl Masuk*</legend><input type="date" name="tanggal_masuk" value={formData.tanggal_masuk} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Email</legend><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Telepon</legend><input type="tel" name="telepon" value={formData.telepon || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Tgl Lahir</legend><input type="date" name="tanggal_lahir" value={formData.tanggal_lahir || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Jenis Kelamin</legend><select name="jenis_kelamin" value={formData.jenis_kelamin || ''} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                                    <div className="relative md:col-span-2"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Alamat</legend><textarea name="alamat" value={formData.alamat || ''} onChange={handleInputChange} rows={2} className="block w-full py-2.5 outline-none bg-transparent resize-none text-sm"/></fieldset></div>
                                    <div className="relative md:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Gaji Pokok (Rp)</legend><input type="number" name="gaji_pokok" value={formData.gaji_pokok === null ? '' : formData.gaji_pokok} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                    <div className="relative md:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Status Karyawan</legend><select name="status_karyawan" value={formData.status_karyawan} onChange={handleInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="aktif">Aktif</option><option value="tidak_aktif">Tidak Aktif</option><option value="cuti">Cuti</option><option value="resign">Resign</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                                </div>
                            </div>
                            
                             {modalMode === 'add' && (
                                <div className="border-t pt-4 mt-4 space-y-4">
                                    <p className="flex items-center space-x-2 font-medium">
                                        <LockClosedIcon className="w-5 h-5 text-slate-500"/>
                                        <span>Akun User</span>
                                    </p>
                                    <div className="pl-7">
                                        <label className="flex items-center space-x-3 text-sm">
                                            <input type="checkbox" name="create_user_account" checked={formData.create_user_account} onChange={handleInputChange} className="form-checkbox h-4 w-4 rounded text-sky-600 focus:ring-sky-500"/>
                                            <span>Buat akun user untuk karyawan ini</span>
                                        </label>
                                    </div>
                                    {formData.create_user_account && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-7">
                                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Username*</legend><input type="text" name="username" value={formData.username} onChange={handleInputChange} required={formData.create_user_account} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Password*</legend><input type="password" name="password" value={formData.password} onChange={handleInputChange} required={formData.create_user_account} className="block w-full py-2.5 outline-none bg-transparent text-sm"/></fieldset></div>
                                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Role*</legend><select name="id_role" value={formData.id_role} onChange={handleInputChange} required={formData.create_user_account} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="">Pilih Role</option>{rolesForSelectedBranch.map(r => <option key={r.id_role} value={r.id_role}>{r.Nama_role}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset>{formData.id_cabang && rolesForSelectedBranch.length === 0 && <p className="text-xs text-red-500 mt-1">Tidak ada role 'user' tersedia.</p>}</div>
                                        </div>
                                    )}
                                </div>
                             )}

                             <div className="pt-4 mt-auto border-t flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                                 <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSubmitting}>Batal</button>
                                 <button type="submit" className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center disabled:opacity-70" disabled={isSubmitting}>
                                    {isSubmitting ? <SpinnerIcon className="w-5 h-5 mr-2"/> : null}
                                    {isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Karyawan' : 'Update Karyawan')}
                                </button>
                             </div>
                         </form>
                    </div>
                </div>
            )}
             {isDeleteConfirmOpen && karyawanToDelete && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus karyawan "{karyawanToDelete.nama_lengkap}"? Akun user terkait juga akan dihapus.</p><div className="flex justify-end space-x-2"><button onClick={cancelDelete} disabled={isSubmitting} className="px-3 py-2 border rounded-md text-xs">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs flex items-center">{isSubmitting && <SpinnerIcon className="w-4 h-4 mr-2"/>}{isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button></div></div></div>)}
        </div>
    );
};

export default KaryawanPage;