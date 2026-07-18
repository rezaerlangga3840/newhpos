// FRONTEND: Komponen ini mengelola UI khusus untuk pengaturan Titik Absensi.

import React, { useState, useMemo, useCallback } from 'react';
import { TitikAbsensi, Branch } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { deepClone } from '../../utils';
import { 
  PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, 
  LocationMarkerIcon, GlobeAltIcon, AnnotationIcon, SpinnerIcon, ClockIcon, MapPinIcon as MapPinIconSolid
} from '../../components/icons';

const PAGE_PATH = '/hrm/settings';

interface TitikAbsensiPageProps {
  titikAbsensiList: TitikAbsensi[];
  branches: Branch[];
  fetchData: () => Promise<void>;
}

const TitikAbsensiPage: React.FC<TitikAbsensiPageProps> = ({ titikAbsensiList, branches, fetchData }) => {
  const { canInsert, canUpdate, canDelete } = useAccess();
  const { selectedBranchId: globalSelectedBranchId, userRoleType, selectableBranches } = useBranch();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentTitikAbsensi, setCurrentTitikAbsensi] = useState<TitikAbsensi | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const defaultFormData: Omit<TitikAbsensi, 'id_titik_absensi'> = {
    id_cabang: '', nama_titik: '', alamat: '', latitude: 0, longitude: 0, radius: 50, aktif: true,
    wajib_di_dalam_radius: true, jam_masuk: '08:00', jam_pulang: '17:00',
  };
  const [formData, setFormData] = useState(deepClone(defaultFormData));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [titikToDelete, setTitikToDelete] = useState<TitikAbsensi | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [locationFetchMessage, setLocationFetchMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const branchesForModal = useMemo(() => {
    if (userRoleType === 'superuser' || userRoleType === 'administrator') return branches;
    return selectableBranches;
  }, [userRoleType, selectableBranches, branches]);

  const displayedTitikAbsensi = useMemo(() => {
    let list = [...titikAbsensiList];
    if (globalSelectedBranchId) {
      list = list.filter(t => t.id_cabang === globalSelectedBranchId);
    }
    if (!searchTerm) return list;
    return list.filter(t =>
      t.nama_titik.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.alamat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [titikAbsensiList, globalSelectedBranchId, searchTerm]);

  const handleOpenModal = (mode: 'add' | 'edit', titik?: TitikAbsensi) => {
    if (mode === 'add' && !canInsert(PAGE_PATH)) { alert("Akses ditolak."); return; }
    if (mode === 'edit' && !canUpdate(PAGE_PATH)) { alert("Akses ditolak."); return; }
    if (mode === 'add' && branchesForModal.length === 0) { alert("Tidak ada cabang valid untuk menambah titik absensi."); return; }
    setModalMode(mode);
    setLocationFetchMessage(null);
    if (mode === 'edit' && titik) {
      setCurrentTitikAbsensi(titik);
      setFormData(deepClone(titik));
    } else {
      setCurrentTitikAbsensi(null);
      const initialBranch = globalSelectedBranchId || (branchesForModal.length > 0 ? branchesForModal[0].id_cabang : '');
      setFormData({ ...deepClone(defaultFormData), id_cabang: initialBranch });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = useCallback(() => { setIsModalOpen(false); setLocationFetchMessage(null); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (['latitude', 'longitude', 'radius'].includes(name) ? parseFloat(value) || 0 : value),
    }));
  };
  
  const handleFetchCurrentLocation = () => {
    setIsFetchingLocation(true);
    setLocationFetchMessage({ text: "Mencari lokasi...", type: 'info' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        setLocationFetchMessage({ text: "Lokasi berhasil didapatkan!", type: 'success' });
        setIsFetchingLocation(false);
      },
      (error) => {
        setLocationFetchMessage({ text: `Gagal mendapatkan lokasi: ${error.message}`, type: 'error' });
        setIsFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.id_cabang || !formData.nama_titik.trim() || !formData.alamat.trim() || formData.radius <= 0 || !formData.jam_masuk || !formData.jam_pulang) {
      alert("Cabang, Nama Titik, Alamat, Radius (positif), dan Jam Kerja wajib diisi."); return;
    }
    setIsSubmitting(true);
    try {
      let response;
      if (modalMode === 'add') {
        response = await api.createTitikAbsensi(formData);
      } else if (currentTitikAbsensi) {
        response = await api.updateTitikAbsensi(currentTitikAbsensi.id_titik_absensi, formData as TitikAbsensi);
      }
      if (response && response.success) {
        await fetchData();
        handleCloseModal();
      } else {
        alert(response?.message || 'Gagal menyimpan data.');
      }
    } catch (error) {
      alert(`Terjadi kesalahan: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (titik: TitikAbsensi) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    setTitikToDelete(titik);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (titikToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteTitikAbsensi(titikToDelete.id_titik_absensi);
        if (response.success) {
          await fetchData();
        } else {
          alert(response.message || 'Gagal menghapus titik.');
        }
      } catch (error) {
        alert(`Terjadi kesalahan: ${error}`);
      } finally {
        setIsSubmitting(false);
        setIsDeleteConfirmOpen(false);
        setTitikToDelete(null);
      }
    }
  };
  const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setTitikToDelete(null); }, []);
  const isModalCabangDisabled = modalMode === 'edit' || (branchesForModal.length <= 1 && formData.id_cabang === branchesForModal[0]?.id_cabang);

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-slate-700 mb-3 sm:mb-0">Manajemen Titik Absensi</h3>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <input type="text" placeholder="Cari titik..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-input flex-grow sm:flex-grow-0 px-3 py-1.5 border-slate-300 rounded-md text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"/>
          {canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('add')} className={`bg-sky-600 hover:bg-sky-700 text-white font-semibold py-1.5 px-3 rounded-md text-sm shadow-sm flex items-center whitespace-nowrap ${branchesForModal.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={branchesForModal.length === 0}><PlusCircleIcon className="w-4 h-4 mr-1.5"/>Tambah Titik</button>}
        </div>
      </div>
      {displayedTitikAbsensi.length === 0 ? (
         <div className="text-center text-slate-500 py-10"><MapPinIconSolid className="w-16 h-16 mx-auto text-slate-400 mb-4" /><p>Belum ada titik absensi yang dikonfigurasi.</p>{canInsert(PAGE_PATH) && <p className="text-sm mt-2">Silakan klik "Tambah Titik" untuk memulai.</p>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedTitikAbsensi.map(titik => (
            <div key={titik.id_titik_absensi} className="bg-white rounded-xl shadow-lg p-5 border border-slate-200 hover:shadow-sky-100 transition-shadow duration-200 flex flex-col space-y-3">
              <div className="flex justify-between items-start">
                <div><h4 className="text-md font-semibold text-sky-700">{titik.nama_titik}</h4><p className="text-xs text-slate-500">{branches.find(b => b.id_cabang === titik.id_cabang)?.Nama || titik.id_cabang}</p></div>
                <div className="flex flex-col items-end space-y-1"><span className={`px-3 py-1 text-xs font-semibold rounded-full shadow-sm ${titik.aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{titik.aktif ? 'Aktif' : 'Nonaktif'}</span><span className={`px-3 py-1 text-xs font-semibold rounded-full shadow-sm ${titik.wajib_di_dalam_radius ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{titik.wajib_di_dalam_radius ? 'Wajib Radius' : 'Fleksibel'}</span></div>
              </div>
              <div className="text-sm text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
                <p className="flex items-center"><AnnotationIcon className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0"/> {titik.alamat}</p>
                <p className="flex items-center"><LocationMarkerIcon className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0"/> Lat: {titik.latitude.toFixed(5)}, Long: {titik.longitude.toFixed(5)}</p>
                <p className="flex items-center"><GlobeAltIcon className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0"/> Radius: {titik.radius} meter</p>
                <p className="flex items-center font-medium"><ClockIcon className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0"/> Jam Kerja: {titik.jam_masuk} - {titik.jam_pulang}</p>
              </div>
              <div className="mt-auto pt-3 border-t border-slate-100 flex justify-end space-x-2">
                {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenModal('edit', titik)} className="p-1.5 text-slate-500 hover:text-sky-600 rounded-md hover:bg-sky-50 transition-colors" title="Edit"><PencilSquareIcon className="w-5 h-5"/></button>}
                {canDelete(PAGE_PATH) && <button onClick={() => handleDeleteClick(titik)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors" title="Hapus"><TrashIcon className="w-5 h-5"/></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {isModalOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
        <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-lg transform transition-all duration-300 scale-100 max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200"><h3 className="text-xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Titik Absensi' : 'Edit Titik Absensi'}</h3><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1 -mr-2" aria-label="Close modal"><XMarkIcon className="w-6 h-6"/></button></div>
          <form onSubmit={handleSubmit} className="space-y-4 flex-grow overflow-y-auto pr-2 text-sm">
            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Cabang*</legend><select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required disabled={isModalCabangDisabled} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100">{branchesForModal.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Nama Titik*</legend><input type="text" name="nama_titik" value={formData.nama_titik} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
            <div className="grid grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Jam Masuk*</legend><input type="time" name="jam_masuk" value={formData.jam_masuk} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Jam Pulang*</legend><input type="time" name="jam_pulang" value={formData.jam_pulang} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div></div>
            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Alamat*</legend><textarea name="alamat" value={formData.alamat} onChange={handleInputChange} required rows={2} className="block w-full py-2.5 outline-none bg-transparent resize-none"/></fieldset></div>
            <div className="space-y-3 pt-2"><button type="button" onClick={handleFetchCurrentLocation} disabled={isFetchingLocation} className="w-full flex items-center justify-center px-4 py-2 border border-sky-500 text-sky-600 hover:bg-sky-50 rounded-md shadow-sm text-sm font-medium">{isFetchingLocation ? <SpinnerIcon className="w-5 h-5 mr-2"/> : <LocationMarkerIcon className="w-5 h-5 mr-2"/>}{isFetchingLocation ? 'Mencari...' : 'Gunakan Lokasi Saat Ini'}</button>{locationFetchMessage && <p className={`text-xs text-center p-2 rounded-md ${locationFetchMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{locationFetchMessage.text}</p>}</div>
            <div className="grid grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Latitude*</legend><input type="number" name="latitude" value={formData.latitude} onChange={handleInputChange} required step="any" className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Longitude*</legend><input type="number" name="longitude" value={formData.longitude} onChange={handleInputChange} required step="any" className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div></div>
            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Radius (meter)*</legend><input type="number" name="radius" value={formData.radius} onChange={handleInputChange} required min="1" className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
            <div className="grid grid-cols-2 gap-4 pt-1"><label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" name="aktif" className="sr-only" checked={formData.aktif} onChange={handleInputChange} /><div className={`block w-10 h-6 rounded-full transition-colors ${formData.aktif ? 'bg-sky-500' : 'bg-slate-300'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.aktif ? 'translate-x-full' : ''}`}></div></div><div className="ml-3 font-medium">Status Aktif</div></label><label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" name="wajib_di_dalam_radius" className="sr-only" checked={formData.wajib_di_dalam_radius} onChange={handleInputChange}/><div className={`block w-10 h-6 rounded-full transition-colors ${formData.wajib_di_dalam_radius ? 'bg-sky-500' : 'bg-slate-300'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.wajib_di_dalam_radius ? 'translate-x-full' : ''}`}></div></div><div className="ml-3 font-medium">Wajib Radius</div></label></div>
            <div className="pt-5 mt-auto border-t border-slate-200 flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md" disabled={isSubmitting}>Batal</button><button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md flex items-center" disabled={isSubmitting}>{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button></div>
          </form>
        </div>
      </div>)}
      {isDeleteConfirmOpen && titikToDelete && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"><h3 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus titik "{titikToDelete.nama_titik}"?</p><div className="flex justify-end space-x-3"><button onClick={cancelDelete} className="px-4 py-2 border rounded-md" disabled={isSubmitting}>Batal</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md" disabled={isSubmitting}>Ya, Hapus</button></div></div></div>)}
    </div>
  );
};

export default TitikAbsensiPage;
