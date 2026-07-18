// FRONTEND: Komponen ini mengelola UI khusus untuk pengaturan Biaya Pengantaran.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Branch, DeliveryFeeSettings, DeliveryFeeTier } from '../../types';
import * as api from '../../backend/api';
import { useBranch } from '../../contexts/BranchContext';
import { PlusCircleIcon, TrashIcon, SpinnerIcon } from '../../components/icons';

const PAGE_PATH = '/penjualan/settings';

// Declare Leaflet to avoid TypeScript errors
declare const L: any;

const InteractiveMap: React.FC<{
    latitude: number;
    longitude: number;
    onLocationChange: (lat: number, lon: number) => void;
    branchName: string;
}> = ({ latitude, longitude, onLocationChange, branchName }) => {
    const mapContainerRef = useRef<HTMLInputElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current && latitude && longitude) {
            mapRef.current = L.map(mapContainerRef.current).setView([latitude, longitude], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

            markerRef.current = L.marker([latitude, longitude], { draggable: true })
                .addTo(mapRef.current)
                .bindPopup(`<b>${branchName}</b><br/>Drag untuk menyesuaikan titik awal.`)
                .openPopup();
            
            markerRef.current.on('dragend', (event: any) => {
                const marker = event.target;
                const position = marker.getLatLng();
                onLocationChange(position.lat, position.lng);
            });
        }
    }, [latitude, longitude, branchName, onLocationChange]); 

    useEffect(() => {
        if (mapRef.current && markerRef.current) {
            const newLatLng = L.latLng(latitude, longitude);
            if (!mapRef.current.getBounds().contains(newLatLng)) {
                mapRef.current.setView(newLatLng);
            }
            markerRef.current.setLatLng(newLatLng);
        }
    }, [latitude, longitude]);

    return <div ref={mapContainerRef} className="h-64 w-full rounded-lg z-0" />;
};

