// SHARED: File ini mendefinisikan semua struktur data (interface dan type) yang digunakan di seluruh aplikasi.
// Ini berfungsi sebagai "kontrak data" yang memastikan konsistensi antara komponen frontend dan simulasi backend.
// Penggunaannya di kedua sisi membuatnya menjadi bagian 'shared' (bersama).

// Provide minimal React type declarations to avoid requiring @types/react in this project
// This is a lightweight fallback for environments where @types/react is not installed.
declare namespace React {
  export interface SVGProps<T = SVGSVGElement> {
    [key: string]: any;
  }
  export interface SVGSVGElement {}
  export type FC<P = {}> = (props: P & { children?: any }) => any;
}

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export type IconComponent = React.FC<IconProps>;

export interface SubMenuItem {
  name: string;
  path: string;
  icon?: IconComponent | string; // Allow string for icon name during config
}

export interface MenuItem {
  name:string;
  path: string; // Used if no subItems, or as a base for subItems paths
  icon?: IconComponent | string; // Allow string for icon name during config
  subItems?: SubMenuItem[];
}

export interface Grup {
  id_grup: string;
  nama_grup: string;
  manajer?: string | null;
  target_tahunan: number;
  npwp?: string | null;
  pajak_reg: number | null;
}

export interface Branch {
  id_cabang: string;
  id_grup: string; 
  Nama: string; // Branch Name
  Alamat: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Role {
  id_grup: string; // Wajib
  id_cabang: string | null; // Opsional, null berarti berlaku untuk semua cabang di grup
  id_role: string; // Kunci unik global
  role: string; // Kategori umum: 'administrator', 'user', 'system'
  Nama_role: string; // Nama tampilan
}

export interface User {
  id_user: string;
  id_karyawan?: string | null; // Replaces 'nama', links to Karyawan
  username: string;
  password?: string; // Optional on read, required on create/update
  id_cabang?: string; // Optional for system-level users like superuser
  id_role: string; // Merujuk ke id_role yang unik secara global
}

// --- HRM & Related Types ---

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export interface Karyawan {
  id_karyawan: string;
  id_grup: string;
  nama_lengkap: string;
  id_user: string | null;
  id_cabang: string;
  posisi: string;
  departemen: string;
  tanggal_masuk: string; // ISO Date string
  status_karyawan: 'aktif' | 'tidak_aktif' | 'cuti' | 'resign';
  email: string | null;
  telepon: string | null;
  alamat: string | null;
  tanggal_lahir: string | null; // ISO Date string
  jenis_kelamin: 'L' | 'P' | null;
  foto_url: string | null;
  gaji_pokok: number | null;
}

export interface TitikAbsensi {
  id_titik_absensi: string;
  id_cabang: string;
  nama_titik: string;
  alamat: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  aktif: boolean;
  wajib_di_dalam_radius: boolean;
  jam_masuk: string; // HH:MM
  jam_pulang: string; // HH:MM
}

export interface AbsensiLog {
  id_absensi_log: string;
  id_karyawan: string;
  id_grup: string;
  id_cabang_karyawan: string;
  waktu_clock_in: string; // ISO datetime
  latitude_clock_in: number;
  longitude_clock_in: number;
  id_titik_absensi_clock_in: string | null;
  status_clock_in: 'valid' | 'luar_area' | 'gagal_gps';
  foto_clock_in_url: string | null;
  waktu_clock_out: string | null; // ISO datetime
  latitude_clock_out: number | null;
  longitude_clock_out: number | null;
  id_titik_absensi_clock_out: string | null;
  status_clock_out: 'valid' | 'luar_area' | 'gagal_gps' | null;
  foto_clock_out_url: string | null;
  catatan_karyawan?: string | null;
}

export interface PayrollComponent {
  id_payroll_component: string;
  id_grup: string; // Wajib, untuk scoping komponen ke grup tertentu
  id_cabang: string | null; // Opsional, null berarti berlaku untuk semua cabang di grup
  nama_component: string;
  type: 'pendapatan' | 'potongan';
  calculation_type: 'fixed' | 'hourly' | 'manual';
  amount: number | null; // amount for fixed, rate for hourly, null for manual
}

export interface PayrollDetail {
  id_payroll_component: string;
  nama_component: string;
  type: 'pendapatan' | 'potongan';
  amount: number;
  quantity: number | null; // This field is used for hourly components
}

export interface Payroll {
  id_payroll: string;
  id_karyawan: string;
  id_cabang: string;
  periode_bulan: number;
  periode_tahun: number;
  tanggal_pembayaran: string | null; // ISO date
  status: 'draft' | 'published' | 'paid';
  details: PayrollDetail[];
  total_pendapatan: number;
  total_potongan: number;
  total_gaji_bersih: number;
}

export interface ScheduledTask {
  id_task: string;
  id_cabang: string | null; // null for all branches
  nama_task: string;
  tipe_ulangi: 'sekali' | 'harian' | 'mingguan';
  tanggal_sekali: string | null; // YYYY-MM-DD
  hari_mingguan: DayOfWeek[];
  aktif: boolean;
}

// Types for Access Management (original, for route access)
export interface PermissionCRUD {
  read: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
}

export type RoleAccessPermissions = Record<string, PermissionCRUD>; // Key is menu/submenu path

export type AllRoleAccessData = Record<string, RoleAccessPermissions>; // Key is id_role or composite key (id_cabang_id_role)


// New Types for detailed "Akses Menu" page
export interface AksesMenuAction {
  id: string; // e.g., 'view_page', 'tambah_grup'
  label: string; // e.g., 'View Page', 'Tambah Grup'
}

export interface AksesMenuConfigItem {
  id: string; // Unique ID for this config item, can be menu path or a custom ID
  label: string; // Display label
  path?: string; // Optional: original menu path if it maps to directly
  actions: AksesMenuAction[];
  subItems?: AksesMenuConfigItem[];
  isInitiallyExpanded?: boolean; // Optional: To control initial expanded state
}

export interface AksesMenuItemPermissions {
  masterChecked: boolean;
  actions: Record<string, boolean>; // Key is action.id (e.g., 'view_page')
}

// Key: aksesMenuConfigItem.id
export type RoleSpecificAksesMenuPermissions = Record<string, AksesMenuItemPermissions>; 

// Key: id_role (sekarang menjadi unik)
export type AllRolesAksesMenuDetailData = Record<string, RoleSpecificAksesMenuPermissions>;


// Stok Management Types
export interface Stok {
  id_stok: string; // e.g., P1, M1 (generated per branch per type)
  id_cabang: string;
  type: 'material' | 'wip' | 'product';
  nama_stok: string;
  kategori?: string; // New optional field for product category
  unit: string; // References id_unit from Unit type
  unit_netto?: string | null;
  netto?: number | null;
  quantity: number | null;
  stok_kritis: number | null;
  harga: number | null; // Represents 'Harga Jual Satuan'
  harga_beli: number | null; // NEW: Represents 'Harga Beli' / 'Harga Pokok'
  photo_url: string | null;
  tampil_di_opname: boolean;
  barcode?: string | null; // New optional field for barcode scanning
  stasiun_dapur?: string | null; // For KDS routing
}

export interface MaterialVariant {
  id_variant_material: string; // e.g., VM1 (unique per parent stock)
  id_cabang: string;           // Foreign key to Branch
  id_stok: string;             // Foreign key to Parent Stok (material/wip type)
  nama_variant: string;
  unit: string;                // Unit of the variant, references id_unit from Unit type
  unit_netto?: string | null;
  netto?: number | null;
  quantity: number;            // Stock quantity of this variant
  stok_kritis: number | null;
  harga_beli: number | null; // NEW: Represents 'Harga Beli' / 'Harga Pokok'
  tampil_di_opname: boolean;   // New field: whether to show in stock opname
  barcode?: string | null;
}

export interface ProductVariant {
  id_variant_product: string; // e.g., VP1 (unique per parent product stock and branch)
  id_cabang: string;
  id_stok_product: string;    // Parent Product ID (must be type: 'product')
  nama_variant_product?: string; // Optional: User-defined name for this specific combination
  id_varian_detail: string; // New field from image, e.g., "vm1 (rasa mangga), vm3 (ukuran kecil)"
  harga_jual: number;
  barcode?: string | null;
  hpp?: number; // Calculated HPP/COGS
  photo_url?: string | null;
}

// BOM Types
export interface BOMEntryKomponenStok {
  type: 'stok';
  id_stok: string; // id_stok of the component
}

export interface BOMEntryKomponenMaterialVariant {
  type: 'material_variant';
  id_stok_material: string; // Parent id_stok of the material variant
  id_variant_material: string; // id_variant_material of the component
}

export type BOMEntryKomponen = BOMEntryKomponenStok | BOMEntryKomponenMaterialVariant;

export interface BOMEntry {
  id_bom: string; // e.g., BM1 (unique globally or per branch)
  id_grup: string;
  id_cabang: string;
  id_stok_product: string;    // The product this BOM defines (must be type: 'product')
  id_variant_product: string | null; // The specific variant of the product, or null if BOM for base product
  komponen: BOMEntryKomponen; // Details of the component
  unit_komponen: string;      // Unit of the component (derived from component at time of adding), references id_unit from Unit type
  quantity_komponen: number;  // Quantity of the component needed for one unit of the parent product/variant
}

export interface GroupedBom {
    productKey: string;
    id_grup: string;
    id_cabang: string;
    id_stok_product: string;
    id_variant_product: string | null;
    productName: string;
    variantName: string;
    totalHpp: number;
    components: BOMEntry[];
}

// Unit Management Type
export interface Unit {
  id_unit: string;
  id_grup: string;
  id_cabang: string | null;
  nama_unit: string;
  deskripsi_unit?: string;
}

// Transaction Types
export interface TransactionItem {
  id_transaction_item: string; // Auto-generated unique ID for this item within the transaction
  id_stok: string; // Product ID from Stok
  id_variant_product: string | null; // Optional ProductVariant ID
  quantity: number;
  harga_satuan: number; // Price per unit at the time of transaction
  total_harga_item: number; // quantity * harga_satuan
  catatan_item?: string | null; // Per-item notes from POS
  diskon_item?: number | null; // Discount amount applied to this specific item line
}

// New Master Data for Payment Methods
export interface PaymentMethod {
  id_metode: string;
  id_grup: string; // Wajib
  id_cabang: string | null; // Opsional, null berarti berlaku untuk semua cabang di grup
  nama_metode: string;
  tipe_metode: 'Cash' | 'Card' | 'E-Wallet' | 'Transfer' | 'Lainnya';
  aktif: boolean;
  logo_url?: string | null;
  qris_image_url?: string | null;
  nomor_pembayaran?: string | null;
  nama_rekening?: string | null;
  biaya_layanan?: number | null; // Bisa persentase (e.g., 1.5) atau nominal (e.g., 2500)
}


// export type PaymentMethod = 'Tunai' | 'Kartu Debit/Kredit' | 'QRIS' | 'Lainnya'; // Deprecated in favor of master data

export interface CheckoutDetails {
  payments: { method: string; amount: number }[]; // All payments for the whole transaction
  split_method: 'none' | 'even' | 'item';
  split_count?: number;
  split_bills?: { 
    items: TransactionItem[]; 
    subtotal: number;       // NEW: Subtotal for this bill before discount
    discount: number;       // NEW: Discount amount for this bill
    total: number;          // Total for this bill (subtotal - discount)
    payments: { method: string; amount: number }[];
  }[];
  unique_code_amount?: number;
}

export interface Transaction {
  id_transaksi: string; // Unique ID for the entire transaction, e.g., T20230101-001
  id_reff?: string | null; // New field for reference ID
  id_cabang: string;
  id_grup: string;
  datetime: string; // ISO datetime string (e.g., "2023-10-27T14:30:05.000Z")
  id_user: string; // User ID from User type
  id_pelanggan?: string | null; // New field for customer link
  asal_data?: 'POS' | 'Form Transaksi' | 'Self-Order' | 'POS Dine-in'; // Source of this transaction
  items: TransactionItem[];
  subtotal_sebelum_diskon?: number | null;
  diskon_tipe?: 'persentase' | 'nominal' | null;
  diskon_nilai?: number | null;
  id_promo_applied?: string | null; // New field for applied promo ID
  biaya_pengantaran?: number | null;
  total_keseluruhan: number; // Sum of all total_harga_item in items
  metode_pembayaran?: string | 'Split' | 'Partial'; // Now uses string
  catatan?: string; // Optional notes for the transaction
  status_pembayaran?: 'lunas' | 'belum lunas' | 'sebagian'; // New optional field
  tanggal_jatuh_tempo?: string | null; // New optional field
  total_hpp?: number; // Calculated total cost of goods sold for this transaction
  laba_kotor?: number; // Calculated gross profit for this transaction
  checkout_details?: CheckoutDetails; // New field
  status_pesanan?: 'menunggu_persiapan' | 'sedang_dibuat' | 'selesai' | 'dihidangkan' | 'menunggu_pembayaran' | null; // For KDS & Self-Order
}

// Self Order Type
export interface SelfOrder {
    id_self_order: string;
    id_cabang: string;
    customer_name: string;
    customer_phone: string;
    order_type: 'meja' | 'takeaway';
    id_meja: string | null;
    items: TransactionItem[];
    subtotal: number;
    discount: number;
    id_promo_applied?: string | null;
    delivery_fee: number;
    total: number;
    payment_method: string;
    status: 'menunggu_pembayaran' | 'menunggu_konfirmasi_pembayaran' | 'diproses';
    created_at: string; // ISO datetime
}

// Customer Management Type
export interface Customer {
  id_pelanggan: string;
  id_grup: string;
  nama_pelanggan: string;
  telepon: string | null;
  email: string | null;
  alamat: string | null;
  tanggal_daftar: string; // ISO Date string
}

// Promotion Management Types
export interface PromoTier {
  minimal_belanja_total_transaksi: number;
  nilai_diskon_persen?: number | null;
  nilai_diskon_nominal?: number | null;
}

export interface Promo {
  id_promo: string; 
  id_grup: string; // null for all groups is deprecated. Now mandatory.
  id_cabang: string | null; // null for all branches in the specified group.
  nama_promo: string;
  banner_url?: string | null;
  tipe_promo: 'persentase' | 'nominal' | 'bogo' | 'voucher' | 'paket' | 'diskon_bertingkat' | 'happy_hour' | 'loyalitas';
  nilai_diskon_persen?: number | null; 
  nilai_diskon_nominal?: number | null; 
  bogo_beli_qty?: number | null; 
  bogo_dapat_qty?: number | null; 
  kode_voucher?: string | null; 
  
