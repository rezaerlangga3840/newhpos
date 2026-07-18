// FRONTEND: File ini berisi fungsi utilitas murni yang digunakan di seluruh aplikasi frontend.
// Fungsi-fungsi ini tidak mengandung logika bisnis dan digunakan untuk tugas-tugas umum
// seperti mengkloning objek atau membuat slug.

// FRONTEND: Fungsi deep cloning untuk mencegah mutasi state secara langsung.
// Ini menangani objek dan array bersarang, dan mempertahankan referensi fungsi (seperti untuk ikon).
export const deepClone = <T,>(source: T): T => {
  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (Array.isArray(source)) {
    const copy = [] as any[];
    for (let i = 0, len = source.length; i < len; i++) {
      copy[i] = deepClone(source[i]);
    }
    return copy as T;
  }

  const copy = {} as { [key: string]: any };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = (source as any)[key];
      if (key === 'icon' && typeof value === 'function') {
        copy[key] = value;
      } else {
        copy[key] = deepClone(value);
      }
    }
  }
  return copy as T;
};

// FRONTEND: Menghasilkan slug yang ramah URL dari sebuah string.
export const generateSlug = (name: string): string => 
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// FRONTEND: Menghitung jarak antara dua titik geografis menggunakan formula Haversine.
export const haversineDistance = (
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity; // Return a large number if coordinates are invalid
  }

  const R = 6371e3; // Radius Bumi dalam meter
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // in meters
  return distance;
};

// FRONTEND: Menyesuaikan kecerahan warna hex untuk efek UI seperti state hover.
export const adjustColor = (color: string, amount: number) => {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
};

// BACKEND LOGIC HELPER: Ditempatkan di sini untuk akses frontend dalam simulasi ini.
// Menghitung ulang jumlah total stok induk berdasarkan variannya.
export const updateParentStockQuantityAfterVariantChange = (idCabang: string, idStokParent: string): void => {
  // This logic is now handled in the backend/api.ts layer.
  // This function is kept for compatibility with any remaining direct callers, but should be considered deprecated.
  console.warn("updateParentStockQuantityAfterVariantChange from utils.ts is deprecated. Logic has moved to api.ts.");
};

// FRONTEND: Fungsi utilitas untuk mengompresi gambar di sisi client sebelum disimpan/diupload.
// Mengurangi beban server dan mempercepat loading client.
// UPDATED: Menggunakan format WebP untuk kompresi yang lebih baik.
export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                elem.width = width;
                elem.height = height;
                const ctx = elem.getContext('2d');
                if (!ctx) {
                    reject(new Error("Gagal membuat canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                
                // OPTIMASI: Menggunakan 'image/webp' untuk ukuran file yang lebih kecil dengan kualitas visual yang sama/lebih baik dibanding jpeg.
                // Jika browser tidak mendukung webp, biasanya akan fallback ke png/jpeg, tapi webp didukung luas di browser modern.
                resolve(elem.toDataURL('image/webp', quality));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};