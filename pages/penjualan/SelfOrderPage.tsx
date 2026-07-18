
// FRONTEND: Komponen ini menyediakan antarmuka Point of Sale (POS) untuk membuat transaksi secara cepat.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import * as api from '../../backend/api';
import { Branch, Meja, Stok, ProductVariant as ProductVariantType, Unit, Promo, MaterialVariant, DayOfWeek, SelfOrder, TransactionItem, Transaction, PaymentMethod as PaymentMethodType, PromoPuasItem, Customer } from '../../types';
import { 
    SpinnerIcon, 
    MagnifyingGlassIcon, 
    StarIcon, 
    ChevronRightIcon, 
    ShoppingCartIcon, 
    XMarkIcon, 
    PlusCircleIcon, 
    MinusCircleIcon,
    MotorcycleIcon,
    ShoppingBagIcon,
    MapPinIcon,
    LocationMarkerIcon,
    TagIcon,
    QrCodeIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    ArrowLeftOnRectangleIcon
} from '../../components/icons';
import QRCode from 'qrcode';

// Declare Leaflet to avoid TypeScript errors
declare const L: any;

// A simple hook to get the current time, updated every second for countdowns
const useTimer = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return now;
};


// --- TYPE DEFINITIONS ---
interface CartItem {
  id: string; // Composite key: `stokId:variantId` or just `stokId`
  stok: Stok;
  variant: ProductVariantType | null;
  quantity: number;
  hargaSatuan: number;
  totalPrice: number;
}

type BestSellingItem = (Stok & { item_type: 'product' }) | (ProductVariantType & { item_type: 'variant' });

interface PageData {
    branch: Branch;
    products: Stok[];
    productVariants: ProductVariantType[];
    allMaterialVariants: MaterialVariant[];
    units: Unit[];
    allStocks: Stok[];
    promos: Promo[];
    bestSellingItems: BestSellingItem[];
    leastSellingItems: BestSellingItem[];
    paymentMethods: PaymentMethodType[];
}

interface CategoryData {
    name: string;
    imageUrl: string;
}


// --- SUB-COMPONENTS ---