  // For 'paket'
  paket_item_ids?: string[] | null; 
  paket_harga_total?: number | null; 

  // For 'diskon_bertingkat'
  tiers?: PromoTier[] | null;

  // For 'happy_hour'
  waktu_mulai?: string | null; // HH:MM
  waktu_berakhir?: string | null; // HH:MM
  hari_berlaku?: DayOfWeek[] | null; // Array of day names e.g., ["Senin", "Minggu"]

  // For 'loyalitas'
  pelanggan_berlaku_ids?: string[] | null;

  tanggal_mulai: string; 
  tanggal_berakhir: string; 
  item_berlaku_ids?: string[] | null; 
  minimal_pembelian_total?: number | null; 
  minimal_pembelian_item_qty?: number | null; 
  deskripsi?: string | null;
  aktif: boolean;
  berulang?: boolean;
  maksimal_berulang?: number | null;
}

// Delivery Fee Settings Types
export interface DeliveryFeeTier {
    id: string; // for React keys
    upToKm: number;
    fee: number;
}

export interface DeliveryFeeSettings {
    id_cabang: string;
    id_grup: string;
    aktif: boolean;
    tipe: 'flat' | 'distance';
    // Flat rate
    flat_rate: number | null;
    // Distance based
    base_fee: number | null;
    tiers: DeliveryFeeTier[];
    fee_per_km_after_last_tier: number | null; 
    // Common
    free_shipping_threshold: number | null;
    // Branch location for calculation
    latitude: number | null;
    longitude: number | null;
}


// --- Stok Opname Types (Updated) ---
export interface StokOpnameItem {
  id_stok_opname_item: string; // Auto-generated unique ID for this item within the opname
  id_stok: string; // Parent Stok ID (from Stok type)
  id_variant_material: string | null; // MaterialVariant ID, if applicable
  
