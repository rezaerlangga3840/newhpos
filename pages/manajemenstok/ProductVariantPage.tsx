// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk daftar, tambah, edit, dan hapus data Varian Produk.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ProductVariant, MaterialVariant, Stok, Branch, Grup } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, ChevronDownIcon, PlusCircleIcon, InformationCircleIcon, SpinnerIcon, MagnifyingGlassIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';

const PAGE_PATH = '/stock-management/stock-overview';

interface ProductVariantPageProps {
  selectedStockForFilter?: Stok | null;
}

const ProductVariantPage: React.FC<ProductVariantPageProps> = ({ selectedStockForFilter }) => {
  // Main Data
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [stocks, setStocks] = useState<Stok[]>([]); // Parent Products Only
  const [materialVariants, setMaterialVariants] = useState<MaterialVariant[]>([]);
  
  // Reference Data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [grups, setGrups] = useState<Grup[]>([]);
  
  // Loading States
  const [isRefLoading, setIsRefLoading] = useState(true);
  const [isMainLoading, setIsMainLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { selectedBranchId, selectedGroupId, userRoleType, selectableBranches } = useBranch();
  const { currentUser } = useAuth();
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentVariantToEdit, setCurrentVariantToEdit] = useState<ProductVariant | null>(null);

  const defaultFormData: ProductVariant = {
    id_variant_product: '', id_cabang: '', id_stok_product: '', nama_variant_product: '', id_varian_detail: '', harga_jual: 0, barcode: null,
  };
  const [formData, setFormData] = useState<ProductVariant>(deepClone(defaultFormData));
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Reference Data (Branches, Grups) - Only ONCE on mount
  useEffect(() => {
    if (!isAccessDataLoaded) return;
    const fetchReferences = async () => {
        setIsRefLoading(true);
        try {
            const [branchesData, grupsData] = await Promise.all([
                api.getBranches(), // Get all for mapping names correctly even if filtered
                api.getGrups(),
            ]);
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

  // 2. Fetch Main Data (Variants, Stocks, MaterialVariants) - Triggered by Scope/Filter/Search
  const fetchMainData = useCallback(async () => {
    setIsMainLoading(true);
    try {
      const filterParams = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          search: searchTerm,
          skipHpp: true // Important: Skip expensive HPP calculation for list view
      };
      
      const stockFilterParams = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          type: 'product' // Only fetch parent products
      };
      
      // Need material variants for mapping component names in the list
      const matFilterParams = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          skipHpp: true
      };
      
      const [prodVars, allStocks, matVars] = await Promise.all([
        api.getProductVariants(filterParams),
        api.getStocks(stockFilterParams), // Only Products
        api.getMaterialVariants(matFilterParams)
      ]);
      setProductVariants(prodVars);
      setStocks(allStocks);
      setMaterialVariants(matVars);
    } catch (error) {
      console.error("Gagal memuat data:", error); alert("Gagal memuat data.");
    } finally {
      setIsMainLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);

  // Debounce search/fetch main data
  useEffect(() => { 
      if (isAccessDataLoaded) {
        const timer = setTimeout(() => {
            fetchMainData();
        }, 500);
        return () => clearTimeout(timer);
      } 
  }, [isAccessDataLoaded, fetchMainData]);

  const isLoading = isRefLoading || isMainLoading;

  // Memoized Maps
  const stockMap = useMemo(() => new Map(stocks.map(s => [`${s.id_cabang}_${s.id_stok}`, s])), [stocks]);
  const materialVariantMap = useMemo(() => new Map(materialVariants.map(mv => [`${mv.id_cabang}_${mv.id_variant_material}`, mv])), [materialVariants]);
  const branchToGrupIdMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.id_grup])), [branches]);
  const grupMap = useMemo(() => new Map(grups.map(g => [g.id_grup, g.nama_grup])), [grups]);
  
  const getMaterialVariantNamesFromIds = useCallback((idCabang: string, idVarianDetail: string): string[] => {
    if (!idVarianDetail) return [];
    return idVarianDetail.split(',').map(id => materialVariantMap.get(`${idCabang}_${id.trim()}`)?.nama_variant || id.trim());
  }, [materialVariantMap]);

  const displayedProductVariants = useMemo(() => {
    let items = [...productVariants];
    if (selectedStockForFilter) items = items.filter(v => v.id_cabang === selectedStockForFilter.id_cabang && v.id_stok_product === selectedStockForFilter.id_stok);
    return items;
  }, [productVariants, selectedStockForFilter]);
  
  const parentProductOptions = useMemo(() => {
    if (!formData.id_cabang) return [];
    return stocks.filter(s => s.id_cabang === formData.id_cabang);
  }, [formData.id_cabang, stocks]);
  
  const materialVariantsForModal = useMemo(() => {
    if (!formData.id_cabang) return [];
    return materialVariants.filter(mv => mv.id_cabang === formData.id_cabang);
  }, [formData.id_cabang, materialVariants]);

  const handleOpenModal = (mode: 'add' | 'edit', variant?: ProductVariant) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
    setModalMode(mode);
    if (mode === 'edit' && variant) {
      setCurrentVariantToEdit(variant); setFormData(deepClone(variant));
    } else {
      setCurrentVariantToEdit(null);
      let initialBranchId = selectedStockForFilter?.id_cabang || selectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : '');
      setFormData({ ...defaultFormData, id_cabang: initialBranchId, id_stok_product: selectedStockForFilter?.id_stok || '' });
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = useCallback(() => { setIsModalOpen(false); }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({...prev, [name]: (name === 'harga_jual' ? Number(value) : value)}));
  };

  const handleComponentChange = (variantId: string) => {
    setFormData(prev => {
      const currentComponents = prev.id_varian_detail ? prev.id_varian_detail.split(',') : [];
      const newComponents = currentComponents.includes(variantId)
        ? currentComponents.filter(id => id !== variantId)
        : [...currentComponents, variantId];
      return { ...prev, id_varian_detail: newComponents.join(',') };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_stok_product || !formData.id_varian_detail) {
      alert("Stok Induk dan minimal satu Komponen Varian wajib dipilih.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        const newId = `VP${Date.now()}`;
        await api.createProductVariant({ ...formData, id_variant_product: newId });
      } else if (currentVariantToEdit) {
        await api.updateProductVariant(currentVariantToEdit.id_variant_product, currentVariantToEdit.id_cabang, currentVariantToEdit.id_stok_product, formData);
      }
      await fetchMainData(); handleCloseModal();
    } catch (error) {
      console.error("Gagal menyimpan:", error); alert("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (variant: ProductVariant) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    setVariantToDelete(variant); setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (variantToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteProductVariant(variantToDelete.id_cabang, variantToDelete.id_stok_product, variantToDelete.id_variant_product);
        if (!response.success) throw new Error(response.message);
        await fetchMainData();
      } catch (error) {
        alert(`Gagal menghapus: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsSubmitting(false); setIsDeleteConfirmOpen(false); setVariantToDelete(null);
      }
    }
  };
  
  const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setVariantToDelete(null); }, []);

  const columns = useMemo<ColumnDef<ProductVariant>[]>(() => [
    { header: 'ID Varian', accessor: 'id_variant_product', sortable: true },
    { 
        header: 'Nama Grup', 
        accessor: (item) => {
            const grupId = branchToGrupIdMap.get(item.id_cabang);
            return grupId ? grupMap.get(grupId) || 'N/A' : 'N/A';
        },
        sortable: true 
    },
    { header: 'Nama Varian', accessor: 'nama_variant_product', sortable: true, render: (item) => item.nama_variant_product || '-' },
    { header: 'Parent Product', accessor: (item) => stockMap.get(`${item.id_cabang}_${item.id_stok_product}`)?.nama_stok || item.id_stok_product, sortable: true },
    { header: 'Komponen', accessor: 'id_varian_detail', render: (item) => <div className="flex flex-wrap gap-1">{getMaterialVariantNamesFromIds(item.id_cabang, item.id_varian_detail).map((name, index) => <span key={index} className="bg-sky-100 text-sky-800 text-xs px-2 py-0.5 rounded-full">{name}</span>)}</div> },
    { header: 'Harga Jual', accessor: 'harga_jual', sortable: true, render: (item) => `Rp ${item.harga_jual.toLocaleString('id-ID')}` },
    { 
        header: 'Estimasi HPP', 
        accessor: 'hpp', 
        sortable: true, 
        render: (item) => {
            // HPP is intentionally skipped for performance in list view.
            return <span className="text-slate-400 italic" title="Lihat detail/BOM untuk kalkulasi">-</span>
        } 
    },
    { 
        header: 'Estimasi Margin', 
        accessor: (item) => 0,
        sortable: false, 
        render: (item) => <span className="text-slate-400 italic">-</span>
    },
    { header: 'Barcode', accessor: 'barcode', sortable: false, render: (item) => item.barcode || '-' },
  ], [stockMap, getMaterialVariantNamesFromIds, branchToGrupIdMap, grupMap]);
  
  const renderActions = useCallback((variant: ProductVariant) => (
    <div className="space-x-1"><button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', variant); }} className={`text-sky-600 p-1 ${!canUpdate(PAGE_PATH) ? 'opacity-50' : ''}`} disabled={!canUpdate(PAGE_PATH)}><PencilSquareIcon className="w-5 h-5"/></button><button onClick={(e) => { e.stopPropagation(); handleDeleteClick(variant); }} className={`text-red-600 p-1 ${!canDelete(PAGE_PATH) ? 'opacity-50' : ''}`} disabled={!canDelete(PAGE_PATH)}><TrashIcon className="w-5 h-5"/></button></div>
  ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);

  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari varian produk..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button onClick={() => handleOpenModal('add')} className={`bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm flex items-center transition duration-150 ease-in-out transform hover:scale-105 text-sm ${!canInsert(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canInsert(PAGE_PATH)} title={!canInsert(PAGE_PATH) ? "Akses ditolak" : "Tambah Varian Produk"}>
            <PlusCircleIcon className="w-5 h-5 mr-2"/>Varian Produk
        </button>
    </div>
  ), [canInsert, handleOpenModal, searchTerm]);

  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }
  
  return (
    <div className="p-6 md:p-8">
       {selectedStockForFilter && (<div className="mb-4 p-3 bg-sky-50 border border-sky-200 text-sky-700 rounded-md text-sm flex items-center"><InformationCircleIcon className="w-5 h-5 mr-2"/>Varian ditampilkan untuk: <strong>{selectedStockForFilter.nama_stok}</strong></div>)}
       <TabelFiturStandar data={displayedProductVariants} columns={columns} uniqueIdKey="id_variant_product" headerActions={headerActions} renderActions={renderActions} title="Varian Produk" />
       
       {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Varian Produk' : 'Edit Varian Produk'}</h2><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Cabang*</legend><select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100">{selectableBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Produk Induk*</legend><select name="id_stok_product" value={formData.id_stok_product} onChange={handleInputChange} required disabled={modalMode === 'edit' || !formData.id_cabang} className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100">{!formData.id_cabang && <option>Pilih cabang dulu</option>}{parentProductOptions.map(s => <option key={s.id_stok} value={s.id_stok}>{s.nama_stok}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
               </div>
               <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nama Varian (Opsional)</legend><input type="text" name="nama_variant_product" value={formData.nama_variant_product || ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent" placeholder="Contoh: Mangga Kecil Topping Oreo"/></fieldset></div>
               
               <fieldset className="border border-slate-300 rounded-md p-3 group"><legend className="text-xs px-1">Komponen Varian*</legend>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 max-h-48 overflow-y-auto">
                        {materialVariantsForModal.map(mv => (
                            <label key={mv.id_variant_material} className="flex items-center space-x-2 text-sm">
                                <input type="checkbox" checked={(formData.id_varian_detail || '').split(',').includes(mv.id_variant_material)} onChange={() => handleComponentChange(mv.id_variant_material)} className="form-checkbox h-4 w-4 rounded" />
                                <span>{mv.nama_variant}</span>
                            </label>
                        ))}
                         {materialVariantsForModal.length === 0 && <p className="text-xs text-slate-500 col-span-full text-center">Tidak ada varian material di cabang ini.</p>}
                    </div>
               </fieldset>

                <div className="grid grid-cols-2 gap-4">
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Harga Jual (Rp)*</legend><input type="number" name="harga_jual" value={formData.harga_jual} onChange={handleInputChange} required className="block w-full py-2.5 bg-transparent"/></fieldset></div>
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Barcode</legend><input type="text" name="barcode" value={formData.barcode || ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent"/></fieldset></div>
                </div>

                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">URL Foto Varian (Opsional)</legend><input type="text" name="photo_url" value={formData.photo_url || ''} onChange={handleInputChange} className="block w-full py-2.5 bg-transparent" placeholder="Pakai foto produk jika kosong"/></fieldset></div>

               <div className="pt-2 flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan' : 'Update')}</button></div>
            </form>
          </div>
        </div>
      )}

       {isDeleteConfirmOpen && variantToDelete && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg p-6 w-full max-w-md"><h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2><p className="mb-6">Yakin ingin menghapus varian "{variantToDelete.nama_variant_product || variantToDelete.id_variant_product}"?</p><div className="flex justify-end space-x-3"><button onClick={cancelDelete} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menghapus...':'Ya, Hapus'}</button></div></div></div>)}
    </div>
  );
};

export default ProductVariantPage;