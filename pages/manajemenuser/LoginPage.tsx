// FRONTEND: Komponen ini menampilkan halaman login.
// Fungsinya adalah untuk menyediakan formulir bagi pengguna untuk memasukkan username dan password,
// lalu memanggil fungsi `login` dari AuthContext untuk melakukan otentikasi.

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { usePersonalization } from '../../contexts/PersonalizationContext';
import { ChevronDownIcon, XMarkIcon, InformationCircleIcon, DocumentCheckIcon, LockClosedIcon } from '../../components/icons'; 

const InfoModal: React.FC<{
  activeModal: 'about' | 'terms' | 'privacy';
  onClose: () => void;
}> = ({ activeModal, onClose }) => {
    
  const modalContent = {
    about: {
      title: 'Tentang H-POS',
      icon: InformationCircleIcon,
      content: (
        <>
          <p>
            <strong>H-POS</strong> adalah sistem Point of Sale (POS) modern yang dirancang untuk memberdayakan bisnis dari berbagai skala, mulai dari UMKM hingga perusahaan yang sedang berkembang. Misi kami adalah menyediakan solusi yang intuitif, andal, dan komprehensif untuk menyederhanakan operasional bisnis Anda.
          </p>
          <h4>Fitur Utama:</h4>
          <ul>
            <li><strong>Manajemen Stok:</strong> Lacak inventaris secara real-time, dari bahan baku, Work-In-Progress (WIP), hingga produk jadi dengan dukungan varian yang kompleks.</li>
            <li><strong>Analisis & Laporan:</strong> Dapatkan wawasan mendalam tentang penjualan, kinerja cabang, dan tren pelanggan melalui laporan yang mudah dipahami.</li>
            <li><strong>Manajemen Pengguna & Akses:</strong> Atur peran dan hak akses terperinci untuk setiap karyawan dengan aman dan fleksibel.</li>
            <li><strong>Manajemen SDM (HRM):</strong> Kelola data karyawan, absensi berbasis lokasi, hingga proses penggajian dalam satu platform terintegrasi.</li>
            <li><strong>Personalisasi:</strong> Sesuaikan tampilan aplikasi dengan warna tema dan logo brand Anda untuk pengalaman yang lebih personal.</li>
          </ul>
          <p>
            Dengan H-POS, kami berkomitmen untuk menjadi mitra teknologi tepercaya Anda, membantu Anda fokus pada hal yang terpenting: <strong>mengembangkan bisnis Anda.</strong>
          </p>
        </>
      )
    },
    terms: {
      title: 'Syarat dan Ketentuan',
      icon: DocumentCheckIcon,
      content: (
         <>
          <p>Dengan menggunakan layanan H-POS ("Layanan"), Anda setuju untuk terikat oleh Syarat dan Ketentuan berikut:</p>
          <ol>
            <li><strong>Penerimaan Syarat:</strong> Akses atau penggunaan Anda terhadap Layanan menandakan penerimaan tanpa syarat atas semua syarat dan ketentuan dalam perjanjian ini.</li>
            <li><strong>Akun Pengguna:</strong> Anda bertanggung jawab penuh untuk menjaga kerahasiaan informasi akun dan kata sandi Anda. Semua aktivitas yang terjadi di bawah akun Anda adalah tanggung jawab Anda.</li>
            <li><strong>Penggunaan Layanan yang Sah:</strong> Anda setuju untuk tidak menggunakan Layanan untuk tujuan ilegal atau yang dilarang. Anda bertanggung jawab penuh atas semua data yang Anda unggah, kirim, atau tampilkan.</li>
            <li><strong>Kepemilikan Data:</strong> Anda adalah pemilik sah dan memegang hak kekayaan intelektual atas semua data operasional yang Anda masukkan ke dalam Layanan. Kami tidak mengklaim kepemilikan atas data Anda.</li>
            <li><strong>Batasan Tanggung Jawab:</strong> Layanan H-POS disediakan "sebagaimana adanya" dan "sebagaimana tersedia". Kami tidak menjamin bahwa layanan akan selalu tersedia, tanpa gangguan, atau bebas dari kesalahan.</li>
            <li><strong>Penghentian Layanan:</strong> Kami berhak untuk menangguhkan atau menghentikan akses Anda ke Layanan dengan segera jika terjadi pelanggaran serius terhadap syarat-syarat ini.</li>
            <li><strong>Perubahan Syarat:</strong> Kami dapat merevisi Syarat dan Ketentuan ini dari waktu ke waktu. Versi terbaru akan selalu tersedia di platform kami.</li>
          </ol>
        </>
      )
    },
    privacy: {
      title: 'Kebijakan Privasi',
      icon: LockClosedIcon,
      content: (
        <>
          <p>Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi Anda saat Anda menggunakan H-POS.</p>
          <h4>1. Informasi yang Kami Kumpulkan</h4>
          <p>Kami mengumpulkan data yang Anda berikan secara langsung, seperti informasi akun pengguna, data karyawan, data transaksi, dan data inventaris. Kami juga dapat mengumpulkan data penggunaan teknis secara anonim untuk meningkatkan layanan.</p>
          
          <h4>2. Bagaimana Kami Menggunakan Informasi Anda</h4>
          <p>Data Anda digunakan untuk tujuan berikut:</p>
          <ul>
              <li>Menyediakan, mengoperasikan, dan memelihara fungsionalitas Layanan H-POS.</li>
              <li>Memproses transaksi Anda dan mengelola data operasional Anda.</li>
              <li>Meningkatkan, mempersonalisasi, dan menganalisis penggunaan Layanan.</li>
              <li>Berkomunikasi dengan Anda untuk dukungan pelanggan dan pembaruan sistem.</li>
              <li>Mencegah penipuan dan memastikan keamanan platform.</li>
          </ul>

          <h4>3. Keamanan Data</h4>
          <p>Kami menerapkan langkah-langkah keamanan teknis dan organisasi yang wajar untuk melindungi data Anda dari akses, pengungkapan, perubahan, atau perusakan yang tidak sah. Namun, tidak ada metode transmisi internet atau penyimpanan elektronik yang 100% aman.</p>
          
          <h4>4. Berbagi Data</h4>
          <p>Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak ketiga. Kami hanya dapat membagikan informasi dengan penyedia layanan tepercaya yang membantu kami mengoperasikan Layanan (misalnya, penyedia hosting cloud), yang terikat oleh kewajiban kerahasiaan yang ketat.</p>
        </>
      )
    },
  };

  const currentContent = modalContent[activeModal];
  const Icon = currentContent.icon;

  return (
    <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Icon className="w-6 h-6 text-sky-600" />
            <h2 id="info-modal-title" className="text-xl font-semibold text-slate-800">{currentContent.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6"/>
          </button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto bg-slate-50/50">
          <div className="prose prose-slate max-w-none">
            {currentContent.content}
          </div>
        </div>
         <div className="p-4 bg-slate-100 border-t border-slate-200 text-right">
            <button
                onClick={onClose}
                className="px-5 py-2 bg-[var(--primary-color)] text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-[var(--primary-color-dark)] transition-colors"
            >
                Tutup
            </button>
        </div>
      </div>
    </div>
  )
}

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeModal, setActiveModal] = useState<'about' | 'terms' | 'privacy' | null>(null);
  const auth = useAuth();
  const { loginLogo, loginBackground } = usePersonalization();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    try {
      const loginResponse = await auth.login(username, password); // Updated to get response object
      if (loginResponse.success) {
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        setError(loginResponse.message || 'Login gagal.'); // Use message from response
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const backgroundStyle = loginBackground !== "none" ? {
    backgroundImage: `url(${loginBackground})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {};

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" style={backgroundStyle}>
      {loginBackground !== "none" && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>}

      <header className="relative w-full p-4 z-20">
        <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-lg shadow-lg rounded-xl p-4 flex justify-between items-center">
          {/* Left Side: Logo */}
          <div>
            <span className="text-4xl font-black text-slate-800 tracking-tighter">
              <span className="text-black">H</span><span className="text-sky-600">POS</span>
            </span>
             <div className="flex items-center mt-1">
                <div className="w-8 h-1 bg-sky-600 mr-2"></div>
                <span className="text-xs text-slate-600">
                Powered By <b className="text-black">H</b><span className="text-sky-600 font-bold">SYSTEM</span>
                </span>
            </div>
          </div>

          {/* Right Side: Links & Language */}
          <div className="hidden md:flex items-center space-x-4 text-sm text-slate-600">
            <button onClick={() => setActiveModal('about')} className="hover:text-sky-600 transition-colors">About Us</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setActiveModal('terms')} className="hover:text-sky-600 transition-colors">Terms and Conditions</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => setActiveModal('privacy')} className="hover:text-sky-600 transition-colors">Privacy Policy</button>
            
            <div className="relative">
              <select className="form-select appearance-none pl-3 pr-8 py-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 bg-white/50">
                <option>English</option>
                <option>Indonesia</option>
              </select>
              <ChevronDownIcon className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>
          </div>
          
          {/* Mobile Language Selector */}
          <div className="md:hidden relative">
              <select className="form-select appearance-none pl-3 pr-8 py-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 bg-white/50">
                <option>English</option>
                <option>Indonesia</option>
              </select>
              <ChevronDownIcon className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"/>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col justify-center items-center p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-lg shadow-xl rounded-xl p-8">
            <div className="flex flex-col items-center mb-6">
              <img src={loginLogo} alt="Logo" className="w-20 h-20 rounded-full mb-3" />
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Login</h1>
              <p className="text-slate-500 text-sm mt-1">Please sign in to continue</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label 
                  htmlFor="username" 
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="form-input mt-1 block w-full px-4 py-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] sm:text-sm transition duration-150"
                  placeholder="Enter your username"
                  aria-label="Username"
                />
              </div>
              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input mt-1 block w-full px-4 py-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] sm:text-sm transition duration-150"
                  placeholder="Masukkan password Anda"
                  aria-label="Password"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--primary-color)] hover:bg-[var(--primary-color-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-color)] disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                >
                  {isLoggingIn ? 'Signing In...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
          <p className="mt-8 text-center text-xs text-white/80 drop-shadow-sm">
            <Link to={`/self-order?branchId=${username}&tableId=${password}`} className="hover:underline transition-all">
              © 2025 H-POS. All rights reserved.
            </Link>
          </p>
        </div>
      </main>
      
      {activeModal && <InfoModal activeModal={activeModal} onClose={() => setActiveModal(null)} />}
    </div>
  );
};

export default LoginPage;