  // Display fields (populated at opname creation)
  nama_stok_display: string;
  unit_display: string; 
  
  qty_system: number; // Quantity in system at time of opname
  qty_fisik: number | null; // Quantity counted by staff (nullable if not yet counted)
  selisih: number; // qty_fisik - qty_system (auto-calculated)

  catatan_staff_item?: string; // Optional notes from staff for this specific item

  // Admin confirmation part
  catatan_admin?: string; // Optional notes from admin for this specific item
  is_confirmed_admin?: boolean; // Admin confirms this item's count for stock adjustment
}

export interface StokOpname {
  id_stok_opname: string;
  nama_opname: string;
  id_grup: string;
  id_cabang: string;
  tanggal_opname_mulai: string; // ISO datetime when opname started
  tanggal_opname_submit?: string | null;
  tanggal_opname_konfirmasi?: string | null;
  id_user_staff: string; // User who started/submitted
  id_user_admin?: string | null; // User who confirmed
  status: 'draft' | 'submitted' | 'confirmed' | 'cancelled';
  items: StokOpnameItem[];
  catatan_staff?: string | null;
  catatan_admin_header?: string | null;
}

// --- Balance Stok, Purchasing ---
export interface BalanceStok {
  id_balance_stok: string;
  id_grup: string;
  id_cabang: string;
  id_transaksi: string | null; // Can be from transaction, opname, or manual
  type: 'stok masuk' | 'stok keluar' | 'keluar POS' | 'stok selisih nambah opname' | 'stok selisih kurang opname';
  item_id: string; // Can be id_stok or id_variant_material
  item_is_variant: boolean;
  quantity: number;
  unit_id: string; // FK to Unit
  tanggal: string; // ISO datetime
  id_user: string; // FK to User
}

export interface PurchaseOrder {
  id_purchase_order: string;
  id_cabang: string;
  tanggal_po: string; // ISO Date string
  status: 'draft' | 'menunggu persetujuan' | 'disetujui' | 'ditolak' | 'selesai';
  supplier_name: string;
  total_amount: number;
}

// --- Reports ---
export interface MergedStockItem {
    id: string;
    id_cabang: string;
    nama_cabang: string;
    item_id: string;
    nama_item: string;
    tipe: string;
    quantity: number | null;
    unit: string;
    stok_kritis: number | null;
    is_critical: boolean;
    barcode: string | null;
}

export interface InventoryValuationData {
    id: string;
    id_cabang: string;
    nama_cabang: string;
    item_id: string;
    nama_item: string;
    tipe: string;
    quantity: number;
    harga_beli: number;
    total_value: number;
}

// --- Dine-in ---
export type MejaStatus = 'Tersedia' | 'Terisi' | 'Dipesan' | 'Perlu Dibersihkan';

export interface Meja {
  id_meja: string;
  id_cabang: string;
  id_grup: string;
  nama_meja: string;
  // New Descriptive Fields
  kapasitas: number;
  lokasi: string; // e.g., 'Indoor', 'Outdoor', 'Lantai 2'
  tipe: string; // e.g., 'Bulat', 'Persegi', 'Sofa'
  durasi_maksimal_menit: number | null; // Maximum allowed seating time in minutes
  // New Operational Fields
  status: MejaStatus;
  id_pesanan_aktif: string | null;
  waktu_terisi: string | null; // ISO datetime string
  id_server: string | null; // Karyawan ID
  nama_pelanggan_reservasi: string | null;
  jumlah_tamu_reservasi: number | null;
  telepon_pelanggan_reservasi: string | null;
}

// --- Module Activation ---
export interface ModuleActivationSettings {
  bom: boolean;
  kds: boolean;
}

// --- Notification System ---
export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string; // ISO string
  isRead: boolean;
  link?: string; // Optional link to a relevant page
}

// --- Self Order Page ---
export interface PromoPuasItem {
    id: string;
    type: 'discount' | 'info';
    name: string;
    imageUrl: string;
    branchName: string;
    promoDescription: string;
    
    // For 'discount' type
    originalPrice?: number;
    discountedPrice?: number;
    discountPercentage?: number;

    // For 'info' type
    infoTitle?: string;
    infoLines?: string[];
    voucherCode?: string;
    
    // Urgency fields
    urgencyText?: string;
    urgencyType?: 'time' | 'stock' | 'info';
    endDate?: string;

    // New fields for interactivity
    actionType?: 'add_to_cart' | 'add_bundle' | 'copy_code' | 'view_items' | 'navigate';
    actionText?: string;
    actionPayload?: {
      product?: Stok;
      variant?: ProductVariant;
      bundleItems?: string[];
      bogoQty?: number;
      codeToCopy?: string;
      promoId?: string;
    };
}