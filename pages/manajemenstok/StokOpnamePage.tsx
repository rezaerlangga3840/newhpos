// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk proses Stok Opname.
// Fungsinya mencakup memulai sesi opname baru, menginput data hasil hitungan fisik,
// menyimpan draft, men-submit hasil, hingga proses konfirmasi oleh admin yang akan menyesuaikan stok.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StokOpname, StokOpnameItem, User as UserType, Branch, Karyawan } from '../../types';
import {
  PencilSquareIcon, TrashIcon, XMarkIcon, ClipboardDocumentListIcon, PlusCircleIcon,
  ChevronRightIcon, DocumentCheckIcon, CheckCircleIcon, InformationCircleIcon, SpinnerIcon
} from '../../components/icons';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/stock-opname';

const StokOpnamePage: React.FC = () => {
  const [opnameSessions, setOpnameSessions] = useState<StokOpname[]>([]);
  const [activeOpnameSession, setActiveOpnameSession] = useState<StokOpname | null>(null);
  const [editableOpnameItems, setEditableOpnameItems] = useState<StokOpnameItem[]>([]);
  
  const [users, setUsers] = useState<UserType[]>([]);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false); // State for lazy loading
  
  const { selectedBranchId, selectedGroupId, selectableBranches, userRoleType } = useBranch();
  const { currentUser } = useAuth();
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<StokOpname | null>(null);
  
  // Date Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default last 30 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [formErrors, setFormErrors] = useState<{ nama_opname?: string; items?: Record<number, string> }>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          startDate,
          endDate
      };
      
      const [opnameData, usersData, karyawanData, branchesData] = await Promise.all([
        api.getStokOpnames(params), // This should return lightweight objects (without items)
        api.getUsers(),
        api.getKaryawan(),
        api.getBranches(),
      ]);
      setOpnameSessions(opnameData);
      setUsers(usersData);
      setKaryawanList(karyawanData);
      setBranches(branchesData);
    } catch (error) {
      console.error("Failed to load opname data:", error);
      alert("Gagal memuat data opname outlet.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, startDate, endDate]);

  useEffect(() => {
    if (isAccessDataLoaded) {
      fetchData();
    }
  }, [isAccessDataLoaded, fetchData]);

  const userDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(user => {
      const karyawan = karyawanList.find(k => k.id_karyawan === user.id_karyawan);
      map.set(user.id_user, karyawan ? karyawan.nama_lengkap : user.username);
    });
    return map;
  }, [users, karyawanList]);

  const branchesMap = useMemo(() => branches.reduce((acc, branch) => { acc[branch.id_cabang] = branch.Nama; return acc; }, {} as Record<string, string>), [branches]);

  // Sorting can still happen client-side on the smaller result set
  const sortedSessions = useMemo(() => {
     return [...opnameSessions].sort((a,b) => new Date(b.tanggal_opname_mulai).getTime() - new Date(a.tanggal_opname_mulai).getTime());
  }, [opnameSessions]);


  const handleStartNewOpname = async () => {
    if (!currentUser || !canInsert(PAGE_PATH)) { alert("Akses ditolak atau user tidak valid."); return; }
    
    let branchIdForOpname = selectedBranchId;
    if (!branchIdForOpname && selectableBranches.length === 1) {
      branchIdForOpname = selectableBranches[0].id_cabang;
    }
    if(!branchIdForOpname) { alert("Pilih satu cabang terlebih dahulu untuk memulai opname."); return; }
    
    setIsProcessing(true);
    try {
        const newSession = await api.createStokOpname(branchIdForOpname, currentUser.id_user);
        setActiveOpnameSession(newSession);
        setEditableOpnameItems(newSession.items);
        await fetchData(); // Refresh list to include the new draft
    } catch (error) {
        console.error("Failed to start new opname session:", error);
        alert("Gagal memulai sesi opname outlet baru.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleEditSession = async (sessionHeader: StokOpname) => {
    if (sessionHeader.status !== 'draft' && userRoleType !== 'administrator' && userRoleType !== 'superuser') { 
        alert("Opname sudah disubmit atau dikonfirmasi, tidak bisa diedit staff."); return; 
    }
    if (!canUpdate(PAGE_PATH)) { alert("Akses ditolak."); return; }
    
    // Lazy Load Details
    setIsDetailsLoading(true);
    try {
        const detailedSession = await api.getStokOpnameDetail(sessionHeader.id_stok_opname);
        if (detailedSession) {
             setActiveOpnameSession(deepClone(detailedSession));
             setEditableOpnameItems(deepClone(detailedSession.items));
             setFormErrors({}); 
        } else {
            alert("Gagal memuat detail sesi opname.");
        }
    } catch (error) {
         console.error("Error fetching detail:", error);
         alert("Gagal memuat detail sesi opname.");
    } finally {
        setIsDetailsLoading(false);
    }
  };
  
  const handleItemQtyFisikChange = (index: number, value: string) => {
    const newItems = [...editableOpnameItems];
    const qtyFisik = value === '' ? null : parseInt(value, 10);
    newItems[index].qty_fisik = isNaN(qtyFisik!) ? null : qtyFisik;
    newItems[index].selisih = (newItems[index].qty_fisik === null ? 0 : newItems[index].qty_fisik!) - newItems[index].qty_system;
    setEditableOpnameItems(newItems);
  };

  const handleItemStaffNoteChange = (index: number, note: string) => {
    const newItems = [...editableOpnameItems];
    newItems[index].catatan_staff_item = note;
    setEditableOpnameItems(newItems);
  };

  const handleSaveOrSubmitOpname = async (isSubmittingAction: boolean) => {
    if (!activeOpnameSession || !currentUser) return;

    setFormErrors({}); // Clear previous errors

    const newErrors: { nama_opname?: string; items?: Record<number, string> } = {};
    let hasError = false;

    // Validate session name (for both draft and submit)
    if (!activeOpnameSession.nama_opname.trim()) {
        newErrors.nama_opname = "Nama Sesi Opname wajib diisi.";
        hasError = true;
    }

    // Validate items (only for submit)
    if (isSubmittingAction) {
        const itemErrors: Record<number, string> = {};
        editableOpnameItems.forEach((item, index) => {
            if (item.qty_fisik === null) {
                itemErrors[index] = "Qty fisik harus diisi.";
                hasError = true;
            }
        });
        if (Object.keys(itemErrors).length > 0) {
            newErrors.items = itemErrors;
        }
    }
    
    if (hasError) {
        setFormErrors(newErrors);
        return; // Stop execution
    }
    
    const newStatus = isSubmittingAction ? 'submitted' : 'draft';
    const updatedSession: StokOpname = { 
        ...activeOpnameSession, 
        items: editableOpnameItems, 
        status: newStatus,
        tanggal_opname_submit: isSubmittingAction ? new Date().toISOString() : activeOpnameSession.tanggal_opname_submit,
    };
    
    setIsProcessing(true);
    try {
        await api.updateStokOpname(updatedSession.id_stok_opname, updatedSession);
        await fetchData();
        setActiveOpnameSession(null);
        setEditableOpnameItems([]);
        alert(`Sesi opname outlet berhasil di${isSubmittingAction ? 'submit' : 'simpan'}!`);
    } catch (error) {
        console.error("Failed to save/submit opname:", error);
        alert("Gagal menyimpan/submit sesi opname outlet.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCancelActiveSession = () => {
    setActiveOpnameSession(null);
    setEditableOpnameItems([]);
  };

  const handleDeleteSession = (session: StokOpname) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    if (session.status !== 'draft' && session.status !== 'cancelled') {
        alert("Hanya opname outlet dengan status 'Draft' atau 'Cancelled' yang bisa dihapus.");
        return;
    }
    setSessionToDelete(session);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
        setIsProcessing(true);
        try {
            await api.deleteStokOpname(sessionToDelete.id_stok_opname);
            await fetchData();
        } catch (error) {
            console.error("Failed to delete opname session:", error);
            alert("Gagal menghapus sesi opname outlet.");
        } finally {
            setIsProcessing(false);
        }
    }
    setIsDeleteConfirmOpen(false);
    setSessionToDelete(null);
  };
  
  const cancelDeleteSession = useCallback(() => { setIsDeleteConfirmOpen(false); setSessionToDelete(null); }, []);

  const handleAdminItemNoteChange = (itemIndex: number, note: string) => {
    const newItems = [...editableOpnameItems];
    newItems[itemIndex].catatan_admin = note;
    setEditableOpnameItems(newItems);
  };

  const handleAdminItemConfirmToggle = (itemIndex: number, isConfirmed: boolean) => {
    const newItems = [...editableOpnameItems];
    newItems[itemIndex].is_confirmed_admin = isConfirmed;
    setEditableOpnameItems(newItems);
  }
  
  const handleAdminConfirmAll = async () => { 
    if (!activeOpnameSession || activeOpnameSession.status !== 'submitted' || (userRoleType !== 'administrator' && userRoleType !== 'superuser') || !currentUser) return;
    
    const confirmedSession: StokOpname = {
      ...activeOpnameSession,
      items: editableOpnameItems, 
      status: 'confirmed',
      id_user_admin: currentUser.id_user,
      tanggal_opname_konfirmasi: new Date().toISOString()
    };
    
    setIsProcessing(true);
    try {
        await api.updateStokOpname(confirmedSession.id_stok_opname, confirmedSession);
        await fetchData();
        setActiveOpnameSession(null);
        setEditableOpnameItems([]);
        alert("Opname Outlet berhasil dikonfirmasi dan stok telah disesuaikan.");
    } catch (error) {
        console.error("Failed to confirm opname:", error);
        alert("Gagal mengonfirmasi opname outlet.");
    } finally {
        setIsProcessing(false);
    }
  };

  const columns = useMemo<ColumnDef<StokOpname>[]>(() => [
    { header: 'ID Opname', accessor: 'id_stok_opname', sortable: true },
    { header: 'Nama Opname', accessor: 'nama_opname', sortable: true, render: (s) => s.nama_opname || '-' },
    { header: 'Cabang', accessor: (s) => branchesMap[s.id_cabang] || s.id_cabang, sortable: true },
    { header: 'Tgl Mulai', accessor: 'tanggal_opname_mulai', sortable: true, render: (s) => new Date(s.tanggal_opname_mulai).toLocaleString('id-ID') },
    { header: 'Staff', accessor: (s) => userDisplayMap.get(s.id_user_staff) || s.id_user_staff, sortable: true },
    { header: 'Status', accessor: 'status', sortable: true, render: (s) => (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full shadow-sm ${
        s.status === 'draft' ? 'bg-amber-100 text-amber-700' :
        s.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
        s.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
        s.status === 'cancelled' ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-700'
      }`}>
        {s.status.toUpperCase()}
      </span>
    )},
  ], [branchesMap, userDisplayMap]);

  const renderActions = useCallback((session: StokOpname) => (
    <div className="space-x-2">
      <button 
        onClick={(e) => { e.stopPropagation(); handleEditSession(session); }} 
        className="text-sky-600 hover:text-sky-800 p-1 transition-colors" 
        title={session.status === 'draft' ? "Edit Sesi" : (session.status === 'submitted' && (userRoleType === 'administrator' || userRoleType === 'superuser') ? "Review & Konfirmasi" : "Lihat Detail")}
      >
        {(session.status === 'draft') ? <PencilSquareIcon className="w-5 h-5"/> : <ChevronRightIcon className="w-5 h-5"/>}
      </button>
      {canDelete(PAGE_PATH) && (session.status === 'draft' || session.status === 'cancelled') && 
        <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session); }} className="text-red-600 hover:text-red-800 p-1 transition-colors" title="Hapus Sesi">
          <TrashIcon className="w-5 h-5"/>
        </button>
      }
    </div>
  ), [userRoleType, canDelete, handleEditSession, handleDeleteSession]);

  const headerActions = useMemo(() => (
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
        {canInsert(PAGE_PATH) && <button onClick={handleStartNewOpname} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm flex items-center" disabled={isProcessing}><PlusCircleIcon className="w-5 h-5 mr-2"/> Mulai Opname</button>}
    </div>
  ), [canInsert, handleStartNewOpname, isProcessing, startDate, endDate]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 bg-white shadow-xl rounded-xl flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500" /></div>;
  }
  
  if (isDetailsLoading) {
     return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
             <div className="bg-white p-6 rounded-lg shadow-xl text-center">
                 <SpinnerIcon className="w-10 h-10 text-sky-500 mx-auto mb-3" />
                 <p className="text-slate-600">Memuat detail item opname...</p>
             </div>
        </div>
     )
  }

  if (activeOpnameSession) {
    const isStaffUser = currentUser?.id_user === activeOpnameSession.id_user_staff;
    const isAdminUser = userRoleType === 'administrator' || userRoleType === 'superuser';
    const canStaffEdit = (activeOpnameSession.status === 'draft') && isStaffUser && canUpdate(PAGE_PATH);
    const canAdminReview = activeOpnameSession.status === 'submitted' && isAdminUser && canUpdate(PAGE_PATH);

    const handleNamaOpnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setActiveOpnameSession(prev => prev ? {...prev, nama_opname: e.target.value} : null);
      if (formErrors.nama_opname) {
          setFormErrors(prev => ({ ...prev, nama_opname: undefined }));
      }
    };
    
    const handleMainStaffNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setActiveOpnameSession(prev => prev ? {...prev, catatan_staff: e.target.value} : null);
    };

    return (
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
        <div className="mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold text-slate-800">
              {activeOpnameSession.id_stok_opname}
            </h2>
            <p className="text-sm text-slate-500">Cabang: {branchesMap[activeOpnameSession.id_cabang] || activeOpnameSession.id_cabang} | Tanggal Mulai: {new Date(activeOpnameSession.tanggal_opname_mulai).toLocaleString('id-ID')}</p>
            <p className="text-sm text-slate-500">Staff: {userDisplayMap.get(activeOpnameSession.id_user_staff) || activeOpnameSession.id_user_staff} | Status: <span className={`font-semibold ${
                activeOpnameSession.status === 'draft' ? 'text-amber-600' :
                activeOpnameSession.status === 'submitted' ? 'text-blue-600' : 
                activeOpnameSession.status === 'confirmed' ? 'text-green-600' :
                'text-slate-600'}`}>{activeOpnameSession.status.toUpperCase()}</span></p>
        </div>

        <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="nama_opname" className="block text-sm font-medium text-slate-700 mb-1">Nama Sesi Opname*:</label>
              <input
                type="text"
                id="nama_opname"
                value={activeOpnameSession.nama_opname || ''}
                onChange={handleNamaOpnameChange}
                className={`form-input w-full py-2 px-3 border rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm disabled:bg-slate-100 ${formErrors.nama_opname ? 'border-red-500' : 'border-slate-300'}`}
                placeholder="Masukkan nama/judul untuk sesi opname ini"
                disabled={!canStaffEdit}
                required
              />
              {formErrors.nama_opname && <p className="mt-1 text-xs text-red-600">{formErrors.nama_opname}</p>}
            </div>
        </div>

        <div className="overflow-x-auto mb-6"> 
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 min-w-[200px]">Nama Stok/Varian</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-600 w-32">Qty Fisik</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-600 w-24">Selisih</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 min-w-[150px]">Catatan Staff</th>
                {(isAdminUser && (activeOpnameSession.status === 'submitted' || activeOpnameSession.status === 'confirmed')) && (
                  <>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 min-w-[150px]">Catatan Admin</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-600 w-24">Konfirmasi</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {editableOpnameItems.map((item, index) => (
                <tr key={item.id_stok_opname_item} className={item.selisih !== 0 && activeOpnameSession.status !== 'draft' ? (item.selisih < 0 ? 'bg-red-50' : 'bg-yellow-50') : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {item.nama_stok_display}
                    <span className="font-bold text-slate-600 ml-1">
                      ({item.qty_system} {item.unit_display})
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-right">
                    <div>
                        <input
                          type="number"
                          value={item.qty_fisik === null ? '' : item.qty_fisik}
                          onChange={e => handleItemQtyFisikChange(index, e.target.value)}
                          className={`form-input w-24 py-1 px-2 text-sm text-right border rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 disabled:cursor-not-allowed ${formErrors.items?.[index] ? 'border-red-500' : 'border-slate-300'}`}
                          disabled={!canStaffEdit}
                          min="0"
                        />
                        {formErrors.items?.[index] && <p className="mt-1 text-xs text-red-600 text-left">{formErrors.items[index]}</p>}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-sm text-right font-medium ${item.selisih < 0 ? 'text-red-600' : item.selisih > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{item.selisih}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.catatan_staff_item || ''}
                      onChange={e => handleItemStaffNoteChange(index, e.target.value)}
                      className="form-input w-full py-1 px-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Catatan..."
                      disabled={!canStaffEdit}
                    />
                  </td>
                  {(isAdminUser && (activeOpnameSession.status === 'submitted' || activeOpnameSession.status === 'confirmed')) && (
                    <>
                      <td className="px-3 py-2">
                        <input 
                          type="text" 
                          value={item.catatan_admin || ''}
                          onChange={(e) => handleAdminItemNoteChange(index, e.target.value)}
                          className="form-input w-full py-1 px-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100"
                          placeholder="Catatan..."
                          disabled={activeOpnameSession.status === 'confirmed'}
                        />
                      </td>
                       <td className="px-3 py-2 text-center">
                          <input 
                              type="checkbox"
                              checked={!!item.is_confirmed_admin}
                              onChange={e => handleAdminItemConfirmToggle(index, e.target.checked)}
                              className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded focus:ring-sky-500"
                              disabled={activeOpnameSession.status === 'confirmed' || item.selisih === 0}
                          />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mb-6">
          <label htmlFor="catatan_staff" className="block text-sm font-medium text-slate-700 mb-1">Catatan Staff (Global):</label>
          <textarea
            id="catatan_staff"
            value={activeOpnameSession.catatan_staff || ''}
            onChange={handleMainStaffNoteChange}
            className="form-input w-full py-2 px-3 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm disabled:bg-slate-100"
            placeholder="Catatan tambahan untuk opname ini..."
            rows={3}
            disabled={!canStaffEdit}
          />
        </div>
        
        <div className="pt-6 border-t flex justify-end space-x-3">
          {canStaffEdit && (
            <>
              <button onClick={() => handleSaveOrSubmitOpname(false)} disabled={isProcessing} className="bg-slate-500 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm">Simpan Draft</button>
              <button onClick={() => handleSaveOrSubmitOpname(true)} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm">Submit Opname</button>
            </>
          )}
          {canAdminReview && (
            <button onClick={handleAdminConfirmAll} disabled={isProcessing} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm">Konfirmasi & Selesaikan Opname</button>
          )}
           <button onClick={handleCancelActiveSession} disabled={isProcessing} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-md shadow-sm">Tutup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
      <TabelFiturStandar
        data={sortedSessions}
        columns={columns}
        uniqueIdKey="id_stok_opname"
        title="Opname Outlet"
        renderActions={renderActions}
        headerActions={headerActions}
        onRowClick={handleEditSession}
      />
      
      {isDeleteConfirmOpen && sessionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus Sesi Opname Outlet</h2>
            <p className="text-slate-600 mb-6">Yakin ingin menghapus sesi opname outlet "{sessionToDelete.nama_opname}" (ID: {sessionToDelete.id_stok_opname})?</p>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button onClick={cancelDeleteSession} disabled={isProcessing} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button onClick={confirmDeleteSession} disabled={isProcessing} className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StokOpnamePage;