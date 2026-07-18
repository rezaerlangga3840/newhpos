import React, { useRef, useState } from 'react';
import { PhotoIcon, TrashIcon, SpinnerIcon } from '../../../components/icons';
import { compressImage } from '../../../utils';

interface AplikasiTabProps {
    loginLogo: string;
    setLoginLogo: (logoUrl: string) => void;
    loginBackground: string;
    setLoginBackground: (bgUrl: string) => void;
}

const AplikasiTab: React.FC<AplikasiTabProps> = ({
    loginLogo,
    setLoginLogo,
    loginBackground,
    setLoginBackground,
}) => {
    const loginLogoInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void, maxWidth: number) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validasi tipe file
            if (!file.type.startsWith('image/')) {
                alert("Harap pilih file gambar.");
                return;
            }
            // Validasi ukuran awal (max 5MB sebelum kompresi)
            if (file.size > 5 * 1024 * 1024) {
                alert("Ukuran file terlalu besar (Max 5MB).");
                return;
            }

            setIsProcessing(true);
            try {
                // OPTIMASI: Kualitas diturunkan ke 0.6. Untuk gambar web background/logo, ini sangat cukup
                // dan menghasilkan ukuran file jauh lebih kecil (meringankan localStorage & load time).
                const compressedDataUrl = await compressImage(file, maxWidth, 0.6);
                setter(compressedDataUrl);
            } catch (error) {
                console.error("Gagal memproses gambar:", error);
                alert("Gagal memproses gambar. Silakan coba file lain.");
            } finally {
                setIsProcessing(false);
                // Reset input value agar user bisa memilih file yang sama jika perlu
                e.target.value = '';
            }
        }
    };

    const handleRemoveBackground = () => {
        setLoginBackground("none");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in relative">
            {isProcessing && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-lg">
                    <div className="bg-white p-3 rounded-lg shadow-md flex items-center space-x-2">
                        <SpinnerIcon className="w-5 h-5 text-sky-600 animate-spin"/>
                        <span className="text-sm font-medium text-slate-700">Mengoptimalkan Gambar...</span>
                    </div>
                </div>
            )}

            <section>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Logo Halaman Login</h2>
                <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Logo yang ditampilkan di tengah kotak formulir login. Otomatis dikompresi ke WebP agar ringan.</p>
                    <div className="flex justify-center items-center h-40 bg-white rounded-md shadow-inner">
                        <img src={loginLogo} alt="Current Login Logo" className="max-w-full max-h-32 object-contain"/>
                    </div>
                    <input 
                        id="login-logo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={loginLogoInputRef} 
                        onChange={(e) => handleFileChange(e, setLoginLogo, 300)} // Resize to max 300px width
                    />
                    <label htmlFor="login-logo-upload" className={`w-full cursor-pointer flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <PhotoIcon className="w-5 h-5 mr-2"/> Ganti Logo Login
                    </label>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Latar Belakang Halaman Login</h2>
                <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Gambar fullscreen di belakang formulir login. Otomatis di-resize (max 1024px) untuk performa optimal.</p>
                    <div className="flex justify-center items-center h-40 bg-white rounded-md shadow-inner overflow-hidden relative">
                        {loginBackground !== 'none' ? (
                            <img src={loginBackground} alt="Current Login Background" className="w-full h-full object-cover"/>
                        ) : (
                            <span className="text-slate-400 text-sm">Tanpa Latar Belakang</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <input 
                            id="bg-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={bgInputRef} 
                            // OPTIMASI: Mengurangi maxWidth ke 1024px sudah cukup untuk background web app
                            onChange={(e) => handleFileChange(e, setLoginBackground, 1024)} 
                        />
                        <label htmlFor="bg-upload" className={`flex-grow cursor-pointer flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <PhotoIcon className="w-5 h-5 mr-2"/> Ganti Latar Belakang
                        </label>
                        <button onClick={handleRemoveBackground} disabled={isProcessing} className="flex-shrink-0 py-2 px-3 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50" title="Hapus Latar Belakang">
                            <TrashIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AplikasiTab;