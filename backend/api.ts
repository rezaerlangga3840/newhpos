// BACKEND: File ini sekarang berfungsi sebagai "barrel file" (aggregator).
// Tujuannya adalah untuk menggabungkan semua fungsi API yang telah dipecah menjadi modul-modul terpisah,
// sehingga impor di seluruh aplikasi frontend tidak perlu diubah.
// Frontend tetap mengimport dari `backend/api`, meskipun implementasinya sudah dipisah.

export * from './apiAuth';
export * from './apiMaster';
export * from './apiHrm';
export * from './apiInventory';
export * from './apiProduction';
export * from './apiSales';
export * from './apiReports';
export * from './apiSettings';
