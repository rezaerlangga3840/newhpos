// BACKEND: File ini bertindak sebagai database dalam memori (in-memory database) untuk aplikasi.
// Ini berisi semua array data mentah. Dalam aplikasi nyata, ini akan menjadi database seperti PostgreSQL, MySQL, atau MongoDB.

import { User, Role, Branch, Grup, Stok, MaterialVariant, ProductVariant, BOMEntry, Unit, Transaction, Promo, StokOpname, Karyawan, TitikAbsensi, AbsensiLog, PayrollComponent, Payroll, BalanceStok, AllRoleAccessData, AllRolesAksesMenuDetailData, ScheduledTask, PurchaseOrder, Customer, Meja, ModuleActivationSettings, SelfOrder, PaymentMethod, DeliveryFeeSettings, RoleSpecificAksesMenuPermissions, AksesMenuConfigItem } from '../types';
import { aksesMenuStructure } from '../constants'; // Import the structure

// KONFIGURASI SIMULASI
export const SIMULATED_DELAY = 100; // ms

// --- ARRAY DATA ---
// Array ini adalah "tabel" dalam database kita. Mereka tidak diekspor
// dan hanya boleh diakses dan diubah melalui fungsi-fungsi di `api.ts`.

export let INITIAL_GRUP_DATA: Grup[] = [
  { id_grup: 'GR1', nama_grup: 'PT Maju Jaya', manajer: 'Budi Santoso', target_tahunan: 5000000, npwp: '12.345.678.9-012.000', pajak_reg: 11 },
  { id_grup: 'GR2', nama_grup: 'CV Orang Luar', manajer: null, target_tahunan: 2000000, npwp: null, pajak_reg: 10 },
  { id_grup: 'GR3', nama_grup: 'Resto Ayam Bakar', manajer: null, target_tahunan: 1500000, npwp: '98.765.432.1-098.000', pajak_reg: null },
];

export let INITIAL_BRANCHES_DATA: Branch[] = [
  { id_cabang: 'CB1', id_grup: 'GR1', Nama: 'Cabang 1', Alamat: 'Gedangan, Sidoarjo, Jawa Timur, Indonesia', latitude: -7.40, longitude: 112.71 },
  { id_cabang: 'CB2', id_grup: 'GR1', Nama: 'Cabang 2', Alamat: 'Surabaya, Jawa Timur, Indonesia', latitude: -7.25, longitude: 112.75 },
  { id_cabang: 'CB3', id_grup: 'GR2', Nama: 'Bangca A', Alamat: 'Mojokerto, Jawa Timur, Indonesia', latitude: -7.47, longitude: 112.43 },
  { id_cabang: 'CB4', id_grup: 'GR2', Nama: 'Bangca B', Alamat: 'Gresik, Jawa Timur, Indonesia', latitude: -7.15, longitude: 112.65 },
  { id_cabang: 'CB5', id_grup: 'GR3', Nama: 'Cabang 1', Alamat: 'Sidoarjo, Jawa Timur, Indonesia', latitude: -7.44, longitude: 112.71 },
];

export let INITIAL_ROLES_DATA: Role[] = [
  { id_grup: 'GR1', id_cabang: 'CB1', id_role: 'RL1', role: 'administrator', Nama_role: 'administrator1 (CB1)' },
  { id_grup: 'GR2', id_cabang: 'CB3', id_role: 'RL2', role: 'administrator', Nama_role: 'administrator2 (CB3)' },
  { id_grup: 'GR2', id_cabang: 'CB4', id_role: 'RL3', role: 'user', Nama_role: 'kasir (CB4)' },
  { id_grup: '__SYSTEM__', id_cabang: '__SYSTEM__', id_role: 'superuser', role: 'system', Nama_role: 'Super User (System)' },
  { id_grup: 'GR1', id_cabang: 'CB1', id_role: 'RL4', role: 'user', Nama_role: 'kasirpos (CB1)' },
  { id_grup: 'GR1', id_cabang: null, id_role: 'RL5', role: 'user', Nama_role: 'Auditor Grup' }, // Contoh Role Level Grup
];

export let INITIAL_USERS_DATA: User[] = [
  { id_user: 'US1', id_karyawan: null, username: 'superuser', password: "'", id_role: 'superuser' },
  { id_user: 'US2', id_karyawan: 'KRY1', username: 'administrator_cb1', password: "'", id_cabang: 'CB1', id_role: 'RL1' },
  { id_user: 'US3', id_karyawan: null, username: 'administrator_cb3', password: "'", id_cabang: 'CB3', id_role: 'RL2' },
  { id_user: 'US4', id_karyawan: 'KRY2', username: 'kasir_cb4', password: "'", id_cabang: 'CB4', id_role: 'RL3' },
  { id_user: 'US5', id_karyawan: 'KRY3', username: 'cinta', password: "'", id_cabang: 'CB1', id_role: 'RL4' }, // Updated from RL2 to RL4
];

export let INITIAL_KARYAWAN_DATA: Karyawan[] = [
  {
    id_karyawan: 'KRY1',
    id_grup: 'GR1',
    nama_lengkap: 'Budi Santoso',
    id_user: 'US2',
    id_cabang: 'CB1',
    posisi: 'Manajer Cabang',
    departemen: 'Operasional',
    tanggal_masuk: '2022-01-15',
    status_karyawan: 'aktif',
    email: 'budi.santoso@example.com',
    telepon: '081234567890',
    alamat: 'Jl. Pahlawan No. 1, Gedangan',
    tanggal_lahir: '1985-05-20',
    jenis_kelamin: 'L',
    foto_url: 'https://i.pravatar.cc/150?u=budi.santoso',
    gaji_pokok: 5000000
  },
  {
    id_karyawan: 'KRY2',
    id_grup: 'GR2',
    nama_lengkap: 'Siti Aminah',
    id_user: 'US4',
    id_cabang: 'CB4',
    posisi: 'Kasir Senior',
    departemen: 'Penjualan',
    tanggal_masuk: '2023-03-01',
    status_karyawan: 'aktif',
    email: 'siti.aminah@example.com',
    telepon: '087654321098',
    alamat: 'Jl. Merdeka No. 10, Gresik',
    tanggal_lahir: '1995-11-10',
    jenis_kelamin: 'P',
    foto_url: 'https://i.pravatar.cc/150?u=siti.aminah',
    gaji_pokok: 3500000
  },
  {
    id_karyawan: 'KRY3',
    id_grup: 'GR1',
    nama_lengkap: 'Cinta Laura Kiehl',
    id_user: 'US5',
    id_cabang: 'CB1',
    posisi: 'Kasir',
    departemen: 'Penjualan',
    tanggal_masuk: '2024-01-01',
    status_karyawan: 'aktif',
    email: 'cinta.laura@example.com',
    telepon: '081122334455',
    alamat: 'Jl. Sudirman Kav. 12, Surabaya',
    tanggal_lahir: '1993-08-17',
    jenis_kelamin: 'P',
    foto_url: 'https://i.pravatar.cc/150?u=cinta.laura',
    gaji_pokok: 3000000
  },
  {
    id_karyawan: 'KRY4',
    id_grup: 'GR1',
    nama_lengkap: 'Ahmad Dhani',
    id_user: null,
    id_cabang: 'CB2',
    posisi: 'Supervisor Gudang',
    departemen: 'Logistik',
    tanggal_masuk: '2021-06-10',
    status_karyawan: 'aktif',
    email: 'ahmad.dhani@example.com',
    telepon: '081212121212',
    alamat: 'Jl. Industri No. 5, Surabaya',
    tanggal_lahir: '1972-05-26',
    jenis_kelamin: 'L',
    foto_url: 'https://i.pravatar.cc/150?u=ahmad.dhani',
    gaji_pokok: 4000000
  },
];

