// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk daftar, tambah, edit, dan hapus data Bill of Materials (BOM).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BOMEntry, Stok, MaterialVariant, Branch, Unit, ProductVariant as ProductVariantType, BOMEntryKomponen, GroupedBom } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon, CubeIcon, WrenchScrewdriverIcon, MagnifyingGlassIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { useModuleActivation } from '../../contexts/ModuleActivationContext';

const PAGE_PATH = '/production/bom';

interface NewComponentEntry {
  tempId: number;
  komponen: BOMEntryKomponen | null;
  quantity_komponen: number;
  unit_komponen: string;
}

const BomPage: React.FC = () => {
  // Main Data (Lightweight Grouped BOMs)
  const [groupedBoms, setGroupedBoms] = useState<GroupedBom[]>([]);
  
  // Reference Data (Lazy Loaded / Filtered) - NOT loaded for list view anymore
  const [stocks, setStocks] = useState<Stok[]>([]);
  const [materialVariants, setMaterialVariants] = useState<MaterialVariant[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariantType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Specific Data for Dropdown (Candidates)
  const [bomCandidates, setBomCandidates] = useState<{parentProducts: {id: string, name: string}[], variants: {id: string, name: string, parentId: string}[]} | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentBomEntryToEdit, setCurrentBomEntryToEdit] = useState<BOMEntry | null>(null);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [bomEntryToDelete, setBomEntryToDelete] = useState<BOMEntry | null>(null);
  
  const [isAddingComponentToGroup, setIsAddingComponentToGroup] = useState(false);
  const [savingBomId, setSavingBomId] = useState<string | null>(null);

  const [newComponents, setNewComponents] = useState<NewComponentEntry[]>([]);

  const defaultFormData: Omit<BOMEntry, 'id_bom'> = {
    id_grup: '',
    id_cabang: '',
    id_stok_product: '',
    id_variant_product: null,
    komponen: { type: 'stok', id_stok: '' },
    unit_komponen: '',
    quantity_komponen: 1,
  };
  const [formData, setFormData] = useState(deepClone(defaultFormData));
  
  const { selectedBranchId, selectedGroupId, selectableBranches, userRoleType } = useBranch();
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
  const { isBomActive, isModuleDataLoaded } = useModuleActivation();

  // 1. Fetch Main List (Optimized: Server-Side Filtering & Enrichment)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          search: searchTerm
      };

      // Only fetch BOMs and basic branch/unit info. 
      // Do NOT fetch all stocks/variants for the list view.
      const [boms, unitsData, branchesData] = await Promise.all([
        api.getBoms(params),
        api.getUnits({ groupId: selectedGroupId }), 
        api.getBranches({ groupId: selectedGroupId }),
      ]);
      setGroupedBoms(boms);
      setUnits(unitsData);
      setBranches(branchesData);
    } catch (error) {
      console.error("Failed to fetch BOM data:", error);
      alert("Gagal memuat data BOM.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);

  // Debounce search
  useEffect(() => {
    if (isAccessDataLoaded) {
        const timer = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchData]);

  // 2. Fetch Reference Data for Modal (Lazy Loading)
  // Only called when modal opens or branch changes in modal
  const fetchModalData = useCallback(async (branchId: string) => {
      if (!branchId || branchId === '__SEMUA__') return;
      setIsModalLoading(true);
      try {
          const filterParams = { branchId: branchId, skipHpp: true }; // Skip HPP calc for simple listing
          const [stocksData, matVariants, prodVariants, candidates] = await Promise.all([
             api.getStocks(filterParams),
             api.getMaterialVariants(filterParams),
             api.getProductVariants(filterParams),
             api.getBomCandidateProducts(branchId) // New lightweight endpoint
          ]);
          setStocks(stocksData);
          setMaterialVariants(matVariants);
          setProductVariants(prodVariants);
          setBomCandidates(candidates);
      } catch (error) {
          console.error("Failed to load modal data", error);
      } finally {
          setIsModalLoading(false);
      }
  }, []);

  const unitMap = useMemo(() => new Map(units.map(u => [u.id_unit, u.nama_unit])), [units]);
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);
  const branchToGrupMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.id_grup])), [branches]);


  // OPTIMIZED: Use cached data from server if local reference data isn't loaded (List View)
  // Fallback to local lookup if available (Modal View / After Edit)
  const getKomponenDetails = useCallback((entry: any): { name: string; unit: string; cost: number; } => {
    // 1. Use Server-Enriched Data (Fastest, used in List View)
    if (entry._cached_name) {
        return { 
            name: entry._cached_name, 
            unit: entry._cached_unit || entry.unit_komponen, 
            cost: entry._cached_cost || 0 
        };
    }

    // 2. Fallback: Local Lookup (Only used if server didn't send cache, e.g., immediate optimistic update before refresh)
    // This logic runs only if 'stocks' are loaded
    const komponen = entry.komponen;
    if (komponen.type === 'stok') {
      const stokItem = stocks.find(s => s.id_stok === komponen.id_stok); 
      return { name: stokItem?.nama_stok || komponen.id_stok, unit: stokItem?.unit || '', cost: stokItem?.harga_beli || 0 };
    } else { // material_variant
      const variantItem = materialVariants.find(mv => mv.id_variant_material === komponen.id_variant_material);
      const parentName = stocks.find(s => s.id_stok === komponen.id_stok_material)?.nama_stok;
      const name = variantItem ? `${parentName || '?'} - ${variantItem.nama_variant}` : komponen.id_variant_material;
      
      let cost = 0;
      if (variantItem) {
          const hargaBeli = variantItem.harga_beli || 0;
          const netto = variantItem.netto;
          if (netto && netto > 0) {
              cost = hargaBeli / netto;
          } else {
              cost = hargaBeli;
          }
      }
      return { name, unit: variantItem?.unit_netto || variantItem?.unit || '', cost };
    }
  }, [stocks, materialVariants]);
  
  const displayedBomGroups = groupedBoms; // Already filtered by API

  const parentProductSelectionGroups = useMemo(() => {
    if (!formData.id_cabang || !bomCandidates) return [];
    
    const groups: { label: string; options: { value: string; label: string; }[] }[] = [];
    
    // Parent Products without variants
    if (bomCandidates.parentProducts.length > 0) {
        groups.push({
            label: "Produk Tunggal",
            options: bomCandidates.parentProducts.map(p => ({
                value: p.id,
                label: p.name
            }))
        });
    }

    // Products with variants
    // Group variants by parent ID
    const variantsByParent = new Map<string, typeof bomCandidates.variants>();
    bomCandidates.variants.forEach(v => {
        if(!variantsByParent.has(v.parentId)) variantsByParent.set(v.parentId, []);
        variantsByParent.get(v.parentId)!.push(v);
    });

    variantsByParent.forEach((variants, parentId) => {
        // Find parent name from stocks list (might need to ensure stocks are loaded for this)
        // If stocks not loaded, use ID.
        const parent = stocks.find(s => s.id_stok === parentId);
        const parentName = parent?.nama_stok || parentId;

        groups.push({
            label: parentName,
            options: variants.map(v => ({
                value: `${v.parentId}:${v.id}`,
                label: `${v.name}`
            }))
        });
    });

    return groups;
  }, [formData.id_cabang, bomCandidates, stocks]);
  
  const handleOpenModal = useCallback(async (mode: 'add' | 'edit', entry?: BOMEntry, productContext?: GroupedBom) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
    
    setModalMode(mode);
    setIsModalOpen(true);

    if (mode === 'edit' && entry) {
        await fetchModalData(entry.id_cabang); // Load refs for this branch
        setIsAddingComponentToGroup(false);
        setCurrentBomEntryToEdit(entry);
        setFormData(deepClone(entry));
        setNewComponents([]);
    } else if (mode === 'add' && productContext) {
        await fetchModalData(productContext.id_cabang); // Load refs
        setIsAddingComponentToGroup(true);
        setCurrentBomEntryToEdit(null);
        setFormData({ 
          ...deepClone(defaultFormData), 
          id_cabang: productContext.id_cabang,
          id_grup: productContext.id_grup,
          id_stok_product: productContext.id_stok_product,
          id_variant_product: productContext.id_variant_product
        });
        setNewComponents([{ tempId: Date.now(), komponen: null, quantity_komponen: 1, unit_komponen: '' }]);
    } else { // 'add' new BOM from scratch
        setIsAddingComponentToGroup(false);
        setCurrentBomEntryToEdit(null);
        const initialBranchId = selectedBranchId || (selectableBranches.length > 0 ? selectableBranches[0].id_cabang : '');
        const initialGrupId = selectedGroupId || branchToGrupMap.get(initialBranchId) || '';
        
        if (initialBranchId) {
             fetchModalData(initialBranchId);
        }

        setFormData({ ...deepClone(defaultFormData), id_cabang: initialBranchId, id_grup: initialGrupId });
        setNewComponents([{ tempId: Date.now(), komponen: null, quantity_komponen: 1, unit_komponen: '' }]);
    }
  }, [canInsert, canUpdate, selectedBranchId, selectedGroupId, selectableBranches, defaultFormData, branchToGrupMap, fetchModalData]);
  
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false); 
    setCurrentBomEntryToEdit(null); 
    setFormData(deepClone(defaultFormData));
    setIsAddingComponentToGroup(false);
    setNewComponents([]);
    setBomCandidates(null); // Clear candidates to free memory
  }, [defaultFormData]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    
    if (name === 'id_cabang') {
        const newGrupId = value === '__SEMUA__' 
            ? selectedGroupId || '' 
            : branchToGrupMap.get(value) || '';

        newFormData = {
            ...defaultFormData,
            id_cabang: value,
            id_grup: newGrupId,
        };
        // Trigger data load for the new branch
        fetchModalData(value);
        
        setNewComponents([{ tempId: Date.now(), komponen: null, quantity_komponen: 1, unit_komponen: '' }]);
    } else if (name === 'quantity_komponen') {
        newFormData.quantity_komponen = parseFloat(value) || 0;
    }
    setFormData(newFormData);
  };
  
  const handleParentProductChange = (value: string) => {
    let newStokId = '';
    let newVariantId: string | null = null;
    if (value.includes(':')) {
        const [stokId, variantId] = value.split(':');
        newStokId = stokId;
        newVariantId = variantId;
    } else {
        newStokId = value;
        newVariantId = null;
    }
    setFormData(prev => ({ ...prev, id_stok_product: newStokId, id_variant_product: newVariantId }));
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (modalMode === 'add') {
        const validComponents = newComponents.filter(c => c.komponen && c.quantity_komponen > 0);
        if (validComponents.length === 0) {
            alert("Harap tambahkan setidaknya satu komponen yang valid.");
            return;
        }
        if (!formData.id_stok_product || !formData.id_grup) {
            alert("Harap pilih Grup, Cabang, dan Produk Induk (Hasil Jadi) terlebih dahulu.");
            return;
        }
        setIsProcessing(true);
        try {
            const promises = validComponents.map(comp => {
                const payload: Omit<BOMEntry, 'id_bom'> = {
                    id_grup: formData.id_grup,
                    id_cabang: formData.id_cabang === '__SEMUA__' ? null : formData.id_cabang,
                    id_stok_product: formData.id_stok_product,
                    id_variant_product: formData.id_variant_product,
                    komponen: comp.komponen!,
                    unit_komponen: comp.unit_komponen,
                    quantity_komponen: comp.quantity_komponen
                };
                return api.createBom(payload);
            });

            const results = await Promise.all(promises);
            const failed = results.filter(r => !r.success);
            if (failed.length > 0) {
                alert(`Gagal menyimpan ${failed.length} komponen.`);
            }
            
            await fetchData();
            handleCloseModal();
        } catch (error) {
            console.error("Gagal menyimpan komponen BOM:", error);
            alert("Terjadi kesalahan saat menyimpan data.");
        } finally {
            setIsProcessing(false);
        }
        return;
    }
  };

  const handleDeleteClick = (entry: BOMEntry) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    setBomEntryToDelete(entry);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (bomEntryToDelete) {
      setIsProcessing(true);
      try {
        const response = await api.deleteBom(bomEntryToDelete.id_bom);
        if (response.success) {
          await fetchData();
        } else {
          alert(response.message || 'Gagal menghapus entri BOM.');
        }
      } catch (error) {
        console.error("Error deleting BOM entry:", error);
        alert("Terjadi kesalahan saat menghapus entri.");
      } finally {
        setIsProcessing(false);
        setIsDeleteConfirmOpen(false);
        setBomEntryToDelete(null);
      }
    }
  };

  const cancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false); setBomEntryToDelete(null);
  }, []);
  
  const modalTitle = useMemo(() => {
    if (modalMode === 'edit') return 'Edit Komponen BOM';
    if (isAddingComponentToGroup) return 'Tambah Komponen ke BOM';
    return 'Tambah BOM Baru';
  }, [modalMode, isAddingComponentToGroup]);

  const handleInlineQtyChange = (groupKey: string, bomId: string, newQuantity: number) => {
    if (newQuantity < 0) return; // Prevent negative numbers
    setGroupedBoms(prevGroups => 
        prevGroups.map(group => {
            if (group.productKey === groupKey) {
                const newComponents = group.components.map(comp => 
                    comp.id_bom === bomId ? { ...comp, quantity_komponen: newQuantity } : comp
                );
                return { ...group, components: newComponents };
            }
            return group;
        })
    );
  };

  const handleInlineSave = async (groupKey: string, bomId: string) => {
    const group = groupedBoms.find(g => g.productKey === groupKey);
    const entryToSave = group?.components.find(c => c.id_bom === bomId);

    if (!entryToSave || !canUpdate(PAGE_PATH)) return;
    
    setSavingBomId(bomId);
    try {
        // Safe destructuring of properties that shouldn't be sent back to update
        const { id_bom, id_grup, _cached_name, _cached_unit, _cached_cost, ...dataToSave } = entryToSave as any;
        const response = await api.updateBom(id_bom, dataToSave);
        if (response && response.success) {
            await fetchData(); 
        } else {
            alert(response?.message || 'Gagal menyimpan perubahan.');
            await fetchData();
        }
    } catch (error) {
        console.error("Failed to save BOM entry:", error);
        alert("Terjadi kesalahan saat menyimpan data.");
        await fetchData();
    } finally {
        setSavingBomId(null);
    }
  };

  const handleNewComponentChange = (tempId: number, field: keyof NewComponentEntry, value: any) => {
    setNewComponents(prev => prev.map(comp => {
      if (comp.tempId === tempId) {
        const newComp = { ...comp, [field]: value };
        if (field === 'komponen') {
          const [type, ...ids] = value.split(':');
          if (type === 'stok') {
            const [id_stok] = ids;
            const selectedStok = stocks.find(s => s.id_cabang === formData.id_cabang && s.id_stok === id_stok);
            newComp.komponen = { type: 'stok', id_stok };
            newComp.unit_komponen = selectedStok?.unit_netto || selectedStok?.unit || '';
          } else if (type === 'variant') {
            const [id_stok_material, id_variant_material] = ids;
            const selectedVariant = materialVariants.find(mv => mv.id_cabang === formData.id_cabang && mv.id_stok === id_stok_material && mv.id_variant_material === id_variant_material);
            newComp.komponen = { type: 'material_variant', id_stok_material, id_variant_material };
            newComp.unit_komponen = selectedVariant?.unit_netto || selectedVariant?.unit || '';
          }
        }
        return newComp;
      }
      return comp;
    }));
  };
  
  const addNewComponentRow = () => {
    setNewComponents(prev => [...prev, { tempId: Date.now(), komponen: null, quantity_komponen: 1, unit_komponen: '' }]);
  };
  
  const removeNewComponentRow = (tempId: number) => {
    setNewComponents(prev => prev.filter(c => c.tempId !== tempId));
  };
  
  if (isLoading || !isAccessDataLoaded || !isModuleDataLoaded) {
    return <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500" /></div>;
  }
  
  if (!isBomActive(selectedBranchId)) {
    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center text-center">
            <WrenchScrewdriverIcon className="w-16 h-16 text-slate-400 mb-4" />
            <h2 className="text-2xl font-bold text-slate-700">Modul Produksi (BOM) Dinonaktifkan</h2>
            <p className="text-slate-500 mt-2 max-w-md">
                Modul ini tidak aktif untuk cabang yang dipilih. Jika Anda memerlukan fitur ini, silakan hubungi administrator sistem untuk mengaktifkannya di halaman Pengaturan Modul.
            </p>
        </div>
    );
  }

  const renderHeaderActions = (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari produk..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        {canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('add')} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm flex items-center"><PlusCircleIcon className="w-5 h-5 mr-2"/>Tambah BOM Baru</button>}
    </div>
  );

  return (
    <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-slate-200">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 sm:mb-0">Bill of Materials (BOM)</h1>
        {renderHeaderActions}
      </div>
      
      {displayedBomGroups.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
            <CubeIcon className="w-16 h-16 mx-auto text-slate-300 mb-4"/>
            <p className="font-semibold">Belum ada Bill of Materials yang dibuat{searchTerm ? ' sesuai pencarian' : ''}.</p>
            {canInsert(PAGE_PATH) && !searchTerm && <p className="text-sm">Silakan klik "Tambah BOM Baru" untuk mulai merakit produk.</p>}
        </div>
      ) : (
      <div className="space-y-6">
        {displayedBomGroups.map(group => (
            <div key={group.productKey} className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 pb-3 border-b border-slate-200 gap-2">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{group.productName} {group.variantName && `- ${group.variantName}`}</h3>
                        <p className="text-xs text-slate-500 font-mono">{group.id_stok_product} {group.id_variant_product && `| ${group.id_variant_product}`}</p>
                        <p className="text-xs text-slate-500">{group.id_cabang ? branchMap.get(group.id_cabang) : 'Semua Cabang'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-slate-500 font-medium">Estimasi HPP</p>
                            <p className="font-bold text-xl text-sky-600">Rp {group.totalHpp.toLocaleString('id-ID')}</p>
                        </div>
                         {canInsert(PAGE_PATH) && <button onClick={() => handleOpenModal('add', undefined, group)} className="text-sky-600 p-2 rounded-full hover:bg-sky-100 transition-colors" title="Tambah Komponen"><PlusCircleIcon className="w-6 h-6"/></button>}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="text-left text-xs text-slate-500">
                            <tr>
                                <th className="p-2 font-medium w-2/5">Komponen</th>
                                <th className="p-2 font-medium text-right">Qty</th>
                                <th className="p-2 font-medium">Unit</th>
                                <th className="p-2 font-medium text-right">Biaya/Unit</th>
                                <th className="p-2 font-medium text-right">Subtotal Biaya</th>
                                <th className="p-2 font-medium text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {group.components.map(entry => {
                                const details = getKomponenDetails(entry);
                                const subtotal = details.cost * entry.quantity_komponen;
                                return (
                                <tr key={entry.id_bom}>
                                    <td className="p-2 text-slate-700 font-medium">{details.name}</td>
                                    <td className="p-2 text-slate-600 text-right">
                                        <div className="flex items-center justify-end">
                                            {savingBomId === entry.id_bom && <SpinnerIcon className="w-4 h-4 mr-2" />}
                                            <input
                                                type="number"
                                                value={entry.quantity_komponen}
                                                onChange={(e) => handleInlineQtyChange(group.productKey, entry.id_bom, Number(e.target.value))}
                                                onBlur={() => handleInlineSave(group.productKey, entry.id_bom)}
                                                className="form-input w-24 text-right py-1 px-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                                                disabled={!canUpdate(PAGE_PATH) || isProcessing}
                                                step="any"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-2 text-slate-600">{unitMap.get(details.unit) || details.unit}</td>
                                    <td className="p-2 text-slate-600 text-right">Rp {details.cost.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                                    <td className="p-2 text-slate-800 font-semibold text-right">Rp {subtotal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-2 text-center">
                                         <div className="flex justify-center items-center space-x-1">
                                            {canDelete(PAGE_PATH) && <button onClick={() => handleDeleteClick(entry)} className="p-1 text-slate-500 hover:text-red-600" title="Hapus"><TrashIcon className="w-4 h-4"/></button>}
                                        </div>
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        ))}
      </div>
      )}
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                    <h3 className="text-xl font-semibold text-slate-800">{modalTitle}</h3>
                    <button onClick={handleCloseModal}><XMarkIcon className="w-5 h-5"/></button>
                </div>
                
                {isModalLoading ? (
                    <div className="flex justify-center items-center h-48"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>
                ) : (
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2 space-y-4 text-sm">
                    {isAddingComponentToGroup ? (
                         <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg mb-4 space-y-2">
                            <div className="text-lg font-bold text-slate-800">
                                {stocks.find(s => s.id_stok === formData.id_stok_product)?.nama_stok}
                            </div>
                            {formData.id_variant_product && (
                                <div className="text-md font-medium text-slate-600">
                                    Varian: {productVariants.find(pv => pv.id_variant_product === formData.id_variant_product)?.nama_variant_product || formData.id_variant_product}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Cabang*</legend><select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100"><option value="" disabled>Pilih Cabang</option>{(userRoleType === 'superuser' || userRoleType === 'administrator') && <option value="__SEMUA__">Semua Cabang (Grup Ini)</option>}{selectableBranches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                            <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Produk Induk (Hasil Jadi)*</legend><select value={`${formData.id_stok_product}${formData.id_variant_product ? `:${formData.id_variant_product}` : ''}`} onChange={e => handleParentProductChange(e.target.value)} required className="block w-full py-2.5 pr-8 bg-transparent appearance-none disabled:bg-slate-100"><option value="">Pilih Produk atau Varian</option>{parentProductSelectionGroups.map(group => (<optgroup key={group.label} label={group.label}>{group.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</optgroup>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                        </div>
                    )}
                    
                    <fieldset className="border border-slate-200 rounded-md p-3 space-y-2"><legend className="text-xs px-1 font-medium text-slate-500">Tambah Komponen</legend>
                        {newComponents.map((component, index) => {
                            const selectedKomponenIds = new Set(newComponents.map(c => c.komponen ? (c.komponen.type === 'stok' ? `stok:${c.komponen.id_stok}` : `variant:${c.komponen.id_stok_material}:${c.komponen.id_variant_material}`) : '').filter(Boolean));
                            // Optimization: Check existing components from the currently viewed group if available
                            const currentGroup = groupedBoms.find(g => g.id_cabang === formData.id_cabang && g.id_stok_product === formData.id_stok_product && g.id_variant_product === formData.id_variant_product);
                            const existingComponentIds = new Set(currentGroup?.components.map(entry => {
                                if (entry.komponen.type === 'stok') return `stok:${entry.komponen.id_stok}`;
                                if (entry.komponen.type === 'material_variant') return `variant:${entry.komponen.id_stok_material}:${entry.komponen.id_variant_material}`;
                                return '';
                              }).filter(Boolean) || []
                            );

                            // Optimization: Filter stocks/variants for dropdowns inside the component loop to prevent recalculating on every render if stocks are huge
                            const singleStocks = useMemo(() => stocks.filter(stok => stok.id_cabang === formData.id_cabang && stok.type !== 'product' && !materialVariants.some(mv => mv.id_stok === stok.id_stok && mv.id_cabang === stok.id_cabang)), [stocks, materialVariants, formData.id_cabang]);
                            const variantStocksGrouped = useMemo(() => stocks.filter(stok => stok.id_cabang === formData.id_cabang && (stok.type === 'material' || stok.type === 'wip')).map(parentStok => ({ parent: parentStok, variants: materialVariants.filter(mv => mv.id_stok === parentStok.id_stok && mv.id_cabang === parentStok.id_cabang) })).filter(group => group.variants.length > 0), [stocks, materialVariants, formData.id_cabang]);
                            
                            const selectedValue = component.komponen ? (component.komponen.type === 'stok' ? `stok:${component.komponen.id_stok}` : `variant:${component.komponen.id_stok_material}:${component.komponen.id_variant_material}`) : '';

                            return (
                                <div key={component.tempId} className="grid grid-cols-12 gap-2 p-3 border rounded-lg bg-slate-50">
                                    <div className="col-span-6"><select value={selectedValue} onChange={e => handleNewComponentChange(component.tempId, 'komponen', e.target.value)} className="form-select w-full py-1.5"><option value="">Pilih Komponen</option>{singleStocks.map(s => { const val = `stok:${s.id_stok}`; return (<option key={val} value={val} disabled={selectedKomponenIds.has(val) || existingComponentIds.has(val)}>{s.nama_stok}</option>)})}{variantStocksGrouped.map(group => (<optgroup key={group.parent.id_stok} label={group.parent.nama_stok}>{group.variants.map(v => {const val = `variant:${group.parent.id_stok}:${v.id_variant_material}`; return (<option key={val} value={val} disabled={selectedKomponenIds.has(val) || existingComponentIds.has(val)}>{v.nama_variant}</option>)})}</optgroup>))}</select></div>
                                    <div className="col-span-3"><input type="number" value={component.quantity_komponen} onChange={e => handleNewComponentChange(component.tempId, 'quantity_komponen', Number(e.target.value))} min="0.001" step="any" className="form-input w-full py-1.5 text-right" /></div>
                                    <div className="col-span-2"><input type="text" value={unitMap.get(component.unit_komponen) || ''} readOnly disabled className="form-input w-full py-1.5 bg-slate-200" /></div>
                                    <div className="col-span-1 flex items-center justify-center"><button type="button" onClick={() => removeNewComponentRow(component.tempId)} disabled={newComponents.length <= 1} className="p-1 text-red-500 disabled:opacity-30"><TrashIcon className="w-5 h-5"/></button></div>
                                </div>
                            )
                        })}
                        <button type="button" onClick={addNewComponentRow} className="text-sky-600 font-semibold text-sm flex items-center p-1 hover:bg-sky-50 rounded-md"><PlusCircleIcon className="w-5 h-5 mr-1"/>Tambah Komponen Lain</button>
                    </fieldset>
                    <div className="pt-4 mt-auto border-t flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} className="px-4 py-2 border rounded-md" disabled={isProcessing}>Batal</button><button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md flex items-center" disabled={isProcessing}>{isProcessing && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isProcessing ? 'Menyimpan...' : 'Simpan'}</button></div>
                </form>
                )}
            </div>
        </div>
      )}
      
      {isDeleteConfirmOpen && bomEntryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2>
                <p className="text-slate-600 mb-6">Yakin ingin menghapus komponen ini dari BOM?</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={cancelDelete} disabled={isProcessing} className="px-4 py-2 border rounded-md">Batal</button>
                    <button onClick={confirmDelete} disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center">
                        {isProcessing && <SpinnerIcon className="w-5 h-5 mr-2"/>}
                        {isProcessing ? 'Menghapus...' : 'Ya, Hapus'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BomPage;