// FRONTEND: Komponen ini mengelola antarmuka pengguna (UI) untuk daftar, tambah, edit, dan hapus data Stok Induk.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Stok, Unit, Branch, ProductVariant, MaterialVariant } from '../../types';
import { PencilSquareIcon, TrashIcon, XMarkIcon, PackageIcon, PhotoIcon, XCircleIcon, ChevronDownIcon, PlusCircleIcon, SpinnerIcon, MagnifyingGlassIcon } from '../../components/icons';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/stock-management/stock-overview';

interface StockPageProps {
  onRowClick?: (item: Stok) => void;
  activeItem?: Stok | null;
}


const StockPage: React.FC<StockPageProps> = ({ onRowClick, activeItem }) => {
  // Main Data
  const [stockItems, setStockItems] = useState<Stok[]>([]);
  
  // Reference Data
  const [units, setUnits] = useState<Unit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Varian hanya diload untuk kebutuhan validasi/modal, dan difilter sesuai scope
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [materialVariants, setMaterialVariants] = useState<MaterialVariant[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { selectedBranchId, selectedGroupId, userRoleType } = useBranch();
  const { currentUser } = useAuth();
  const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentItemToEdit, setCurrentItemToEdit] = useState<Stok | null>(null);

  const defaultFormData: Omit<Stok, 'unit' | 'type'> & { unit: string; type: Stok['type'] | ''; kategori?: string; unit_netto?: string; } = {
    id_stok: '',
    id_cabang: '',
    type: '',
    nama_stok: '',
    kategori: '',
    unit: '',
    unit_netto: '',
    netto: null,
    quantity: null,
    stok_kritis: null,
    harga: null,
    harga_beli: null,
    photo_url: null,
    tampil_di_opname: true,
    barcode: '',
  };
  const [formData, setFormData] = useState(deepClone(defaultFormData));
  const [generatedStokIdDisplay, setGeneratedStokIdDisplay] = useState<string>('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<Stok | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Reference Data (Units, Branches) - Only on Mount
  useEffect(() => {
    if (!isAccessDataLoaded) return;
    const fetchReferences = async () => {
        try {
            const [unitData, branchData] = await Promise.all([
                api.getUnits(),
                api.getBranches(),
            ]);
            setUnits(unitData);
            setBranches(branchData);
        } catch (e) {
            console.error("Failed to load refs", e);
        }
    };
    fetchReferences();
  }, [isAccessDataLoaded]);

  // 2. Fetch Main Data (Stocks & Variants) - Based on Scope/Filter
  const fetchMainData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterParams = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          search: searchTerm
      };
      
      const filterParamsForVariants = {
          branchId: selectedBranchId,
          groupId: selectedGroupId,
          // Optimization: Skip HPP calculation for variants when just checking existence
          skipHpp: true
      };

      const [stockData, prodVariantData, matVariantData] = await Promise.all([
        api.getStocks(filterParams),
        api.getProductVariants(filterParamsForVariants),
        api.getMaterialVariants(filterParamsForVariants)
      ]);
      
      setStockItems(stockData);
      setProductVariants(prodVariantData);
      setMaterialVariants(matVariantData);
    } catch (error) {
      console.error("Gagal memuat data stok:", error);
      alert("Gagal memuat data. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, selectedGroupId, searchTerm]);

  // Debounce search
  useEffect(() => {
    if (isAccessDataLoaded) {
        const timer = setTimeout(() => {
            fetchMainData();
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [isAccessDataLoaded, fetchMainData]);

  const unitMap = useMemo(() => new Map(units.map(u => [u.id_unit, u])), [units]);
  
  // Data is already filtered by API
  const displayedStockItems = stockItems;

  const branchesForModalDropdown = useMemo(() => {
    let availableBranches = [...branches];
    if (userRoleType === 'other' && currentUser?.id_cabang) {
      availableBranches = availableBranches.filter(b => b.id_cabang === currentUser.id_cabang);
    }
    return availableBranches;
  }, [branches, userRoleType, currentUser]);

  const generateNewStokId = useCallback((idCabang: string, type: Stok['type']) => {
    if (!idCabang || !type) return '';
    const prefix = type === 'product' ? 'P' : type === 'material' ? 'M' : 'W';
    // Mitigation: We scan the full `stockItems` list which contains all items for this branch.
    const itemsInBranchAndType = stockItems.filter(item => item.id_cabang === idCabang && item.type === type);
    let maxIdNum = 0;
    itemsInBranchAndType.forEach(item => {
      const match = item.id_stok.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      if (match) maxIdNum = Math.max(maxIdNum, parseInt(match[1]));
    });
    return `${prefix}${maxIdNum + 1}`;
  }, [stockItems]);

  // Optimized: Create Sets for O(1) variant lookup
  const productParentIds = useMemo(() => new Set(productVariants.map(v => v.id_stok_product)), [productVariants]);
  const materialParentIds = useMemo(() => new Set(materialVariants.map(v => v.id_stok)), [materialVariants]);
  
  const hasVariants = useCallback((item: Stok): boolean => {
    if (item.type === 'product') {
        return productParentIds.has(item.id_stok);
    }
    if (item.type === 'material' || item.type === 'wip') {
        return materialParentIds.has(item.id_stok);
    }
    return false;
  }, [productParentIds, materialParentIds]);
  
  const handleOpenModal = (mode: 'add' | 'edit', item?: Stok) => {
    if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) {
      alert("Akses ditolak."); return;
    }
    setModalMode(mode);
    if (mode === 'edit' && item) {
      setCurrentItemToEdit(item);
      const unitName = unitMap.get(item.unit)?.nama_unit || item.unit;
      const unitNettoName = item.unit_netto ? unitMap.get(item.unit_netto)?.nama_unit || item.unit_netto : '';
      setFormData({...deepClone(item), unit: unitName, unit_netto: unitNettoName, type: item.type as Stok['type'] | ''});
      setGeneratedStokIdDisplay(item.id_stok);
    } else {
      setCurrentItemToEdit(null);
      const initialBranchId = selectedBranchId || (branchesForModalDropdown.length > 0 ? branchesForModalDropdown[0].id_cabang : '');
      setFormData({...deepClone(defaultFormData), id_cabang: initialBranchId });
      setGeneratedStokIdDisplay('');
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentItemToEdit(null);
    setFormData(deepClone(defaultFormData));
    setGeneratedStokIdDisplay('');
  }, [defaultFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type: inputType, checked } = e.target as HTMLInputElement;
    setFormData(prev => {
        let newFormData = { ...prev };
        if (inputType === 'checkbox') newFormData = { ...newFormData, [name]: checked };
        else if (['quantity', 'stok_kritis', 'harga', 'harga_beli', 'netto'].includes(name)) newFormData = { ...newFormData, [name]: value === '' ? null : parseFloat(value) };
        else newFormData = { ...newFormData, [name]: value };
        
        if (modalMode === 'add' && (name === 'id_cabang' || name === 'type')) {
            const idCabang = name === 'id_cabang' ? value : newFormData.id_cabang;
            const type = name === 'type' ? value as Stok['type'] | '' : newFormData.type;
            const newId = (idCabang && type) ? generateNewStokId(idCabang, type as Stok['type']) : '';
            newFormData.id_stok = newId;
            setGeneratedStokIdDisplay(newId);
        }
        return newFormData;
    });
  };

  const hasVariantsInModal = useMemo(() => {
    if (modalMode === 'edit' && currentItemToEdit) {
      return hasVariants(currentItemToEdit);
    }
    return false;
  }, [modalMode, currentItemToEdit, hasVariants]);

  const isQuantityDisabled = useMemo(() => {
    // If it has variants or if we are just creating it and expect variants later (user choice)
    return hasVariantsInModal;
  }, [hasVariantsInModal]);


  const filteredUnitsForModal = useMemo(() => {
      if (!formData.id_cabang) return [];
      const branch = branches.find(b => b.id_cabang === formData.id_cabang);
      if (!branch) return [];
      const groupId = branch.id_grup;
      return units.filter(u => u.id_cabang === formData.id_cabang || (u.id_grup === groupId && u.id_cabang === null));
  }, [formData.id_cabang, units, branches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const selectedUnitObj = units.find(u => u.nama_unit.toLowerCase() === formData.unit.toLowerCase());
    const selectedUnitNettoObj = formData.unit_netto ? units.find(u => u.nama_unit.toLowerCase() === formData.unit_netto!.toLowerCase()) : null;

    if (!selectedUnitObj) {
      alert("Unit Beli tidak valid."); setIsSubmitting(false); return;
    }
    
    const itemToSubmit: Stok = {
      ...formData,
      id_stok: generatedStokIdDisplay,
      type: formData.type as Stok['type'],
      unit: selectedUnitObj.id_unit,
      unit_netto: selectedUnitNettoObj ? selectedUnitNettoObj.id_unit : null,
      barcode: hasVariantsInModal ? null : formData.barcode,
    };

    try {
      if (modalMode === 'add') {
        await api.createStok(itemToSubmit);
      } else if (currentItemToEdit) {
        await api.updateStok(currentItemToEdit.id_stok, currentItemToEdit.id_cabang, itemToSubmit);
      }
      await fetchMainData();
      handleCloseModal();
    } catch (error) {
      console.error("Gagal menyimpan stok:", error);
      alert("Gagal menyimpan data stok.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (item: Stok) => {
    if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; }
    setItemToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      setIsSubmitting(true);
      try {
        const response = await api.deleteStok(itemToDelete.id_stok, itemToDelete.id_cabang);
        if (!response.success) throw new Error(response.message);
        await fetchMainData();
      } catch (error) {
        console.error("Gagal menghapus stok:", error);
        alert(`Gagal menghapus stok: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsSubmitting(false);
        setIsDeleteConfirmOpen(false);
        setItemToDelete(null);
      }
    }
  };
  
  const cancelDelete = useCallback(() => { setIsDeleteConfirmOpen(false); setItemToDelete(null); }, []);
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };
  
  const headerActions = useMemo(() => (
    <div className="flex space-x-3 items-center">
        <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
                type="text" 
                placeholder="Cari stok..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-9 pr-4 py-2 text-sm border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
        <button onClick={() => handleOpenModal('add')} className={`w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-150 ease-in-out transform hover:scale-105 flex items-center ${!canInsert(PAGE_PATH) || branchesForModalDropdown.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canInsert(PAGE_PATH) || branchesForModalDropdown.length === 0} title={!canInsert(PAGE_PATH) ? "Permission denied" : (branchesForModalDropdown.length === 0 ? "Tidak ada cabang" : "Stok Induk")}><PlusCircleIcon className="w-5 h-5 mr-2" />Stok Induk</button>
    </div>
  ), [canInsert, branchesForModalDropdown, handleOpenModal, searchTerm]);

  const columns = useMemo<ColumnDef<Stok>[]>(() => [
    { header: 'ID Stok', accessor: 'id_stok', sortable: true },
    { header: 'Tipe', accessor: 'type', sortable: true, render: (item) => <span className="capitalize">{item.type}</span> },
    { header: 'Nama Stok', accessor: 'nama_stok', sortable: true },
    { header: 'Harga Beli', accessor: 'harga_beli', sortable: true, render: (item) => hasVariants(item) ? <span className="text-center w-full block">-</span> : <span className="text-right w-full block">{item.harga_beli?.toLocaleString() ?? '-'}</span>},
    { header: 'Unit Beli', accessor: 'unit', sortable: true, render: (item) => hasVariants(item) ? <span className="text-center w-full block">-</span> : (unitMap.get(item.unit)?.nama_unit || item.unit) },
    { header: 'Netto', accessor: 'netto', sortable: true, render: (item) => hasVariants(item) ? <span className="text-center w-full block">-</span> : <span className="text-right w-full block">{item.netto ?? '-'}</span> },
    { header: 'Sisa Stok', accessor: 'quantity', sortable: true, render: (item) => {
        const isCritical = item.stok_kritis !== null && item.quantity !== null && item.quantity < item.stok_kritis;
        return hasVariants(item) ? <span className="text-center w-full block">-</span> : <span className={`text-right w-full block ${isCritical ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.quantity ?? '-'}</span>
      },
    },
    { header: 'Unit Netto', accessor: 'unit_netto', sortable: true, render: (item) => hasVariants(item) ? <span className="text-center w-full block">-</span> : unitMap.get(item.unit_netto || '')?.nama_unit || '-' },
    { header: 'Harga Jual', accessor: 'harga', sortable: true, render: (item) => hasVariants(item) ? <span className="text-center w-full block">-</span> : <span className="text-right w-full block">{item.harga?.toLocaleString() ?? '-'}</span>},
    { header: 'Barcode', accessor: 'barcode', sortable: false, render: (item) => hasVariants(item) ? <span className="text-center w-full block">-</span> : item.barcode || '-' },
    { header: 'Opname', accessor: 'tampil_di_opname', sortable: true, render: (item) => hasVariants(item) ? <div className="text-center">-</div> : <div className="text-center"><span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full shadow-sm ${item.tampil_di_opname ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.tampil_di_opname ? 'Ya' : 'Tidak'}</span></div> },
  ], [unitMap, hasVariants]);

  const renderActions = useCallback((item: Stok) => (
    <div className="space-x-1"><button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', item); }} className={`text-sky-600 hover:text-sky-800 p-1 ${!canUpdate(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canUpdate(PAGE_PATH)} title="Edit Stok"><PencilSquareIcon className="w-5 h-5" /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }} className={`text-red-600 hover:text-red-800 p-1 ${!canDelete(PAGE_PATH) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!canDelete(PAGE_PATH)} title="Hapus Stok"><TrashIcon className="w-5 h-5" /></button></div>
  ), [canUpdate, canDelete, handleOpenModal, handleDeleteClick]);


  if (isLoading || !isAccessDataLoaded) {
    return <div className="p-6 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
  }
  
  return (
    <div className="p-6 md:p-8">
      <TabelFiturStandar data={displayedStockItems} columns={columns} uniqueIdKey={(item) => `${item.id_cabang}-${item.id_stok}`} renderActions={renderActions} headerActions={headerActions} title="Stok Induk" onRowClick={onRowClick} activeItem={activeItem} />
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-semibold text-slate-800">{modalMode === 'add' ? 'Tambah Stok Baru' : 'Edit Stok'}</h2><button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-6 h-6" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Cabang*</legend><select name="id_cabang" value={formData.id_cabang} onChange={handleInputChange} required disabled={modalMode==='edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100">{branchesForModalDropdown.map(b => (<option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>))}</select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Tipe Stok*</legend><select name="type" value={formData.type} onChange={handleInputChange} required disabled={modalMode === 'edit'} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none disabled:bg-slate-100"><option value="" disabled>Pilih Tipe</option><option value="material">Material</option><option value="wip">WIP</option><option value="product">Product</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 top-1/2 -translate-y-1/2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Nama Stok*</legend><input type="text" name="nama_stok" value={formData.nama_stok} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Kategori</legend><input type="text" name="kategori" value={formData.kategori || ''} onChange={handleInputChange} placeholder="e.g., Minuman Dingin" className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="relative sm:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Harga Beli</legend><input type="number" name="harga_beli" value={formData.harga_beli ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., 8000" step="any" disabled={formData.type === 'product'}/></fieldset></div>
                <div className="relative sm:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Unit Beli*</legend><input list="unit-list" name="unit" value={formData.unit} onChange={handleInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/><datalist id="unit-list">{filteredUnitsForModal.map(u => <option key={u.id_unit} value={u.nama_unit}/>)}</datalist></fieldset></div>
                <div className="relative sm:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Netto</legend><input type="number" name="netto" value={formData.netto ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" step="any"/></fieldset></div>
                <div className="relative sm:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Quantity</legend><input type="number" name="quantity" value={formData.quantity ?? ''} onChange={handleInputChange} disabled={isQuantityDisabled} className="block w-full py-2.5 outline-none bg-transparent disabled:bg-slate-100" step="any"/></fieldset>{isQuantityDisabled && <p className="text-xs mt-1">Otomatis dari total varian.</p>}</div>
                <div className="relative sm:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Unit Netto</legend><input list="unit-list" name="unit_netto" value={formData.unit_netto || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent"/><datalist id="unit-list">{filteredUnitsForModal.map(u => <option key={u.id_unit} value={u.nama_unit}/>)}</datalist></fieldset></div>
              </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {formData.type === 'product' && <p className="text-xs text-slate-500 mt-1 sm:col-span-2">Untuk produk, Harga Beli/HPP dihitung otomatis dari BOM.</p>}
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Harga Jual (Rp)</legend><input type="number" name="harga" value={formData.harga ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., 15000" step="any" disabled={formData.type !== 'product'}/></fieldset>{formData.type !== 'product' && <p className="text-xs text-slate-500 mt-1">Hanya untuk tipe 'Product'.</p>}</div>
              </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Stok Kritis</legend><input type="number" name="stok_kritis" value={formData.stok_kritis ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="e.g., 10" step="any"/></fieldset></div>
                <div className="relative">
                    <fieldset className={`border ${hasVariantsInModal ? 'border-slate-200' : 'border-slate-300 group focus-within:border-sky-500'} rounded-md px-3`}>
                      <legend className={`text-xs font-medium px-1 ${hasVariantsInModal ? 'text-slate-400' : 'text-slate-500 group-focus-within:text-sky-600'}`}>Barcode</legend>
                      <input type="text" name="barcode" value={formData.barcode || ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent disabled:bg-slate-100 disabled:text-slate-500" disabled={hasVariantsInModal}/>
                    </fieldset>
                    {hasVariantsInModal && <p className="text-xs text-slate-500 mt-1">Barcode diatur pada level varian.</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                 <div>
                    <fieldset className="border border-slate-300 rounded-md p-3 group">
                        <legend className="text-xs font-medium text-slate-500 px-1">Foto Stok</legend>
                        <div className="flex items-center space-x-3">
                            <div className="w-20 h-20 bg-slate-100 rounded-md flex items-center justify-center overflow-hidden border">
                                {formData.photo_url ? <img src={formData.photo_url} alt="Stok" className="w-full h-full object-cover"/> : <PhotoIcon className="w-8 h-8 text-slate-400"/>}
                            </div>
                            <div className="space-y-2">
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden"/>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50">Ganti Foto</button>
                                {formData.photo_url && <button type="button" onClick={() => setFormData(prev => ({ ...prev, photo_url: null }))} className="text-xs flex items-center text-red-600 hover:text-red-800"><XCircleIcon className="w-4 h-4 mr-1"/> Hapus</button>}
                            </div>
                        </div>
                    </fieldset>
                </div>
                 <div className="flex items-center justify-start sm:justify-center pt-5 sm:pt-0">
                    <label className={`flex items-center space-x-2 ${hasVariantsInModal ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input 
                            type="checkbox" 
                            name="tampil_di_opname" 
                            checked={formData.tampil_di_opname} 
                            onChange={handleInputChange} 
                            className="form-checkbox h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={hasVariantsInModal}
                        />
                        <span className={`text-sm font-medium ${hasVariantsInModal ? 'text-slate-400' : 'text-slate-700'}`}>
                            Tampilkan di Opname Outlet
                        </span>
                    </label>
                    {hasVariantsInModal && <p className="text-xs text-slate-500 mt-1 ml-2">(Diatur pada level varian)</p>}
                </div>
              </div>
              <div className="pt-2 flex justify-end space-x-3"><button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menyimpan...' : (modalMode === 'add' ? 'Simpan' : 'Update')}</button></div>
            </form>
          </div>
        </div>
      )}
      {isDeleteConfirmOpen && itemToDelete && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h2 className="text-xl font-semibold mb-4">Konfirmasi Hapus</h2><p className="mb-6">Yakin ingin menghapus "{itemToDelete.nama_stok}"?</p><div className="flex justify-end space-x-3"><button onClick={cancelDelete} disabled={isSubmitting} className="px-4 py-2 border rounded-md">Batal</button><button onClick={confirmDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2"/>}{isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}</button></div></div></div>)}
    </div>
  );
};

export default StockPage;