// FRONTEND: File ini berisi konstanta yang digunakan di seluruh aplikasi.
// Fungsinya adalah untuk mendefinisikan data statis seperti judul aplikasi dan struktur menu navigasi.
// Ini membantu menjaga konsistensi dan memudahkan perubahan di masa depan.

import { MenuItem, AksesMenuConfigItem } from './types';
import { 
  HomeIcon, 
  BuildingStorefrontIcon, 
  UsersIcon, 
  CubeIcon, 
  ChartBarIcon, 
  ClipboardDocumentListIcon,
  CogIcon,
  UserCircleIcon,
  KeyIcon,
  PackageIcon,
  DocumentDuplicateIcon,
  BeakerIcon, 
  ScaleIcon,
  ShoppingCartIcon,
  ListBulletIcon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon,
  PencilSquareIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CalendarDaysIcon,
  BellIcon,
  BriefcaseIcon,
  ComputerDesktopIcon, // Import new icon
  SparklesIcon, // Import new icon
  MotorcycleIcon, // Import new icon
} from './components/icons';

export const APP_TITLE = "H-POS";

export const INITIAL_MENU_DATA: MenuItem[] = [
  { name: 'Home', path: '/home', icon: HomeIcon }, 
  { name: 'Dashboard', path: '/dashboard', icon: WrenchScrewdriverIcon }, 
  {
    name: 'Cabang', 
    path: '/branch', 
    icon: BuildingStorefrontIcon, 
    subItems: [
      { name: 'Daftar Cabang', path: '/branch/daftar-cabang', icon: BeakerIcon }, 
    ]
  },
  { 
    name: 'User', 
    path: '/user-management', 
    icon: UsersIcon,
    subItems: [
      { name: 'Role Akses', path: '/user-management/role-access-config', icon: KeyIcon }, 
      { name: 'Daftar User', path: '/user-management/users', icon: UserCircleIcon },
    ]
  },
  {
    name: 'Stok',
    path: '/stock-management', 
    icon: CubeIcon,
    subItems: [
      { name: 'Daftar Stok', path: '/stock-management/stock-overview', icon: ListBulletIcon },
      { name: 'Balance Stok', path: '/stock-management/stock-balance', icon: ScaleIcon },
      { name: 'Opname Outlet', path: '/stock-opname', icon: ClipboardDocumentListIcon },
      { name: 'Setting', path: '/stock-management/settings', icon: CogIcon },
    ]
  },
  {
    name: 'Produksi',
    path: '/production',
    icon: WrenchScrewdriverIcon,
    subItems: [
      { name: 'BOM', path: '/production/bom', icon: ListBulletIcon },
    ]
  },
  {
    name: 'Penjualan',
    path: '/penjualan', 
    icon: ShoppingCartIcon,
    subItems: [
      { name: 'Pelanggan', path: '/penjualan/pelanggan', icon: UsersIcon },
      { name: 'POS', path: '/penjualan/pos', icon: ShoppingCartIcon },
      { name: 'Transaksi', path: '/penjualan/transaksi', icon: BuildingStorefrontIcon }, 
      { name: 'Setting', path: '/penjualan/settings', icon: CogIcon }, // New submenu
    ]
  },
  {
    name: 'Dapur',
    path: '/dapur',
    icon: ClipboardDocumentListIcon,
    subItems: [
      { name: 'KDS', path: '/dapur/kds', icon: ComputerDesktopIcon },
    ]
  },
  { 
    name: 'Report', 
    path: '/reports', 
    icon: ChartBarIcon,
    subItems: [
      { name: 'Penjualan', path: '/reports/sales', icon: ArrowTrendingUpIcon },
      { name: 'Stok', path: '/reports/stock', icon: CubeIcon },
      { name: 'Valuasi Stok', path: '/reports/inventory-valuation', icon: CubeIcon },
      { name: 'Opname Outlet', path: '/reports/opname-history', icon: ClockIcon },
      { name: 'Absensi', path: '/reports/attendance', icon: CalendarDaysIcon },
      { name: 'Penggajian', path: '/reports/payroll', icon: CurrencyDollarIcon },
    ]
  },
  {
    name: 'HRM', 
    path: '/hrm',
    icon: UsersIcon, 
    subItems: [
      { name: 'Karyawan', path: '/hrm/karyawan', icon: UserCircleIcon },
      { name: 'Absensi', path: '/hrm/absensi', icon: ClipboardDocumentListIcon },
      { name: 'Penggajian', path: '/hrm/penggajian', icon: CurrencyDollarIcon },
      { name: 'Setting', path: '/hrm/settings', icon: CogIcon }, // New HRM Setting submenu
    ],
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: CogIcon,
    subItems: [
      { name: 'Menu List', path: '/settings/menu-list', icon: ListBulletIcon },
      { name: 'Personalize', path: '/settings/personalize', icon: PencilSquareIcon },
      { name: 'Pengaturan Tugas', path: '/settings/task-settings', icon: BellIcon },
      { name: 'Pengaturan Modul', path: '/settings/module-settings', icon: WrenchScrewdriverIcon },
    ],
  },
];

