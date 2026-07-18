
// FRONTEND: Komponen ini mengelola UI khusus untuk pengaturan Promo.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CogIcon, CurrencyDollarIcon, PencilSquareIcon, TrashIcon, XMarkIcon, PlusCircleIcon, ChevronDownIcon, SpinnerIcon, BriefcaseIcon, PhotoIcon, XCircleIcon, MotorcycleIcon, MapPinIcon, MagnifyingGlassIcon } from '../../components/icons';
import { Promo, Branch, Stok, PromoTier, ProductVariant as ProductVariantType, DayOfWeek, Customer, Grup } from '../../types';
import * as api from '../../backend/api';
import { useAccess } from '../../contexts/AccessContext';
import { useBranch } from '../../contexts/BranchContext';
import { deepClone } from '../../utils';

const PAGE_PATH = '/penjualan/settings';

// Reusable component for selecting items/variants for a promo
const PromoItemsInput: React.FC<{
  label: string;
  selectedItemIds: string[];
  onChange: (ids: string[]) => void;
  availableProducts: Stok[];
  getVariantsForProduct: (productId: string) => ProductVariantType[];
  disabled?: boolean;
}> = ({ label, selectedItemIds, onChange, availableProducts, getVariantsForProduct, disabled }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectionChange = (id: string, isSelected: boolean) => {
    let newIds = [...(selectedItemIds || [])];
    const isParentProduct = !id.includes(':');
    const [productId] = id.split(':');

    if (isSelected) {
      if (isParentProduct) {
        // Remove all variants of this product, then add the parent
        newIds = newIds.filter(existingId => !existingId.startsWith(productId + ':'));
        newIds.push(id);
      } else {
        // Add variant, but ensure parent is not selected
        newIds = newIds.filter(existingId => existingId !== productId);
        if (!newIds.includes(id)) {
          newIds.push(id);
        }
      }
    } else {
      // Remove the id
      newIds = newIds.filter(existingId => existingId !== id);
    }
    onChange(newIds);
  };

  const isParentSelected = (productId: string) => {
    return (selectedItemIds || []).includes(productId);
  };

  const hasResults = useMemo(() => {
    if (!searchTerm.trim()) return availableProducts.length > 0;
    const lowercasedTerm = searchTerm.toLowerCase();
    return availableProducts.some(product => {
      if (product.nama_stok.toLowerCase().includes(lowercasedTerm)) return true;
      const variants = getVariantsForProduct(product.id_stok);
      return variants.some(variant =>
        (variant.nama_variant_product || variant.id_variant_product).toLowerCase().includes(lowercasedTerm)
      );
    });
  }, [searchTerm, availableProducts, getVariantsForProduct]);


  return (
    <fieldset className="border border-slate-300 rounded-md p-3 group focus-within:border-sky-500 transition-colors duration-150">
      <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600 transition-colors duration-150">{label}</legend>
      
      <div className="relative mb-2">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari produk atau varian..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="form-input w-full pl-9 py-1.5 text-sm"
          disabled={disabled}
        />
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border rounded-md p-2 bg-slate-50">
        {!hasResults && !disabled && (
          <p className="text-xs text-center text-slate-400 py-2">
            {availableProducts.length === 0 ? 'Pilih cabang untuk melihat produk.' : 'Produk tidak ditemukan.'}
          </p>
        )}
        {(availableProducts || []).map(product => {
          const lowercasedTerm = searchTerm.trim().toLowerCase();
          const productMatches = product.nama_stok.toLowerCase().includes(lowercasedTerm);
          const allVariants = getVariantsForProduct(product.id_stok);
          const matchingVariants = allVariants.filter(variant => 
              (variant.nama_variant_product || variant.id_variant_product).toLowerCase().includes(lowercasedTerm)
          );

          if (lowercasedTerm && !productMatches && matchingVariants.length === 0) {
              return null;
          }

          const variantsToShow = lowercasedTerm && !productMatches ? matchingVariants : allVariants;
          const parentIsChecked = isParentSelected(product.id_stok);
          const hasAnyVariants = allVariants.length > 0;

          return (
            <div key={product.id_stok}>
              <label className="flex items-center space-x-2 text-sm text-slate-800 font-semibold p-2 bg-slate-100 rounded-t-md border-b">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded focus:ring-sky-400"
                  checked={parentIsChecked}
                  onChange={(e) => handleSelectionChange(product.id_stok, e.target.checked)}
                  disabled={disabled}
                />
                <span>{product.nama_stok} {hasAnyVariants && '(Semua Varian)'}</span>
              </label>
              {variantsToShow.length > 0 && (
                <div className="space-y-1 pt-2 pb-1 pl-6 bg-white rounded-b-md">
                  {variantsToShow.map(variant => {
                    const variantId = `${product.id_stok}:${variant.id_variant_product}`;
                    return (
                      <label key={variant.id_variant_product} className="flex items-center space-x-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded focus:ring-sky-400"
                          checked={(selectedItemIds || []).includes(variantId)}
                          onChange={(e) => handleSelectionChange(variantId, e.target.checked)}
                          disabled={disabled || parentIsChecked}
                        />
                        <span className={parentIsChecked ? 'text-slate-400' : ''}>{variant.nama_variant_product || variant.id_variant_product}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 mt-2 p-1">Jika tidak ada item yang dipilih, promo akan berlaku untuk total transaksi.</p>
    </fieldset>
  );
};

interface PromoCustomersInputProps {
  label: string;
  selectedCustomerIds: string[];
  onChange: (ids: string[]) => void;
  availableCustomers: Customer[];
  disabled?: boolean;
}

const PromoCustomersInput: React.FC<PromoCustomersInputProps> = ({ label, selectedCustomerIds, onChange, availableCustomers, disabled }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableCustomers;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return availableCustomers.filter(customer =>
      customer.nama_pelanggan.toLowerCase().includes(lowercasedTerm) ||
      (customer.telepon && customer.telepon.includes(lowercasedTerm)) ||
      customer.id_pelanggan.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, availableCustomers]);

  const handleSelectionChange = (id: string, isSelected: boolean) => {
    let newIds = [...(selectedCustomerIds || [])];
    if (isSelected) {
      if (!newIds.includes(id)) {
        newIds.push(id);
      }
    } else {
      newIds = newIds.filter(existingId => existingId !== id);
    }
    onChange(newIds);
  };

  return (
    <fieldset className="border border-slate-300 rounded-md p-3 group focus-within:border-sky-500 transition-colors duration-150">
      <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap group-focus-within:text-sky-600 transition-colors duration-150">{label}</legend>
      <div className="relative mb-2">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari pelanggan..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="form-input w-full pl-9 py-1.5 text-sm"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-2 border rounded-md p-2 bg-slate-50">
        {filteredCustomers.length === 0 ? (
          <p className="text-xs text-center text-slate-400 py-2">
            {availableCustomers.length === 0 ? 'Tidak ada data pelanggan untuk grup ini.' : 'Pelanggan tidak ditemukan.'}
          </p>
        ) : (
          filteredCustomers.map(customer => (
            <label key={customer.id_pelanggan} className="flex items-center space-x-2 text-sm text-slate-700 p-1.5 hover:bg-slate-100 rounded-md cursor-pointer">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded focus:ring-sky-400"
                checked={(selectedCustomerIds || []).includes(customer.id_pelanggan)}
                onChange={(e) => handleSelectionChange(customer.id_pelanggan, e.target.checked)}
                disabled={disabled}
              />
              <span>{customer.nama_pelanggan} <span className="text-slate-400">({customer.telepon || 'No Telp'})</span></span>
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2 p-1">Jika tidak ada pelanggan yang dipilih, promo akan berlaku untuk semua pelanggan terdaftar di grup yang sama.</p>
    </fieldset>
  );
};
// FIX: Moved SectionHeader component outside of PromoPage component to prevent re-declaration on every render.
// Replaced React.FC with a more explicit props interface and return type for better type safety.
interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    className?: string;
}

const SectionHeader = ({ title, subtitle, className = '' }: SectionHeaderProps): React.ReactElement => (
    <div className={`pt-6 pb-2 border-t border-slate-200 first:pt-0 first:border-t-0 ${className}`}>
        <h3 className="text-base font-semibold leading-6 text-slate-800">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
);

const PromoPage: React.FC = () => {
    const { canInsert, canUpdate, canDelete, isAccessDataLoaded } = useAccess();
    // FIX: Destructure 'selectableGrups' instead of 'grups' from useBranch hook to match the context state type.
    const { selectedBranchId: globalSelectedBranchId, selectedGroupId, userRoleType, selectableBranches, selectableGrups: allGrups } = useBranch();
  
    const [promos, setPromos] = useState<Promo[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [stocks, setStocks] = useState<Stok[]>([]);
    const [productVariants, setProductVariants] = useState<ProductVariantType[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isPromoModalOpen, setIsPromoModalOpen] = useState<boolean>(false);
    const [promoModalMode, setPromoModalMode] = useState<'add' | 'edit'>('add');
    const [currentPromoToEdit, setCurrentPromoToEdit] = useState<Promo | null>(null);
    const promoBannerInputRef = useRef<HTMLInputElement>(null);
    
    const defaultPromoFormData: Omit<Promo, 'id_promo'> = {
        id_grup: '',
        id_cabang: null,
        nama_promo: '',
        banner_url: null,
        tipe_promo: 'persentase',
        nilai_diskon_persen: null,
        nilai_diskon_nominal: null,
        bogo_beli_qty: null,
        bogo_dapat_qty: null,
        kode_voucher: null,
        paket_item_ids: [],
        paket_harga_total: null,
        tiers: [],
        waktu_mulai: null,
        waktu_berakhir: null,
        hari_berlaku: [],
        pelanggan_berlaku_ids: [],
        tanggal_mulai: new Date().toISOString().split('T')[0],
        tanggal_berakhir: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        item_berlaku_ids: [],
        minimal_pembelian_total: null,
        minimal_pembelian_item_qty: null,
        deskripsi: '',
        aktif: true,
        berulang: false,
        maksimal_berulang: null,
    };
    const [promoFormData, setPromoFormData] = useState(deepClone(defaultPromoFormData));
    const [promoSearchTerm, setPromoSearchTerm] = useState<string>('');
    const [isPromoDeleteConfirmOpen, setIsPromoDeleteConfirmOpen] = useState<boolean>(false);
    const [promoToDelete, setPromoToDelete] = useState<Promo | null>(null);
    const [newTier, setNewTier] = useState<PromoTier>({ minimal_belanja_total_transaksi: 0, nilai_diskon_persen: null, nilai_diskon_nominal: null });

    const daysOfWeek: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getPenjualanSettingsPageData();
            setPromos(data.promos);
            setBranches(data.branches);
            setStocks(data.stocks);
            setProductVariants(data.productVariants);
            setCustomers(data.customers);
        } catch (error) {
            console.error("Failed to load promo settings data:", error);
            alert("Gagal memuat data pengaturan penjualan.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAccessDataLoaded) {
            fetchData();
        }
    }, [isAccessDataLoaded, fetchData]);

    const stockForModalDropdown = useMemo(() => {
        const branchId = promoFormData.id_cabang === '__SEMUA__' || promoFormData.id_cabang === null ? null : promoFormData.id_cabang;
        
        const productStocks = stocks.filter(s => s.type === 'product');

        if (branchId) {
            return productStocks.filter(s => s.id_cabang === branchId);
        }
        return productStocks;
    }, [promoFormData.id_cabang, stocks]);
  
    const getVariantsForProduct = useCallback((productId: string): ProductVariantType[] => {
        if (!productId) return [];
        const product = stocks.find(s => s.id_stok === productId);
        if (!product) return [];
        
        const branchIdForVariants = promoFormData.id_cabang === '__SEMUA__' || promoFormData.id_cabang === null ? product.id_cabang : promoFormData.id_cabang;
        return productVariants.filter(pv => pv.id_cabang === branchIdForVariants && pv.id_stok_product === productId);
    }, [promoFormData.id_cabang, stocks, productVariants]);

    const customersForPromoModal = useMemo(() => {
        if (!promoFormData.id_grup) return [];
        return customers.filter(c => c.id_grup === promoFormData.id_grup);
    }, [customers, promoFormData.id_grup]);

    const branchMap = useMemo(() => new Map(branches.map(b => [b.id_cabang, b.Nama])), [branches]);
    const grupMap = useMemo(() => new Map(allGrups.map(g => [g.id_grup, g.nama_grup])), [allGrups]);

    const filteredPromos = useMemo(() => {
        let itemsToFilter = deepClone(promos);
        
        if (globalSelectedBranchId) {
            itemsToFilter = itemsToFilter.filter(p => p.id_cabang === globalSelectedBranchId || (p.id_cabang === null && p.id_grup === selectedGroupId));
        } else if (selectedGroupId) {
            itemsToFilter = itemsToFilter.filter(p => p.id_grup === selectedGroupId);
        }

        if (!promoSearchTerm) return itemsToFilter;
        return itemsToFilter.filter(p => p.nama_promo.toLowerCase().includes(promoSearchTerm.toLowerCase()));
    }, [promos, globalSelectedBranchId, selectedGroupId, promoSearchTerm]);

    const handleOpenPromoModal = (mode: 'add' | 'edit', promo?: Promo) => {
        if ((mode === 'add' && !canInsert(PAGE_PATH)) || (mode === 'edit' && !canUpdate(PAGE_PATH))) { alert("Akses ditolak."); return; }
        setPromoModalMode(mode);
        if (mode === 'edit' && promo) {
        setCurrentPromoToEdit(promo);
        setPromoFormData({ ...deepClone(defaultPromoFormData), ...promo, id_cabang: promo.id_cabang || '__SEMUA__', tanggal_mulai: promo.tanggal_mulai.split('T')[0], tanggal_berakhir: promo.tanggal_berakhir.split('T')[0] });
        } else {
            setCurrentPromoToEdit(null);
            
            let initialCabangId: string | null = '__SEMUA__';
            if (userRoleType === 'other') {
                initialCabangId = selectableBranches.length > 0 ? selectableBranches[0].id_cabang : null;
            } else if (globalSelectedBranchId) {
                initialCabangId = globalSelectedBranchId;
            }
            const initialGrupId: string | null = selectedGroupId || null;
            if (!initialGrupId) {
                alert("Silakan pilih grup terlebih dahulu di header.");
                return;
            }

            setPromoFormData({...deepClone(defaultPromoFormData), id_grup: initialGrupId, id_cabang: initialCabangId });
        }
        setIsPromoModalOpen(true);
    };

    const handleClosePromoModal = useCallback(() => {
        setIsPromoModalOpen(false); setCurrentPromoToEdit(null);
        setPromoFormData(deepClone(defaultPromoFormData));
        setNewTier({ minimal_belanja_total_transaksi: 0, nilai_diskon_persen: null, nilai_diskon_nominal: null });
    }, [defaultPromoFormData]);

    const handlePromoInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setPromoFormData(prev => {
        let newState = { ...prev };
        if (type === 'checkbox') {
            (newState as any)[name] = checked;
        } else if (['nilai_diskon_persen', 'nilai_diskon_nominal', 'bogo_beli_qty', 'bogo_dapat_qty', 'paket_harga_total', 'minimal_pembelian_total', 'minimal_pembelian_item_qty', 'maksimal_berulang'].includes(name)) {
            (newState as any)[name] = value === '' ? null : parseFloat(value);
        } else {
            (newState as any)[name] = value;
        }
        
        if (name === 'id_cabang') { 
            newState = {...newState, item_berlaku_ids: [], paket_item_ids: []}; 
        }
        
        if (name === 'berulang' && !checked) {
            newState.maksimal_berulang = null;
        }
        
        return newState;
        });
    };

    const handlePromoBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
        const reader = new FileReader();
        reader.onloadend = () => setPromoFormData(prev => ({ ...prev, banner_url: reader.result as string }));
        reader.readAsDataURL(file);
        }
    };

    const handleHariBerlakuChange = (day: DayOfWeek) => setPromoFormData(prev => ({...prev, hari_berlaku: (prev.hari_berlaku || []).includes(day) ? (prev.hari_berlaku || []).filter(d => d !== day) : [...(prev.hari_berlaku || []), day] }));

    const handleAddTier = () => {
        if (newTier.minimal_belanja_total_transaksi <= 0 || (!newTier.nilai_diskon_persen && !newTier.nilai_diskon_nominal)) { alert("Minimal belanja dan salah satu diskon wajib diisi."); return; }
        setPromoFormData(prev => ({ ...prev, tiers: [...(prev.tiers || []), deepClone(newTier)].sort((a,b) => a.minimal_belanja_total_transaksi - b.minimal_belanja_total_transaksi) }));
        setNewTier({ minimal_belanja_total_transaksi: 0, nilai_diskon_persen: null, nilai_diskon_nominal: null });
    };

    const handleRemoveTier = (index: number) => setPromoFormData(prev => ({ ...prev, tiers: prev.tiers?.filter((_, i) => i !== index) }));

    const handlePromoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!promoFormData.nama_promo.trim() || !promoFormData.tanggal_mulai || !promoFormData.tanggal_berakhir || !promoFormData.id_grup) {
            alert('Nama, Periode Tanggal, dan Grup wajib diisi!');
            return;
        }
        
        setIsSubmitting(true);
        const promoToSave: Omit<Promo, 'id_promo'> = {
            ...promoFormData,
            id_cabang: promoFormData.id_cabang === '__SEMUA__' ? null : promoFormData.id_cabang,
            item_berlaku_ids: (promoFormData.item_berlaku_ids || []).filter(id => id),
            paket_item_ids: (promoFormData.paket_item_ids || []).filter(id => id)
        };
        
        try {
            let response;
            if (promoModalMode === 'add') {
                response = await api.createPromo(promoToSave);
            } else if (currentPromoToEdit) {
                response = await api.updatePromo(currentPromoToEdit.id_promo, promoToSave);
            }
            
            if (response && response.success) {
                await fetchData();
                handleClosePromoModal();
            } else {
                alert(response?.message || 'Gagal menyimpan promo.');
            }
        } catch (error) {
            console.error("Error saving promo:", error);
            alert("Terjadi kesalahan saat menyimpan promo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePromoDeleteClick = (promo: Promo) => { if (!canDelete(PAGE_PATH)) { alert("Akses ditolak."); return; } setPromoToDelete(promo); setIsPromoDeleteConfirmOpen(true); };
    
    const confirmPromoDelete = async () => {
        if (!promoToDelete) return;
        setIsSubmitting(true);
        try {
            const response = await api.deletePromo(promoToDelete.id_promo);
            if (response.success) {
                await fetchData();
            } else {
                alert(response.message || 'Gagal menghapus promo.');
            }
        } catch (error) {
            console.error("Error deleting promo:", error);
            alert("Terjadi kesalahan saat menghapus promo.");
        } finally {
            setIsSubmitting(false);
            setIsPromoDeleteConfirmOpen(false);
            setPromoToDelete(null);
        }
    };
  
    const cancelPromoDelete = useCallback(() => { setIsPromoDeleteConfirmOpen(false); setPromoToDelete(null); }, []);
    useEffect(() => { const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (isPromoModalOpen) handleClosePromoModal(); if (isPromoDeleteConfirmOpen) cancelPromoDelete(); } }; window.addEventListener('keydown', handleEsc); return () => window.removeEventListener('keydown', handleEsc); }, [isPromoModalOpen, isPromoDeleteConfirmOpen, handleClosePromoModal, cancelPromoDelete]);

    const simpleStockMap = useMemo(() => new Map(stocks.map(s => [s.id_stok, s])), [stocks]);
    const simpleVariantMap = useMemo(() => new Map(productVariants.map(v => [v.id_variant_product, v])), [productVariants]);

    const getApplicableItemNames = useCallback((promo: Promo): string[] => {
        const idsToUse = promo.tipe_promo === 'paket' 
            ? promo.paket_item_ids 
            : promo.item_berlaku_ids;

        if (!idsToUse || idsToUse.length === 0) {
        if (['diskon_bertingkat', 'voucher', 'loyalitas'].includes(promo.tipe_promo)) {
            return ['Semua Item (berdasarkan total belanja)'];
        }
        if (promo.tipe_promo === 'paket') {
            return ['Paket tidak memiliki item.'];
        }
        return ['Semua Item'];
        }
        return idsToUse.map(id => {
        if (id.includes(':')) {
            const [stokId, variantId] = id.split(':');
            const product = simpleStockMap.get(stokId);
            const variant = simpleVariantMap.get(variantId);
            return `${product?.nama_stok || stokId} - ${variant?.nama_variant_product || variantId}`;
        } else {
            const product = simpleStockMap.get(id);
            return product?.nama_stok || id;
        }
        });
    }, [simpleStockMap, simpleVariantMap]);

    if (isLoading || !isAccessDataLoaded) {
        return <div className="p-6 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500" /></div>;
    }
  
    const renderPromoDetail = (promo: Promo) => {
        switch (promo.tipe_promo) {
        case 'persentase':
        case 'happy_hour':
            return `Diskon ${promo.nilai_diskon_persen}%`;
        case 'nominal':
        case 'loyalitas':
            return `Potongan Rp ${promo.nilai_diskon_nominal?.toLocaleString('id-ID') || 0}`;
        case 'bogo':
            return `Beli ${promo.bogo_beli_qty} Dapat ${promo.bogo_dapat_qty}`;
        case 'voucher':
            return `Kode: ${promo.kode_voucher}`;
        case 'paket':
            return `Harga Paket Rp ${promo.paket_harga_total?.toLocaleString('id-ID') || 0}`;
        case 'diskon_bertingkat':
            return `${promo.tiers?.length || 0} Tingkatan Diskon`;
        default:
            return 'Detail promo tidak tersedia';
        }
    };
  
    return (
        <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Manajemen Promo</h1>
                <div className="flex items-center space-x-3 mt-3 sm:mt-0">
                    <input type="text" placeholder="Cari promo..." value={promoSearchTerm} onChange={e => setPromoSearchTerm(e.target.value)} className="form-input px-4 py-2 border-slate-300 rounded-md text-sm shadow-sm"/>
                    {canInsert(PAGE_PATH) && (
                    <button 
                        onClick={() => handleOpenPromoModal('add')} 
                        className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md text-sm shadow-sm flex items-center transition duration-150 ease-in-out transform hover:scale-105"
                        title="Tambah Promo Baru"
                    >
                        <PlusCircleIcon className="w-5 h-5 mr-2"/>
                        Tambah Promo
                    </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPromos.map(promo => {
                    const branchName = promo.id_cabang ? branchMap.get(promo.id_cabang) : 'Semua Cabang';
                    const grupName = grupMap.get(promo.id_grup) || 'N/A';
                    const formattedStartDate = new Date(promo.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });
                    const formattedEndDate = new Date(promo.tanggal_berakhir).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });

                    const conditions = [];
                    if (promo.minimal_pembelian_total) conditions.push(`Min. Belanja: Rp ${promo.minimal_pembelian_total.toLocaleString('id-ID')}`);
                    if (promo.minimal_pembelian_item_qty) conditions.push(`Min. Qty Item: ${promo.minimal_pembelian_item_qty}`);
                    if (promo.tipe_promo === 'happy_hour' && promo.waktu_mulai && promo.waktu_berakhir) conditions.push(`Waktu: ${promo.waktu_mulai} - ${promo.waktu_berakhir}`);
                    if (promo.tipe_promo === 'happy_hour' && promo.hari_berlaku && promo.hari_berlaku.length > 0 && promo.hari_berlaku.length < 7) conditions.push(`Hari: ${promo.hari_berlaku.join(', ')}`);
                    if (promo.tipe_promo === 'loyalitas') {
                        if (promo.pelanggan_berlaku_ids && promo.pelanggan_berlaku_ids.length > 0) {
                            conditions.push(`Khusus untuk ${promo.pelanggan_berlaku_ids.length} pelanggan terpilih`);
                        } else {
                            conditions.push('Untuk semua pelanggan terdaftar');
                        }
                    }

                    return (
                    <div key={promo.id_promo} className={`bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden transition-all duration-300 ${!promo.aktif ? 'bg-slate-100' : ''}`}>
                        <div className="p-5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-sm tracking-wider uppercase">
                                        {promo.tipe_promo.replace('_', ' ')}
                                    </span>
                                    <span className="bg-sky-100 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                        {renderPromoDetail(promo)}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                                    {canUpdate(PAGE_PATH) && <button onClick={() => handleOpenPromoModal('edit', promo)} className="p-2 text-slate-400 hover:text-sky-600"><PencilSquareIcon className="w-5 h-5"/></button>}
                                    {canDelete(PAGE_PATH) && <button onClick={() => handlePromoDeleteClick(promo)} className="p-2 text-slate-400 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>}
                                </div>
                            </div>

                            <div className="flex justify-between items-start mt-2">
                                <h3 className="text-xl font-bold text-slate-800 pr-4" title={promo.nama_promo}>
                                    {promo.nama_promo}
                                </h3>
                                <span className={`flex-shrink-0 inline-block px-4 py-1 text-sm font-semibold rounded-full capitalize ${promo.aktif ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                                    {promo.aktif ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 h-full">
                                        <h4 className="text-sm font-semibold text-slate-600 mb-2">Produk Berlaku:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {getApplicableItemNames(promo).map((name, index) => (
                                            <span key={index} className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full">{name}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-1 flex items-center justify-center">
                                    {promo.banner_url ? (
                                        <img src={promo.banner_url} alt={promo.nama_promo} className="w-full h-24 object-cover rounded-md shadow-sm" />
                                    ) : (
                                        <div className="w-full h-24 bg-slate-100 rounded-md flex items-center justify-center">
                                            <PhotoIcon className="w-10 h-10 text-slate-300"/>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {promo.deskripsi && (
                                <p className="text-sm text-slate-600 italic mt-3">"{promo.deskripsi}"</p>
                            )}
                            
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-600 md:col-span-3">
                                <div className="space-y-1">
                                    <div>Grup: <strong>{grupName}</strong></div>
                                    <div>Cabang: <strong>{branchName}</strong></div>
                                    <div>{formattedStartDate} - {formattedEndDate}</div>
                                    <div>
                                        {promo.berulang ? (
                                            <span className="mt-1 inline-block text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                {promo.maksimal_berulang && promo.maksimal_berulang > 0
                                                    ? `Dapat Berulang (Maks. ${promo.maksimal_berulang}x)`
                                                    : 'Dapat Berulang'
                                                }
                                            </span>
                                        ) : (
                                            <span className="mt-1 inline-block text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                                Tidak Berulang
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {conditions.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-slate-700">Syarat & Aturan:</h4>
                                        <ul className="list-disc list-inside space-y-0.5 pl-1 text-xs">
                                            {conditions.map((cond, index) => (
                                                <li key={index}>{cond}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    )
                })}
                {filteredPromos.length === 0 && <p className="text-center text-slate-500 md:col-span-3 py-10">Tidak ada promo ditemukan.</p>}
            </div>
            {isPromoModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div className="flex-shrink-0 flex justify-between items-center mb-4 pb-4 border-b">
                    <h3 className="text-xl font-semibold text-slate-800">{promoModalMode === 'add' ? 'Tambah Promo Baru' : 'Edit Promo'}</h3>
                    <button onClick={handleClosePromoModal} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-5 h-5"/></button>
                    </div>
                    <form id="promo-form" onSubmit={handlePromoSubmit} className="flex-grow overflow-y-auto pr-2 text-sm space-y-4">
                        <SectionHeader title="Informasi Dasar" subtitle="Beri nama, deskripsi, dan status untuk promo Anda." />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative md:col-span-1"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Tipe Promo*</legend><select name="tipe_promo" value={promoFormData.tipe_promo} onChange={handlePromoInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none"><option value="persentase">Persentase</option><option value="nominal">Nominal</option><option value="bogo">BOGO (Beli X Gratis Y)</option><option value="voucher">Voucher</option><option value="paket">Paket (Bundle)</option><option value="diskon_bertingkat">Diskon Bertingkat</option><option value="happy_hour">Happy Hour</option><option value="loyalitas">Loyalitas</option></select><div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div></fieldset></div>
                            <div className="relative md:col-span-2"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nama Promo*</legend><input type="text" name="nama_promo" value={promoFormData.nama_promo} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div>
                        </div>
                        <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Deskripsi (Opsional)</legend><textarea name="deskripsi" value={promoFormData.deskripsi || ''} onChange={handlePromoInputChange} className="block w-full py-2.5 outline-none bg-transparent resize-none" rows={2}/></fieldset></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><fieldset className="border border-slate-300 rounded-md p-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Gambar Banner Promo</legend><div className="flex items-center space-x-4"><div className="w-28 h-20 bg-slate-100 rounded-md flex items-center justify-center overflow-hidden border flex-shrink-0">{promoFormData.banner_url ? (<img src={promoFormData.banner_url} alt="Banner Promo" className="w-full h-full object-cover"/>) : (<PhotoIcon className="w-8 h-8 text-slate-400"/>)}</div><div><div className="space-y-2"><input type="file" accept="image/*" ref={promoBannerInputRef} onChange={handlePromoBannerChange} className="hidden"/><button type="button" onClick={() => promoBannerInputRef.current?.click()} className="text-xs bg-white border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50">Ganti Gambar</button>{promoFormData.banner_url && <button type="button" onClick={() => setPromoFormData(prev => ({ ...prev, banner_url: null }))} className="text-xs flex items-center text-red-600 hover:text-red-800"><XCircleIcon className="w-4 h-4 mr-1"/> Hapus</button>}</div></div></div></fieldset><div className="flex items-center justify-center"><label htmlFor="aktif_promo" className="flex items-center cursor-pointer select-none"><div className="relative"><input type="checkbox" id="aktif_promo" name="aktif" className="sr-only" checked={promoFormData.aktif} onChange={handlePromoInputChange} /><div className={`block w-10 h-6 rounded-full transition-colors ${promoFormData.aktif ? 'bg-sky-500' : 'bg-slate-300'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${promoFormData.aktif ? 'translate-x-full' : ''}`}></div></div><div className="ml-3 text-slate-700 font-medium">Aktifkan Promo</div></label></div></div>
                        <SectionHeader title="Ruang Lingkup" subtitle="Atur kapan dan di mana saja promo ini berlaku." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative hidden">
                                <fieldset className="border border-slate-300 rounded-md px-3 group">
                                <legend className="text-xs font-medium text-slate-500 px-1 whitespace-nowrap">Grup Berlaku*</legend>
                                <select
                                    name="id_grup"
                                    value={promoFormData.id_grup || ''}
                                    onChange={handlePromoInputChange}
                                    required
                                    className="block w-full py-2.5 pr-8 outline-none bg-transparent text-sm appearance-none disabled:bg-slate-100"
                                    disabled={promoModalMode === 'edit'}
                                >
                                    <option value="" disabled>Pilih Grup</option>
                                    {allGrups.map(g => (
                                    <option key={g.id_grup} value={g.id_grup}>{g.nama_grup}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 mt-1">
                                    <ChevronDownIcon className="h-4 w-4" />
                                </div>
                                </fieldset>
                            </div>
                            <div className="relative md:col-span-2">
                                <fieldset className="border border-slate-300 rounded-md px-3 group">
                                <legend className="text-xs">Cabang Berlaku</legend>
                                <select name="id_cabang" value={promoFormData.id_cabang || '__SEMUA__'} onChange={handlePromoInputChange} className="block w-full py-2.5 pr-8 outline-none bg-transparent appearance-none">
                                    <option value="__SEMUA__">Semua Cabang (di grup ini)</option>
                                    {selectableBranches.filter(b => b.id_grup === promoFormData.id_grup).map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.Nama}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 mt-1"><ChevronDownIcon className="h-4 w-4"/></div>
                                </fieldset>
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:col-span-2">
                                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Tanggal Mulai*</legend><input type="date" name="tanggal_mulai" value={promoFormData.tanggal_mulai} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
                                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Tanggal Berakhir*</legend><input type="date" name="tanggal_berakhir" value={promoFormData.tanggal_berakhir} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
                            </div>
                        </div>
                        <SectionHeader title="Syarat & Ketentuan" subtitle="Tentukan kondisi yang harus dipenuhi agar promo dapat diterapkan." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Min. Pembelian Total (Rp)</legend><input type="number" name="minimal_pembelian_total" value={promoFormData.minimal_pembelian_total || ''} onChange={handlePromoInputChange} className="block w-full py-2.5"/></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Min. Qty Item Berlaku</legend><input type="number" name="minimal_pembelian_item_qty" value={promoFormData.minimal_pembelian_item_qty || ''} onChange={handlePromoInputChange} className="block w-full py-2.5"/></fieldset></div></div>
                        {promoFormData.tipe_promo !== 'paket' && (
                        <PromoItemsInput label="Item Berlaku (Opsional)" selectedItemIds={promoFormData.item_berlaku_ids || []} onChange={(ids) => setPromoFormData(prev => ({...prev, item_berlaku_ids: ids}))} availableProducts={stockForModalDropdown} getVariantsForProduct={getVariantsForProduct}/>
                        )}
                        <SectionHeader title="Nilai Promo" subtitle="Tentukan keuntungan yang didapat pelanggan." />
                        {promoFormData.tipe_promo === 'persentase' && (<div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nilai Diskon (%)*</legend><input type="number" name="nilai_diskon_persen" value={promoFormData.nilai_diskon_persen || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div>)}
                        {promoFormData.tipe_promo === 'nominal' && (<div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nilai Diskon (Rp)*</legend><input type="number" name="nilai_diskon_nominal" value={promoFormData.nilai_diskon_nominal || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div>)}
                        {promoFormData.tipe_promo === 'bogo' && (<div className="grid grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Beli Qty*</legend><input type="number" name="bogo_beli_qty" value={promoFormData.bogo_beli_qty || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5"/></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Dapat Qty*</legend><input type="number" name="bogo_dapat_qty" value={promoFormData.bogo_dapat_qty || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5"/></fieldset></div></div>)}
                        {promoFormData.tipe_promo === 'voucher' && (<><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Kode Voucher*</legend><input type="text" name="kode_voucher" value={promoFormData.kode_voucher || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5"/></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Nilai Diskon (Rp)*</legend><input type="number" name="nilai_diskon_nominal" value={promoFormData.nilai_diskon_nominal || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5"/></fieldset></div></>)}
                        {promoFormData.tipe_promo === 'paket' && (<div className="space-y-4"><PromoItemsInput label="Item dalam Paket*" selectedItemIds={promoFormData.paket_item_ids || []} onChange={(ids) => setPromoFormData(prev => ({ ...prev, paket_item_ids: ids }))} availableProducts={stockForModalDropdown} getVariantsForProduct={getVariantsForProduct}/><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Harga Total Paket (Rp)*</legend><input type="number" name="paket_harga_total" value={promoFormData.paket_harga_total || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5"/></fieldset></div></div>)}
                        {promoFormData.tipe_promo === 'diskon_bertingkat' && (<fieldset className="border border-slate-300 rounded-md p-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Tingkatan Diskon</legend><div className="space-y-1 max-h-32 overflow-y-auto">{(promoFormData.tiers || []).map((tier, i) => (<div key={i} className="flex items-center justify-between bg-slate-50 p-1 rounded-md text-xs"><span>Belanja &gt;= Rp {tier.minimal_belanja_total_transaksi.toLocaleString()}, diskon {tier.nilai_diskon_persen ? `${tier.nilai_diskon_persen}%` : `Rp ${tier.nilai_diskon_nominal?.toLocaleString()}`}</span><button type="button" onClick={() => handleRemoveTier(i)} className="p-1 text-red-500"><TrashIcon className="w-4 h-4"/></button></div>))}<div className="flex items-center gap-2 pt-2"><input type="number" placeholder="Min. Belanja" value={newTier.minimal_belanja_total_transaksi} onChange={e => setNewTier({...newTier, minimal_belanja_total_transaksi: Number(e.target.value)})} className="form-input w-full text-xs"/><input type="number" placeholder="Diskon %" value={newTier.nilai_diskon_persen || ''} onChange={e => setNewTier({...newTier, nilai_diskon_persen: Number(e.target.value), nilai_diskon_nominal: null})} className="form-input w-full text-xs"/><input type="number" placeholder="Diskon Rp" value={newTier.nilai_diskon_nominal || ''} onChange={e => setNewTier({...newTier, nilai_diskon_nominal: Number(e.target.value), nilai_diskon_persen: null})} className="form-input w-full text-xs"/><button type="button" onClick={handleAddTier} className="p-2 bg-sky-500 text-white rounded-md"><PlusCircleIcon className="w-4 h-4"/></button></div></div></fieldset>)}
                        {promoFormData.tipe_promo === 'happy_hour' && (<div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Waktu Mulai</legend><input type="time" name="waktu_mulai" value={promoFormData.waktu_mulai || ''} onChange={handlePromoInputChange} className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Waktu Berakhir</legend><input type="time" name="waktu_berakhir" value={promoFormData.waktu_berakhir || ''} onChange={handlePromoInputChange} className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div></div><fieldset className="border border-slate-300 rounded-md p-3 group"><legend className="text-xs font-medium text-slate-500 px-1">Hari Berlaku</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{daysOfWeek.map(d => (<label key={d} className="flex items-center space-x-1.5"><input type="checkbox" checked={(promoFormData.hari_berlaku || []).includes(d)} onChange={() => handleHariBerlakuChange(d)} className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded focus:ring-sky-500"/><span>{d}</span></label>))}</div></fieldset><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Diskon (%)*</legend><input type="number" name="nilai_diskon_persen" value={promoFormData.nilai_diskon_persen || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div></div>)}
                        {promoFormData.tipe_promo === 'loyalitas' && (<div className="space-y-4"><PromoCustomersInput label="Pelanggan Berlaku (Opsional)" selectedCustomerIds={promoFormData.pelanggan_berlaku_ids || []} onChange={(ids) => setPromoFormData(prev => ({...prev, pelanggan_berlaku_ids: ids}))} availableCustomers={customersForPromoModal} disabled={isSubmitting}/><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500"><legend className="text-xs font-medium text-slate-500 px-1">Nilai Potongan (Rp)*</legend><input type="number" name="nilai_diskon_nominal" value={promoFormData.nilai_diskon_nominal || ''} onChange={handlePromoInputChange} required className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div></div>)}
                        <SectionHeader title="Aturan Lanjutan" subtitle="Konfigurasi pengulangan promo." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div className="flex items-center">
                                <label htmlFor="berulang_promo" className="flex items-center cursor-pointer select-none">
                                    <div className="relative">
                                        <input type="checkbox" id="berulang_promo" name="berulang" className="sr-only" checked={promoFormData.berulang || false} onChange={handlePromoInputChange} />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${promoFormData.berulang ? 'bg-sky-500' : 'bg-slate-300'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${promoFormData.berulang ? 'translate-x-full' : ''}`}></div>
                                    </div>
                                    <div className="ml-3 text-slate-700 font-medium">Promo Berulang</div>
                                </label>
                            </div>
                            {promoFormData.berulang && (
                                <div className="relative">
                                    <fieldset className="border border-slate-300 rounded-md px-3 group focus-within:border-sky-500">
                                        <legend className="text-xs font-medium text-slate-500 px-1">Maksimal Berulang</legend>
                                        <input type="number" name="maksimal_berulang" value={promoFormData.maksimal_berulang || ''} onChange={handlePromoInputChange} className="block w-full py-2.5 outline-none bg-transparent" placeholder="Kosongkan untuk tanpa batas" min="1"/>
                                    </fieldset>
                                </div>
                            )}
                        </div>
                    </form>
                    <div className="flex-shrink-0 pt-4 mt-4 border-t flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <button type="button" onClick={handleClosePromoModal} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
                    <button form="promo-form" type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 flex justify-center items-center disabled:opacity-70">{isSubmitting && <SpinnerIcon className="w-5 h-5 mr-2" />} {isSubmitting ? 'Menyimpan...' : 'Simpan Promo'}</button>
                    </div>
                </div>
                </div>
            )}
            {isPromoDeleteConfirmOpen && promoToDelete && ( <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus promo "{promoToDelete.nama_promo}"?</p><div className="flex justify-end space-x-2"><button onClick={cancelPromoDelete} className="px-3 py-2 border rounded-md text-xs">Batal</button><button onClick={confirmPromoDelete} className="px-3 py-2 bg-red-600 text-white rounded-md text-xs">Ya, Hapus</button></div></div></div>)}
        </div>
    )
}

export default PromoPage;
