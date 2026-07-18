// FRONTEND: Komponen ini bertanggung jawab untuk menampilkan widget Clock In/Clock Out.
// Fungsinya adalah untuk mendapatkan lokasi GPS pengguna, membandingkannya dengan titik absensi yang valid,
// dan memungkinkan pengguna untuk mencatat waktu masuk dan keluar kerja.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAccess } from '../contexts/AccessContext';
import { Karyawan, TitikAbsensi, AbsensiLog } from '../types';
import * as api from '../backend/api';
import { haversineDistance } from '../utils';
import { MapPinIcon, ClockIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon, ArrowPathIcon, ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, SpinnerIcon, CameraIcon, XMarkIcon } from './icons';

const HRM_ABSENSI_PATH = '/hrm/absensi'; // Path for insert permission check

const CameraModal: React.FC<{
    onClose: () => void;
    onConfirm: (photoDataUrl: string) => void;
    isProcessing: boolean;
}> = ({ onClose, onConfirm, isProcessing }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraError(null);
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraError(`Gagal mengakses kamera: ${(err as Error).message}. Pastikan izin telah diberikan.`);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-800">Verifikasi Foto Selfie</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100"><XMarkIcon className="w-6 h-6"/></button>
                </div>
                <div className="flex-grow flex items-center justify-center p-4 bg-slate-100 relative">
                    {cameraError ? (
                        <div className="text-center text-red-600 p-4 bg-red-50 rounded-lg">
                            <XCircleIcon className="w-12 h-12 mx-auto mb-2"/>
                            <p className="text-sm font-medium">{cameraError}</p>
                        </div>
                    ) : (
                        <div className="aspect-square w-full max-w-sm relative">
                            <video ref={videoRef} playsInline autoPlay muted className={`w-full h-full object-cover rounded-lg transform -scale-x-100 ${capturedImage ? 'hidden' : 'block'}`}></video>
                            {capturedImage && <img src={capturedImage} alt="Selfie Preview" className="w-full h-full object-cover rounded-lg transform -scale-x-100" />}
                            <canvas ref={canvasRef} className="hidden"></canvas>
                        </div>
                    )}
                </div>
                <div className="p-4 space-y-3">
                    {capturedImage ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={retakePhoto} disabled={isProcessing} className="w-full py-3 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-700 transition-colors">Ambil Ulang</button>
                            <button onClick={() => onConfirm(capturedImage)} disabled={isProcessing} className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 font-semibold text-white transition-colors flex items-center justify-center">
                                {isProcessing ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>}
                                {isProcessing ? 'Memproses...' : 'Konfirmasi'}
                            </button>
                        </div>
                    ) : (
                        <button onClick={capturePhoto} disabled={isProcessing || !!cameraError} className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 font-semibold text-white transition-colors flex items-center justify-center disabled:bg-slate-400">
                            <CameraIcon className="w-6 h-6 mr-2"/> Ambil Foto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ClockInOutWidget: React.FC = () => {
  const { currentUser } = useAuth();
  const { canInsert, isAccessDataLoaded } = useAccess();

  const [karyawan, setKaryawan] = useState<Karyawan | null>(null);
  const [titikAbsensiList, setTitikAbsensiList] = useState<TitikAbsensi[]>([]);
  const [todayLog, setTodayLog] = useState<AbsensiLog | null>(null);
  
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTimeWidget, setCurrentTimeWidget] = useState<string>(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':'));
  const [isLoading, setIsLoading] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Time ticker - optimized to not trigger expensive calculations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeWidget(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDataForWidget = useCallback(async () => {
    if (!currentUser?.id_karyawan) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
        const data = await api.getClockWidgetData(currentUser.id_karyawan);
        setKaryawan(data.karyawan);
        setTitikAbsensiList(data.titikAbsensi);
        setTodayLog(data.todayLog);
    } catch (error) {
        console.error("Error fetching widget data:", error);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser?.id_karyawan]);
  
  useEffect(() => {
    if (isAccessDataLoaded) {
        fetchDataForWidget();
    }
  }, [isAccessDataLoaded, fetchDataForWidget]);

  const fetchLocationWidget = useCallback((isManualRefresh?: boolean) => {
    if (!karyawan) return;
    
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lon: longitude });
      },
      (error: GeolocationPositionError) => {
        console.error("Error getting location:", error);
        const errorMessage = `Gagal mendapatkan lokasi: ${error.message}. Pastikan GPS aktif dan izin lokasi diberikan.`;
        setLocationError(errorMessage);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [karyawan]);

  useEffect(() => {
    if (karyawan && !isLoading) {
        fetchLocationWidget();
    }
  }, [karyawan, isLoading, fetchLocationWidget]);
  
  const canClockInWidget = !todayLog || (todayLog && !!todayLog.waktu_clock_out);
  const canClockOutWidget = todayLog && !todayLog.waktu_clock_out;

  // Memoize heavy distance calculation
  // Only recalculate when currentLocation or list changes, NOT when time changes
  const nearestTitikWidget = useMemo(() => {
      if (!currentLocation || !karyawan || titikAbsensiList.length === 0) return null;

      let closestTitik: { titik: TitikAbsensi; distance: number; isValid: boolean } | null = null;

      for (const titik of titikAbsensiList) {
          const distance = haversineDistance(currentLocation.lat, currentLocation.lon, titik.latitude, titik.longitude);
          if (closestTitik === null || distance < closestTitik.distance) {
            closestTitik = { titik, distance, isValid: distance <= titik.radius };
          }
      }
      return closestTitik;
  }, [currentLocation, karyawan, titikAbsensiList]);

  // Derived state for status message
  const absensiStatusWidget = useMemo(() => {
    if (isLoading) return { message: "Memuat data...", type: 'info' as const };
    if (!karyawan) return { message: "Data karyawan tidak tersedia.", type: 'error' as const };

    if (todayLog) {
        if (todayLog.waktu_clock_out) {
            return { message: `Sudah Clock Out pada ${new Date(todayLog.waktu_clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`, type: 'info' as const };
        } else {
            return { message: `Sudah Clock In pada ${new Date(todayLog.waktu_clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`, type: 'success' as const };
        }
    }

    // Not logged in/out yet, check location status
    if (locationError) return { message: locationError, type: 'error' as const };
    if (!currentLocation) return { message: "Mendeteksi lokasi...", type: 'info' as const };
    
    if (nearestTitikWidget) {
        if (nearestTitikWidget.isValid) {
            return { message: `Siap untuk ${canClockInWidget ? 'Clock In' : 'Clock Out'}. Lokasi valid.`, type: 'info' as const };
        } else {
            if (nearestTitikWidget.titik.wajib_di_dalam_radius) {
                return { message: "Anda di luar radius. Absensi tidak diizinkan.", type: 'error' as const };
            } else {
                return { message: "Anda berada di luar radius absensi yang valid.", type: 'error' as const };
            }
        }
    }

    return { message: "Tidak ada titik absensi valid untuk cabang Anda.", type: 'info' as const };

  }, [isLoading, karyawan, todayLog, locationError, currentLocation, nearestTitikWidget, canClockInWidget]);


  const handleClockActionWidget = async (fotoUrl: string) => {
    if (!canInsert(HRM_ABSENSI_PATH) || !karyawan ) return;
    if (!currentLocation) {
        fetchLocationWidget(true); 
        return;
    }
    if (nearestTitikWidget?.titik.wajib_di_dalam_radius && !nearestTitikWidget?.isValid) return;
    
    setIsProcessing(true);
    let statusAbsensi: 'valid' | 'luar_area' | 'gagal_gps' = 'luar_area';
    if (locationError) statusAbsensi = 'gagal_gps';
    else if (nearestTitikWidget?.isValid) statusAbsensi = 'valid';

    try {
        const response = await api.performClockAction({
            karyawanId: karyawan.id_karyawan,
            isClockIn: !todayLog || !!todayLog.waktu_clock_out,
            location: currentLocation,
            nearestTitik: nearestTitikWidget?.titik || null,
            status: statusAbsensi,
            fotoUrl: fotoUrl
        });

        if (response.success) {
            await fetchDataForWidget(); 
        } else {
            throw new Error("Gagal melakukan absensi di server.");
        }
    } catch (error) {
        console.error("Error performing clock action:", error);
        alert("Gagal menyimpan data absensi.");
    } finally {
        setIsProcessing(false);
        setIsCameraOpen(false);
    }
  };

  if (!isAccessDataLoaded || isLoading) {
    return <div className="p-4 flex justify-center items-center h-full bg-slate-50 rounded-lg"><SpinnerIcon className="w-6 h-6 text-sky-500"/></div>;
  }

  if (!karyawan) {
    return <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg">Widget absensi memerlukan data karyawan yang terhubung dengan akun Anda.</div>;
  }
  
  const isOutsideStrictRadius = nearestTitikWidget?.titik.wajib_di_dalam_radius && !nearestTitikWidget.isValid;
  const clockButtonDisabledWidget = isProcessing || (!canClockInWidget && !canClockOutWidget) || !currentLocation || !canInsert(HRM_ABSENSI_PATH) || isOutsideStrictRadius;
  
  const { icon: statusLocationIcon, text: statusLocationText, color: statusLocationColor } = (() => {
    if (locationError) return { icon: <XCircleIcon className="w-4 h-4 mr-1.5 text-red-500 flex-shrink-0" />, text: locationError, color: "text-red-600" };
    if (!currentLocation) return { icon: <InformationCircleIcon className="w-4 h-4 mr-1.5 text-sky-500 flex-shrink-0" />, text: "Mendeteksi lokasi...", color: "text-sky-600"};
    if (nearestTitikWidget) {
        if (nearestTitikWidget.isValid) return { icon: <CheckCircleIcon className="w-4 h-4 mr-1.5 text-green-500 flex-shrink-0" />, text: `Dalam jangkauan: ${nearestTitikWidget.titik.nama_titik} (${nearestTitikWidget.distance.toFixed(0)}m)`, color: "text-green-600" };
        const baseText = `Di luar radius: ${nearestTitikWidget.titik.nama_titik} (${nearestTitikWidget.distance.toFixed(0)}m dari radius ${nearestTitikWidget.titik.radius}m)`;
        if (nearestTitikWidget.titik.wajib_di_dalam_radius) {
            return { icon: <XCircleIcon className="w-4 h-4 mr-1.5 text-red-500 flex-shrink-0" />, text: `${baseText}. Absensi tidak diizinkan.`, color: "text-red-600" };
        }
        return { icon: <XCircleIcon className="w-4 h-4 mr-1.5 text-orange-500 flex-shrink-0" />, text: baseText, color: "text-orange-600" };
    }
    return { icon: <InformationCircleIcon className="w-4 h-4 mr-1.5 text-slate-500 flex-shrink-0" />, text: "Tidak ada titik absensi terdekat.", color: "text-slate-600"};
  })();
  
  const currentDayDateWidget = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
    <div className="w-full bg-white p-5 rounded-xl shadow-lg space-y-5">
      <div className="text-center">
        <ClockIcon className="w-12 h-12 text-sky-500 mx-auto mb-1" />
        <p className="text-3xl font-bold text-slate-700 tracking-wider">{currentTimeWidget}</p>
        <p className="text-xs text-slate-500">{currentDayDateWidget}</p>
      </div>

      {/* Status Message from derived state */}
      <div className={`p-2 rounded-md text-xs text-center border ${absensiStatusWidget.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : absensiStatusWidget.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
          {absensiStatusWidget.message}
      </div>

      <div className={`flex items-center p-2.5 rounded-md text-xs ${statusLocationColor} ${statusLocationColor.includes('red') ? 'bg-red-50 border-red-200' : statusLocationColor.includes('green') ? 'bg-green-50 border-green-200' : statusLocationColor.includes('orange') ? 'bg-orange-50 border-orange-200' : 'bg-sky-50 border-sky-200'} border`}>
        {statusLocationIcon}
        <span className="leading-tight">{statusLocationText}</span>
      </div>
      
      <div className="text-center">
        <button 
            onClick={() => fetchLocationWidget(true)} 
            className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center justify-center mx-auto p-1 hover:bg-sky-50 rounded disabled:opacity-50"
            disabled={isProcessing}
            aria-label="Segarkan Lokasi GPS"
        >
            <ArrowPathIcon className="w-3.5 h-3.5 mr-1"/> Segarkan Lokasi
        </button>
      </div>

      <button
        onClick={() => setIsCameraOpen(true)}
        disabled={clockButtonDisabledWidget}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-150 ease-in-out shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center justify-center text-sm
                    ${clockButtonDisabledWidget ? 'bg-slate-400 cursor-not-allowed focus-visible:ring-slate-500' : 
                     canClockInWidget ? 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 focus-visible:ring-sky-500' : 
                     'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 focus-visible:ring-orange-500'
                    }`}
        aria-live="polite"
      >
        {isProcessing ? <SpinnerIcon className="w-5 h-5 mr-2"/> : (canClockInWidget ? <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2"/> : <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-2"/>)}
        {isProcessing ? 'Memproses...' : (canClockInWidget ? 'Clock In' : 'Clock Out')}
      </button>

      {todayLog && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5">
          <p className="font-medium text-slate-600">Absensi Hari Ini:</p>
          <div className="flex items-center text-slate-500">
            <ArrowRightOnRectangleIcon className="w-3.5 h-3.5 mr-1.5 text-green-500 flex-shrink-0"/>
            <span>In: {new Date(todayLog.waktu_clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({todayLog.status_clock_in})</span>
          </div>
          {todayLog.waktu_clock_out && (
            <div className="flex items-center text-slate-500">
              <ArrowLeftOnRectangleIcon className="w-3.5 h-3.5 mr-1.5 text-red-500 flex-shrink-0"/>
              <span>Out: {new Date(todayLog.waktu_clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({todayLog.status_clock_out})</span>
            </div>
          )}
        </div>
      )}
    </div>
    {isCameraOpen && (
        <CameraModal 
            onClose={() => setIsCameraOpen(false)}
            onConfirm={handleClockActionWidget}
            isProcessing={isProcessing}
        />
    )}
    </>
  );
};

export default ClockInOutWidget;