export const aksesMenuStructure: AksesMenuConfigItem[] = [
  { 
    id: 'home', 
    label: 'Home', 
    path: '/home', 
    actions: [
      { id: 'view_page_home', label: 'View Page' },
      { id: 'use_absensi_widget_home', label: 'Gunakan Widget Absensi (Clock In/Out)' }, // This action enables using the widget. The actual clocking uses /hrm/absensi insert permission.
    ], 
    isInitiallyExpanded: false 
  },
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', actions: [{ id: 'view_page_dashboard', label: 'View Page' }], isInitiallyExpanded: false },
  {
    id: 'manajemen_cabang_top', label: 'Cabang', path: '/branch', isInitiallyExpanded: true, actions: [],
    subItems: [
      {
        id: 'daftar_cabang_parent', label: 'Daftar Cabang (Page)', path: '/branch/daftar-cabang', isInitiallyExpanded: true, actions: [{ id: 'view_page_daftar_cabang', label: 'View Page' }],
        subItems: [
          {
            id: 'manajemen_grup_dc', label: 'Tab Grup', path: '/branch/daftar-cabang#grup',
            actions: [
              { id: 'view_tab_grup_dc', label: 'View Tab Grup' },
              { id: 'tambah_grup_dc', label: 'Tambah Grup' },
              { id: 'edit_grup_dc', label: 'Edit Grup' },
              { id: 'hapus_grup_dc', label: 'Hapus Grup' },
            ],
          },
          {
            id: 'manajemen_cabang_dc', label: 'Tab Cabang', path: '/branch/daftar-cabang#cabang',
            actions: [
              { id: 'view_tab_cabang_dc', label: 'View Tab Cabang' },
              { id: 'tambah_cabang_dc', label: 'Tambah Cabang' },
              { id: 'edit_cabang_dc', label: 'Edit Cabang' },
              { id: 'hapus_cabang_dc', label: 'Hapus Cabang' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'manajemen_user_top', label: 'User', path: '/user-management', isInitiallyExpanded: true, actions: [],
    subItems: [
      {
        id: 'role_akses_config_parent', label: 'Role Akses (Page)', path: '/user-management/role-access-config', isInitiallyExpanded: true, actions: [{ id: 'view_page_role_akses_config', label: 'View Page' }],
        subItems: [
          {
            id: 'manajemen_role_rac', label: 'Role', path: '/user-management/role-access-config#role',
            actions: [
              { id: 'view_tab_role_rac', label: 'View Tab Role' },
              { id: 'tambah_role_rac', label: 'Tambah Role' },
              { id: 'edit_role_rac', label: 'Edit Role' },
              { id: 'hapus_role_rac', label: 'Hapus Role' },
            ],
          },
          {
            id: 'manajemen_akses_menu_rac', label: 'Akses Menu', path: '/user-management/role-access-config#akses',
            actions: [
              { id: 'view_tab_akses_menu_rac', label: 'View Tab Akses Menu' },
              { id: 'konfigurasi_akses_menu_rac', label: 'Simpan Konfigurasi' },
            ],
          },
        ],
      },
      {
        id: 'user_page', label: 'Daftar User (Page)', path: '/user-management/users',
        actions: [
          { id: 'view_page_user', label: 'View Page User' },
          { id: 'tambah_user', label: 'Tambah User' },
          { id: 'edit_user', label: 'Edit User' },
          { id: 'hapus_user', label: 'Hapus User' },
        ],
      },
    ],
  },
  {
    id: 'manajemen_stok_top', label: 'Stok', path: '/stock-management', isInitiallyExpanded: true, actions: [],
    subItems: [
      {
        id: 'daftar_stok_overview_parent', label: 'Daftar Stok Overview (Page)', path: '/stock-management/stock-overview', isInitiallyExpanded: true, actions: [{ id: 'view_page_stok_overview', label: 'View Page' }],
        subItems: [
          {
            id: 'stok_tab_so', label: 'Tab Stok Induk', path: '/stock-management/stock-overview#stok',
            actions: [
              { id: 'view_tab_stok_so', label: 'View Tab' },
              { id: 'tambah_stok_induk_so', label: 'Tambah Stok Induk' },
              { id: 'edit_stok_induk_so', label: 'Edit Stok Induk' },
              { id: 'hapus_stok_induk_so', label: 'Hapus Stok Induk' },
              { id: 'filter_detail_stok_so', label: 'Filter Detail Terkait' },
            ],
          },
          {
            id: 'varian_material_tab_so', label: 'Tab Varian Material', path: '/stock-management/stock-overview#mv',
            actions: [
              { id: 'view_tab_varian_material_so', label: 'View Tab' },
              { id: 'tambah_varian_material_so', label: 'Tambah Varian Material' },
              { id: 'edit_varian_material_so', label: 'Edit Varian Material' },
              { id: 'hapus_varian_material_so', label: 'Hapus Varian Material' },
            ],
          },
          {
            id: 'varian_produk_tab_so', label: 'Tab Varian Produk', path: '/stock-management/stock-overview#pv',
            actions: [
              { id: 'view_tab_varian_produk_so', label: 'View Tab' },
              { id: 'tambah_varian_produk_so', label: 'Tambah Varian Produk' },
              { id: 'edit_varian_produk_so', label: 'Edit Varian Produk' },
              { id: 'hapus_varian_produk_so', label: 'Hapus Varian Produk' },
              { id: 'filter_bom_varian_produk_so', label: 'Filter BOM Terkait' },
            ],
          },
        ]
      },
      {
        id: 'balance_stok_page', label: 'Balance Stok (Page)', path: '/stock-management/stock-balance',
        actions: [
          { id: 'view_page_balance_stok', label: 'View Page Balance Stok' },
          { id: 'tambah_balance_stok', label: 'Tambah Entri Manual' },
          { id: 'edit_balance_stok', label: 'Edit Entri Manual' },
          { id: 'hapus_balance_stok', label: 'Hapus Entri Manual' },
        ],
      },
      {
        id: 'stok_opname_page', label: 'Opname Outlet (Page)', path: '/stock-opname',
        actions: [
          { id: 'view_page_stok_opname', label: 'View Daftar Sesi Opname' },
          { id: 'mulai_opname_baru', label: 'Mulai Sesi Opname Baru' },
          { id: 'edit_draft_opname', label: 'Edit Draft / Isi Qty Fisik' },
          { id: 'submit_hasil_opname_staff', label: 'Submit Hasil Opname (Staff)' },
          { id: 'konfirmasi_admin_opname', label: 'Konfirmasi Admin (Adjust Stok)' },
          { id: 'hapus_sesi_opname', label: 'Hapus Sesi (Draft/Cancelled)' },
        ],
        isInitiallyExpanded: false
      },
      {
        id: 'setting_stok_parent', label: 'Setting Stok (Page)', path: '/stock-management/settings', isInitiallyExpanded: true, actions: [{ id: 'view_page_setting_stok', label: 'View Page' }],
        subItems: [
          {
            id: 'manajemen_unit_ss', label: 'Tab Unit', path: '/stock-management/settings#unit',
            actions: [
              { id: 'view_tab_manajemen_unit_ss', label: 'View Tab' },
              { id: 'tambah_unit_ss', label: 'Tambah Unit' },
              { id: 'edit_unit_ss', label: 'Edit Unit' },
              { id: 'hapus_unit_ss', label: 'Hapus Unit' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'produksi_top', label: 'Produksi', path: '/production', isInitiallyExpanded: false, actions: [],
    subItems: [
      {
        id: 'bom_page', label: 'BOM (Page)', path: '/production/bom',
        actions: [
          { id: 'view_page_bom', label: 'View Page' },
          { id: 'tambah_komponen_bom', label: 'Tambah Komponen BOM' },
          { id: 'edit_komponen_bom', label: 'Edit Komponen BOM' },
          { id: 'hapus_komponen_bom', label: 'Hapus Komponen BOM' },
        ],
      },
    ]
  },
  {
    id: 'penjualan_top', label: 'Penjualan', path: '/penjualan', isInitiallyExpanded: true, actions: [],
    subItems: [
      {
        id: 'pelanggan_page',
        label: 'Pelanggan (Page)',
        path: '/penjualan/pelanggan',
        actions: [
          { id: 'view_page_pelanggan', label: 'View Page' },
          { id: 'tambah_pelanggan', label: 'Tambah Pelanggan' },
          { id: 'edit_pelanggan', label: 'Edit Pelanggan' },
          { id: 'hapus_pelanggan', label: 'Hapus Pelanggan' },
        ],
      },
      {
        id: 'pos_page', label: 'POS (Page)', path: '/penjualan/pos',
        actions: [
          { id: 'view_page_pos', label: 'View Page POS' },
          { id: 'proses_transaksi_pos', label: 'Proses Transaksi' },
          { id: 'view_waiter_notifications_pos', label: 'View Notifikasi Pelayan' },
          { id: 'update_served_status_pos', label: 'Update Status Dihidangkan' },
        ],
      },
      {
        id: 'transaksi_page', label: 'Transaksi (Page)', path: '/penjualan/transaksi',
        actions: [
          { id: 'view_page_transaksi', label: 'View Page Transaksi' },
          { id: 'tambah_transaksi_manual', label: 'Tambah Transaksi Manual' },
          { id: 'edit_transaksi', label: 'Edit Transaksi' },
          { id: 'hapus_transaksi', label: 'Hapus Transaksi' },
        ],
      },
      {
        id: 'setting_penjualan_parent', label: 'Setting Penjualan (Page)', path: '/penjualan/settings', isInitiallyExpanded: true, actions: [{ id: 'view_page_setting_penjualan', label: 'View Page' }],
        subItems: [
          {
            id: 'manajemen_promo_ps', label: 'Tab Promo', path: '/penjualan/settings#promo',
            actions: [
              { id: 'view_tab_manajemen_promo_ps', label: 'View Tab' },
              { id: 'tambah_promo_ps', label: 'Tambah Promo' },
              { id: 'edit_promo_ps', label: 'Edit Promo' },
              { id: 'hapus_promo_ps', label: 'Hapus Promo' },
            ],
          },
          {
            id: 'manajemen_meja_ps',
            label: 'Tab Meja',
            path: '/penjualan/settings#meja',
            actions: [
              { id: 'view_tab_manajemen_meja_ps', label: 'View Tab' },
              { id: 'tambah_meja_ps', label: 'Tambah Meja' },
              { id: 'edit_meja_ps', label: 'Edit Meja' },
              { id: 'hapus_meja_ps', label: 'Hapus Meja' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'dapur_top', label: 'Dapur', path: '/dapur', isInitiallyExpanded: false, actions: [],
    subItems: [
      {
        id: 'kds_page', label: 'KDS (Page)', path: '/dapur/kds',
        actions: [
          { id: 'view_page_kds', label: 'View Page KDS' },
          { id: 'update_order_status_kds', label: 'Update Status Pesanan' }
        ],
      },
    ]
  },
  { 
    id: 'report_top', label: 'Report', path: '/reports', isInitiallyExpanded: false, actions: [],
    subItems: [
      {
        id: 'report_sales', label: 'Penjualan', path: '/reports/sales',
        actions: [{ id: 'view_page_report_sales', label: 'View Page' }],
      },
      {
        id: 'report_stock', label: 'Stok', path: '/reports/stock',
        actions: [{ id: 'view_page_report_stock', label: 'View Page' }],
      },
       {
        id: 'report_inventory_valuation', label: 'Valuasi Stok', path: '/reports/inventory-valuation',
        actions: [{ id: 'view_page_report_inventory_valuation', label: 'View Page' }],
      },
      {
        id: 'report_opname_history', label: 'Opname Outlet', path: '/reports/opname-history',
        actions: [{ id: 'view_page_report_opname_history', label: 'View Page' }],
      },
      {
        id: 'report_attendance', label: 'Absensi', path: '/reports/attendance',
        actions: [{ id: 'view_page_report_attendance', label: 'View Page' }],
      },
      {
        id: 'report_payroll', label: 'Penggajian', path: '/reports/payroll',
        actions: [{ id: 'view_page_report_payroll', label: 'View Page' }],
      }
    ]
  },
  {
    id: 'hrm_top', label: 'HRM', path: '/hrm', isInitiallyExpanded: false, actions: [],
    subItems: [
      {
        id: 'karyawan_page', label: 'Karyawan (Page)', path: '/hrm/karyawan',
        actions: [
          { id: 'view_page_karyawan', label: 'View Page' },
          { id: 'tambah_karyawan', label: 'Tambah Karyawan' },
          { id: 'edit_karyawan', label: 'Edit Karyawan' },
          { id: 'hapus_karyawan', label: 'Hapus Karyawan' },
        ],
      },
      {
        id: 'absensi_page_log', label: 'Log Kehadiran (Page)', path: '/hrm/absensi', // Changed label and path context
        actions: [
          { id: 'view_page_absensi_log', label: 'View Log Kehadiran' },
          { id: 'edit_absensi_log_admin', label: 'Edit Log (Admin)' }, // Example admin action
          // Note: The clock-in/out action itself is tied to `canInsert('/hrm/absensi')` in `GLOBAL_ACCESS_DATA`,
          // and the `use_absensi_widget_home` on the Home item controls widget visibility/usage.
        ],
      },
      {
        id: 'penggajian_page', label: 'Penggajian (Page)', path: '/hrm/penggajian',
        actions: [
          { id: 'view_page_penggajian', label: 'View Page' },
          { id: 'generate_gaji', label: 'Generate Gaji' },
          { id: 'edit_draft', label: 'Edit Draft Gaji' },
          { id: 'publish_gaji', label: 'Publish Gaji' },
          { id: 'mark_paid', label: 'Tandai Dibayar' },
          { id: 'delete_draft', label: 'Hapus Draft Gaji' },
        ],
      },
      { 
        id: 'hrm_settings_page', label: 'Setting (HRM Page)', path: '/hrm/settings', isInitiallyExpanded: false, 
        actions: [{ id: 'view_page_hrm_settings', label: 'View Page' }],
        subItems: [ 
          {
            id: 'hrm_titik_absensi_tab', label: 'Tab Titik Absensi', path: '/hrm/settings#titik-absensi', 
            actions: [
              { id: 'view_tab_titik_absensi', label: 'View Tab Titik Absensi' },
              { id: 'tambah_titik_absensi', label: 'Tambah Titik Absensi' },
              { id: 'edit_titik_absensi', label: 'Edit Titik Absensi' },
              { id: 'hapus_titik_absensi', label: 'Hapus Titik Absensi' },
            ],
          },
          {
            id: 'hrm_payroll_component_tab', label: 'Tab Komponen Gaji', path: '/hrm/settings#gaji',
            actions: [
              { id: 'view_tab_gaji_komponen', label: 'View Tab' },
              { id: 'tambah_gaji_komponen', label: 'Tambah Komponen' },
              { id: 'edit_gaji_komponen', label: 'Edit Komponen' },
              { id: 'hapus_gaji_komponen', label: 'Hapus Komponen' },
            ],
          },
        ],
      }
    ],
  },
  {
    id: 'settings_global_top', label: 'Settings (Global)', path: '/settings', isInitiallyExpanded: false, actions: [],
    subItems: [
      {
        id: 'menu_list_settings_page', label: 'Menu List (Page)', path: '/settings/menu-list',
        actions: [
          { id: 'view_page_menu_list', label: 'View Daftar Menu' },
          { id: 'edit_menu_list', label: 'Simpan/Refresh Konfigurasi Menu' },
        ],
      },
      {
        id: 'personalize_settings_page', label: 'Personalize (Page)', path: '/settings/personalize',
        actions: [
            { id: 'view_page_personalize', label: 'View Page' },
            { id: 'update_personalize', label: 'Update Personalization' },
        ],
      },
      {
        id: 'task_settings_page', 
        label: 'Pengaturan Tugas (Page)', 
        path: '/settings/task-settings',
        actions: [
            { id: 'view_page_task_settings', label: 'View Page' },
            { id: 'tambah_task', label: 'Tambah Tugas' },
            { id: 'edit_task', label: 'Edit Tugas' },
            { id: 'hapus_task', label: 'Hapus Tugas' },
        ],
      },
      {
        id: 'module_settings_page', 
        label: 'Pengaturan Modul (Page)', 
        path: '/settings/module-settings',
        actions: [
            { id: 'view_page_module_settings', label: 'View Page' },
            { id: 'update_module_settings', label: 'Update Pengaturan Modul' },
        ],
      }
    ],
  }
];