export let INITIAL_UNIT_DATA: Unit[] = [
  { id_unit: 'U1', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'kg', deskripsi_unit: 'Kilogram' },
  { id_unit: 'U2', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'gr', deskripsi_unit: 'Gram' },
  { id_unit: 'U3', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'pcs', deskripsi_unit: 'Pieces / Buah' },
  { id_unit: 'U4', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'ml', deskripsi_unit: 'Mililiter' },
  { id_unit: 'U5', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'L', deskripsi_unit: 'Liter' },
  { id_unit: 'U6', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'cup', deskripsi_unit: 'Cangkir / Gelas Plastik' },
  { id_unit: 'U7', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'botol', deskripsi_unit: 'Botol' },
  { id_unit: 'U8', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'box', deskripsi_unit: 'Kotak / Dus' },
  { id_unit: 'U9', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'pack', deskripsi_unit: 'Pak / Kemasan' },
  { id_unit: 'U10', id_grup: 'GR1', id_cabang: 'CB1', nama_unit: 'roll', deskripsi_unit: 'Gulungan' },
];

export let INITIAL_STOCK_DATA: Stok[] = [
  // Item dengan varian: Data kuantitas, netto, harga beli, di-handle di level varian -> null di sini. tampil_di_opname -> false.
  { id_stok: 'P1', id_cabang: 'CB1', type: 'product', nama_stok: 'Es Sticky Milk', kategori: 'Minuman Dingin', unit: 'U6', unit_netto: null, netto: null, quantity: null, stok_kritis: null, harga: null, harga_beli: null, photo_url: 'https://picsum.photos/seed/es-sticky-milk/50/50', tampil_di_opname: false, barcode: null },
  { id_stok: 'M1', id_cabang: 'CB1', type: 'material', nama_stok: 'Bubuk Rasa', kategori: 'Bahan Baku', unit: 'U9', unit_netto: null, netto: null, quantity: null, stok_kritis: null, harga: null, harga_beli: null, photo_url: 'https://picsum.photos/seed/bubuk-rasa/50/50', tampil_di_opname: false, barcode: null },
  { id_stok: 'M2', id_cabang: 'CB1', type: 'material', nama_stok: 'Susu Cokelat', kategori: 'Bahan Baku', unit: 'U9', unit_netto: null, netto: null, quantity: null, stok_kritis: null, harga: null, harga_beli: null, photo_url: null, tampil_di_opname: false, barcode: null },
  { id_stok: 'M3', id_cabang: 'CB1', type: 'material', nama_stok: 'Cup', kategori: 'Packaging', unit: 'U3', unit_netto: null, netto: null, quantity: null, stok_kritis: null, harga: null, harga_beli: null, photo_url: null, tampil_di_opname: false, barcode: null },
  { id_stok: 'M4', id_cabang: 'CB1', type: 'material', nama_stok: 'Topping', kategori: 'Bahan Baku', unit: 'U9', unit_netto: null, netto: null, quantity: null, stok_kritis: null, harga: null, harga_beli: null, photo_url: null, tampil_di_opname: false, barcode: null },
  { id_stok: 'M5', id_cabang: 'CB2', type: 'material', nama_stok: 'Tepung Terigu Premium', kategori: 'Bahan Baku', unit: 'U1', unit_netto: null, netto: null, quantity: null, stok_kritis: 15, harga: null, harga_beli: null, photo_url: null, tampil_di_opname: false, barcode: null },

  // Item tanpa varian: Data diisi lengkap.
  { id_stok: 'P2', id_cabang: 'CB1', type: 'product', nama_stok: 'Teh Botol Sosro Dingin', kategori: 'Minuman Kemasan', unit: 'U7', unit_netto: 'U4', netto: 250, quantity: 48, stok_kritis: 20, harga: 5000, harga_beli: 3500, photo_url: 'https://picsum.photos/seed/tehbotol/50/50', tampil_di_opname: true, barcode: '8998899010015' },
  { id_stok: 'P3', id_cabang: 'CB3', type: 'product', nama_stok: 'Kopi Susu Mantap', kategori: 'Kopi', unit: 'U6', unit_netto: 'U4', netto: 200, quantity: 120, stok_kritis: 25, harga: 15000, harga_beli: 7000, photo_url: 'https://picsum.photos/seed/kopisusu/50/50', tampil_di_opname: true, barcode: '1122334455667' },
  { id_stok: 'P4', id_cabang: 'CB1', type: 'product', nama_stok: 'Burger Klasik', kategori: 'Makanan Utama', unit: 'U3', unit_netto: 'U2', netto: 180, quantity: 8, stok_kritis: 10, harga: 25000, harga_beli: 12000, photo_url: 'https://picsum.photos/seed/burger/50/50', tampil_di_opname: true, barcode: '1234567890123' },
  { id_stok: 'P5', id_cabang: 'CB1', type: 'product', nama_stok: 'Kentang Goreng', kategori: 'Makanan Ringan', unit: 'U9', unit_netto: 'U2', netto: 250, quantity: 100, stok_kritis: 30, harga: 15000, harga_beli: 8000, photo_url: 'https://picsum.photos/seed/kentang/50/50', tampil_di_opname: true, barcode: '9876543210987' },
];

export let INITIAL_MATERIAL_VARIANTS_DATA: MaterialVariant[] = [
  { id_cabang: 'CB1', id_stok: 'M1', id_variant_material: 'VM1', nama_variant: 'Mangga', unit: 'U9', unit_netto: 'U2', netto: 1000, quantity: 1240, stok_kritis: 250, harga_beli: 55, tampil_di_opname: true, barcode: '8991111000012' },
  { id_cabang: 'CB1', id_stok: 'M1', id_variant_material: 'VM10', nama_variant: 'Durian', unit: 'U9', unit_netto: 'U2', netto: 1000, quantity: 1995, stok_kritis: 400, harga_beli: 60, tampil_di_opname: true, barcode: '8991111000029' },
  { id_cabang: 'CB1', id_stok: 'M1', id_variant_material: 'VM11', nama_variant: 'anggur', unit: 'U9', unit_netto: 'U2', netto: 1000, quantity: 1300, stok_kritis: 300, harga_beli: 58, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB1', id_stok: 'M2', id_variant_material: 'VM2', nama_variant: 'Cokelat Premium', unit: 'U9', unit_netto: 'U2', netto: 1000, quantity: 1200, stok_kritis: 200, harga_beli: 80, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB1', id_stok: 'M3', id_variant_material: 'VM3', nama_variant: 'Kecil', unit: 'U9', unit_netto: 'U3', netto: 50, quantity: 48, stok_kritis: 100, harga_beli: 450, tampil_di_opname: true, barcode: '8993333000014' },
  { id_cabang: 'CB1', id_stok: 'M3', id_variant_material: 'VM4', nama_variant: 'Sedang', unit: 'U9', unit_netto: 'U3', netto: 50, quantity: 250, stok_kritis: 100, harga_beli: 500, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB1', id_stok: 'M3', id_variant_material: 'VM5', nama_variant: 'Besar', unit: 'U9', unit_netto: 'U3', netto: 50, quantity: 250, stok_kritis: 100, harga_beli: 600, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB1', id_stok: 'M4', id_variant_material: 'VM6', nama_variant: 'Oreo Crumbs', unit: 'U9', unit_netto: 'U2', netto: 500, quantity: 400, stok_kritis: 150, harga_beli: 110, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB1', id_stok: 'M4', id_variant_material: 'VM7', nama_variant: 'Kacang Cincang', unit: 'U9', unit_netto: 'U2', netto: 500, quantity: 300, stok_kritis: 100, harga_beli: 90, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB2', id_stok: 'M5', id_variant_material: 'VM8', nama_variant: 'Protein Tinggi', unit: 'U1', unit_netto: 'U1', netto: 1, quantity: 4, stok_kritis: 5, harga_beli: 15000, tampil_di_opname: true, barcode: null },
  { id_cabang: 'CB2', id_stok: 'M5', id_variant_material: 'VM9', nama_variant: 'Rendah Gluten', unit: 'U1', unit_netto: 'U1', netto: 1, quantity: 30, stok_kritis: 10, harga_beli: 13000, tampil_di_opname: true, barcode: null },
];

