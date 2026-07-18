// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan halaman Profil Pengguna.
// Fungsinya adalah untuk memungkinkan pengguna yang sedang login untuk melihat data pribadi mereka,
// mengubah informasi profil (jika terhubung dengan data karyawan), dan memperbarui username atau password akun mereka.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { Karyawan, User, Role } from '../../types';
import * as api from '../../backend/api';
import { 
    AtSymbolIcon, 
    PhoneIcon, 
    HomeIcon as AddressIcon, 
    IdentificationIcon, 
    BriefcaseIcon, 
    LockClosedIcon,
    PencilSquareIcon,
    ArrowDownTrayIcon,
    UserCircleIcon,
    SpinnerIcon
} from '../../components/icons';
import { deepClone } from '../../utils';

const ProfilePage: React.FC = () => {
    const { currentUser, login } = useAuth();
    const { selectedBranch } = useBranch();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    const [fullUser, setFullUser] = useState<User | null>(null);
    const [karyawanData, setKaryawanData] = useState<Karyawan | null>(null);
    const [userRole, setUserRole] = useState<Role | null>(null);

    const [profileData, setProfileData] = useState<Partial<Karyawan>>({});
    const [accountData, setAccountData] = useState({
        username: currentUser?.username || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const [profileMessage, setProfileMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    const [accountMessage, setAccountMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    
    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const data = await api.getProfilePageData(currentUser.id_user);
            setFullUser(data.user);
            setKaryawanData(data.karyawan);
            setProfileData(data.karyawan || {});
            
            if (data.user) {
                const allRoles = await api.getRoles();
                const role = allRoles.find(r => r.id_role === data.user.id_role && (r.id_cabang === data.user.id_cabang || r.id_cabang === '__SYSTEM__'));
                setUserRole(role || null);
            }
        } catch (error) {
            console.error("Failed to load profile data", error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);


    const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleAccountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAccountData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileMessage(null);
        if (!karyawanData) {
            setProfileMessage({ text: 'Profil hanya bisa diubah untuk user yang terhubung ke data karyawan.', type: 'error'});
            return;
        }
        
        const response = await api.updateKaryawanProfile(karyawanData.id_karyawan, profileData);
        if (response.success) {
            await fetchData(); // Re-fetch data to confirm changes
            setProfileMessage({ text: 'Profil berhasil diperbarui.', type: 'success'});
            setTimeout(() => { setProfileMessage(null); setIsEditing(false); }, 2000);
        } else {
            setProfileMessage({ text: response.message || 'Gagal memperbarui profil.', type: 'error'});
        }
    };
    
    const handleAccountSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountMessage(null);
    
        if (!fullUser || !accountData.currentPassword) {
            setAccountMessage({ text: 'Password saat ini dibutuhkan untuk menyimpan perubahan.', type: 'error' });
            return;
        }
        
        if (accountData.newPassword && accountData.newPassword !== accountData.confirmPassword) {
            setAccountMessage({ text: 'Password baru dan konfirmasi tidak cocok.', type: 'error' });
            return;
        }

        const payload = {
            userId: fullUser.id_user,
            username: accountData.username,
            currentPassword: accountData.currentPassword,
            newPassword: accountData.newPassword || undefined
        };

        const response = await api.updateUserAccount(payload);
        if (response.success) {
            setAccountMessage({ text: response.message || 'Perubahan akun berhasil disimpan.', type: 'success' });
            // Re-login to update auth context state
            await login(payload.username, payload.newPassword || payload.currentPassword);
            setAccountData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' })); 
            setTimeout(() => setAccountMessage(null), 3000);
        } else {
            setAccountMessage({ text: response.message || 'Gagal menyimpan perubahan akun.', type: 'error' });
        }
    };

    const InfoField: React.FC<{ icon: React.FC<any>, label: string, value: string | undefined | null, isEditing?: boolean, name?: string, onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, multiline?: boolean }> = ({ icon: Icon, label, value, isEditing, name, onChange, multiline }) => (
        <div className="flex items-start py-3">
            <Icon className="w-5 h-5 text-slate-400 mt-1 mr-4 flex-shrink-0" />
            <div className="flex-grow">
                <p className="text-xs text-slate-500">{label}</p>
                {isEditing && name ? (
                    multiline ? (
                         <textarea name={name} value={value || ''} onChange={onChange} rows={2} className="text-sm text-slate-800 font-medium w-full border-b border-slate-300 focus:border-sky-500 outline-none p-1 -ml-1 bg-sky-50 rounded-t-md resize-none" />
                    ) : (
                         <input type="text" name={name} value={value || ''} onChange={onChange} className="text-sm text-slate-800 font-medium w-full border-b border-slate-300 focus:border-sky-500 outline-none p-1 -ml-1 bg-sky-50 rounded-t-md" />
                    )
                ) : (
                    <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">{value || '-'}</p>
                )}
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center h-full">
                <SpinnerIcon className="w-8 h-8 text-sky-500"/>
            </div>
        );
    }
    
    if (!currentUser) {
        return <div className="p-8">Gagal memuat data user.</div>;
    }
    
    const displayName = karyawanData?.nama_lengkap || currentUser.username;
    const displayPosition = karyawanData?.posisi || userRole?.Nama_role || 'User';

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-full">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-sky-500 to-indigo-600 relative">
                        <img
                            src={karyawanData?.foto_url || `https://i.pravatar.cc/150?u=${currentUser.username}`}
                            alt="Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-white absolute -bottom-16 left-8 shadow-lg"
                        />
                    </div>
                    <div className="pt-20 px-8 pb-6 border-b border-slate-200">
                        <h1 className="text-3xl font-bold text-slate-800">{displayName}</h1>
                        <p className="text-md text-slate-500">{displayPosition}</p>
                    </div>

                    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                           <form onSubmit={handleProfileSave}>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-slate-700">Detail Profil</h2>
                                    {karyawanData && (
                                        !isEditing ? (
                                             <button type="button" onClick={() => setIsEditing(true)} className="flex items-center text-sm font-medium text-sky-600 hover:text-sky-800 p-2 rounded-lg hover:bg-sky-50 transition-colors">
                                                <PencilSquareIcon className="w-5 h-5 mr-1.5"/> Edit Profil
                                            </button>
                                        ) : (
                                            <div className="space-x-2">
                                                 <button type="button" onClick={() => {setIsEditing(false); setProfileData(karyawanData || {});}} className="text-sm font-medium text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">Batal</button>
                                                 <button type="submit" className="flex items-center text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 p-2 rounded-lg shadow-sm transition-colors">
                                                    <ArrowDownTrayIcon className="w-5 h-5 mr-1.5"/> Simpan
                                                </button>
                                            </div>
                                        )
                                    )}
                                </div>
                                {profileMessage && <div className={`mb-4 p-3 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{profileMessage.text}</div>}
                                
                                <div className="divide-y divide-slate-100">
                                    <InfoField icon={AtSymbolIcon} label="Email" value={profileData?.email} isEditing={isEditing} name="email" onChange={handleProfileInputChange} />
                                    <InfoField icon={PhoneIcon} label="Telepon" value={profileData?.telepon} isEditing={isEditing} name="telepon" onChange={handleProfileInputChange} />
                                    <InfoField icon={AddressIcon} label="Alamat" value={profileData?.alamat} isEditing={isEditing} name="alamat" onChange={handleProfileInputChange} multiline />
                                    <InfoField icon={BriefcaseIcon} label="Cabang Saat Ini" value={selectedBranch?.Nama} />
                                </div>
                           </form>
                        </div>
                        
                        <div>
                            <h2 className="text-xl font-semibold text-slate-700 mb-4">Ubah Akun</h2>
                             <form onSubmit={handleAccountSave} className="space-y-4">
                                {accountMessage && <div className={`p-3 rounded-md text-sm ${accountMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{accountMessage.text}</div>}
                                
                                <div className="relative">
                                    <UserCircleIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                                    <input type="text" name="username" value={accountData.username} onChange={handleAccountInputChange} placeholder="Username" required className="form-input w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm" />
                                </div>
                                <div className="relative">
                                    <LockClosedIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                                    <input type="password" name="currentPassword" value={accountData.currentPassword} onChange={handleAccountInputChange} placeholder="Password Saat Ini (Wajib)" className="form-input w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm" />
                                </div>
                                <div className="relative">
                                    <LockClosedIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                                    <input type="password" name="newPassword" value={accountData.newPassword} onChange={handleAccountInputChange} placeholder="Password Baru (Kosongkan jika tidak diubah)" className="form-input w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                                </div>
                                 <div className="relative">
                                    <LockClosedIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                                    <input type="password" name="confirmPassword" value={accountData.confirmPassword} onChange={handleAccountInputChange} placeholder="Konfirmasi Password Baru" className="form-input w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                                </div>
                                <button type="submit" className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-md shadow-sm transition-colors">Simpan Perubahan Akun</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;