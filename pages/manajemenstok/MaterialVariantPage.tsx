// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk daftar, tambah, edit, dan hapus data Varian Material.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MaterialVariant, Stok, Branch, Unit, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, ChevronDownIcon, PlusCircleIcon, InformationCircleIcon, SpinnerIcon, MagnifyingGlassIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/stock-management/stock-overview';

interface MaterialVariantPageProps {
  selectedStockForFilter?: Stok | null;
}

const MaterialVariantPage: React.FC<MaterialVariantPageProps> = ({ selectedStockForFilter }) => {
  // Main Data
  const [materialVariants, setMaterialVariants] = useState<MaterialVariant[]>([]);
  const [stocks, setStocks] = useState<Stok[]>([]); // Only Parent Stocks (Material/WIP)
  
  // Reference Data
  const [units, setUnits] = useState<Unit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  
  // Loading States
  const [isRefLoading, setIsRefLoading] = useState(true);
  const [isMainLoading, setIsMainLoading] = useState(true);
  const [isStocksLoading, setIsStocksLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { selectedBranchId, selectedGroupId, userRoleType, selectableBranches } = useBranch();
  const { currentUser } = useAuth();
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentVariantToEdit, setCurrentVariantToEdit] = useState<MaterialVariant | null>(null);

  const defaultFormData = {
    id_variant_material: '',
    id_cabang: '',
    id_stok: '', 
    nama_variant: '',
    unit: '',
    unit_netto: '' as string | null,
    netto: null as number | null,
    quantity: 0,
    stok_kritis: null as number | null,
    harga_beli: null as number | null,
    tampil_di_opname: true,
    barcode: null as string | null,
  };
  const [formData, setFormData] = useState(deepClone(defaultFormData));
  const [variantToDelete, setVariantToDelete] = useState<MaterialVariant | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Reference Data (Units, Branches, Grups) - Only ONCE on mount
  useEffect(() => {
    if (!isAccessDataLoaded) return;
    const fetchReferences = async () => {
        setIsRefLoading(true);
        try {
            const [unitsData, branchesData, grupsData] = await Promise.all([
                api.getUnits(),
                api.getBranches(), // Get all branches to map names correctly even if filtered later
                api.getGrups(),
            ]);
            setUnits(unitsData);
            setBranches(branchesData);
            setGrups(grupsData);
        } catch (error) {
            console.error("Gagal memuat data referensi:", error);
        } finally {
            setIsRefLoading(false);
        }
    };
    fetchReferences();
  }, [isAccessDataLoaded]);

  // 2. Fetch Parent Stocks (Context Dependent) - Triggered by Scope (Branch/Group) Change
  useEffect(() => {
      if (!isAccessDataLoaded) return;
      const fetchParentStocks = async () => {
          setIsStocksLoading(true);
          try {
              const stockFilterParams = {
                  branchId: selectedBranchId,
                  groupId: selectedGroupId
              };
              // Fetch only relevant parent types (Material/WIP)
              const [materials, wips] = await Promise.all([
                  api.getStocks({ ...stockFilterParams, type: 'material' }),
                  api.getStocks({ ...stockFilterParams, type: 'wip' })
              ]);
              setStocks([...materials, ...wips]);
          } catch (error) {
              console.error("Gagal memuat stok induk:", error);
          } finally {
              setIsStocksLoading(false);
          }
      };
      fetchParentStocks();
  }, [isAccessDataLoaded, selectedBranchId, selectedGroupId]);


  // 3. Fetch Variants (Search Dependent) - Triggered by Scope OR Search
  const fetchVariants = useCallback(async () => {
    setIsMainLoading(true);
    try {
      const filterParams = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          search: searchTerm // Include search in API call
      };
      
      const variantsData = await api.getMaterialVariants(filterParams);
      setMaterialVariants(variantsData);
    } catch (error) {
      console.error("Gagal memuat data varian:", error);
      alert("Gagal memuat data varian. Silakan coba lagi.");
    } finally {
      setIsMainLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);

  // Debounce search/fetch main data
  useEffect(() => {
      if (isAccessDataLoaded) {
          const timer = setTimeout(() => {
              fetchVariants();
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [isAccessDataLoaded, fetchVariants]);
  
  const isLoading = isRefLoading || isMainLoading || isStocksLoading;

  const unitMap = useMemo(() => new Map(units.map(u => [u.id_unit, u])), [units]);
  const parentStockMap = useMemo(() => new Map(stocks.map(s => [`${s.id_cabang}_${s.id_stok}`, s])), [stocks]);
  const branchToGrupIdMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.id_grup])), [branches]);
  const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);

  const displayedMaterialVariants = useMemo(() => {
    let items = [...materialVariants];
    if (selectedStockForFilter) {
      items = items.filter(v => v.id_cabang === selectedStockForFilter.id_cabang && v.id_stok === selectedStockForFilter.id_stok);
    }
    // Search is handled by API now
    return items;
  }, [materialVariants, selectedStockForFilter]);

  const parentStockOptions = useMemo(() => {
    if (!formData.id_cabang) return [];
    return stocks.filter(s => s.id_cabang === formData.id_cabang);
  }, [formData.id_cabang, stocks]);

  const derivedUnitName = useMemo(() => {
    const parentStock = parentStockMap.get(`${formData.id_cabang}_${formData.id_stok}`);
    return parentStock ? unitMap.get(parentStock.unit)?.nama_unit || '' : '';
  }, [formData.id_cabang, formData.id_stok, parentStockMap, unitMap]);

  const filteredUnitsForModal = useMemo(() => {
      if (!formData.id_cabang) return [];
      const branch = branches.find(b => b.id_cabang === formData.id_cabang);
      if (!branch) return [];
      const groupId = branch.id_grup;
      return units.filter(u => u.id_cabang === formData.id_cabang || (u.id_grup === groupId && u.id_cabang === null));
  }, [formData.id_cabang, units, branches]);

  const handleOpenModal = (mode: 'add' | 'edit', variant?: MaterialVariant) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
    setModalMode(mode);
    if (mode === 'edit' && variant) {
      setCurrentVariantToEdit(variant);
      const unitNettoName = variant.unit_netto ? unitMap.get(variant.unit_netto)?.nama_unit || '' : '';
      setFormData({ ...variant, unit_netto: unitNettoName, stok_kritis: variant.stok_kritis ?? null, harga_beli: variant.harga_beli ?? null, barcode: variant.barcode ?? null, netto: variant.netto ?? null });
    } else {
      setCurrentVariantToEdit(null);
      let initialBranchId = selectedStockForFilter?.id_cabang || selectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : '');
      let initialParentStockId = selectedStockForFilter?.id_stok || '';
      setFormData({ ...defaultFormData, id_cabang: initialBranchId, id_stok: initialParentStockId });
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = useCallback(() => { setIsModalOpen(false); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => {
        let newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
        if (name === 'id_cabang') newState.id_stok = '';
        if (['quantity', 'stok_kritis', 'harga_beli', 'netto'].includes(name)) {
             (newState as any)[name] = value === '' ? null : Number(value);
        }
        return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const parentStock = parentStockMap.get(`${formData.id_cabang}_${formData.id_stok}`);
    if (!parentStock) {
        // Fallback check if stocks not fully loaded or new
        const foundParent = stocks.find(s => s.id_cabang === formData.id_cabang && s.id_stok === formData.id_stok);
        if(!foundParent) {
            alert("Stok Induk tidak valid."); setIsSubmitting(false); return;
        }
    }
    const selectedUnitNettoObj = formData.unit_netto ? units.find(u => u.nama_unit.toLowerCase() === formData.unit_netto!.toLowerCase()) : null;
    
    // Get unit from map or fallback
    const parentUnitId = parentStock?.unit || stocks.find(s => s.id_cabang === formData.id_cabang && s.id_stok === formData.id_stok)?.unit || '';

    const itemToSubmit: Omit<MaterialVariant, 'id_variant_material'> = { 
        ...formData, 
        unit: parentUnitId,
        unit_netto: selectedUnitNettoObj ? selectedUnitNettoObj.id_unit : null,
        quantity: Number(formData.quantity), 
        stok_kritis: formData.stok_kritis ? Number(formData.stok_kritis) : null,
        harga_beli: formData.harga_beli ? Number(formData.harga_beli) : null,
    };
    try {
      if (modalMode === 'add') {
        const newId = `VM${Date.now()}`;
        await api.createMaterialVariant({...itemToSubmit, id_variant_material: newId});
      } else if (currentVariantToEdit) {
        await api.updateMaterialVariant(currentVariantToEdit.id_variant_material, {...itemToSubmit, id_variant_material: currentVariantToEdit.id_variant_material});
      }
      await fetchVariants(); // Refresh variants list
      // Note: No need to refresh stocks unless we added a new parent here, which we don't.
      handleCloseModal();
    } catch (error) {
      console.error("Gagal menyimpan varian:", error); alert("Gagal menyimpan varian.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (variant: MaterialVariant) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    setVariantToDelete(variant); setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (variantToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteMaterialVariant(variantToDelete.id_cabang, variantToDelete.id_stok, variantToDelete.id_variant_material);
        if (!response.success) throw new Error(response.message);
        await fetchVariants();
      } catch (error) {
        console.error("Gagal menghapus:", error); alert(`Gagal menghapus: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsSubmitting(false); setIsDeleteConfirmOpen(false); setVariantToDelete(null);
      }
    }
  };

  const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setVariantToDelete(null); }, []);
  
  const columns = useMemo<ColumnDef<MaterialVariant>[]>(() => [
    { header: 'ID Varian', accessor: 'id_variant_material', sortable: true },
    { 
        header: 'Nama Grup', 
        accessor: (item) => {
            const grupId = branchToGrupIdMap.get(item.id_cabang);
            return grupId ? grupMap.get(grupId) || 'N/A' : 'N/A';
        },
        sortable: true 
    },
    { header: 'Nama Varian', accessor: 'nama_variant', sortable: true },
    { header: 'Nama Stok (Parent)', accessor: (item) => parentStockMap.get(`${item.id_cabang}_${item.id_stok}`)?.nama_stok || item.id_stok, sortable: true },
    { header: 'Harga Beli', accessor: 'harga_beli', sortable: true, render: (item) => <span className="text-right w-full block">{item.harga_beli?.toLocaleString() ?? '-'}</span> },
    { header: 'Unit Beli', accessor: 'unit', sortable: true, render: (item) => unitMap.get(item.unit)?.nama_unit || item.unit },
    { header: 'Netto', accessor: 'netto', sortable: true, render: (item) => <span className="text-right w-full block">{item.netto ?? '-'}</span> },
    { header: 'Sisa Stok', accessor: 'quantity', sortable: true, render: (item) => <span className="text-right w-full block">{item.quantity}</span> },
    { header: 'Unit Netto', accessor: 'unit_netto', sortable: true, render: (item) => unitMap.get(item.unit_netto || '')?.nama_unit || '-' },
    { header: 'Barcode', accessor: 'barcode', sortable: false, render: (item) => item.barcode || '-' },
  ], [parentStockMap, unitMap, branchToGrupIdMap, grupMap]);

  const renderActions = useCallback((variant: MaterialVariant) => (
    <div className="space-x-1"><button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', variant); }} className={`text-sky-600 p-1 ${!canUpdate(PAGE_PATH) ? 'opacity-50' : ''}`} disabled={!canUpdate(PAGE_PATH)}><PencilSquareIcon className="w-5 h-5"/></button><button onClick={(e) => { e.stopPropagation(); handleDeleteClick(variant); }} className={`text-red-600 p-1 ${!canDelete(PAGE_PATH) ? 'opacity-50' : ''}`} disabled={!canDelete(PAGE_PATH)}><TrashIcon className="w-5 h-5"/></button></div>
  ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari varian..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button onClick={() => handleOpenModal('add')} className={`bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center transition duration-150 ease-in-out transform hover:scale-105 text-sm ${!canInsert(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canInsert(PAGE_PATH)} title={!canInsert(PAGE_PATH) ? "Akses ditolak" : "Tambah Varian Material"}>
            <PlusCircleIcon className="w-5 h-5 mr-2"/>Varian Material
        </button>
    </div>
  ), [canInsert, handleOpenModal, searchTerm]);
  
  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }

  return (
    <div className="p-6 md:p-8">
      {selectedStockForFilter && (<div className="mb-4 p-3 bg-sky-50 border border-sky-200 text-sky-700 rounded-md text-sm flex items-center"><InformationCircleIcon className="w-5 h-5 mr-2"/>Varian ditampilkan untuk: <strong>{selectedStockForFilter.nama_stok}</strong></div>)}
      <TabelFiturStandar data={displayedMaterialVariants} columns={columns} uniqueIdKey="id_variant_material" renderActions={renderActions} headerActions={headerActions} title="Varian Material" />
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Varian Material' : 'Edit Varian Material'}</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Cabang*</legend><select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100">{selectableBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
               <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Stok Induk*</legend><select name="id_stok" value={formData.id_stok} onChange={handleInputChange} required disabled={modalMode === 'edit' || !formData.id_cabang} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100">{!formData.id_cabang && <option>Pilih cabang dulu</option>}{parentStockOptions.map(s => <option key={s.id_stok} value={s.id_stok}>{s.nama_stok}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
               <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nama Varian*</legend><input type="text" name="nama_variant" value={formData.nama_variant} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent" /></fieldset></div>
               <div className="grid grid-cols-5 gap-4">
                   <div className="relative col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Harga Beli</legend><input type="number" name="harga_beli" value={formData.harga_beli ?? ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent" /></fieldset></div>
                   <div className="relative col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Unit Beli</legend><input type="text" name="unit" value={derivedUnitName} readOnly disabled className="block w-full py-2.5 bg-slate-100" /></fieldset></div>
                   <div className="relative col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Netto</legend><input type="number" name="netto" value={formData.netto ?? ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent" /></fieldset></div>
                   <div className="relative col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Quantity*</legend><input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent"/></fieldset></div>
                   <div className="relative col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Unit Netto</legend><input list="unit-list" name="unit_netto" value={formData.unit_netto || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent"/><datalist id="unit-list">{filteredUnitsForModal.map(u => <option key={u.id_unit} value={u.nama_unit}/>)}</datalist></fieldset></div>
               </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Stok Kritis</legend><input type="number" name="stok_kritis" value={formData.stok_kritis ?? ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent" /></fieldset></div>
                </div>
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Barcode</legend><input type="text" name="barcode" value={formData.barcode ?? ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent"/></fieldset></div>
               <div className="flex items-center"><input type="checkbox" name="tampil_di_opname" checked={formData.tampil_di_opname} onChange={handleInputChange} className="form-checkbox h-4 w-4 rounded mr-2" /><label className="text-sm">Tampilkan di Opname Outlet</label></div>
               <div className="pt-2 flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan' : 'Update')}</button></div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && variantToDelete && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg p-6 w-full max-w-md"><h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2><p className="mb-6">Yakin ingin menghapus varian "{variantToDelete.nama_variant}"?</p><div className="flex justify-end space-x-3"><button onClick={cancelDelete} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menghapus...':'Ya, Hapus'}</button></div></div></div>)}
    </div>
  );
};

export default MaterialVariantPage;