const BiayaPengantaranPage: React.FC = () => {
    const { selectedBranchId } = useBranch();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [settings, setSettings] = useState<DeliveryFeeSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchDataForBranch = useCallback(async (branchId: string) => {
        setIsLoading(true);
        try {
            let data = await api.getDeliveryFeeSettingsForBranch(branchId);
            const branchData = await api.getBranches();
            setBranches(branchData);
            if (!data) {
                const selectedBranch = branchData.find(b => b.id_cabang === branchId);
                data = {
                    id_cabang: branchId,
                    id_grup: selectedBranch?.id_grup || '',
                    aktif: false, tipe: 'flat', flat_rate: 10000,
                    base_fee: 5000, tiers: [{ id: `tier-${Date.now()}`, upToKm: 5, fee: 10000 }],
                    fee_per_km_after_last_tier: 2000, free_shipping_threshold: null,
                    latitude: selectedBranch?.latitude || -6.2088, longitude: selectedBranch?.longitude || 106.8456,
                };
            }
            setSettings(data);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedBranchId) {
            fetchDataForBranch(selectedBranchId);
        } else {
            setSettings(null);
            setIsLoading(false);
        }
    }, [selectedBranchId, fetchDataForBranch]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!settings) return;
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        const isNumeric = ['flat_rate', 'base_fee', 'fee_per_km_after_last_tier', 'free_shipping_threshold'].includes(name);

        setSettings(prev => ({
            ...prev!,
            [name]: type === 'checkbox' ? checked : (isNumeric ? (value === '' ? null : Number(value)) : value)
        }));
    };
    
    const handleTierChange = (id: string, field: 'upToKm' | 'fee', value: string) => {
        if (!settings) return;
        const newTiers = settings.tiers.map(tier => 
            tier.id === id ? { ...tier, [field]: Number(value) || 0 } : tier
        );
        setSettings(prev => ({ ...prev!, tiers: newTiers }));
    };

    const addTier = () => {
        if (!settings) return;
        const newTier: DeliveryFeeTier = { id: `tier-${Date.now()}`, upToKm: 0, fee: 0 };
        setSettings(prev => ({ ...prev!, tiers: [...prev!.tiers, newTier] }));
    };

    const removeTier = (id: string) => {
        if (!settings || settings.tiers.length <= 1) return;
        setSettings(prev => ({ ...prev!, tiers: prev!.tiers.filter(t => t.id !== id) }));
    };
    
    const handleLocationChange = (lat: number, lon: number) => {
        setSettings(prev => prev ? { ...prev, latitude: lat, longitude: lon } : null);
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await api.saveDeliveryFeeSettings(settings);
            alert("Pengaturan biaya pengantaran berhasil disimpan.");
        } catch (error) {
            alert("Gagal menyimpan pengaturan.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
    if (!settings || !selectedBranchId) return <div className="p-8 text-center text-slate-500">Pilih cabang terlebih dahulu untuk mengatur biaya pengantaran.</div>;

    const selectedBranch = branches.find(b => b.id_cabang === selectedBranchId);

    return (
        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-700">Status & Tipe</h3>
                        <label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" name="aktif" checked={settings.aktif} onChange={handleInputChange} className="sr-only"/><div className={`block w-10 h-6 rounded-full transition-colors ${settings.aktif ? 'bg-sky-500' : 'bg-slate-300'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.aktif ? 'translate-x-full' : ''}`}></div></div><span className="ml-3 font-medium text-slate-700">Aktifkan Biaya Pengantaran</span></label>
                    </div>
                     <div className={`flex border border-slate-300 rounded-lg p-1 transition-opacity duration-300 ${!settings.aktif ? 'opacity-50' : ''}`}><button type="button" onClick={() => setSettings(p => ({...p!, tipe: 'flat'}))} className={`w-1/2 py-2 text-sm font-semibold rounded-md ${settings.tipe === 'flat' ? 'bg-sky-600 text-white shadow' : 'text-slate-600'}`}>Tarif Tetap</button><button type="button" onClick={() => setSettings(p => ({...p!, tipe: 'distance'}))} className={`w-1/2 py-2 text-sm font-semibold rounded-md ${settings.tipe === 'distance' ? 'bg-sky-600 text-white shadow' : 'text-slate-600'}`}>Berdasarkan Jarak</button></div>
                </div>

                <div className={`bg-white p-6 rounded-lg border border-slate-200 shadow-sm transition-opacity duration-300 ${!settings.aktif ? 'opacity-50 pointer-events-none' : ''}`}>
                    {settings.tipe === 'flat' ? (
                        <div><h3 className="text-lg font-semibold text-slate-700 mb-4">Pengaturan Tarif Tetap</h3><div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Biaya Pengantaran (Rp)*</legend><input type="number" name="flat_rate" value={settings.flat_rate ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div></div>
                    ) : (
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-4">Pengaturan Tarif Berdasarkan Jarak</h3>
                            <div className="space-y-4">
                                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Biaya Dasar (Rp)</legend><input type="number" name="base_fee" value={settings.base_fee ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div>
                                <div>
                                    <h4 className="text-sm font-medium text-slate-600 mb-2">Tingkatan Tarif</h4>
                                    <div className="space-y-2">
                                        {settings.tiers.map((tier) => (
                                            <div key={tier.id} className="flex items-center gap-2"><span className="text-sm">Hingga</span><input type="number" value={tier.upToKm} onChange={e => handleTierChange(tier.id, 'upToKm', e.target.value)} className="form-input w-20 text-center py-1"/><span className="text-sm">km, biaya</span><input type="number" value={tier.fee} onChange={e => handleTierChange(tier.id, 'fee', e.target.value)} className="form-input flex-grow py-1 text-right"/><span className="text-sm">Rp</span><button onClick={() => removeTier(tier.id)} disabled={settings.tiers.length <= 1} className="p-1 text-red-500 disabled:opacity-50"><TrashIcon className="w-4 h-4"/></button></div>
                                        ))}
                                    </div>
                                    <button onClick={addTier} className="text-sky-600 font-semibold text-sm mt-2 flex items-center"><PlusCircleIcon className="w-5 h-5 mr-1"/> Tambah Tingkatan</button>
                                </div>
                                <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Biaya per KM (setelah tingkatan terakhir)</legend><input type="number" name="fee_per_km_after_last_tier" value={settings.fee_per_km_after_last_tier ?? ''} onChange={handleInputChange} className="block w-full py-2.5 outline-none bg-transparent"/></fieldset></div>
                            </div>
                        </div>
                    )}
                </div>
                 <div className={`bg-white p-6 rounded-lg border border-slate-200 shadow-sm transition-opacity duration-300 ${!settings.aktif ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="text-lg font-semibold text-slate-700 mb-4">Opsi Tambahan</h3>
                    <div className="relative"><fieldset className="border border-slate-300 rounded-md px-3 group"><legend className="text-xs">Gratis Ongkir (min. belanja Rp)</legend><input type="number" name="free_shipping_threshold" value={settings.free_shipping_threshold ?? ''} onChange={handleInputChange} placeholder="Kosongkan untuk menonaktifkan" className="block w-full py-2.5 outline-none bg-transparent" /></fieldset></div>
                 </div>

            </div>
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-700 mb-4">Lokasi Awal Pengantaran</h3>
                    {selectedBranch && settings.latitude && settings.longitude ? (
                        <InteractiveMap latitude={settings.latitude} longitude={settings.longitude} onLocationChange={handleLocationChange} branchName={selectedBranch.Nama} />
                    ) : (
                        <div className="h-64 w-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">Pilih cabang untuk menampilkan peta.</div>
                    )}
                </div>
                 <button onClick={handleSave} disabled={isSaving} className="w-full bg-sky-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-700 transition-colors flex items-center justify-center disabled:bg-slate-400">
                    {isSaving ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : null}
                    {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
            </div>
        </div>
    );
};

export default BiayaPengantaranPage;