const LocationSearchModal: React.FC<{
    onClose: () => void;
    onLocationSelect: (location: { lat: number, lon: number, address: string }) => void;
    initialLocation: { lat: number, lon: number, address: string } | null;
}> = ({ onClose, onLocationSelect, initialLocation }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [selected, setSelected] = useState<{ lat: number; lon: number; address: string } | null>(initialLocation);
    const [isSearching, setIsSearching] = useState(false);
    const [isFetchingCurrentLocation, setIsFetchingCurrentLocation] = useState(false);
    const debounceTimeout = useRef<number | null>(null);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    useEffect(() => {
        if (initialLocation) {
            setQuery(initialLocation.address);
        }
    }, [initialLocation]);
    
    // Map Initialization
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const initialView: [number, number] = initialLocation ? [initialLocation.lat, initialLocation.lon] : [-6.200000, 106.816666]; // Default to Jakarta
            mapRef.current = L.map(mapContainerRef.current).setView(initialView, 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
        }

        // Cleanup on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            return data.display_name || 'Alamat tidak ditemukan.';
        } catch (error) {
            console.error('Reverse geocoding failed', error);
            return 'Gagal mendapatkan nama alamat';
        }
    };

    // Marker Management
    useEffect(() => {
        if (!mapRef.current || !selected) return;

        const { lat, lon } = selected;
        mapRef.current.setView([lat, lon], 16);

        if (!markerRef.current) {
            markerRef.current = L.marker([lat, lon], { draggable: true }).addTo(mapRef.current);
            
            markerRef.current.on('dragend', async (event: any) => {
                const marker = event.target;
                const position = marker.getLatLng();
                const address = await reverseGeocode(position.lat, position.lng);
                setSelected({ lat: position.lat, lon: position.lng, address });
                setQuery(address);
            });
        } else {
            markerRef.current.setLatLng([lat, lon]);
        }
    }, [selected]);


    const handleSearch = (searchQuery: string) => {
        setQuery(searchQuery);
        setSelected(null); // Clear selection when searching
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        if (searchQuery.length < 3) {
            setResults([]);
            return;
        }
        setIsSearching(true);
        debounceTimeout.current = window.setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=id&limit=5`);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                setResults(data);
            } catch (error) {
                console.error('Geocoding search failed:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce
    };

    const handleSelectResult = (result: any) => {
        const location = {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            address: result.display_name,
        };
        setSelected(location);
        setQuery(result.display_name);
        setResults([]);
    };

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            setIsFetchingCurrentLocation(true);
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const address = await reverseGeocode(latitude, longitude);
                        handleSelectResult({ lat: latitude, lon: longitude, display_name: address });
                    } catch (error) {
                        handleSelectResult({ lat: latitude, lon: longitude, display_name: 'Gagal mendapatkan nama alamat' });
                    } finally {
                        setIsFetchingCurrentLocation(false);
                    }
                },
                (error) => {
                    alert(`Gagal mendapatkan lokasi: ${error.message}`);
                    setIsFetchingCurrentLocation(false);
                }
            );
        } else {
            alert("Geolocation tidak didukung oleh browser ini.");
        }
    };


    const handleConfirm = () => {
        if (selected) {
            onLocationSelect(selected);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
                <div className="p-4 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Pilih Lokasi Pengantaran</h2>
                </div>
                <div className="p-4 space-y-3">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={query}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Cari nama jalan, gedung, atau area..."
                            className="form-input w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        {isSearching && <SpinnerIcon className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
                    </div>
                    {results.length > 0 && (
                        <ul className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {results.map(result => (
                                <li 
                                    key={result.place_id} 
                                    onClick={() => handleSelectResult(result)}
                                    className="p-3 text-sm hover:bg-sky-50 cursor-pointer border-b last:border-b-0"
                                >
                                    {result.display_name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="px-4 pb-4 flex-grow relative">
                    <div ref={mapContainerRef} className="border-2 border-slate-200 rounded-lg h-full min-h-[300px]"></div>
                    <div className="absolute top-4 right-4 z-[1000] flex flex-col space-y-2">
                        <button onClick={handleGetCurrentLocation} disabled={isFetchingCurrentLocation} className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-wait">
                            {isFetchingCurrentLocation ? <SpinnerIcon className="w-5 h-5 animate-spin"/> : <LocationMarkerIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-100">Batal</button>
                    <button onClick={handleConfirm} disabled={!selected} className="px-6 py-2 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700 disabled:bg-slate-400">
                        Konfirmasi Lokasi
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProductCard: React.FC<{ 
    product: Stok; 
    variants: ProductVariantType[];
    onProductClick: (product: Stok) => void;
}> = ({ product, variants, onProductClick }) => {
    const hasVariants = variants.length > 0;
    const priceText = hasVariants 
        ? `Mulai dari Rp ${(product.harga || (variants[0] && variants[0].harga_jual) || 0).toLocaleString('id-ID')}`
        : `Rp ${(product.harga || 0).toLocaleString('id-ID')}`;

    return (
        <div onClick={() => onProductClick(product)} className="flex items-start space-x-4 py-4 border-b border-slate-100 cursor-pointer group">
            <img src={product.photo_url || 'https://picsum.photos/seed/product/200/200'} alt={product.nama_stok} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-grow">
                <h3 className="font-bold text-slate-800 group-hover:text-sky-600 transition-colors">{product.nama_stok}</h3>
                <div className="flex items-center text-sm text-slate-500 mt-1">
                    <StarIcon className="w-4 h-4 text-yellow-400 mr-1" />
                    <span className="font-semibold">4.8</span>
                    <span className="mx-2">&middot;</span>
                    <span>{product.kategori}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{priceText}</p>
                 {product.stok_kritis !== null && product.quantity !== null && product.quantity < product.stok_kritis && (
                    <p className="text-xs text-red-600 font-medium mt-1 bg-red-100 px-2 py-0.5 rounded-full inline-block">Stok Terbatas!</p>
                )}
            </div>
        </div>
    );
};

const VariantSelectionModal: React.FC<{ 
    product: Stok; 
    variants: ProductVariantType[];
    onClose: () => void;
    onAddToCart: (product: Stok, variant: ProductVariantType) => void;
}> = ({ product, variants, onClose, onAddToCart }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-t-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col animate-slide-up">
                <div className="flex-shrink-0 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">{product.nama_stok}</h2>
                    <p className="text-slate-500">Pilih varian yang Anda inginkan.</p>
                </div>
                <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                    {variants.map(variant => (
                        <div key={variant.id_variant_product} className="flex justify-between items-center p-4 rounded-lg border border-slate-200">
                            <div>
                                <h4 className="font-semibold text-slate-700">{variant.nama_variant_product || variant.id_varian_detail}</h4>
                                <p className="text-sm text-slate-800 font-bold mt-1">Rp {variant.harga_jual.toLocaleString('id-ID')}</p>
                            </div>
                            <button onClick={() => onAddToCart(product, variant)} className="p-2 bg-sky-100 text-sky-600 rounded-full hover:bg-sky-200 transition-colors">
                                <PlusCircleIcon className="w-6 h-6"/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const PaymentInstructionModal: React.FC<{
    order: SelfOrder;
    onFinished: () => void;
}> = ({ order, onFinished }) => {
    const [copied, setCopied] = useState(false);
    const { selectedMethodDetails } = order as any;

    if (!selectedMethodDetails) {
        return (
            <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-4">
                <p>Metode pembayaran tidak valid.</p>
                <button onClick={onFinished} className="mt-4 px-6 py-2 bg-slate-200 rounded-lg">Kembali</button>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="w-full max-w-md mx-auto py-8">
                    <div className="flex flex-col items-center text-center">
                        <div className="flex items-center justify-center space-x-4 mb-4">
                            {selectedMethodDetails.logo_url ? <img src={selectedMethodDetails.logo_url} alt={selectedMethodDetails.nama_metode} className="w-12 h-12 object-contain"/> : <QrCodeIcon className="w-12 h-12 text-slate-800"/>}
                            <h2 className="text-2xl font-bold text-slate-800 text-left">{selectedMethodDetails.nama_metode}</h2>
                        </div>
                        
                         <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 w-full mb-6">
                            <p className="text-sm text-sky-700">Total Pembayaran</p>
                            <p className="text-3xl font-extrabold text-sky-800 tracking-tight">Rp {order.total.toLocaleString('id-ID')}</p>
                            <p className="text-xs text-sky-600 mt-1">Total sudah termasuk kode unik untuk verifikasi.</p>
                        </div>
                        
                        <p className="text-slate-500 mt-2 mb-6">Gunakan aplikasi m-banking atau e-wallet Anda.</p>
                        
                        {selectedMethodDetails.qris_image_url && (
                            <div className="my-6 border-2 border-slate-200 rounded-xl p-4">
                                <img src={selectedMethodDetails.qris_image_url} alt="QRIS Code" className="w-[200px] h-[200px] mx-auto" />
                            </div>
                        )}
                        
                        {selectedMethodDetails.nomor_pembayaran && (
                            <div className="mt-6 w-full">
                                <p className="text-sm text-slate-600 mb-1">Atau transfer ke nomor berikut:</p>
                                <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-left">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-slate-800 text-lg">{selectedMethodDetails.nomor_pembayaran}</span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedMethodDetails!.nomor_pembayaran!);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                            className="text-sky-600 hover:text-sky-800 font-semibold text-sm px-3 py-1 bg-sky-100 rounded-md transition-colors"
                                        >
                                            {copied ? 'Tersalin!' : 'Salin'}
                                        </button>
                                    </div>
                                    {selectedMethodDetails.nama_rekening && (
                                        <p className="text-sm text-slate-600 mt-2">
                                            a/n <span className="font-semibold text-slate-800">{selectedMethodDetails.nama_rekening}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="mt-8 text-center text-slate-500 text-sm">
                            <SpinnerIcon className="w-5 h-5 inline-block animate-spin mr-2"/>
                            Menunggu konfirmasi pembayaran...
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white sticky bottom-0">
                <button onClick={onFinished} className="w-full bg-slate-100 border border-slate-300 text-slate-700 font-semibold py-3 px-8 rounded-lg hover:bg-slate-200 transition-colors">
                    Selesai & Buat Pesanan Baru
                </button>
            </div>
        </div>
    );
};


const SelfOrderPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const tableId = searchParams.get('tableId');
    const branchId = searchParams.get('branchId');
    
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeOrderType, setActiveOrderType] = useState<'delivery' | 'pickup'>('pickup');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isVariantModalOpen, setIsVariantModalOpen] = useState<boolean>(false);
    const [productForModal, setProductForModal] = useState<Stok | null>(null);

    const [customerName, setCustomerName] = useState(tableId ? `Meja ${tableId}` : '');
    const [customerWhatsapp, setCustomerWhatsapp] = useState('');
    const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number; lon: number; address: string } | null>(null);
    const [pickupCoordinates, setPickupCoordinates] = useState<{ lat: number; lon: number } | null>(null);
    const [isLocationSearchModalOpen, setIsLocationSearchModalOpen] = useState(false);
    
    // Checkout flow states
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<(SelfOrder & { selectedMethodDetails?: PaymentMethodType }) | null>(null);
    const [checkoutErrors, setCheckoutErrors] = useState<{ name?: string, whatsapp?: string, location?: string }>({});
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
    const [isKasirSuccessModalOpen, setIsKasirSuccessModalOpen] = useState(false);

    // Voucher states
    const [voucherCodeInput, setVoucherCodeInput] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState<Promo | null>(null);
    const [voucherError, setVoucherError] = useState<string | null>(null);

    // New State for Package Promos
    const [appliedPackagePromo, setAppliedPackagePromo] = useState<Promo | null>(null);
    const [suggestedPackagePromo, setSuggestedPackagePromo] = useState<Promo | null>(null);

    // New states for customer lookup
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);

    const now = useTimer();


    useEffect(() => {
        if (!branchId) {
            setError("Cabang tidak ditemukan dalam URL.");
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const data = await api.getSelfOrderPageData(branchId);
                setPageData(data as PageData);
                const customersData = await api.getCustomers();
                setAllCustomers(customersData);
            } catch (e) {
                setError("Gagal memuat data menu untuk cabang ini.");
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [branchId]);

    // Customer lookup effect
    useEffect(() => {
        if (!customerName.trim() || !pageData || allCustomers.length === 0) {
            setFoundCustomer(null);
            return;
        }

        const searchTerm = customerName.toLowerCase().trim();
        const currentBranchGroupId = pageData.branch.id_grup;

        const matchedCustomer = allCustomers.find(customer =>
            (customer.id_pelanggan.toLowerCase() === searchTerm || customer.nama_pelanggan.toLowerCase() === searchTerm) &&
            customer.id_grup === currentBranchGroupId
        );

        if (matchedCustomer) {
            setFoundCustomer(matchedCustomer);
            setCustomerWhatsapp(matchedCustomer.telepon || '');

            if (matchedCustomer.alamat && activeOrderType === 'delivery') {
                const geocodeAndSetLocation = async (address: string) => {
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=id&limit=1`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data && data.length > 0) {
                                setDeliveryLocation({
                                    lat: parseFloat(data[0].lat),
                                    lon: parseFloat(data[0].lon),
                                    address: data[0].display_name
                                });
                            }
                        }
                    } catch (error) {
                        console.error("Geocoding failed for customer address:", error);
                        setDeliveryLocation(null);
                    }
                };
                geocodeAndSetLocation(matchedCustomer.alamat);
            }
        } else {
            setFoundCustomer(null);
        }
    }, [customerName, allCustomers, pageData, activeOrderType]);

    const handleOrderTypeChange = (type: 'delivery' | 'pickup') => {
        setActiveOrderType(type);
        if (type === 'pickup') {
            setDeliveryLocation(null);
            setCheckoutErrors(p => ({...p, location: undefined}));
        }
    };

    useEffect(() => {
        if (pageData?.branch.Alamat) {
            const geocodeAddress = async () => {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pageData.branch.Alamat)}`);
                    if (!response.ok) throw new Error('Network response was not ok for geocoding');
                    const data = await response.json();
                    if (data && data.length > 0) {
                        setPickupCoordinates({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
                    }
                } catch (error) {
                    console.error("Geocoding error for pickup location:", error);
                }
            };
            geocodeAddress();
        }
    }, [pageData?.branch.Alamat]);
    
    const resetCartAndCustomer = () => {
        setCart([]);
        setAppliedVoucher(null);
        setVoucherError(null);
        setAppliedPackagePromo(null);
        setSuggestedPackagePromo(null);
    };

    const handleProductClick = (product: Stok) => {
        if (!pageData) return;
        const variants = pageData.productVariants.filter(v => v.id_stok_product === product.id_stok);
        if (variants.length > 0) {
            setProductForModal(product);
            setIsVariantModalOpen(true);
        } else {
            addToCart(product);
        }
    };
    
    const addToCart = (product: Stok, variant: ProductVariantType | null = null) => {
        if (appliedPackagePromo) {
            if (!window.confirm("Menambahkan item akan menghapus promo paket yang sedang aktif. Lanjutkan?")) {
                return;
            }
            resetCartAndCustomer();
        }

        const cartId = `${product.id_stok}:${variant ? variant.id_variant_product : 'base'}`;
        const existingItem = cart.find(item => item.id === cartId);
        const hargaSatuan = variant?.harga_jual || product.harga || 0;
        
        if (existingItem) {
            setCart(cart.map(item => item.id === cartId ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.hargaSatuan } : item));
        } else {
            const newItem: CartItem = {
                id: cartId,
                stok: product,
                variant: variant,
                quantity: 1,
                hargaSatuan: hargaSatuan,
                totalPrice: hargaSatuan
            };
            setCart([...cart, newItem]);
        }
        setIsVariantModalOpen(false);
        setProductForModal(null);
    };
    
    const handleAddPackageToCart = (promo: Promo) => {
        if (!promo.paket_item_ids || !promo.paket_harga_total || !branchId || !pageData) return;

        if (cart.length > 0 && !window.confirm("Menambahkan paket akan mengosongkan keranjang saat ini. Lanjutkan?")) {
            return;
        }

        resetCartAndCustomer();

        const newCartItems: CartItem[] = [];
        let isAllItemsAvailable = true;

        for (const itemId of promo.paket_item_ids) {
            let product: Stok | undefined;
            let variant: ProductVariantType | null = null;
            
            if (itemId.includes(':')) {
                const [stokId, variantId] = itemId.split(':');
                product = pageData.allStocks.find(p => p.id_stok === stokId && p.id_cabang === branchId);
                variant = pageData.productVariants.find(v => v.id_variant_product === variantId && v.id_cabang === branchId) || null;
            } else {
                product = pageData.allStocks.find(p => p.id_stok === itemId && p.id_cabang === branchId);
            }

            if (!product) {
                alert(`Item dengan ID "${itemId}" dalam paket tidak ditemukan.`);
                isAllItemsAvailable = false;
                break;
            }

            const hargaSatuan = variant ? variant.harga_jual : (product.harga || 0);
            newCartItems.push({
                id: `${product.id_stok}:${variant ? variant.id_variant_product : 'base'}`,
                stok: product,
                variant: variant,
                quantity: 1, // Assume quantity 1 for each item in package
                hargaSatuan: hargaSatuan,
                totalPrice: hargaSatuan
            });
        }

        if (isAllItemsAvailable) {
            setCart(newCartItems);
            setAppliedPackagePromo(promo);
        } else {
            resetCartAndCustomer();
        }
    };

    const handleUpdateQuantity = (cartItemId: string, action: 'increment' | 'decrement' | 'remove') => {
        setCart(currentCart => {
            if (appliedPackagePromo) {
                setAppliedPackagePromo(null);
            }
            
            const itemIndex = currentCart.findIndex(item => item.id === cartItemId);
            if (itemIndex === -1) return currentCart;
    
            if (action === 'remove') {
                const newCart = currentCart.filter(item => item.id !== cartItemId);
                if (newCart.length === 0) {
                    setIsConfirmationModalOpen(false);
                }
                return newCart;
            }
    
            const updatedCart = [...currentCart];
            const itemToUpdate = { ...updatedCart[itemIndex] };
    
            if (action === 'increment') {
                itemToUpdate.quantity += 1;
            } else if (action === 'decrement') {
                if (itemToUpdate.quantity > 1) {
                    itemToUpdate.quantity -= 1;
                } else {
                    const newCart = currentCart.filter(item => item.id !== cartItemId);
                     if (newCart.length === 0) {
                        setIsConfirmationModalOpen(false);
                    }
                    return newCart;
                }
            }
            
            itemToUpdate.totalPrice = itemToUpdate.quantity * itemToUpdate.hargaSatuan;
            updatedCart[itemIndex] = itemToUpdate;
            
            return updatedCart;
        });
    };

    const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.totalPrice, 0), [cart]);
    const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

    const calculatePromoDiscount = useCallback((promo: Promo, cartItems: CartItem[], subtotal: number): { discount: number } => {
        if (!promo || !promo.aktif) return { discount: 0 };
    
        const startDate = new Date(promo.tanggal_mulai);
        const endDate = new Date(promo.tanggal_berakhir);
        endDate.setHours(23, 59, 59, 999);
        if (now < startDate || now > endDate) return { discount: 0 };
    
        const relevantItems = (promo.item_berlaku_ids && promo.item_berlaku_ids.length > 0)
          ? cartItems.filter(ci => {
              const itemId = ci.variant ? `${ci.stok.id_stok}:${ci.variant.id_variant_product}` : ci.stok.id_stok;
              const productId = ci.stok.id_stok;
              return promo.item_berlaku_ids!.includes(itemId) || promo.item_berlaku_ids!.includes(productId);
            })
          : cartItems;
    
        if (relevantItems.length === 0 && promo.item_berlaku_ids && promo.item_berlaku_ids.length > 0) return { discount: 0 };
        
        const relevantSubtotal = relevantItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const relevantQuantity = relevantItems.reduce((sum, item) => sum + item.quantity, 0);
    
        if (promo.minimal_pembelian_total && subtotal < promo.minimal_pembelian_total) return { discount: 0 };
        if (promo.minimal_pembelian_item_qty && relevantQuantity < promo.minimal_pembelian_item_qty) return { discount: 0 };
    
        let discount = 0;
        switch (promo.tipe_promo) {
          case 'persentase':
          case 'happy_hour': {
              if(promo.tipe_promo === 'happy_hour') {
                  const dayMap: DayOfWeek[] = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                  const todayDayName = dayMap[now.getDay()];
                  const timeIsInRange = promo.waktu_mulai && promo.waktu_berakhir && now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) >= promo.waktu_mulai && now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) <= promo.waktu_berakhir;
                  const dayIsValid = !promo.hari_berlaku || promo.hari_berlaku.length === 0 || promo.hari_berlaku.includes(todayDayName);
                  if (!timeIsInRange || !dayIsValid) break;
              }
      
              const discountValue = promo.nilai_diskon_persen || 0;
              if (discountValue <= 0) break;
      
              if (!promo.berulang) {
                  discount = (relevantSubtotal * discountValue) / 100;
              } else {
                  let multiplier = 0;
                  if (promo.minimal_pembelian_total && promo.minimal_pembelian_total > 0) {
                      multiplier = Math.floor(subtotal / promo.minimal_pembelian_total);
                  } else if (promo.minimal_pembelian_item_qty && promo.minimal_pembelian_item_qty > 0) {
                      multiplier = Math.floor(relevantQuantity / promo.minimal_pembelian_item_qty);
                  } else {
                      discount = (relevantSubtotal * discountValue) / 100;
                      break;
                  }
      
                  if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                      multiplier = Math.min(multiplier, promo.maksimal_berulang);
                  }
      
                  const baseValuePerApplication = promo.minimal_pembelian_total || (relevantSubtotal / multiplier);
                  const totalDiscount = (baseValuePerApplication * discountValue / 100) * multiplier;
                  discount = Math.min(totalDiscount, subtotal);
              }
              break;
          }
          
          case 'nominal':
          case 'voucher': {
              const discountValue = promo.nilai_diskon_nominal || 0;
              if (discountValue <= 0) break;
      
              if (!promo.berulang) {
                  discount = Math.min(discountValue, relevantSubtotal);
              } else {
                  let multiplier = 0;
                  if (promo.minimal_pembelian_total && promo.minimal_pembelian_total > 0) {
                      multiplier = Math.floor(subtotal / promo.minimal_pembelian_total);
                  } else if (promo.minimal_pembelian_item_qty && promo.minimal_pembelian_item_qty > 0) {
                      multiplier = Math.floor(relevantQuantity / promo.minimal_pembelian_item_qty);
                  } else {
                      discount = Math.min(discountValue, relevantSubtotal);
                      break;
                  }
      
                  if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                      multiplier = Math.min(multiplier, promo.maksimal_berulang);
                  }
      
                  const totalDiscount = discountValue * multiplier;
                  discount = Math.min(totalDiscount, subtotal);
              }
              break;
          }
          
          case 'loyalitas': {
            // A registered customer must be identified for the promo to be considered.
            if (!foundCustomer) {
                break;
            }

            const branch = pageData?.branch;
            if (!branch) {
                break; // Should not happen, but a good guard
            }

            // Check the promo's targeting mechanism.
            const isForSpecificCustomers = promo.pelanggan_berlaku_ids && promo.pelanggan_berlaku_ids.length > 0;

            if (isForSpecificCustomers) {
                // Explicit targeting: The found customer MUST be in the promo's list.
                if (!promo.pelanggan_berlaku_ids.includes(foundCustomer.id_pelanggan)) {
                    break; // This customer is not eligible.
                }
            } else {
                // Implicit targeting: The found customer MUST belong to the same group as the current branch.
                if (foundCustomer.id_grup !== branch.id_grup) {
                    break; // This customer is from a different group, not eligible.
                }
            }

            // If we reach here, the customer is eligible. Now calculate the discount.
            const discountValue = promo.nilai_diskon_nominal || 0;
            if (discountValue <= 0) break;

            if (!promo.berulang) {
                discount = Math.min(discountValue, relevantSubtotal);
            } else {
                let multiplier = 0;
                if (promo.minimal_pembelian_total && promo.minimal_pembelian_total > 0) {
                    multiplier = Math.floor(subtotal / promo.minimal_pembelian_total);
                } else if (promo.minimal_pembelian_item_qty && promo.minimal_pembelian_item_qty > 0) {
                    multiplier = Math.floor(relevantQuantity / promo.minimal_pembelian_item_qty);
                } else {
                    discount = Math.min(discountValue, relevantSubtotal);
                    break;
                }

                if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                    multiplier = Math.min(multiplier, promo.maksimal_berulang);
                }

                const totalDiscount = discountValue * multiplier;
                discount = Math.min(totalDiscount, subtotal);
            }
            break;
          }

          case 'diskon_bertingkat': {
              if (!promo.tiers) break;
              const applicableTier = [...promo.tiers].sort((a, b) => b.minimal_belanja_total_transaksi - a.minimal_belanja_total_transaksi).find(tier => subtotal >= tier.minimal_belanja_total_transaksi);
              if (applicableTier) {
                  if (applicableTier.nilai_diskon_persen) discount = (subtotal * applicableTier.nilai_diskon_persen) / 100;
                  else if (applicableTier.nilai_diskon_nominal) discount = Math.min(applicableTier.nilai_diskon_nominal, subtotal);
              }
              break;
          }
          
          case 'bogo': {
              if (!promo.bogo_beli_qty || !promo.bogo_dapat_qty) break;
              if (relevantQuantity < promo.bogo_beli_qty) break;
              
              let numPromosApplied = 1;
      
              if (promo.berulang) {
                  numPromosApplied = Math.floor(relevantQuantity / promo.bogo_beli_qty);
                  if (promo.maksimal_berulang && promo.maksimal_berulang > 0) {
                      numPromosApplied = Math.min(numPromosApplied, promo.maksimal_berulang);
                  }
              }
              
              const numFreeItems = numPromosApplied * promo.bogo_dapat_qty;
              const sortedEligibleItems = [...relevantItems].sort((a, b) => a.hargaSatuan - b.hargaSatuan);
              let freeValue = 0;
              let itemsToMakeFree = numFreeItems;
              for (const item of sortedEligibleItems) {
                  if (itemsToMakeFree <= 0) break;
                  const freeInThisItem = Math.min(itemsToMakeFree, item.quantity);
                  freeValue += freeInThisItem * item.hargaSatuan;
                  itemsToMakeFree -= freeInThisItem;
              }
              discount = freeValue;
              break;
          }
          default: discount = 0;
        }
        return { discount };
    }, [now, foundCustomer, pageData]);

    const autoPromoDetails = useMemo(() => {
        if (!pageData || cart.length === 0 || appliedVoucher || appliedPackagePromo) return { promo: null, amount: 0 };
        
        let bestDiscount = 0;
        let bestPromo: Promo | null = null;
    
        const automaticPromos = pageData.promos.filter(p => p.tipe_promo !== 'voucher' && p.tipe_promo !== 'paket');

        for (const promo of automaticPromos) {
            const { discount } = calculatePromoDiscount(promo, cart, cartSubtotal);
            if (discount > bestDiscount) {
                bestDiscount = discount;
                bestPromo = promo;
            }
        }
        return { promo: bestPromo, amount: bestDiscount };
    }, [pageData, cart, cartSubtotal, calculatePromoDiscount, appliedVoucher, appliedPackagePromo, foundCustomer]);

    const finalPromoDetails = useMemo(() => {
        if (appliedPackagePromo && appliedPackagePromo.paket_harga_total) {
            const discount = cartSubtotal - appliedPackagePromo.paket_harga_total;
            return { promo: appliedPackagePromo, amount: discount > 0 ? discount : 0 };
        }
        if (appliedVoucher) {
            const { discount } = calculatePromoDiscount(appliedVoucher, cart, cartSubtotal);
            return { promo: appliedVoucher, amount: discount };
        }
        return autoPromoDetails;
    }, [appliedVoucher, autoPromoDetails, cart, cartSubtotal, calculatePromoDiscount, appliedPackagePromo]);

    useEffect(() => {
        if (appliedVoucher) {
            const { discount } = calculatePromoDiscount(appliedVoucher, cart, cartSubtotal);
            if (discount === 0) {
                setAppliedVoucher(null);
                setVoucherError(`Voucher "${appliedVoucher.kode_voucher}" tidak lagi valid untuk keranjang saat ini dan telah dihapus.`);
            }
        }
    }, [cart, cartSubtotal, appliedVoucher, calculatePromoDiscount]);

    const handleApplyVoucher = () => {
        setVoucherError(null);
        if (!voucherCodeInput.trim() || !pageData) return;

        const promo = pageData.promos.find(p => 
            p.tipe_promo === 'voucher' && 
            p.kode_voucher?.toLowerCase() === voucherCodeInput.trim().toLowerCase() &&
            p.aktif
        );

        if (!promo) {
            setVoucherError("Kode voucher tidak valid.");
            return;
        }
        
        const startDate = new Date(promo.tanggal_mulai);
        const endDate = new Date(promo.tanggal_berakhir);
        endDate.setHours(23, 59, 59, 999);
        if (now < startDate || now > endDate) {
            setVoucherError("Voucher tidak berlaku pada periode ini.");
            return;
        }

        if (promo.minimal_pembelian_total && cartSubtotal < promo.minimal_pembelian_total) {
            setVoucherError(`Minimal pembelian Rp ${promo.minimal_pembelian_total.toLocaleString()} untuk menggunakan voucher ini.`);
            return;
        }
        
        setAppliedVoucher(promo);
        setVoucherCodeInput('');
        setAppliedPackagePromo(null); // Remove package promo if voucher is applied
    };
    
    // New: Effect for suggesting package promos
    useEffect(() => {
        setSuggestedPackagePromo(null);
        if (cart.length === 0 || appliedVoucher || appliedPackagePromo) return;
    
        const cartItemIds = new Set(cart.map(item => item.id));
        const packagePromos = pageData?.promos.filter(p => p.tipe_promo === 'paket') || [];

        for (const promo of packagePromos) {
            if (!promo.paket_item_ids) continue;
            
            const packageItemIds = new Set(promo.paket_item_ids.map(id => id.includes(':') ? id : `${id}:base`));

            if (packageItemIds.size === cartItemIds.size && [...packageItemIds].every(id => cartItemIds.has(id))) {
                setSuggestedPackagePromo(promo);
                break; 
            }
        }
    }, [cart, pageData?.promos, appliedVoucher, appliedPackagePromo]);


    const deliveryFee = useMemo(() => {
        return activeOrderType === 'delivery' && deliveryLocation ? 10000 : 0; // Example fee
    }, [activeOrderType, deliveryLocation]);

    const finalTotal = useMemo(() => {
        if (appliedPackagePromo && appliedPackagePromo.paket_harga_total) {
            return appliedPackagePromo.paket_harga_total + deliveryFee;
        }
        return cartSubtotal - finalPromoDetails.amount + deliveryFee;
    }, [cartSubtotal, finalPromoDetails, deliveryFee, appliedPackagePromo]);

    const categoryData = useMemo<CategoryData[]>(() => {
        if (!pageData) return [];
        const uniqueCategoryNames = Array.from(new Set(pageData.products.map(p => p.kategori).filter(Boolean) as string[]));
        
        const filteredCategories = uniqueCategoryNames.filter(name => name.toLowerCase() !== 'semua');

        const categoriesWithImages = filteredCategories.map(name => {
            const productWithImage = pageData.products.find(p => p.kategori === name && p.photo_url);
            return {
                name: name,
                imageUrl: productWithImage?.photo_url || 'https://i.imgur.com/eF4Z3LX.png'
            };
        });

        return categoriesWithImages;
    }, [pageData]);
    
    const filteredProducts = useMemo(() => {
        if (!pageData) return [];
        let productsToFilter = [...pageData.products];

        if (selectedPromoId) {
            const selectedPromo = pageData.promos.find(p => p.id_promo === selectedPromoId);
            if (selectedPromo && selectedPromo.item_berlaku_ids && selectedPromo.item_berlaku_ids.length > 0) {
                const applicableProductIds = new Set<string>();
                selectedPromo.item_berlaku_ids.forEach(id => {
                    const productId = id.split(':')[0];
                    applicableProductIds.add(productId);
                });
                productsToFilter = productsToFilter.filter(p => applicableProductIds.has(p.id_stok));
            }
        }
    
        if (selectedCategory) {
            productsToFilter = productsToFilter.filter(p => p.kategori === selectedCategory);
        }
        
        if (searchTerm) {
            productsToFilter = productsToFilter.filter(p => p.nama_stok.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        return productsToFilter;
    }, [pageData, selectedCategory, searchTerm, selectedPromoId]);
    
    const productListTitle = useMemo(() => {
        const titleParts = [];
        
        if (selectedCategory) {
            titleParts.push(selectedCategory);
        }
        
        const promo = pageData?.promos.find(p => p.id_promo === selectedPromoId);
        if (promo) {
            titleParts.push(promo.nama_promo);
        }
    
        if (titleParts.length === 0) {
            return 'Semua Menu';
        }
        
        return titleParts.join(' ');
    }, [selectedPromoId, selectedCategory, pageData?.promos]);

    const bestSellingItems = useMemo(() => {
        if (!pageData) return [];
        return pageData.bestSellingItems || [];
    }, [pageData]);

    const leastSellingItems = useMemo(() => {
        if (!pageData) return [];
        return pageData.leastSellingItems || [];
    }, [pageData]);

    const findPromosForItem = useCallback((item: BestSellingItem): Promo[] => {
        if (!pageData) return [];
        const applicablePromos: Promo[] = [];
        const itemId = item.item_type === 'product' ? item.id_stok : `${(item as ProductVariantType).id_stok_product}:${(item as ProductVariantType).id_variant_product}`;
        const productId = item.item_type === 'product' ? item.id_stok : (item as ProductVariantType).id_stok_product;

        for (const promo of pageData.promos) {
            if (promo.item_berlaku_ids && promo.item_berlaku_ids.length > 0) {
                if (promo.item_berlaku_ids.includes(itemId) || promo.item_berlaku_ids.includes(productId)) {
                    applicablePromos.push(promo);
                }
            } else {
                 applicablePromos.push(promo);
            }
        }
        return applicablePromos;
    }, [pageData]);

// FIX: Add helper function to get promo chip details
const getPromoChipDetails = (promo: Promo): { title: string; subtitle: string; iconUrl: string } => {
    let title = promo.nama_promo;
    let subtitle = '';
    const iconUrl = promo.banner_url || `https://picsum.photos/seed/${promo.id_promo}/50/50`;

    switch (promo.tipe_promo) {
        case 'persentase':
        case 'happy_hour':
            subtitle = `Diskon ${promo.nilai_diskon_persen}%`;
            break;
        case 'nominal':
        case 'voucher':
        case 'loyalitas':
            subtitle = `Potongan Rp ${promo.nilai_diskon_nominal?.toLocaleString('id-ID') || 0}`;
            break;
        case 'bogo':
            subtitle = `Beli ${promo.bogo_beli_qty} Gratis ${promo.bogo_dapat_qty}`;
            break;
        case 'paket':
            subtitle = `Harga spesial Rp ${promo.paket_harga_total?.toLocaleString('id-ID') || 0}`;
            break;
        case 'diskon_bertingkat':
            subtitle = 'Diskon bertingkat';
            break;
        default:
            subtitle = 'Penawaran Spesial';
            break;
    }
    
    return { title, subtitle, iconUrl };
};

    const getPromoValueForCircle = (promo: Promo): string => {
      switch (promo.tipe_promo) {
          case 'nominal':
          case 'voucher':
          case 'loyalitas':
              if (promo.nilai_diskon_nominal) {
                  if (promo.nilai_diskon_nominal >= 1000) {
                      return `Rp${promo.nilai_diskon_nominal / 1000}K`;
                  }
                  return `Rp${promo.nilai_diskon_nominal}`;
              }
              break;
          case 'persentase':
          case 'happy_hour':
              if (promo.nilai_diskon_persen) {
                  return `${promo.nilai_diskon_persen}%`;
              }
              break;
          case 'bogo':
              return 'BOGO';
          case 'paket':
               return 'hemat'
          default:
              return 'hemat';
      }
      return 'hemat';
    };

    const getPromoCardStyle = (index: number) => {
        const styles = [
            { card: 'bg-red-50 border-red-200', circle: 'bg-red-500', text: 'text-red-800', subtitle: 'text-red-600' },
            { card: 'bg-sky-50 border-sky-200', circle: 'bg-sky-500', text: 'text-sky-800', subtitle: 'text-sky-600' },
            { card: 'bg-emerald-50 border-emerald-200', circle: 'bg-emerald-500', text: 'text-emerald-800', subtitle: 'text-emerald-600' },
            { card: 'bg-amber-50 border-amber-200', circle: 'bg-amber-500', text: 'text-amber-800', subtitle: 'text-amber-600' },
            { card: 'bg-violet-50 border-violet-200', circle: 'bg-violet-500', text: 'text-violet-800', subtitle: 'text-violet-600' },
            { card: 'bg-rose-50 border-rose-200', circle: 'bg-rose-500', text: 'text-rose-800', subtitle: 'text-rose-600' }
        ];
        return styles[index % styles.length];
    };
    
    const promoPuasItems = useMemo((): PromoPuasItem[] => {
        if (!pageData) return [];
        const { promos, products, productVariants, branch } = pageData;
    
        const itemsWithPromo: PromoPuasItem[] = [];
        const activePromos = promos.filter(p => p.aktif);
    
        for (const promo of activePromos) {
            const urgency: Partial<PromoPuasItem> = {};
            const endDate = new Date(promo.tanggal_berakhir);
            const diffTime = endDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
            if (diffDays <= 1 && diffDays >= 0) {
                urgency.urgencyText = "Berakhir Hari Ini!";
                urgency.urgencyType = 'time';
                urgency.endDate = promo.tanggal_berakhir;
            } else if (diffDays <= 3 && diffDays > 1) {
                urgency.urgencyText = `Berakhir ${diffDays} hari lagi!`;
                urgency.urgencyType = 'time';
                urgency.endDate = promo.tanggal_berakhir;
            }
    
            if (promo.tipe_promo === 'happy_hour') {
                const [startH, startM] = (promo.waktu_mulai || '00:00').split(':').map(Number);
                const [endH, endM] = (promo.waktu_berakhir || '23:59').split(':').map(Number);
                const dayMap: DayOfWeek[] = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const todayDayName = dayMap[now.getDay()];
                const dayIsValid = !promo.hari_berlaku || promo.hari_berlaku.length === 0 || promo.hari_berlaku.includes(todayDayName);
    
                if (dayIsValid) {
                    const startTime = new Date(now);
                    startTime.setHours(startH, startM, 0, 0);
                    const endTime = new Date(now);
                    endTime.setHours(endH, endM, 0, 0);
    
                    if (now >= startTime && now <= endTime) {
                        const remainingMs = endTime.getTime() - now.getTime();
                        const remainingHours = Math.floor(remainingMs / 3600000);
                        const remainingMins = Math.floor((remainingMs % 3600000) / 60000);
                        urgency.urgencyText = `Berakhir dalam ${remainingHours}j ${remainingMins}m!`;
                        urgency.urgencyType = 'time';
                    }
                }
            } else if (['bogo', 'paket'].includes(promo.tipe_promo)) {
                urgency.urgencyText = "Penawaran Terbatas!";
                urgency.urgencyType = 'stock';
            } else if (promo.tipe_promo === 'voucher') {
                urgency.urgencyText = "Kuota Terbatas!";
                urgency.urgencyType = 'info';
            } else if (promo.tipe_promo === 'diskon_bertingkat') {
                urgency.urgencyText = "Belanja lebih banyak, diskon lebih besar!";
                urgency.urgencyType = 'info';
            }

            if (['voucher', 'diskon_bertingkat', 'loyalitas'].includes(promo.tipe_promo)) {
                let action: Partial<PromoPuasItem> = { actionType: 'view_items', actionText: 'Mulai Belanja', actionPayload: { promoId: null } };
                if (promo.tipe_promo === 'voucher' && promo.kode_voucher) {
                   action = { actionType: 'copy_code', actionText: 'Salin Kode', actionPayload: { codeToCopy: promo.kode_voucher }};
                   itemsWithPromo.push({ id: promo.id_promo, type: 'info', name: promo.nama_promo, imageUrl: 'https://picsum.photos/seed/voucher/200/200', branchName: branch.Nama, promoDescription: "Gunakan kode saat checkout", infoTitle: "Kode Voucher", voucherCode: promo.kode_voucher, infoLines: [promo.deskripsi || `Potongan Rp ${promo.nilai_diskon_nominal?.toLocaleString()}`], ...urgency, ...action });
                } else if (promo.tipe_promo === 'diskon_bertingkat' && promo.tiers && promo.tiers.length > 0) {
                   itemsWithPromo.push({ id: promo.id_promo, type: 'info', name: promo.nama_promo, imageUrl: 'https://picsum.photos/seed/tiered-discount/200/200', branchName: branch.Nama, promoDescription: "Diskon otomatis di kasir", infoTitle: "Cara Pakai:", infoLines: promo.tiers.map(tier => `Belanja > Rp ${tier.minimal_belanja_total_transaksi.toLocaleString()}: ${tier.nilai_diskon_persen ? `${tier.nilai_diskon_persen}% off` : `potongan Rp ${tier.nilai_diskon_nominal?.toLocaleString()}`}`), ...urgency, ...action });
                } else if (promo.tipe_promo === 'loyalitas') {
                   action = { actionType: 'navigate', actionText: 'Info Member' };
                   itemsWithPromo.push({ id: promo.id_promo, type: 'info', name: promo.nama_promo, imageUrl: 'https://picsum.photos/seed/loyalty/200/200', branchName: branch.Nama, promoDescription: "Khusus untuk member setia", infoTitle: "Keuntungan Member:", infoLines: [promo.deskripsi || `Potongan spesial untuk member.`], ...urgency, ...action });
                }
                continue;
            }
    
            if (promo.tipe_promo === 'paket') {
                if (!promo.paket_item_ids || promo.paket_item_ids.length === 0 || !promo.paket_harga_total) continue;
                let originalTotalPrice = 0;
                const itemNames: string[] = [];
                let representativeImage = 'https://picsum.photos/seed/product/200/200';
                promo.paket_item_ids.forEach((itemId, index) => {
                    let product: Stok | undefined, variant: ProductVariantType | null = null, price = 0;
                    if (itemId.includes(':')) {
                        const [stokId, variantId] = itemId.split(':');
                        product = products.find(p => p.id_stok === stokId);
                        variant = productVariants.find(v => v.id_variant_product === variantId) || null;
                        if (variant) price = variant.harga_jual;
                    } else {
                        product = products.find(p => p.id_stok === itemId);
                        if (product) price = product.harga || 0;
                    }
                    if (product) {
                        originalTotalPrice += price;
                        itemNames.push(variant ? (variant.nama_variant_product || product.nama_stok) : product.nama_stok);
                        if (index === 0) representativeImage = variant?.photo_url || product.photo_url || representativeImage;
                    }
                });
                if (originalTotalPrice > promo.paket_harga_total) {
                    itemsWithPromo.push({ id: `${promo.id_promo}-paket`, type: 'discount', name: `Paket: ${itemNames.slice(0, 2).join(' + ')}${itemNames.length > 2 ? '...' : ''}`, imageUrl: representativeImage, originalPrice: originalTotalPrice, discountedPrice: promo.paket_harga_total, discountPercentage: Math.round(((originalTotalPrice - promo.paket_harga_total) / originalTotalPrice) * 100), branchName: branch.Nama, promoDescription: promo.nama_promo, ...urgency, actionType: 'add_bundle', actionText: 'Tambah Paket', actionPayload: { promoId: promo.id_promo } });
                }
                continue;
            }

            if (!promo.item_berlaku_ids || promo.item_berlaku_ids.length === 0) continue;
    
            for (const itemId of promo.item_berlaku_ids) {
                const isVariantId = itemId.includes(':');
                const productId = isVariantId ? itemId.split(':')[0] : itemId;
                const product = products.find(p => p.id_stok === productId);
                if (!product) continue;
    
                const allVariantsForProduct = productVariants.filter(v => v.id_stok_product === product.id_stok);
                const itemsToProcess: {product: Stok, variant: ProductVariantType | null}[] = [];
    
                if (!isVariantId && allVariantsForProduct.length > 0) {
                    allVariantsForProduct.forEach(variant => itemsToProcess.push({ product, variant }));
                } else {
                    const variant = isVariantId ? productVariants.find(v => v.id_variant_product === itemId.split(':')[1]) || null : null;
                    itemsToProcess.push({ product, variant });
                }
    
                for (const { product, variant } of itemsToProcess) {
                    let originalPrice = variant ? variant.harga_jual : (product.harga || 0);
                    if (originalPrice <= 0) continue;
    
                    let discountedPrice = originalPrice, discountPercentage = 0;
                    let finalName = variant ? (variant.nama_variant_product || `${product.nama_stok} - Varian`) : product.nama_stok;
                    let promoItemImageUrl = variant?.photo_url || product.photo_url || 'https://picsum.photos/seed/product/200/200';
                    let action: Partial<PromoPuasItem> = { actionType: 'add_to_cart', actionText: 'Tambah', actionPayload: { product, variant }};
    
                    if (promo.tipe_promo === 'persentase' || promo.tipe_promo === 'nominal' || promo.tipe_promo === 'happy_hour') {
                        if (promo.tipe_promo === 'happy_hour') {
                            if (!urgency.urgencyText) continue; 
                        }
                        
                        if (promo.nilai_diskon_persen) {
                            discountedPrice = originalPrice * (1 - (promo.nilai_diskon_persen / 100));
                            discountPercentage = promo.nilai_diskon_persen;
                        } else if (promo.nilai_diskon_nominal) {
                            discountedPrice = Math.max(0, originalPrice - promo.nilai_diskon_nominal);
                            discountPercentage = Math.round((promo.nilai_diskon_nominal / originalPrice) * 100);
                        }
                    } else if (promo.tipe_promo === 'bogo') {
                        if (!promo.bogo_beli_qty || !promo.bogo_dapat_qty) continue;
                        action = { actionType: 'add_bundle', actionText: 'Ambil Promo', actionPayload: { promoId: promo.id_promo }};
                        const totalItemsToGet = promo.bogo_beli_qty + promo.bogo_dapat_qty;
                        const originalFullPrice = originalPrice * totalItemsToGet;
                        const discountedFinalPrice = originalPrice * promo.bogo_beli_qty;
                        originalPrice = originalFullPrice;
                        discountedPrice = discountedFinalPrice;
                        discountPercentage = Math.round(((originalPrice - discountedFinalPrice) / originalPrice) * 100);
                        finalName = `Beli ${promo.bogo_beli_qty} ${finalName}, Gratis ${promo.bogo_dapat_qty}`;
                    }
    
                    if (discountedPrice < originalPrice) {
                        itemsWithPromo.push({ id: `${promo.id_promo}-${(variant ? variant.id_variant_product : product.id_stok)}`, type: 'discount', name: finalName, imageUrl: promoItemImageUrl, originalPrice, discountedPrice, discountPercentage, branchName: branch.Nama, promoDescription: promo.nama_promo, ...urgency, ...action });
                    }
                }
            }
        }
        
        return Array.from(new Map(itemsWithPromo.map(item => [item.id, item])).values());
    }, [pageData, now]);
    
    const specialOfferPromos = useMemo(() => {
        if (!pageData) return [];
        return pageData.promos.filter(p => p.aktif);
    }, [pageData]);


    const handleCheckoutClick = () => {
        const errors: { name?: string; whatsapp?: string; location?: string } = {};
        if (!customerName.trim()) {
            errors.name = "Nama wajib diisi.";
        }
        if (!tableId && (!customerWhatsapp.trim() || !/^\d{9,}$/.test(customerWhatsapp))) {
            errors.whatsapp = "Nomor WhatsApp valid wajib diisi (minimal 9 digit).";
        }
        if (activeOrderType === 'delivery' && !deliveryLocation) {
            errors.location = "Lokasi pengantaran wajib dipilih.";
        }
        
        setCheckoutErrors(errors);

        if (Object.keys(errors).length === 0) {
            setIsConfirmationModalOpen(true);
        } else {
            const firstErrorKey = Object.keys(errors)[0] as keyof typeof errors;
            const element = document.getElementById(firstErrorKey === 'location' ? 'delivery-location-btn' : `customer${firstErrorKey.charAt(0).toUpperCase() + firstErrorKey.slice(1)}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element?.focus();
        }
    };

    const handleInitiatePayment = async (paymentMethod: string) => {
        if (!pageData?.branch.id_cabang) return;
        
        setIsProcessingPayment(true);
        const orderPayload: Omit<SelfOrder, 'id_self_order' | 'status' | 'created_at'> = {
            id_cabang: pageData.branch.id_cabang,
            customer_name: customerName,
            customer_phone: customerWhatsapp,
            // FIX: Map UI order types 'delivery'/'pickup' to the backend 'takeaway' type.
            order_type: tableId ? 'meja' : 'takeaway',
            id_meja: tableId,
            items: cart.map(c => ({
                id_transaction_item: c.id,
                id_stok: c.stok.id_stok,
                id_variant_product: c.variant?.id_variant_product || null,
                quantity: c.quantity,
                harga_satuan: c.variant?.harga_jual || c.stok.harga || 0,
                total_harga_item: c.totalPrice,
                catatan_item: null
            })),
            subtotal: cartSubtotal,
            discount: finalPromoDetails.amount,
            id_promo_applied: finalPromoDetails.promo?.id_promo || null,
            delivery_fee: deliveryFee,
            total: finalTotal,
            payment_method: paymentMethod
        };

        try {
            const result = await api.createSelfOrder(orderPayload);
            if(result.success && result.order) {
                if (paymentMethod === 'kasir') {
                    setIsConfirmationModalOpen(false);
                    setIsKasirSuccessModalOpen(true);
                } else {
                    const selectedMethodDetails = pageData.paymentMethods.find(pm => pm.nama_metode === paymentMethod);
                    setPendingOrder({ ...(result.order as SelfOrder), selectedMethodDetails });
                    setIsConfirmationModalOpen(false);
                }
            } else {
                 alert(result.message || "Gagal membuat pesanan. Silakan coba lagi.");
            }
        } catch (err) {
            console.error(err);
            alert("Gagal membuat pesanan. Silakan coba lagi.");
        } finally {
            setIsProcessingPayment(false);
        }
    };
    
    const handleOrderFinished = () => {
        setCart([]);
        setCustomerName(tableId ? `Meja ${tableId}` : '');
        setCustomerWhatsapp('');
        setDeliveryLocation(null);
        setPendingOrder(null);
        setIsKasirSuccessModalOpen(false);
        setAppliedVoucher(null);
        setVoucherError(null);
    };
    
    const handlePromoAction = (item: PromoPuasItem) => {
        if (!item.actionType || !item.actionPayload) return;
        
        switch (item.actionType) {
            case 'add_to_cart':
                if (item.actionPayload.product) {
                    addToCart(item.actionPayload.product, item.actionPayload.variant || null);
                }
                break;
            case 'add_bundle':
                if (item.actionPayload.promoId && pageData) {
                    const promo = pageData.promos.find(p => p.id_promo === item.actionPayload.promoId);
                    if (promo) {
                        handleAddPackageToCart(promo);
                    }
                }
                break;
            case 'copy_code':
                if(item.actionPayload.codeToCopy) {
                    navigator.clipboard.writeText(item.actionPayload.codeToCopy);
                    alert(`Kode "${item.actionPayload.codeToCopy}" telah disalin!`);
                }
                break;
            case 'view_items':
                setSelectedPromoId(item.actionPayload.promoId || null);
                document.getElementById('product-list-title')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 'navigate':
                alert("Fitur member akan segera hadir!");
                break;
            default:
                break;
        }
    };

    if (isLoading) return <div className="min-h-screen bg-slate-100 flex justify-center items-center"><SpinnerIcon className="w-12 h-12 text-sky-500"/></div>;
    if (error) return <div className="min-h-screen bg-slate-100 flex justify-center items-center text-red-500 font-semibold">{error}</div>;
    if (!pageData) return <div className="min-h-screen bg-slate-100 flex justify-center items-center text-red-500 font-semibold">Data menu tidak dapat dimuat.</div>;

    if (pendingOrder) {
        return <PaymentInstructionModal order={pendingOrder} onFinished={handleOrderFinished} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            <header className="bg-white p-4 border-b border-slate-100">
            {tableId ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-center">
                    <p className="font-bold text-lg">{`Pemesanan dari ${customerName}`}</p>
                </div>
            ) : (
                <>
                    <div className="flex space-x-2">
                        <button onClick={() => handleOrderTypeChange('pickup')} className={`flex-1 flex items-center justify-center py-2.5 rounded-full text-sm font-semibold transition-colors ${activeOrderType === 'pickup' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <ShoppingBagIcon className="w-5 h-5 mr-2" /> Pickup
                        </button>
                        <button onClick={() => handleOrderTypeChange('delivery')} className={`flex-1 flex items-center justify-center py-2.5 rounded-full text-sm font-semibold transition-colors ${activeOrderType === 'delivery' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <MotorcycleIcon className="w-5 h-5 mr-2" /> Pengantaran
                        </button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative"><fieldset className={`border ${checkoutErrors.name ? 'border-red-500' : 'border-slate-300'} rounded-md px-3 group`}><legend className={`text-xs font-medium ${checkoutErrors.name ? 'text-red-600' : 'text-slate-500'} px-1`}>ID pelanggan / nama*</legend>
                            <div className="relative flex items-center">
                                <input type="text" id="customerName" value={customerName} onChange={(e) => {setCustomerName(e.target.value); setCheckoutErrors(p => ({...p, name: undefined}));}} className={`block w-full py-2.5 outline-none bg-transparent text-sm ${foundCustomer ? 'font-bold pr-8' : 'pr-1'}`} placeholder="ID atau Nama Pelanggan" />
                                {foundCustomer && (
                                    <CheckCircleIcon className="w-5 h-5 text-green-500 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                                )}
                            </div>
                        </fieldset>{checkoutErrors.name && <p className="text-xs text-red-500 mt-1">{checkoutErrors.name}</p>}</div>
                        <div className="relative"><fieldset className={`border ${checkoutErrors.whatsapp ? 'border-red-500' : 'border-slate-300'} rounded-md px-3 group`}><legend className={`text-xs font-medium ${checkoutErrors.whatsapp ? 'text-red-600' : 'text-slate-500'} px-1`}>WhatsApp*</legend><input type="tel" id="customerWhatsapp" value={customerWhatsapp} onChange={(e) => {setCustomerWhatsapp(e.target.value); setCheckoutErrors(p => ({...p, whatsapp: undefined}));}} className="block w-full py-2.5 outline-none bg-transparent text-sm" placeholder="Nomor WhatsApp" /></fieldset>{checkoutErrors.whatsapp && <p className="text-xs text-red-500 mt-1">{checkoutErrors.whatsapp}</p>}</div>

                        {activeOrderType === 'pickup' && (
                            <div className="md:col-span-2">
                                <fieldset className="border border-slate-300 rounded-md px-3 group bg-slate-50">
                                    <legend className="text-xs font-medium text-slate-500 px-1">
                                        <div className="flex items-center justify-between w-full">
                                            <span>Lokasi Pengambilan</span>
                                            {pickupCoordinates && (
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${pickupCoordinates.lat},${pickupCoordinates.lon}`} target="_blank" rel="noopener noreferrer" className="font-normal text-sky-600 hover:underline ml-2">(Lihat Peta)</a>
                                            )}
                                        </div>
                                    </legend>
                                    <div className="block w-full py-2.5 outline-none bg-transparent text-sm text-slate-700">
                                        <p className="font-medium truncate">{pageData.branch.Alamat}</p>
                                    </div>
                                </fieldset>
                            </div>
                        )}

                        {activeOrderType === 'delivery' && (
                            <div className="md:col-span-2 space-y-2">
                                <fieldset className={`border ${checkoutErrors.location ? 'border-red-500' : 'border-slate-300'} rounded-md px-3 group`}>
                                    <legend className={`text-xs font-medium ${checkoutErrors.location ? 'text-red-600' : 'text-slate-500'} px-1`}>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span>Lokasi Pengantaran*</span>
                                                {deliveryLocation && (<a href={`https://www.google.com/maps/search/?api=1&query=${deliveryLocation.lat},${deliveryLocation.lon}`} target="_blank" rel="noopener noreferrer" className="font-normal text-sky-600 hover:underline">(Lihat Peta)</a>)}
                                            </div>
                                            <button id="delivery-location-btn" type="button" onClick={() => setIsLocationSearchModalOpen(true)} className="text-sky-600 font-semibold hover:text-sky-800 flex items-center gap-1 text-sm flex-shrink-0 ml-auto -mr-2 p-1"><MapPinIcon className="w-4 h-4"/>Pilih</button>
                                        </div>
                                    </legend>
                                    <div className="block w-full py-2.5 text-sm min-h-[2.5rem] flex items-center">
                                        {deliveryLocation ? (<p className="font-medium text-slate-800 leading-snug">{deliveryLocation.address}</p>) : (<span className="text-slate-400">Belum diatur</span>)}
                                    </div>
                                </fieldset>
                                {checkoutErrors.location && <p className="text-xs text-red-500 mt-1">{checkoutErrors.location}</p>}
                            </div>
                        )}
                    </div>
                </>
            )}
            </header>
            
            <div className="sticky top-0 bg-white z-30 p-4 shadow-sm">
                 <div className="relative">
                    <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Kamu pesan apa nih?" className="w-full bg-slate-100 rounded-full py-3 pl-11 pr-4 border border-transparent focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                </div>
            </div>

            <main className="px-4">
                <div className="my-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center">
                        <span>Penawaran Spesial</span>
                        <ChevronRightIcon className="w-6 h-6 text-slate-400 ml-1" />
                    </h2>
                    {specialOfferPromos.length > 0 ? (
                        <div className="flex space-x-3 overflow-x-auto pb-4 -mx-4 px-4">
                            {specialOfferPromos.map((promo, index) => {
                                const { card, circle, text, subtitle } = getPromoCardStyle(index);
                                const isSelected = selectedPromoId === promo.id_promo;
                                return (
                                    <button
                                        key={promo.id_promo}
                                        onClick={() => setSelectedPromoId(prev => prev === promo.id_promo ? null : promo.id_promo)}
                                        className={`flex-shrink-0 w-64 rounded-xl p-4 flex items-center space-x-4 shadow-lg transition-all duration-200 border ${card} ${isSelected ? 'ring-2 ring-sky-500 ring-offset-2' : ''}`}
                                    >
                                        <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md border-4 border-white/30 ${circle}`}>
                                            <span>{getPromoValueForCircle(promo)}</span>
                                        </div>
                                        <div className="flex-grow min-w-0 text-left">
                                            <h2 className={`font-bold text-lg truncate ${text}`} title={promo.nama_promo}>{promo.nama_promo}</h2>
                                            <p className={`text-sm opacity-90 mt-1 line-clamp-2 ${subtitle}`} title={promo.deskripsi || ''}>{promo.deskripsi || 'Promo spesial untukmu!'}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">Saat ini tidak ada penawaran spesial.</p>
                    )}
                </div>

                <div className="my-6">
                  {categoryData.length > 0 && (
                     <>
                        <div className="flex space-x-3 overflow-x-auto pb-2 -mx-4 px-4">
                            {categoryData.map(cat => (
                                <button 
                                    key={cat.name} 
                                    onClick={() => {
                                        setSelectedCategory(prev => prev === cat.name ? null : cat.name);
                                    }} 
                                    className={`flex-shrink-0 text-center group ${selectedCategory === cat.name ? 'font-bold text-sky-600' : 'text-slate-600'}`}
                                >
                                    <div className={`w-16 h-16 rounded-full p-1 border-2 transition-colors ${selectedCategory === cat.name ? 'border-sky-500' : 'border-transparent group-hover:border-slate-300'}`}>
                                        <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover rounded-full"/>
                                    </div>
                                    <span className="block text-xs mt-1.5">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                     </>
                  )}
                </div>
                
                <div className="my-6">
                    <h2 id="product-list-title" className="text-xl font-bold text-slate-800 mb-2 capitalize">{productListTitle}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
                        {filteredProducts.map(product => {
                            const variantsForProduct = pageData.productVariants.filter(v => v.id_stok_product === product.id_stok);
                            return (<ProductCard key={product.id_stok} product={product} onProductClick={handleProductClick} variants={variantsForProduct} />)
                        })}
                        {filteredProducts.length === 0 && (<p className="text-center text-slate-500 py-10 sm:col-span-2 lg:col-span-3">Tidak ada produk yang cocok.</p>)}
                    </div>
                </div>
                
                <div className="my-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center">
                        <span>Wajib Kamu Coba</span>
                        <ChevronRightIcon className="w-6 h-6 text-slate-400 ml-1" />
                    </h2>
                    <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4">
                        {bestSellingItems.map(item => {
                            if (item.item_type === 'variant') {
                                const variant = item as ProductVariantType;
                                const parentProduct = pageData?.products.find(p => p.id_stok === variant.id_stok_product);
                                if (!parentProduct) return null;

                                return (
                                    <div 
                                        key={`must-try-${variant.id_variant_product}`} 
                                        onClick={() => addToCart(parentProduct, variant)}
                                        className="flex-shrink-0 w-40 bg-white rounded-xl shadow-md overflow-hidden group cursor-pointer transition-transform hover:scale-105"
                                    >
                                        <img 
                                            src={variant.photo_url || parentProduct.photo_url || 'https://picsum.photos/seed/product/200/200'} 
                                            alt={variant.nama_variant_product || parentProduct.nama_stok} 
                                            className="w-full h-24 object-cover"
                                        />
                                        <div className="p-3">
                                            <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight group-hover:text-sky-600" title={variant.nama_variant_product || parentProduct.nama_stok}>
                                                {variant.nama_variant_product || parentProduct.nama_stok}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 truncate" title={parentProduct.nama_stok}>
                                                {parentProduct.nama_stok}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-900 mt-2">
                                                Rp {variant.harga_jual.toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                );
                            } else {
                                const product = item as Stok;
                                return (
                                    <div 
                                        key={`must-try-${product.id_stok}`} 
                                        onClick={() => handleProductClick(product)}
                                        className="flex-shrink-0 w-40 bg-white rounded-xl shadow-md overflow-hidden group cursor-pointer transition-transform hover:scale-105"
                                    >
                                        <img 
                                            src={product.photo_url || 'https://picsum.photos/seed/product/200/200'} 
                                            alt={product.nama_stok} 
                                            className="w-full h-24 object-cover"
                                        />
                                        <div className="p-3">
                                            <h3 className="font-bold text-sm text-slate-800 truncate group-hover:text-sky-600" title={product.nama_stok}>
                                                {product.nama_stok}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 truncate" title={product.kategori || ''}>
                                                {product.kategori || 'Produk'}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-900 mt-2">
                                                Rp {(product.harga || 0).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>

                {promoPuasItems.length > 0 && (
                    <div className="my-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center">
                            <span>Promo Puas</span>
                            <ChevronRightIcon className="w-6 h-6 text-slate-400 ml-1" />
                        </h2>
                        <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4">
                            {promoPuasItems.map(item => {
                                if (item.type === 'discount') {
                                    return (
                                        <div 
                                            key={item.id} 
                                            className="flex-shrink-0 w-40 bg-white rounded-xl shadow-md overflow-hidden group flex flex-col"
                                        >
                                            <div className="relative">
                                                <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover"/>
                                                {item.discountPercentage && item.discountPercentage > 0 && (
                                                    <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow">
                                                        -{item.discountPercentage}%
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 flex flex-col h-[calc(100%-6rem)] flex-grow">
                                                <div className="flex items-center text-xs text-orange-600 font-semibold mb-1">
                                                    <TagIcon className="w-4 h-4 mr-1"/>
                                                    PROMO
                                                </div>
                                                <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight flex-grow" title={item.name}>
                                                    {item.name}
                                                </h3>
                                                <div className="mt-2">
                                                    <p className="text-sm font-bold text-slate-900">
                                                        Rp {item.discountedPrice?.toLocaleString('id-ID')}
                                                    </p>
                                                     <p className="text-xs text-slate-500 line-through">
                                                        Rp {item.originalPrice?.toLocaleString('id-ID')}
                                                    </p>
                                                </div>
                                                {item.actionType && item.actionText && (
                                                    <button onClick={() => handlePromoAction(item)} className="w-full mt-2 text-center text-xs font-bold bg-sky-500 text-white py-1.5 rounded-md hover:bg-sky-600 transition-colors">
                                                        {item.actionText}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div 
                                            key={item.id} 
                                            className="flex-shrink-0 w-40 bg-white rounded-xl shadow-md overflow-hidden group flex flex-col"
                                        >
                                            <div className="relative">
                                                <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover"/>
                                                <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow">
                                                    INFO
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col h-[calc(100%-6rem)] flex-grow">
                                                <div className="flex items-center text-xs text-blue-600 font-semibold mb-1">
                                                    <TagIcon className="w-4 h-4 mr-1"/>
                                                    PROMO
                                                </div>
                                                <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight" title={item.name}>
                                                    {item.name}
                                                </h3>
                                                <div className="flex-grow mt-2">
                                                    {item.voucherCode ? (
                                                        <div className="text-center bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg p-2 h-full flex flex-col justify-center">
                                                            <p className="text-xs text-slate-500">Kode:</p>
                                                            <p className="font-mono font-bold text-slate-800 tracking-wider">{item.voucherCode}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-500 space-y-1">
                                                            {item.infoLines?.map((line, idx) => <p key={idx} className="line-clamp-2">- {line}</p>)}
                                                        </div>
                                                    )}
                                                </div>
                                                 {item.actionType && item.actionText && (
                                                    <button onClick={() => handlePromoAction(item)} className="w-full mt-2 text-center text-xs font-bold bg-sky-500 text-white py-1.5 rounded-md hover:bg-sky-600 transition-colors">
                                                        {item.actionText}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                            {promoPuasItems.length === 0 && (
                                <div className="w-full text-center py-4 bg-slate-100 rounded-lg">
                                    <p className="text-sm text-slate-500">Saat ini belum ada Promo Puas.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="my-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
                        <span>Disarankan untukmu</span>
                        <ChevronRightIcon className="w-6 h-6 text-slate-400 ml-1" />
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                        {leastSellingItems.map(item => {
                            const promos = findPromosForItem(item);
                            const product = item.item_type === 'product' ? item as Stok : pageData?.products.find(p => p.id_stok === (item as ProductVariantType).id_stok_product);
                            const variant = item.item_type === 'variant' ? item as ProductVariantType : null;
                            if (!product) return null;

                            const price = variant ? variant.harga_jual : product.harga || 0;
                            const name = variant ? (variant.nama_variant_product || product.nama_stok) : product.nama_stok;
                            const photo = variant?.photo_url || product.photo_url || 'https://picsum.photos/seed/product/200/200';

                            const clickHandler = () => {
                                if (variant) {
                                    addToCart(product, variant);
                                } else {
                                    handleProductClick(product);
                                }
                            };

                            return (
                                <div key={`rec-${item.item_type}-${variant ? variant.id_variant_product : product.id_stok}`} 
                                     onClick={clickHandler}
                                     className="flex items-start space-x-4 py-4 border-b border-slate-100 cursor-pointer group"
                                >
                                    <img src={photo} alt={name} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                                    <div className="flex-grow flex flex-col min-w-0">
                                        <div>
                                            <h3 className="font-bold text-slate-800 group-hover:text-sky-600 transition-colors">{name}</h3>
                                            <p className="text-sm text-slate-600 mt-1">Rp {price.toLocaleString('id-ID')}</p>
                                        </div>
                                        
                                        {promos.length > 0 && (
                                            <div className="mt-2">
                                                <div className="flex space-x-2 overflow-x-auto pb-2 -ml-1">
                                                    {promos.map(promo => {
                                                        const { title, subtitle, iconUrl } = getPromoChipDetails(promo);
                                                        return (
                                                            <div key={promo.id_promo} className="flex-shrink-0 flex items-center space-x-2 bg-white border border-slate-200 rounded-lg p-2 pr-3 shadow-sm max-w-[200px]">
                                                                <img src={iconUrl} alt="promo icon" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-xs text-slate-700 truncate" title={title}>{title}</p>
                                                                    <p className="text-xs text-slate-500 truncate" title={subtitle}>{subtitle}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {leastSellingItems.length === 0 && <p className="text-center text-slate-500 py-10 sm:col-span-2 lg:col-span-3">Tidak ada rekomendasi saat ini.</p>}
                    </div>
                </div>
                
                <div className="my-12 text-center border-t border-slate-200 pt-8">
                    <p className="text-slate-500 mb-4">Anda adalah karyawan?</p>
                    <Link 
                        to="/login" 
                        className="inline-flex items-center justify-center px-8 py-3 bg-slate-800 text-white font-bold rounded-full shadow-lg hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-2" />
                        Login
                    </Link>
                </div>

            </main>

            {cartItemCount > 0 && (
                <div className="fixed bottom-4 left-4 right-4 z-40">
                    <button onClick={handleCheckoutClick} className="w-full max-w-lg mx-auto bg-sky-600 text-white rounded-full shadow-lg p-3 flex justify-between items-center animate-fade-in hover:bg-sky-700 transition-colors">
                        <div className="flex items-center"><div className="relative mr-3"><ShoppingCartIcon className="w-6 h-6"/><span className="absolute -top-1 -right-1.5 bg-white text-sky-600 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartItemCount}</span></div><span className="font-semibold text-lg">Rp {finalTotal.toLocaleString('id-ID')}</span></div>
                        <div className="font-bold py-2 px-6 rounded-full text-sm">Pesan</div>
                    </button>
                </div>
            )}
            
            {isVariantModalOpen && productForModal && pageData && (
                <VariantSelectionModal 
                    product={productForModal}
                    variants={pageData.productVariants.filter(v => v.id_stok_product === productForModal.id_stok)}
                    onClose={() => setIsVariantModalOpen(false)}
                    onAddToCart={addToCart}
                />
            )}
            {isLocationSearchModalOpen && (
                <LocationSearchModal
                    initialLocation={deliveryLocation}
                    onClose={() => setIsLocationSearchModalOpen(false)}
                    onLocationSelect={(location) => {
                        setDeliveryLocation(location);
                        setIsLocationSearchModalOpen(false);
                        setCheckoutErrors(p => ({...p, location: undefined}));
                    }}
                />
            )}

            {isConfirmationModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setIsConfirmationModalOpen(false)}>
                    <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
                        <header className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Pesanan</h2>
                            <button onClick={() => setIsConfirmationModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><XMarkIcon className="w-6 h-6" /></button>
                        </header>
                        <div className="flex-grow p-4 overflow-y-auto">
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.id} className="py-3 border-b border-slate-100 last:border-b-0">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-semibold text-slate-800 pr-2">
                                                {item.stok.nama_stok}
                                                {item.variant && ` - ${item.variant.nama_variant_product}`}
                                            </p>
                                             <button type="button" onClick={() => handleUpdateQuantity(item.id, 'remove')} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0" aria-label={`Hapus ${item.stok.nama_stok}`}><XMarkIcon className="w-4 h-4" /></button>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center space-x-2 text-slate-600">
                                                <button type="button" onClick={() => handleUpdateQuantity(item.id, 'decrement')} className="p-0.5 text-slate-500 hover:text-sky-600 rounded-full"><MinusCircleIcon className="w-5 h-5"/></button>
                                                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                                                <button type="button" onClick={() => handleUpdateQuantity(item.id, 'increment')} className="p-0.5 text-slate-500 hover:text-sky-600 rounded-full"><PlusCircleIcon className="w-5 h-5"/></button>
                                                <span className="text-xs">@ Rp {item.hargaSatuan.toLocaleString('id-ID')}</span>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800">Rp {item.totalPrice.toLocaleString('id-ID')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                             {suggestedPackagePromo && (
                                <div className="my-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                                    <p className="text-sm font-semibold text-emerald-800">Terapkan promo "{suggestedPackagePromo.nama_promo}"?</p>
                                    <p className="text-xs text-emerald-600 mb-2">Anda akan hemat Rp {(cartSubtotal - (suggestedPackagePromo.paket_harga_total || 0)).toLocaleString('id-ID')}</p>
                                    <button onClick={() => setAppliedPackagePromo(suggestedPackagePromo)} className="px-4 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full hover:bg-emerald-600">Terapkan Diskon Paket</button>
                                </div>
                            )}
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                                <div className="flex items-center"><p className="text-xs font-semibold text-slate-500 uppercase">Kode Voucher</p></div>
                                {appliedVoucher ? (
                                    <div className="bg-green-50 p-3 rounded-lg flex justify-between items-center">
                                        <span className="font-semibold text-green-800">{appliedVoucher.kode_voucher}</span>
                                        <button onClick={() => { setAppliedVoucher(null); setVoucherError(null); }} className="text-sm font-medium text-red-600 hover:text-red-800">Hapus</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex space-x-2">
                                            <input type="text" value={voucherCodeInput} onChange={e => setVoucherCodeInput(e.target.value)} placeholder="Masukkan kode voucher" className="form-input flex-grow text-sm"/>
                                            <button type="button" onClick={handleApplyVoucher} className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700">Terapkan</button>
                                        </div>
                                        {voucherError && <p className="text-xs text-red-500">{voucherError}</p>}
                                    </>
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal</span><span>Rp {cartSubtotal.toLocaleString('id-ID')}</span></div>
                                {finalPromoDetails.amount > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Potongan Promo ({finalPromoDetails.promo?.nama_promo})</span>
                                        <span>- Rp {finalPromoDetails.amount.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {deliveryFee > 0 && (
                                    <div className="flex justify-between text-sm"><span className="text-slate-600">Biaya Pengantaran</span><span>Rp {deliveryFee.toLocaleString('id-ID')}</span></div>
                                )}
                                <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                                    <span className="text-slate-800">Total Akhir</span>
                                    <span>Rp {finalTotal.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                            {tableId ? (
                                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                    <div className="flex items-center"><p className="text-xs font-semibold text-slate-500 uppercase">Detail Pemesanan</p></div>
                                    <div className="bg-slate-50 p-3 rounded-lg text-sm"><p className="font-semibold">{`Pemesanan dari ${customerName}`}</p></div>
                                </div>
                            ) : (
                                <>
                                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                                        <div className="flex items-center"><p className="text-xs font-semibold text-slate-500 uppercase">Detail Pelanggan</p></div>
                                        <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">ID pelanggan / nama*</legend>
                                            <div className="relative flex items-center">
                                                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className={`block w-full py-2 outline-none bg-transparent text-sm font-medium ${foundCustomer ? 'font-bold pr-8' : 'pr-1'}`} />
                                                {foundCustomer && (
                                                    <CheckCircleIcon className="w-5 h-5 text-green-500 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                )}
                                            </div>
                                        </fieldset></div>
                                        <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs font-medium text-slate-500 px-1">WhatsApp*</legend><input type="tel" value={customerWhatsapp} onChange={e => setCustomerWhatsapp(e.target.value)} className="block w-full py-2 outline-none bg-transparent text-sm font-medium"/></fieldset></div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                                        <div className="flex items-center"><p className="text-xs font-semibold text-slate-500 uppercase">Detail Pengambilan/Pengantaran</p></div>
                                        <div className="bg-slate-50 p-3 rounded-lg text-sm">
                                            <p className="font-semibold capitalize">{activeOrderType === 'delivery' ? 'Pengantaran' : 'Pickup'}</p>
                                            <p className="text-slate-600 mt-1">{activeOrderType === 'delivery' ? deliveryLocation?.address : pageData.branch.Alamat}</p>
                                            {activeOrderType === 'delivery' && <button onClick={() => setIsLocationSearchModalOpen(true)} className="text-sky-600 font-semibold text-xs mt-2 hover:underline">Ubah Alamat</button>}
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                                <div className="flex items-center"><p className="text-xs font-semibold text-slate-500 uppercase">Metode Pembayaran</p></div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {tableId && (
                                        <button onClick={() => handleInitiatePayment('kasir')} disabled={isProcessingPayment} className="bg-slate-100 p-3 rounded-lg text-sm font-semibold flex flex-col items-center justify-center space-y-2 border-2 border-slate-200 hover:border-slate-400 transition-colors disabled:opacity-50">
                                            <PencilSquareIcon className="w-6 h-6 text-slate-700"/><span>Bayar di Kasir</span>
                                        </button>
                                    )}
                                    {pageData.paymentMethods.map(method => (
                                        <button key={method.id_metode} onClick={() => tableId ? handleInitiatePayment(method.nama_metode) : setSelectedPaymentMethod(method.nama_metode)} disabled={isProcessingPayment} className={`w-full bg-slate-100 p-3 rounded-lg text-sm font-semibold flex flex-col items-center justify-center space-y-2 border-2 transition-colors disabled:opacity-50 ${!tableId && selectedPaymentMethod === method.nama_metode ? 'border-sky-500 ring-2 ring-sky-200' : 'border-slate-200 hover:border-slate-400'}`}>
                                            {method.logo_url ? <img src={method.logo_url} alt={method.nama_metode} className="w-6 h-6 object-contain" /> : <QrCodeIcon className="w-6 h-6 text-slate-700"/>}
                                            <span>{method.nama_metode}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {!tableId && (
                            <footer className="p-4 border-t border-slate-100">
                                <button 
                                    onClick={() => selectedPaymentMethod && handleInitiatePayment(selectedPaymentMethod)} 
                                    disabled={isProcessingPayment || !selectedPaymentMethod}
                                    className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-slate-900 disabled:bg-slate-400 flex items-center justify-center"
                                >
                                    {isProcessingPayment ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : null}
                                    {isProcessingPayment ? 'Memproses...' : `Lanjutkan Pembayaran (Rp ${finalTotal.toLocaleString('id-ID')})`}
                                </button>
                            </footer>
                        )}
                    </div>
                </div>
            )}
            
            {isKasirSuccessModalOpen && (
                <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-4 z-50 text-center">
                    <CheckCircleIcon className="w-24 h-24 text-green-500 mb-4"/>
                    <h2 className="text-2xl font-bold text-slate-800">Pesanan Berhasil Diterima!</h2>
                    <p className="text-slate-500 mt-2">Pesanan Anda sedang disiapkan di dapur.</p>
                    <p className="text-slate-500 mt-1">Silakan lakukan pembayaran di kasir nanti.</p>
                    <div className="mt-8">
                        <button onClick={handleOrderFinished} className="bg-slate-800 text-white font-semibold py-3 px-8 rounded-lg hover:bg-slate-700">
                            Selesai & Buat Pesanan Baru
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SelfOrderPage;
