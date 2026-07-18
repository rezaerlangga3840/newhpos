import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Branch, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon, MapPinIcon, MagnifyingGlassIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';

const PAGE_PATH = '/branch/daftar-cabang';
declare const L: any; // Declare Leaflet to avoid TypeScript errors

// --- Location Picker Modal Component ---
const LocationPickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: { address: string; lat: number; lon: number }) => void;
  initialLocation: { lat: number | null | undefined; lon: number | null | undefined; address: string };
}> = ({ isOpen, onClose, onConfirm, initialLocation }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const debounceTimeout = useRef<number | null>(null);

    const [searchQuery, setSearchQuery] = useState(initialLocation.address || '');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lon: number; address: string } | null>(
      initialLocation.lat && initialLocation.lon ? { lat: initialLocation.lat, lon: initialLocation.lon, address: initialLocation.address } : null
    );

    // Optimized: Properly cleanup map instance on unmount or close
    useEffect(() => {
        if (isOpen && mapContainerRef.current && !mapRef.current) {
            const initialView: [number, number] = selectedPosition ? [selectedPosition.lat, selectedPosition.lon] : [-7.38, 112.73]; // Default Sidoarjo
            mapRef.current = L.map(mapContainerRef.current).setView(initialView, 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

            // Add marker
            markerRef.current = L.marker(initialView, { draggable: true }).addTo(mapRef.current);
            
            // Marker drag event
            markerRef.current.on('dragend', async (event: any) => {
                const position = event.target.getLatLng();
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.lat}&lon=${position.lng}`);
                const data = await response.json();
                const address = data.display_name || 'Alamat tidak ditemukan';
                setSelectedPosition({ lat: position.lat, lon: position.lng, address });
                setSearchQuery(address);
            });
        }
        
        // CLEANUP: Always remove map instance when effect cleans up (e.g. modal closes)
        // Previous logic using !isOpen was flawed due to closure capturing the previous state.
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [isOpen]); 

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        if (searchQuery.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        debounceTimeout.current = window.setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=id&limit=5`);
                const data = await response.json();
                setSearchResults(data);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setIsSearching(false);
            }
        }, 500);
    }, [searchQuery]);
    
    const handleSelectResult = (result: any) => {
        const newPos = { lat: parseFloat(result.lat), lon: parseFloat(result.lon), address: result.display_name };
        setSelectedPosition(newPos);
        setSearchQuery(result.display_name);
        setSearchResults([]);
        if (mapRef.current && markerRef.current) {
            mapRef.current.setView([newPos.lat, newPos.lon], 16);
            markerRef.current.setLatLng([newPos.lat, newPos.lon]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center"><h2 className="text-xl font-semibold">Pilih Lokasi Pengantaran</h2><button onClick={onClose}><XMarkIcon className="w-6 h-6"/></button></div>
                <div className="p-4 space-y-2">
                    <div className="relative">
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari alamat atau nama tempat..." className="form-input w-full pl-4 pr-10 py-2 border-slate-300 rounded-md"/>
                        {isSearching && <SpinnerIcon className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin"/>}
                    </div>
                    {searchResults.length > 0 && (<ul className="bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">{searchResults.map(res => (<li key={res.place_id} onClick={() => handleSelectResult(res)} className="p-2 text-sm hover:bg-sky-50 cursor-pointer">{res.display_name}</li>))}</ul>)}
                </div>
                <div className="flex-grow p-4 pt-0"><div ref={mapContainerRef} className="h-full w-full rounded-lg z-0 min-h-[40vh]"></div></div>
                <div className="p-4 border-t flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 border rounded-md">Batal</button><button onClick={() => selectedPosition && onConfirm(selectedPosition)} disabled={!selectedPosition} className="px-4 py-2 bg-sky-600 text-white rounded-md disabled:opacity-50">Konfirmasi Lokasi</button></div>
            </div>
        </div>
    );
};


interface CabangPageProps {
  selectedGrupForFilter?: Grup | null;
}

const CabangPage: React.FC<CabangPageProps> = ({ selectedGrupForFilter }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<Omit<Branch, 'id_cabang'>>({
    id_grup: '',
    Nama: '',
    Alamat: '',
    latitude: null,
    longitude: null,
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
  const { selectedGroupId, selectedBranchId } = useBranch();

  // Optimized: Load Grups ONLY ONCE on mount, but respect context
  useEffect(() => {
    const loadGrups = async () => {
        if (isAccessDataLoaded) {
            try {
                // Pass context to prevent fetching all groups if user is restricted
                const params = {
                    branchId: selectedBranchId,
                    groupId: selectedGroupId
                };
                const grupData = await api.getGrups(params);
                setGrups(grupData);
            } catch (error) {
                console.error("Failed to fetch grups:", error);
            }
        }
    };
    loadGrups();
  }, [isAccessDataLoaded, selectedBranchId, selectedGroupId]);

  // Optimized: Fetch ONLY branches with server-side filtering
  // This reduces server load by filtering at source based on user context and search
  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
        const params: any = { search: searchTerm };
        
        // Priority 1: Specific Branch Context (Hard constraint for Branch Managers)
        if (selectedBranchId) {
            params.branchId = selectedBranchId;
        } 
        // Priority 2: User Selection Filter (Soft constraint from UI interaction)
        else if (selectedGrupForFilter) {
            params.groupId = selectedGrupForFilter.id_grup;
        }
        // Priority 3: Group Context (Medium constraint for Group Admins)
        else if (selectedGroupId) {
            params.groupId = selectedGroupId;
        }
        
        const branchData = await api.getBranches(params);
        setBranches(branchData);
    } catch (error) {
      console.error("Failed to fetch branch data:", error);
      alert("Gagal memuat data cabang. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedGrupForFilter, selectedGroupId, selectedBranchId, searchTerm]);

  // Debounce search for branches
  useEffect(() => {
    if (isAccessDataLoaded) {
        const timer = setTimeout(() => {
            fetchBranches();
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchBranches]);

  const grupIdToNameMap = useMemo(() => {
    return grups.reduce((acc, grup) => {
      acc[grup.id_grup] = grup.nama_grup;
      return acc;
    }, {} as Record<string, string>);
  }, [grups]);
  
  const handleOpenModal = useCallback((mode: 'add' | 'edit', branch?: Branch) => {
    if (mode === 'add' && !canInsert(PAGE_PATH)) {
      alert("Anda tidak memiliki izin untuk menambah cabang baru.");
      return;
    }
    if (mode === 'edit' && !canUpdate(PAGE_PATH)) {
      alert("Anda tidak memiliki izin untuk mengedit cabang.");
      return;
    }

    setModalMode(mode);
    if (mode === 'edit' && branch) {
      setCurrentBranch(branch);
      setFormData({
        id_grup: branch.id_grup,
        Nama: branch.Nama,
        Alamat: branch.Alamat,
        latitude: branch.latitude,
        longitude: branch.longitude,
      });
    } else {
      setCurrentBranch(null);
      // Auto-select group if filtered or from context
      const initialGrupId = selectedGrupForFilter?.id_grup || selectedGroupId || (grups.length > 0 ? grups[0].id_grup : '');
      setFormData({
        id_grup: initialGrupId,
        Nama: '',
        Alamat: '',
        latitude: null,
        longitude: null,
      });
    }
    setIsModalOpen(true);
  }, [canInsert, canUpdate, selectedGrupForFilter, selectedGroupId, grups]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentBranch(null);
    setFormData({ id_grup: '', Nama: '', Alamat: '', latitude: null, longitude: null });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationConfirm = (location: { address: string; lat: number; lon: number }) => {
    setFormData(prev => ({
      ...prev,
      Alamat: location.address,
      latitude: location.lat,
      longitude: location.lon,
    }));
    setIsLocationPickerOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.Nama.trim() || !formData.Alamat.trim() || !formData.id_grup) {
      alert('Nama Cabang, Alamat, dan Grup wajib diisi!');
      return;
    }
    setIsSubmitting(true);
    try {
        if (modalMode === 'add') {
          await api.createBranch(formData);
        } else if (currentBranch) {
          await api.updateBranch(currentBranch.id_cabang, formData);
        }
        await fetchBranches();
        handleCloseModal();
    } catch (error) {
        console.error("Failed to save branch:", error);
        alert("Gagal menyimpan data cabang.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClick = useCallback((branch: Branch) => {
    if (!canDelete(PAGE_PATH)) {
      alert("Anda tidak memiliki izin untuk menghapus cabang.");
      return;
    }
    setBranchToDelete(branch);
    setIsDeleteConfirmOpen(true);
  }, [canDelete]);

  const confirmDelete = async () => {
    if (branchToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteBranch(branchToDelete.id_cabang);
        if (response.success) {
          await fetchBranches();
        } else {
          alert(response.message || 'Gagal menghapus cabang.');
        }
      } catch (error) {
        console.error("Error deleting branch:", error);
        alert("Terjadi kesalahan saat menghapus cabang.");
      } finally {
        setIsSubmitting(false);
        setIsDeleteConfirmOpen(false);
        setBranchToDelete(null);
      }
    }
  };

  const cancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setBranchToDelete(null);
  }, []);

  const columns = useMemo<ColumnDef<Branch>[]>(() => [
    { header: 'ID Cabang', accessor: 'id_cabang', sortable: true },
    { header: 'Nama Grup', accessor: (branch) => grupIdToNameMap[branch.id_grup] || 'N/A', sortable: true },
    { header: 'Nama Cabang', accessor: 'Nama', sortable: true },
    { header: 'Alamat', accessor: 'Alamat', sortable: false },
  ], [grupIdToNameMap]);

  const renderActions = useCallback((branch: Branch) => (
    <div className="space-x-2">
      <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', branch); }} className={`p-1 ${!canUpdate(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : 'text-sky-600 hover:text-sky-800'}`} disabled={!canUpdate(PAGE_PATH)} title="Edit Cabang"><PencilSquareIcon className="w-5 h-5" /></button>
      <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(branch); }} className={`p-1 ${!canDelete(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`} disabled={!canDelete(PAGE_PATH)} title="Hapus Cabang"><TrashIcon className="w-5 h-5" /></button>
    </div>
  ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari cabang..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button onClick={() => handleOpenModal('add')} className={`bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center transition duration-150 ease-in-out transform hover:scale-105 ${!canInsert(PAGE_PATH) || grups.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canInsert(PAGE_PATH) || grups.length === 0} title={!canInsert(PAGE_PATH) ? "Permission denied" : (grups.length === 0 ? "Tidak ada grup untuk menambah cabang" : "Tambah Cabang")}><PlusCircleIcon className="w-5 h-5 mr-2" />Tambah Cabang</button>
    </div>
  ), [canInsert, handleOpenModal, grups, searchTerm]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 flex justify-center items-center min-h-[300px]"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }

  return (
    <div className="p-6 md:p-8">
      <TabelFiturStandar
        data={branches}
        columns={columns}
        uniqueIdKey="id_cabang"
        renderActions={renderActions}
        headerActions={headerActions}
        title="Daftar Cabang"
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40 transition-opacity duration-300" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Cabang Baru' : 'Edit Cabang'}</h2><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600" aria-label="Close modal"><XMarkIcon className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500 transition-colors duration-150"><legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600 transition-colors duration-150">Grup*</legend><select name="id_grup" value={formData.id_grup} onChange={handleInputChange} required className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none" aria-label="Grup">{grups.map(grup => (<option key={grup.id_grup} value={grup.id_grup}>{grup.nama_grup}</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4" /></div></fieldset></div>
              <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500 transition-colors duration-150"><legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600 transition-colors duration-150">Nama Cabang*</legend><input type="text" name="Nama" value={formData.Nama} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent placeholder-slate-400 text-sm" placeholder="Nama cabang" aria-label="Nama Cabang"/></fieldset></div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-500">Lokasi Pengantaran*</label>
                    <button type="button" onClick={() => setIsLocationPickerOpen(true)} className="text-sm font-medium text-sky-600 hover:text-sky-800">Pilih</button>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-full p-3 border border-slate-300 rounded-md bg-slate-50 min-h-[60px] text-sm break-words">
                        {formData.Alamat || <span className="text-slate-400">Belum diatur</span>}
                    </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3"><button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSubmitting}>Batal</button><button type="submit" className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center disabled:opacity-70" disabled={isSubmitting}>{isSubmitting ? <SpinnerIcon className="w-5 h-5 mr-2"/> : null} {isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan Cabang' : 'Update Cabang')} </button></div>
            </form>
          </div>
        </div>
      )}

      {isLocationPickerOpen && (
        <LocationPickerModal
            isOpen={isLocationPickerOpen}
            onClose={() => setIsLocationPickerOpen(false)}
            onConfirm={handleLocationConfirm}
            initialLocation={{ lat: formData.latitude, lon: formData.longitude, address: formData.Alamat }}
        />
      )}

      {isDeleteConfirmOpen && branchToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-md"><h2 className="text-xl font-semibold text-slate-800 mb-4">Konfirmasi Hapus</h2><p className="text-slate-600 mb-6">Anda yakin ingin menghapus cabang "{branchToDelete.Nama}" (ID: {branchToDelete.id_cabang})? Tindakan ini tidak dapat diurungkan.</p><div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3"><button onClick={cancelDelete} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSubmitting}>Batal</button><button onClick={confirmDelete} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex justify-center items-center disabled:opacity-70" disabled={isSubmitting}>{isSubmitting ? <SpinnerIcon className="w-5 h-5 mr-2"/> : null} {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button></div></div>
        </div>
      )}
    </div>
  );
};

export default CabangPage;