export let INITIAL_PRODUCT_VARIANTS_DATA: ProductVariant[] = [
  { id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP1', nama_variant_product: 'Mangga Kecil', id_varian_detail: "VM1,VM3", harga_jual: 10000, barcode: '8992222000019', photo_url: 'https://picsum.photos/seed/mangga-kecil/50/50' },
  { id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP2', nama_variant_product: 'Mangga Sedang', id_varian_detail: "VM1,VM4", harga_jual: 15000, barcode: '8992222000026', photo_url: 'https://picsum.photos/seed/mangga-sedang/50/50' },
  { id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP3', nama_variant_product: 'Mangga Besar Topping Kacang', id_varian_detail: "VM1,VM5,VM7", harga_jual: 20000, barcode: null, photo_url: 'https://picsum.photos/seed/mangga-kacang/50/50' },
  { id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP4', nama_variant_product: 'Durian Kecil', id_varian_detail: "VM10,VM3", harga_jual: 10000, barcode: null, photo_url: 'https://picsum.photos/seed/durian-kecil/50/50' },
  { id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP5', nama_variant_product: 'Durian Sedang', id_varian_detail: "VM10,VM4", harga_jual: 15000, barcode: null, photo_url: null },
  { id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP6', nama_variant_product: 'Durian Besar', id_varian_detail: "VM10,VM5", harga_jual: 20000, barcode: null, photo_url: null },
];

export let INITIAL_BOM_DATA: BOMEntry[] = [
  { id_bom: 'BM1', id_grup: 'GR1', id_cabang: 'CB1', id_stok_product: 'P2', id_variant_product: null, komponen: { type: 'stok', id_stok: 'P2' }, unit_komponen: 'U7', quantity_komponen: 1 },
  { id_bom: 'BM2', id_grup: 'GR1', id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP1', komponen: { type: 'material_variant', id_stok_material: 'M1', id_variant_material: 'VM1' }, unit_komponen: 'U2', quantity_komponen: 30 },
  { id_bom: 'BM3', id_grup: 'GR1', id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP1', komponen: { type: 'material_variant', id_stok_material: 'M3', id_variant_material: 'VM3' }, unit_komponen: 'U3', quantity_komponen: 1 },
  { id_bom: 'BM4', id_grup: 'GR1', id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP3', komponen: { type: 'material_variant', id_stok_material: 'M1', id_variant_material: 'VM1' }, unit_komponen: 'U2', quantity_komponen: 50 },
  { id_bom: 'BM5', id_grup: 'GR1', id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP3', komponen: { type: 'material_variant', id_stok_material: 'M3', id_variant_material: 'VM5' }, unit_komponen: 'U3', quantity_komponen: 1 },
  { id_bom: 'BM6', id_grup: 'GR1', id_cabang: 'CB1', id_stok_product: 'P1', id_variant_product: 'VP3', komponen: { type: 'material_variant', id_stok_material: 'M4', id_variant_material: 'VM7' }, unit_komponen: 'U2', quantity_komponen: 10 }
];

export let INITIAL_TRANSACTIONS_DATA: Transaction[] = [
  {
    id_transaksi: 'T20231027-001',
    id_reff: 'INV/2023/X/27/001',
    id_cabang: 'CB1',
    id_grup: 'GR1',
    datetime: '2023-10-27T10:30:00.000Z',
    id_user: 'US4',
    asal_data: 'POS',
    items: [
      { id_transaction_item: 'TI1', id_stok: 'P1', id_variant_product: 'VP1', quantity: 2, harga_satuan: 10000, total_harga_item: 20000 },
      { id_transaction_item: 'TI2', id_stok: 'P2', id_variant_product: null, quantity: 1, harga_satuan: 5000, total_harga_item: 5000 },
    ],
    total_keseluruhan: 25000,
    metode_pembayaran: 'QRIS',
    catatan: 'Pelanggan minta esnya jangan terlalu manis.',
    status_pembayaran: 'lunas',
    tanggal_jatuh_tempo: null,
  },
  {
    id_transaksi: 'T20231028-001',
    id_reff: 'T-MANUAL-1755262127588',
    id_cabang: 'CB4',
    id_grup: 'GR2',
    datetime: '2023-10-28T14:45:15.000Z',
    id_user: 'US4',
    asal_data: 'Form Transaksi',
    items: [
      { id_transaction_item: 'TI3', id_stok: 'P1', id_variant_product: 'VP6', quantity: 3, harga_satuan: 20000, total_harga_item: 60000 },
    ],
    total_keseluruhan: 60000,
    metode_pembayaran: 'Tunai',
    status_pembayaran: 'belum lunas',
    tanggal_jatuh_tempo: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
  },
];

export let INITIAL_CUSTOMERS_DATA: Customer[] = [
    { id_pelanggan: 'CUST1', id_grup: 'GR1', nama_pelanggan: 'Andi Setiawan', telepon: '08123456789', email: 'andi.s@example.com', alamat: 'Jl. Merdeka 1', tanggal_daftar: '2023-01-15T00:00:00.000Z' },
    { id_pelanggan: 'CUST2', id_grup: 'GR1', nama_pelanggan: 'Rina Kartika', telepon: '08567891234', email: 'rina.k@example.com', alamat: 'Jl. Pahlawan 2', tanggal_daftar: '2023-02-20T00:00:00.000Z' },
    { id_pelanggan: 'CUST3', id_grup: 'GR2', nama_pelanggan: 'Toko Sebelah', telepon: '0315551234', email: null, alamat: 'Jl. Industri 3', tanggal_daftar: '2023-03-01T00:00:00.000Z' },
];

export let INITIAL_PROMO_DATA: Promo[] = [
  {
    id_promo: 'PRM1',
    id_grup: 'GR1',
    id_cabang: 'CB1',
    nama_promo: 'Diskon Akhir Pekan Kopi',
    banner_url: 'https://picsum.photos/seed/promo-kopi/400/200',
    tipe_promo: 'persentase',
    nilai_diskon_persen: 10,
    nilai_diskon_nominal: 5000,
    tanggal_mulai: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
    tanggal_berakhir: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
    item_berlaku_ids: ['P3'],
    minimal_pembelian_total: 20000,
    deskripsi: 'Nikmati diskon 10% untuk Kopi Susu Mantap setiap akhir pekan, maks. diskon Rp 5.000.',
    aktif: true,
    berulang: false,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM2',
    id_grup: 'GR1',
    id_cabang: null,
    nama_promo: 'Potongan Langsung Teh Botol',
    banner_url: null,
    tipe_promo: 'nominal',
    nilai_diskon_nominal: 2000,
    tanggal_mulai: new Date().toISOString(),
    tanggal_berakhir: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
    item_berlaku_ids: ['P2'],
    minimal_pembelian_item_qty: 1,
    deskripsi: 'Dapatkan potongan Rp 2.000 setiap pembelian Teh Botol Sosro Dingin.',
    aktif: true,
    berulang: false,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM3',
    id_grup: 'GR1',
    id_cabang: 'CB1',
    nama_promo: 'Beli 2 Gratis 1 Es Sticky Milk',
    banner_url: 'https://picsum.photos/seed/promo-bogo/400/200',
    tipe_promo: 'bogo',
    bogo_beli_qty: 2,
    bogo_dapat_qty: 1,
    tanggal_mulai: new Date().toISOString(),
    tanggal_berakhir: new Date(new Date().getFullYear(), 11, 31).toISOString(),
    item_berlaku_ids: ['P1'],
    minimal_pembelian_item_qty: 2,
    deskripsi: 'Beli 2 Es Sticky Milk (varian apa saja), dapatkan 1 Es Sticky Milk (varian terkecil) gratis.',
    aktif: true,
    berulang: true,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM4',
    id_grup: 'GR1',
    id_cabang: null,
    nama_promo: 'Voucher Gajian Hemat',
    banner_url: null,
    tipe_promo: 'voucher',
    kode_voucher: 'GAJIANSERU',
    nilai_diskon_nominal: 15000,
    minimal_pembelian_total: 100000,
    tanggal_mulai: new Date().toISOString(),
    tanggal_berakhir: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
    aktif: true,
    deskripsi: 'Potongan Rp 15.000 dengan min. belanja Rp 100.000',
    berulang: false,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM5',
    id_grup: 'GR1',
    id_cabang: 'CB1',
    nama_promo: 'Paket Combo Kenyang',
    banner_url: 'https://picsum.photos/seed/promo-paket/400/200',
    tipe_promo: 'paket',
    paket_item_ids: ['P4', 'P5'],
    paket_harga_total: 35000,
    tanggal_mulai: new Date().toISOString(),
    tanggal_berakhir: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    aktif: true,
    deskripsi: 'Paket Burger Klasik dan Kentang Goreng lebih hemat!',
    berulang: false,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM6',
    id_grup: 'GR1',
    id_cabang: null,
    nama_promo: 'Makin Banyak, Makin Murah!',
    banner_url: null,
    tipe_promo: 'diskon_bertingkat',
    tiers: [
      { minimal_belanja_total_transaksi: 50000, nilai_diskon_persen: 5, nilai_diskon_nominal: null },
      { minimal_belanja_total_transaksi: 100000, nilai_diskon_persen: 10, nilai_diskon_nominal: null },
      { minimal_belanja_total_transaksi: 150000, nilai_diskon_persen: null, nilai_diskon_nominal: 20000 }
    ],
    tanggal_mulai: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
    tanggal_berakhir: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    aktif: true,
    deskripsi: 'Diskon hingga Rp 20.000 untuk total belanja Anda.',
    berulang: false,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM7',
    id_grup: 'GR1',
    id_cabang: 'CB1',
    nama_promo: 'Happy Hour Es Sticky Milk',
    banner_url: null,
    tipe_promo: 'happy_hour',
    nilai_diskon_persen: 20,
    waktu_mulai: '14:00',
    waktu_berakhir: '17:00',
    hari_berlaku: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
    item_berlaku_ids: ['P1'],
    tanggal_mulai: new Date().toISOString(),
    tanggal_berakhir: new Date(new Date().getFullYear(), 11, 31).toISOString(),
    aktif: true,
    deskripsi: 'Diskon 20% untuk semua varian Es Sticky Milk setiap hari kerja jam 2-5 sore.',
    berulang: false,
    maksimal_berulang: null,
  },
  {
    id_promo: 'PRM8',
    id_grup: 'GR2',
    id_cabang: null,
    nama_promo: 'Member Special Burger',
    banner_url: null,
    tipe_promo: 'loyalitas',
    nilai_diskon_nominal: 5000,
    item_berlaku_ids: ['P4'],
    tanggal_mulai: new Date(new Date().getFullYear(), 0, 1).toISOString(),
    tanggal_berakhir: new Date(new Date().getFullYear(), 11, 31).toISOString(),
    aktif: true,
    deskripsi: 'Potongan khusus member Rp 5.000 untuk Burger Klasik.',
    berulang: false,
    maksimal_berulang: null,
  }
];

export let INITIAL_STOK_OPNAME_DATA: StokOpname[] = [
    {
      id_stok_opname: 'SO-CB1-20240520-001',
      nama_opname: 'Opname Bulanan Bahan Baku',
      id_grup: 'GR1',
      id_cabang: 'CB1',
      tanggal_opname_mulai: '2024-05-20T08:00:00.000Z',
      tanggal_opname_submit: '2024-05-20T17:00:00.000Z',
      tanggal_opname_konfirmasi: '2024-05-21T10:00:00.000Z',
      id_user_staff: 'US5',
      id_user_admin: 'US2',
      status: 'confirmed',
      items: [
        { id_stok_opname_item: 'SOI1-1', id_stok: 'M1', id_variant_material: 'VM1', nama_stok_display: 'Bubuk Rasa - Mangga', unit_display: 'gr', qty_system: 1300, qty_fisik: 1240, selisih: -60, catatan_staff_item: "Kemasan sedikit sobek", is_confirmed_admin: true, catatan_admin: 'Tumpah sedikit' },
        { id_stok_opname_item: 'SOI1-2', id_stok: 'M2', id_variant_material: null, nama_stok_display: 'Susu Cokelat', unit_display: 'gr', qty_system: 1200, qty_fisik: 1200, selisih: 0, catatan_staff_item: "Sesuai", is_confirmed_admin: true },
        { id_stok_opname_item: 'SOI1-3', id_stok: 'P2', id_variant_material: null, nama_stok_display: 'Teh Botol Sosro Dingin', unit_display: 'botol', qty_system: 200, qty_fisik: 197, selisih: -3, catatan_staff_item: "3 botol pecah saat unloading", is_confirmed_admin: true, catatan_admin: 'Rusak saat pengiriman' },
      ],
      catatan_staff: "Selesai dihitung semua.",
      catatan_admin_header: "Sudah disesuaikan."
    }
];

export let INITIAL_BALANCE_STOK_DATA: BalanceStok[] = [
    { id_balance_stok: 'BS1', id_grup: 'GR1', id_cabang: 'CB1', id_transaksi: 'T20231027-001', type: 'keluar POS', item_id: 'VM1', item_is_variant: true, quantity: 60, unit_id: 'U2', tanggal: '2023-10-27T10:30:00.000Z', id_user: 'US4' },
    { id_balance_stok: 'BS2', id_grup: 'GR1', id_cabang: 'CB1', id_transaksi: 'T20231027-001', type: 'keluar POS', item_id: 'P2', item_is_variant: false, quantity: 1, unit_id: 'U7', tanggal: '2023-10-27T10:30:00.000Z', id_user: 'US4' },
    { id_balance_stok: 'BS3', id_grup: 'GR1', id_cabang: 'CB1', id_transaksi: null, type: 'stok masuk', item_id: 'M1', item_is_variant: false, quantity: 5000, unit_id: 'U2', tanggal: '2023-10-26T09:00:00.000Z', id_user: 'US2' },
];

export let INITIAL_PURCHASE_ORDERS_DATA: PurchaseOrder[] = [
    {
        id_purchase_order: 'PO-2024-001',
        id_cabang: 'CB1',
        tanggal_po: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
        status: 'menunggu persetujuan',
        supplier_name: 'Supplier Bubuk Nasional',
        total_amount: 5000000
    },
    {
        id_purchase_order: 'PO-2024-002',
        id_cabang: 'CB2',
        tanggal_po: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
        status: 'selesai',
        supplier_name: 'Tepung Jaya Abadi',
        total_amount: 12000000
    }
];

export let INITIAL_TITIK_ABSENSI_DATA: TitikAbsensi[] = [
    { id_titik_absensi: 'TA1', id_cabang: 'CB1', nama_titik: 'Pintu Depan Cabang 1', alamat: 'Gedangan', latitude: -7.387, longitude: 112.738, radius: 50, aktif: true, wajib_di_dalam_radius: true, jam_masuk: '08:00', jam_pulang: '17:00' },
    { id_titik_absensi: 'TA2', id_cabang: 'CB2', nama_titik: 'Kantor Cabang Surabaya', alamat: 'Surabaya', latitude: -7.257, longitude: 112.752, radius: 100, aktif: true, wajib_di_dalam_radius: true, jam_masuk: '09:00', jam_pulang: '18:00' },
];

export let INITIAL_ABSENSI_LOG_DATA: AbsensiLog[] = [
    { id_absensi_log: 'ALOG1', id_karyawan: 'KRY1', id_grup: 'GR1', id_cabang_karyawan: 'CB1', waktu_clock_in: '2024-05-23T08:01:15.000Z', latitude_clock_in: -7.387, longitude_clock_in: 112.738, id_titik_absensi_clock_in: 'TA1', status_clock_in: 'valid', foto_clock_in_url: null, waktu_clock_out: '2024-05-23T17:05:00.000Z', latitude_clock_out: -7.387, longitude_clock_out: 112.738, id_titik_absensi_clock_out: 'TA1', status_clock_out: 'valid', foto_clock_out_url: null },
    { id_absensi_log: 'ALOG2', id_karyawan: 'KRY3', id_grup: 'GR1', id_cabang_karyawan: 'CB1', waktu_clock_in: '2024-05-23T08:15:00.000Z', latitude_clock_in: -7.390, longitude_clock_in: 112.740, id_titik_absensi_clock_in: null, status_clock_in: 'luar_area', foto_clock_in_url: null, waktu_clock_out: null, latitude_clock_out: null, longitude_clock_out: null, id_titik_absensi_clock_out: null, status_clock_out: null, catatan_karyawan: 'Terjebak macet', foto_clock_out_url: null },
];

export let INITIAL_PAYROLL_COMPONENTS_DATA: PayrollComponent[] = [
    { id_payroll_component: 'PC2', id_grup: 'GR1', id_cabang: null, nama_component: 'Bonus Kinerja', type: 'pendapatan', calculation_type: 'manual', amount: null },
    { id_payroll_component: 'PC3', id_grup: 'GR1', id_cabang: null, nama_component: 'Insentif Kehadiran', type: 'pendapatan', calculation_type: 'hourly', amount: 20000 },
    { id_payroll_component: 'PC4', id_grup: 'GR1', id_cabang: null, nama_component: 'Tunjangan Makan', type: 'pendapatan', calculation_type: 'fixed', amount: 400000 },
    { id_payroll_component: 'PC5', id_grup: 'GR1', id_cabang: null, nama_component: 'Tunjangan Transport', type: 'pendapatan', calculation_type: 'fixed', amount: 300000 },
    { id_payroll_component: 'PC6', id_grup: 'GR1', id_cabang: null, nama_component: 'Uang Lembur per Jam', type: 'pendapatan', calculation_type: 'hourly', amount: 25000 },
    { id_payroll_component: 'PP1', id_grup: 'GR1', id_cabang: null, nama_component: 'Potongan BPJS', type: 'potongan', calculation_type: 'fixed', amount: 150000 },
    { id_payroll_component: 'PP2', id_grup: 'GR1', id_cabang: null, nama_component: 'Potongan Keterlambatan per Jam', type: 'potongan', calculation_type: 'hourly', amount: 20000 },
    { id_payroll_component: 'PP3', id_grup: 'GR1', id_cabang: null, nama_component: 'Potongan PPh 21', type: 'potongan', calculation_type: 'fixed', amount: 75000 },
];

export let INITIAL_PAYROLL_DATA: Payroll[] = [
    {
      id_payroll: 'PAY-CB1-202404-KRY1',
      id_karyawan: 'KRY1',
      id_cabang: 'CB1',
      periode_bulan: 4,
      periode_tahun: 2024,
      tanggal_pembayaran: '2024-04-25',
      status: 'paid',
      details: [
        { id_payroll_component: 'PC1', nama_component: 'Gaji Pokok', type: 'pendapatan', amount: 5000000, quantity: null },
        { id_payroll_component: 'PC4', nama_component: 'Tunjangan Makan', type: 'pendapatan', amount: 400000, quantity: null },
        { id_payroll_component: 'PC5', nama_component: 'Tunjangan Transport', type: 'pendapatan', amount: 300000, quantity: null },
        { id_payroll_component: 'PP1', nama_component: 'Potongan BPJS', type: 'potongan', amount: 150000, quantity: null },
      ],
      total_pendapatan: 5700000,
      total_potongan: 150000,
      total_gaji_bersih: 5550000,
    },
    {
      id_payroll: 'PAY-CB4-202404-KRY2',
      id_karyawan: 'KRY2',
      id_cabang: 'CB4',
      periode_bulan: 4,
      periode_tahun: 2024,
      tanggal_pembayaran: null,
      status: 'published',
      details: [
        { id_payroll_component: 'PC1', nama_component: 'Gaji Pokok', type: 'pendapatan', amount: 3500000, quantity: null },
        { id_payroll_component: 'PC4', nama_component: 'Tunjangan Makan', type: 'pendapatan', amount: 400000, quantity: null },
        { id_payroll_component: 'PC5', nama_component: 'Tunjangan Transport', type: 'pendapatan', amount: 300000, quantity: null },
        { id_payroll_component: 'PP1', nama_component: 'Potongan BPJS', type: 'potongan', amount: 150000, quantity: null },
        { id_payroll_component: 'PP3', nama_component: 'Potongan PPh 21', type: 'potongan', amount: 75000, quantity: null },
      ],
      total_pendapatan: 4200000,
      total_potongan: 225000,
      total_gaji_bersih: 3975000,
    },
    {
      id_payroll: 'PAY-CB1-202404-KRY3',
      id_karyawan: 'KRY3',
      id_cabang: 'CB1',
      periode_bulan: 4,
      periode_tahun: 2024,
      tanggal_pembayaran: null,
      status: 'draft',
      details: [
        { id_payroll_component: 'PC1', nama_component: 'Gaji Pokok', type: 'pendapatan', amount: 3000000, quantity: null },
        { id_payroll_component: 'PC4', nama_component: 'Tunjangan Makan', type: 'pendapatan', amount: 400000, quantity: null },
        { id_payroll_component: 'PC5', nama_component: 'Tunjangan Transport', type: 'pendapatan', amount: 300000, quantity: null },
        { id_payroll_component: 'PC2', nama_component: 'Bonus Kinerja', type: 'pendapatan', amount: 500000, quantity: null },
        { id_payroll_component: 'PP1', nama_component: 'Potongan BPJS', type: 'potongan', amount: 150000, quantity: null },
      ],
      total_pendapatan: 4200000,
      total_potongan: 150000,
      total_gaji_bersih: 4050000,
    },
    {
      id_payroll: 'PAY-CB2-202403-KRY4',
      id_karyawan: 'KRY4',
      id_cabang: 'CB2',
      periode_bulan: 3,
      periode_tahun: 2024,
      tanggal_pembayaran: '2024-03-25',
      status: 'paid',
      details: [
        { id_payroll_component: 'PC1', nama_component: 'Gaji Pokok', type: 'pendapatan', amount: 4000000, quantity: null },
        { id_payroll_component: 'PC4', nama_component: 'Tunjangan Makan', type: 'pendapatan', amount: 400000, quantity: null },
        { id_payroll_component: 'PC5', nama_component: 'Tunjangan Transport', type: 'pendapatan', amount: 300000, quantity: null },
        { id_payroll_component: 'PP1', nama_component: 'Potongan BPJS', type: 'potongan', amount: 150000, quantity: null },
        { id_payroll_component: 'PP3', nama_component: 'Potongan PPh 21', type: 'potongan', amount: 75000, quantity: null },
      ],
      total_pendapatan: 4700000,
      total_potongan: 225000,
      total_gaji_bersih: 4475000,
    }
];

export let INITIAL_SCHEDULED_TASKS_DATA: ScheduledTask[] = [
  {
    id_task: 'TSK1',
    id_cabang: 'CB1',
    nama_task: 'Cek Stok Kritis Pagi',
    tipe_ulangi: 'harian',
    tanggal_sekali: null,
    hari_mingguan: [],
    aktif: true,
  },
  {
    id_task: 'TSK2',
    id_cabang: null, // Semua cabang
    nama_task: 'Rapat Mingguan Manajer',
    tipe_ulangi: 'mingguan',
    tanggal_sekali: null,
    hari_mingguan: ['Senin'],
    aktif: true,
  },
  {
    id_task: 'TSK3',
    id_cabang: 'CB2',
    nama_task: 'Training Karyawan Baru',
    tipe_ulangi: 'sekali',
    tanggal_sekali: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
    hari_mingguan: [],
    aktif: false,
  },
];

export let INITIAL_MEJA_DATA: Meja[] = [
    { id_meja: 'MJA1', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Meja 1', kapasitas: 4, lokasi: 'Indoor', tipe: 'Persegi', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA2', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Meja 2', kapasitas: 4, lokasi: 'Indoor', tipe: 'Persegi', status: 'Terisi', id_pesanan_aktif: 'T-DINEIN-1', waktu_terisi: new Date(Date.now() - 30 * 60000).toISOString(), id_server: 'KRY3', nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: 90, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA3', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Meja 3', kapasitas: 2, lokasi: 'Indoor', tipe: 'Bulat', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA4', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Meja 4', kapasitas: 6, lokasi: 'Indoor', tipe: 'Sofa', status: 'Perlu Dibersihkan', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA5', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Meja 5', kapasitas: 2, lokasi: 'Indoor', tipe: 'Bulat', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA6', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Meja 6', kapasitas: 8, lokasi: 'Indoor', tipe: 'Panjang', status: 'Dipesan', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: 'Budi Santoso', jumlah_tamu_reservasi: 4, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: '08123456789' },
    { id_meja: 'MJA7', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Teras A', kapasitas: 4, lokasi: 'Outdoor', tipe: 'Persegi', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA8', id_cabang: 'CB1', id_grup: 'GR1', nama_meja: 'Teras B', kapasitas: 4, lokasi: 'Outdoor', tipe: 'Persegi', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA9', id_cabang: 'CB2', id_grup: 'GR1', nama_meja: 'VIP Room', kapasitas: 10, lokasi: 'Indoor', tipe: 'Sofa', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: 180, telepon_pelanggan_reservasi: null },
    { id_meja: 'MJA10', id_cabang: 'CB2', id_grup: 'GR1', nama_meja: 'Meja 1 (Lantai 2)', kapasitas: 4, lokasi: 'Lantai 2', tipe: 'Persegi', status: 'Tersedia', id_pesanan_aktif: null, waktu_terisi: null, id_server: null, nama_pelanggan_reservasi: null, jumlah_tamu_reservasi: null, durasi_maksimal_menit: null, telepon_pelanggan_reservasi: null },
];

export let INITIAL_SELF_ORDERS_DATA: SelfOrder[] = [
    {
        id_self_order: 'SO-1716883200123',
        id_cabang: 'CB1',
        customer_name: 'Budi Pelanggan',
        customer_phone: '081234567890',
        order_type: 'takeaway',
        id_meja: null,
        items: [
            { id_transaction_item: 'TI-SO-1', id_stok: 'P1', id_variant_product: 'VP2', quantity: 1, harga_satuan: 15000, total_harga_item: 15000, catatan_item: 'Less ice' },
            { id_transaction_item: 'TI-SO-2', id_stok: 'P5', id_variant_product: null, quantity: 2, harga_satuan: 15000, total_harga_item: 30000 },
        ],
        subtotal: 45000,
        discount: 0,
        id_promo_applied: null,
        delivery_fee: 0,
        total: 45012, // Unique total for QRIS matching
        payment_method: 'qris',
        status: 'menunggu_konfirmasi_pembayaran',
        created_at: new Date(Date.now() - 2 * 60000).toISOString(), // 2 minutes ago
    },
    {
        id_self_order: 'SO-1716883320456',
        id_cabang: 'CB1',
        customer_name: 'Siti Tamu',
        customer_phone: '089876543210',
        order_type: 'meja',
        id_meja: 'MJA5',
        items: [
            { id_transaction_item: 'TI-SO-3', id_stok: 'P4', id_variant_product: null, quantity: 1, harga_satuan: 25000, total_harga_item: 25000 },
        ],
        subtotal: 25000,
        discount: 0,
        id_promo_applied: null,
        delivery_fee: 0,
        total: 25047,
        payment_method: 'qris',
        status: 'menunggu_konfirmasi_pembayaran',
        created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
    },
];

// New: Master Data for Payment Methods
export let INITIAL_PAYMENT_METHODS_DATA: PaymentMethod[] = [
    { id_metode: 'PM1', id_grup: 'GR1', id_cabang: null, nama_metode: 'Tunai', tipe_metode: 'Cash', aktif: true, logo_url: null, qris_image_url: null, nomor_pembayaran: null, nama_rekening: null, biaya_layanan: 0 },
    { id_metode: 'PM2', id_grup: 'GR1', id_cabang: null, nama_metode: 'Kartu Debit/Kredit', tipe_metode: 'Card', aktif: true, logo_url: null, qris_image_url: null, nomor_pembayaran: null, nama_rekening: null, biaya_layanan: 1.5 },
    { id_metode: 'PM3', id_grup: 'GR1', id_cabang: null, nama_metode: 'QRIS', tipe_metode: 'E-Wallet', aktif: true, logo_url: 'https://i.imgur.com/S6d5tJn.png', qris_image_url: 'https://i.imgur.com/g113n92.png', nomor_pembayaran: null, nama_rekening: null, biaya_layanan: 0.7 },
    { id_metode: 'PM4', id_grup: 'GR1', id_cabang: 'CB1', nama_metode: 'GoPay', tipe_metode: 'E-Wallet', aktif: true, logo_url: 'https://i.imgur.com/DDp7j2s.png', qris_image_url: null, nomor_pembayaran: '081234567890', nama_rekening: 'PT Maju Jaya', biaya_layanan: 0 },
    { id_metode: 'PM5', id_grup: 'GR1', id_cabang: 'CB2', nama_metode: 'OVO', tipe_metode: 'E-Wallet', aktif: false, logo_url: 'https://i.imgur.com/lV4a3aI.png', qris_image_url: null, nomor_pembayaran: null, nama_rekening: null, biaya_layanan: 0 },
    { id_metode: 'PM6', id_grup: 'GR2', id_cabang: null, nama_metode: 'Transfer BCA', tipe_metode: 'Transfer', aktif: true, logo_url: 'https://i.imgur.com/lDo8i6J.png', qris_image_url: null, nomor_pembayaran: '1234567890', nama_rekening: 'CV Orang Luar', biaya_layanan: 2500 },
];


// New: Delivery Fee Settings
export let INITIAL_DELIVERY_FEE_SETTINGS_DATA: DeliveryFeeSettings[] = [
    {
        id_cabang: 'CB1',
        id_grup: 'GR1',
        aktif: true,
        tipe: 'distance',
        flat_rate: null,
        base_fee: 5000,
        tiers: [
            { id: 'tier1', upToKm: 3, fee: 8000 },
            { id: 'tier2', upToKm: 5, fee: 12000 },
        ],
        fee_per_km_after_last_tier: 2000,
        free_shipping_threshold: 150000,
        latitude: -7.3870, // Gedangan
        longitude: 112.7380,
    },
];

// Data Izin (Permissions Data) - Dikelola oleh backend
export let INITIAL_GLOBAL_ACCESS_DATA: AllRoleAccessData = {};

/**
 * Helper function to generate a full permission object for a role based on a configuration.
 * @param config - A simplified configuration object.
 *   - 'all': All actions are true.
 *   - 'read': Only 'view_*' actions are true.
 *   - 'cru': All actions except 'hapus_*' are true.
 *   - string[]: An explicit list of allowed action IDs.
 */
function generatePermissions(config: { [itemId: string]: 'all' | 'read' | 'cru' | string[] }) {
    const permissions: RoleSpecificAksesMenuPermissions = {};

    function traverse(items: AksesMenuConfigItem[]) {
        items.forEach(item => {
            const itemConfig = config[item.id] || [];
            const actions: Record<string, boolean> = {};
            item.actions.forEach(action => {
                if (itemConfig === 'all') {
                    actions[action.id] = true;
                } else if (itemConfig === 'read') {
                    actions[action.id] = action.id.startsWith('view_');
                } else if (itemConfig === 'cru') {
                    actions[action.id] = !action.id.startsWith('hapus_');
                } else if (Array.isArray(itemConfig)) {
                    actions[action.id] = itemConfig.includes(action.id);
                } else {
                    actions[action.id] = false;
                }
            });
            permissions[item.id] = {
                masterChecked: Object.values(actions).some(v => v),
                actions: actions,
            };
            if (item.subItems) {
                traverse(item.subItems);
            }
        });
    }

    traverse(aksesMenuStructure);
    return permissions;
}

export let INITIAL_GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS: AllRolesAksesMenuDetailData = {
    // Branch Administrator (RL1, RL2) - Almost full access, except for some global settings.
    'RL1': generatePermissions({
        'home': 'all',
        'dashboard': 'all',
        'daftar_cabang_parent': ['view_page_daftar_cabang'],
        'manajemen_grup_dc': 'cru', // Can't delete group
        'manajemen_cabang_dc': 'all',
        'role_akses_config_parent': ['view_page_role_akses_config'],
        'manajemen_role_rac': 'all',
        'manajemen_akses_menu_rac': 'all',
        'user_page': 'all',
        'daftar_stok_overview_parent': ['view_page_stok_overview'],
        'stok_tab_so': 'all',
        'varian_material_tab_so': 'all',
        'varian_produk_tab_so': 'all',
        'balance_stok_page': 'all',
        'stok_opname_page': 'all',
        'setting_stok_parent': ['view_page_setting_stok'],
        'manajemen_unit_ss': 'all',
        'bom_page': 'all',
        'pelanggan_page': 'all',
        'pos_page': 'all',
        'transaksi_page': 'all',
        'setting_penjualan_parent': ['view_page_setting_penjualan'],
        'manajemen_promo_ps': 'all',
        'manajemen_meja_ps': 'all',
        'kds_page': 'all',
        'report_sales': ['view_page_report_sales'],
        'report_stock': ['view_page_report_stock'],
        'report_inventory_valuation': ['view_page_report_inventory_valuation'],
        'report_opname_history': ['view_page_report_opname_history'],
        'report_attendance': ['view_page_report_attendance'],
        'report_payroll': ['view_page_report_payroll'],
        'karyawan_page': 'all',
        'absensi_page_log': 'all',
        'penggajian_page': 'all',
        'hrm_settings_page': ['view_page_hrm_settings'],
        'hrm_titik_absensi_tab': 'all',
        'hrm_payroll_component_tab': 'all',
        'task_settings_page': 'all'
    }),
    'RL2': generatePermissions({ // Same as RL1 for simplicity
        'home': 'all', 'dashboard': 'all', 'daftar_cabang_parent': ['view_page_daftar_cabang'],
        'manajemen_grup_dc': 'cru', 'manajemen_cabang_dc': 'all', 'role_akses_config_parent': ['view_page_role_akses_config'],
        'manajemen_role_rac': 'all', 'manajemen_akses_menu_rac': 'all', 'user_page': 'all',
        'daftar_stok_overview_parent': ['view_page_stok_overview'], 'stok_tab_so': 'all',
        'varian_material_tab_so': 'all', 'varian_produk_tab_so': 'all', 'balance_stok_page': 'all',
        'stok_opname_page': 'all', 'setting_stok_parent': ['view_page_setting_stok'], 'manajemen_unit_ss': 'all',
        'bom_page': 'all', 'pelanggan_page': 'all', 'pos_page': 'all', 'transaksi_page': 'all',
        'setting_penjualan_parent': ['view_page_setting_penjualan'], 'manajemen_promo_ps': 'all',
        'manajemen_meja_ps': 'all', 'kds_page': 'all', 'report_sales': ['view_page_report_sales'],
        'report_stock': ['view_page_report_stock'], 'report_inventory_valuation': ['view_page_report_inventory_valuation'],
        'report_opname_history': ['view_page_report_opname_history'], 'report_attendance': ['view_page_report_attendance'],
        'report_payroll': ['view_page_report_payroll'], 'karyawan_page': 'all', 'absensi_page_log': 'all',
        'penggajian_page': 'all', 'hrm_settings_page': ['view_page_hrm_settings'],
        'hrm_titik_absensi_tab': 'all', 'hrm_payroll_component_tab': 'all', 'task_settings_page': 'all'
    }),

    // Cashier (RL3, RL4) - Limited access, mainly POS and related tasks.
    'RL3': generatePermissions({
        'home': ['view_page_home', 'use_absensi_widget_home'],
        'pelanggan_page': ['view_page_pelanggan', 'tambah_pelanggan'],
        'pos_page': ['view_page_pos', 'proses_transaksi_pos', 'view_waiter_notifications_pos', 'update_served_status_pos'],
        'transaksi_page': ['view_page_transaksi'],
        'kds_page': ['view_page_kds']
    }),
    'RL4': generatePermissions({ // Same as RL3
        'home': ['view_page_home', 'use_absensi_widget_home'],
        'pelanggan_page': ['view_page_pelanggan', 'tambah_pelanggan'],
        'pos_page': ['view_page_pos', 'proses_transaksi_pos', 'view_waiter_notifications_pos', 'update_served_status_pos'],
        'transaksi_page': ['view_page_transaksi'],
        'kds_page': ['view_page_kds']
    }),

    // Group Auditor (RL5) - Read-only access to most things.
    'RL5': generatePermissions({
        'home': ['view_page_home'],
        'dashboard': ['view_page_dashboard'],
        'daftar_cabang_parent': ['view_page_daftar_cabang'],
        'manajemen_grup_dc': ['view_tab_grup_dc'],
        'manajemen_cabang_dc': ['view_tab_cabang_dc'],
        'role_akses_config_parent': ['view_page_role_akses_config'],
        'manajemen_role_rac': ['view_tab_role_rac'],
        'manajemen_akses_menu_rac': ['view_tab_akses_menu_rac'],
        'user_page': ['view_page_user'],
        'daftar_stok_overview_parent': ['view_page_stok_overview'],
        'stok_tab_so': ['view_tab_stok_so', 'filter_detail_stok_so'],
        'varian_material_tab_so': ['view_tab_varian_material_so'],
        'varian_produk_tab_so': ['view_tab_varian_produk_so', 'filter_bom_varian_produk_so'],
        'balance_stok_page': ['view_page_balance_stok'],
        'stok_opname_page': ['view_page_stok_opname'],
        'setting_stok_parent': ['view_page_setting_stok'],
        'manajemen_unit_ss': ['view_tab_manajemen_unit_ss'],
        'bom_page': ['view_page_bom'],
        'pelanggan_page': ['view_page_pelanggan'],
        'transaksi_page': ['view_page_transaksi'],
        'setting_penjualan_parent': ['view_page_setting_penjualan'],
        'manajemen_promo_ps': ['view_tab_manajemen_promo_ps'],
        'manajemen_meja_ps': ['view_tab_manajemen_meja_ps'],
        'report_sales': ['view_page_report_sales'],
        'report_stock': ['view_page_report_stock'],
        'report_inventory_valuation': ['view_page_report_inventory_valuation'],
        'report_opname_history': ['view_page_report_opname_history'],
        'report_attendance': ['view_page_report_attendance'],
        'report_payroll': ['view_page_report_payroll'],
        'karyawan_page': ['view_page_karyawan'],
        'absensi_page_log': ['view_page_absensi_log'],
        'penggajian_page': ['view_page_penggajian'],
        'hrm_settings_page': ['view_page_hrm_settings'],
        'hrm_titik_absensi_tab': ['view_tab_titik_absensi'],
        'hrm_payroll_component_tab': ['view_tab_gaji_komponen'],
    }),
};

// Fix: Add INITIAL_MODULE_ACTIVATION_SETTINGS_DATA
export let INITIAL_MODULE_ACTIVATION_SETTINGS_DATA: Record<string, ModuleActivationSettings> = {
    '__global__': { bom: true, kds: true }, // Default: all active globally
};

// Ini adalah objek database yang akan digunakan oleh lapisan API.
export const db = {
    GRUP_DATA: INITIAL_GRUP_DATA,
    BRANCHES_DATA: INITIAL_BRANCHES_DATA,
    ROLES_DATA: INITIAL_ROLES_DATA,
    USERS_DATA: INITIAL_USERS_DATA,
    KARYAWAN_DATA: INITIAL_KARYAWAN_DATA,
    UNIT_DATA: INITIAL_UNIT_DATA,
    STOCK_DATA: INITIAL_STOCK_DATA,
    MATERIAL_VARIANTS_DATA: INITIAL_MATERIAL_VARIANTS_DATA,
    PRODUCT_VARIANTS_DATA: INITIAL_PRODUCT_VARIANTS_DATA,
    BOM_DATA: INITIAL_BOM_DATA,
    TRANSACTIONS_DATA: INITIAL_TRANSACTIONS_DATA,
    CUSTOMERS_DATA: INITIAL_CUSTOMERS_DATA,
    PROMO_DATA: INITIAL_PROMO_DATA,
    STOK_OPNAME_DATA: INITIAL_STOK_OPNAME_DATA,
    BALANCE_STOK_DATA: INITIAL_BALANCE_STOK_DATA,
    PURCHASE_ORDERS_DATA: INITIAL_PURCHASE_ORDERS_DATA,
    TITIK_ABSENSI_DATA: INITIAL_TITIK_ABSENSI_DATA,
    ABSENSI_LOG_DATA: INITIAL_ABSENSI_LOG_DATA,
    PAYROLL_COMPONENTS_DATA: INITIAL_PAYROLL_COMPONENTS_DATA,
    PAYROLL_DATA: INITIAL_PAYROLL_DATA,
    SCHEDULED_TASKS_DATA: INITIAL_SCHEDULED_TASKS_DATA,
    MEJA_DATA: INITIAL_MEJA_DATA,
    SELF_ORDERS_DATA: INITIAL_SELF_ORDERS_DATA,
    PAYMENT_METHODS_DATA: INITIAL_PAYMENT_METHODS_DATA,
    DELIVERY_FEE_SETTINGS_DATA: INITIAL_DELIVERY_FEE_SETTINGS_DATA, // Added
    // Menambahkan data izin ke objek db
    GLOBAL_ACCESS_DATA: INITIAL_GLOBAL_ACCESS_DATA,
    GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS: INITIAL_GLOBAL_AKSES_MENU_DETAIL_PERMISSIONS,
    // Fix: Add MODULE_ACTIVATION_SETTINGS_DATA to db object
    MODULE_ACTIVATION_SETTINGS_DATA: INITIAL_MODULE_ACTIVATION_SETTINGS_DATA,
};