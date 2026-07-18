import React, { useRef, useState } from 'react';
import { PhotoIcon, CheckCircleIcon, SpinnerIcon } from '../../../components/icons';
import { compressImage } from '../../../utils';

interface PerusahaanTabProps {
    logo: string;
    setLogo: (logoUrl: string) => void;
    themeColor: string;
    setThemeColor: (color: string) => void;
}

const THEME_COLORS = [
    { name: 'Sky', bg: 'bg-sky-500', color: '#0ea5e9' },
    { name: 'Indigo', bg: 'bg-indigo-500', color: '#6366f1' },
    { name: 'Emerald', bg: 'bg-emerald-500', color: '#10b981' },
    { name: 'Rose', bg: 'bg-rose-500', color: '#f43f5e' },
    { name: 'Amber', bg: 'bg-amber-500', color: '#f59e0b' },
];

const PerusahaanTab: React.FC<PerusahaanTabProps> = ({
    logo,
    setLogo,
    themeColor,
    setThemeColor,
}) => {
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert("Harap pilih file gambar.");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert("Ukuran file terlalu besar (Max 5MB).");
                return;
            }

            setIsProcessing(true);
            try {
                // OPTIMASI: Kompresi logo ke lebar maksimal 150px (cukup untuk sidebar)
                // Menggunakan WebP dan kualitas 0.7 untuk keseimbangan ukuran/kualitas.
                const compressedDataUrl = await compressImage(file, 150, 0.7);
                setLogo(compressedDataUrl);
            } catch (error) {
                console.error("Gagal memproses gambar:", error);
                alert("Gagal memproses gambar.");
            } finally {
                setIsProcessing(false);
                e.target.value = '';
            }
        }
    };

    return (
        <div className="space-y-10 animate-fade-in relative">
             {isProcessing && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-lg">
                    <div className="bg-white p-3 rounded-lg shadow-md flex items-center space-x-2">
                        <SpinnerIcon className="w-5 h-5 text-sky-600 animate-spin"/>
                        <span className="text-sm font-medium text-slate-700">Memproses Logo...</span>
                    </div>
                </div>
            )}

            <section>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Logo Perusahaan (Sidebar)</h2>
                <div className="max-w-md space-y-4 p-4 border rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Logo ini akan muncul di pojok kiri atas sidebar menu utama. Otomatis dikompresi ke WebP agar ringan.</p>
                    <div className="flex justify-center items-center h-40 bg-white rounded-md shadow-inner">
                        <img src={logo} alt="Current Logo" className="max-w-full max-h-32 object-contain"/>
                    </div>
                    <input 
                        id="logo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={logoInputRef} 
                        onChange={handleFileChange} 
                    />
                    <label htmlFor="logo-upload" className={`w-full cursor-pointer flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <PhotoIcon className="w-5 h-5 mr-2"/> Ganti Logo Perusahaan
                    </label>
                </div>
            </section>
            <section>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Warna Tema Utama</h2>
                <div className="flex flex-wrap gap-4">
                    {THEME_COLORS.map(color => (
                        <button
                            key={color.name}
                            onClick={() => setThemeColor(color.color)}
                            className="flex items-center space-x-3 p-3 rounded-lg border-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                            style={{ borderColor: themeColor === color.color ? color.color : 'transparent', boxShadow: themeColor === color.color ? `0 0 0 3px ${color.color}33` : 'none' }}
                            aria-pressed={themeColor === color.color}
                        >
                            <div className={`w-10 h-10 rounded-full ${color.bg} shadow-md`}></div>
                            <span className={`font-medium ${themeColor === color.color ? 'text-slate-800' : 'text-slate-600'}`}>{color.name}</span>
                            {themeColor === color.color && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default PerusahaanTab;