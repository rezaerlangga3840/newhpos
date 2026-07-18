import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Payroll, PayrollDetail, Karyawan, PayrollComponent, Grup, Branch, AbsensiLog } from '../../types';
import { useBranch } from '../../contexts/BranchContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAccess } from '../../contexts/AccessContext';
import { deepClone } from '../../utils';
import { 
    getPayrolls, getKaryawan, getPayrollComponents, getAbsensiLogs, getBranches, getGrups, 
    updatePayroll, deletePayroll, addPayroll
} from '../../backend/api';
import { CurrencyDollarIcon, PencilSquareIcon, TrashIcon, XMarkIcon, EyeIcon, LockClosedIcon, CheckCircleIcon, InformationCircleIcon, DocumentCheckIcon, SpinnerIcon } from '../../components/icons';
import { TabelFiturStandar, ColumnDef } from '../../components/TabelFiturStandar';

const PAGE_PATH = '/hrm/penggajian';

const calculateTotalHours = (karyawanId: string, year: number, month: number, absensiLogs: AbsensiLog[]): number => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const relevantLogs = absensiLogs.filter(log =>
        log.id_karyawan === karyawanId &&
        log.waktu_clock_out &&
        new Date(log.waktu_clock_in) >= startDate &&
        new Date(log.waktu_clock_in) <= endDate
    );

    let totalMilliseconds = 0;
    relevantLogs.forEach(log => {
        const clockInTime = new Date(log.waktu_clock_in).getTime();
        const clockOutTime = new Date(log.waktu_clock_out!).getTime();
        if(clockOutTime > clockInTime){
            totalMilliseconds += (clockOutTime - clockInTime);
        }
    });

    const totalHours = totalMilliseconds / (1000 * 60 * 60);
    return totalHours;
};

export const PayslipModal: React.FC<{ payroll: Payroll | null; onClose: () => void; branchMap: Record<string, string>; karyawanMap: Record<string, Karyawan>; grupMap: Record<string,string> }> = ({ payroll, onClose, branchMap, karyawanMap, grupMap }) => {
    if (!payroll) return null;
    const handlePrint = () => window.print();
    const karyawan = karyawanMap[payroll.id_karyawan];
    const branchName = branchMap[payroll.id_cabang];
    const grupName = grupMap[payroll.id_cabang] || 'Perusahaan';
    const isDraft = payroll.status === 'draft';
    const period = new Date(payroll.periode_tahun, payroll.periode_bulan - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const earnings = payroll.details.filter(d => d.type === 'pendapatan');
    const deductions = payroll.details.filter(d => d.type === 'potongan');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 payslip-print-area">
            <style>{`@media print { body, html { background: #fff; } body > *:not(.payslip-print-area), .no-print { display: none !important; } .payslip-print-area, .payslip-container { position: absolute; left: 0; top: 0; width: 100%; height: auto; display: block; overflow: visible; background: white; margin: 0; padding: 0; border: none; box-shadow: none; border-radius: 0; } .payslip-content-wrapper { padding: 2rem 1.5rem !important; -webkit-print-color-adjust: exact; color-adjust: exact; } }`}</style>
            <div className="payslip-container bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col relative overflow-hidden">
                 {isDraft && ( <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0"> <h1 className="text-8xl md:text-9xl font-black text-red-500 opacity-5 -rotate-45 whitespace-nowrap select-none">D R A F T</h1> </div> )}
                <div className="payslip-content-wrapper flex-grow overflow-y-auto p-8 z-10">
                    <header className="flex justify-between items-start pb-6 mb-6"><h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{grupName}</h1><div className="text-right"><h2 className="text-2xl font-bold text-sky-600">SLIP GAJI</h2><p className="text-sm text-slate-500 font-medium">{period}</p></div></header>
                    <section className="mb-8 p-4 bg-slate-50 rounded-lg border grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                        <div><p className="text-slate-500">Nama</p><p className="font-semibold text-slate-800">{karyawan?.nama_lengkap || '-'}</p></div>
                        <div><p className="text-slate-500">Jabatan</p><p className="font-semibold text-slate-800">{karyawan?.posisi || '-'}</p></div>
                        <div><p className="text-slate-500">ID Karyawan</p><p className="font-semibold text-slate-800">{payroll.id_karyawan}</p></div>
                        <div><p className="text-slate-500">Departemen</p><p className="font-semibold text-slate-800">{karyawan?.departemen || '-'}</p></div>
                    </section>
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div><h3 className="text-lg font-semibold text-green-700 bg-green-100 px-4 py-2 rounded-t-lg">Pendapatan</h3><div className="border border-t-0 border-green-200 rounded-b-lg overflow-hidden">{earnings.length > 0 ? (<table className="min-w-full text-sm"><tbody>{earnings.map(d => (<tr key={d.id_payroll_component} className="border-b border-slate-100 last:border-b-0"><td className="py-2.5 px-4 text-slate-600">{d.nama_component}</td><td className="py-2.5 px-4 text-right font-mono text-slate-800">{formatRupiah(d.amount)}</td></tr>))}</tbody><tfoot><tr className="font-bold bg-green-100"><td className="py-2.5 px-4 text-green-800">Total Pendapatan</td><td className="py-2.5 px-4 text-right font-mono text-green-800">{formatRupiah(payroll.total_pendapatan)}</td></tr></tfoot></table>) : (<p className="text-center text-slate-500 py-10 text-xs italic">Tidak ada pendapatan.</p>)}</div></div>
                        <div><h3 className="text-lg font-semibold text-red-700 bg-red-100 px-4 py-2 rounded-t-lg">Potongan</h3><div className="border border-t-0 border-red-200 rounded-b-lg overflow-hidden">{deductions.length > 0 ? (<table className="min-w-full text-sm"><tbody>{deductions.map(d => (<tr key={d.id_payroll_component} className="border-b border-slate-100 last:border-b-0"><td className="py-2.5 px-4 text-slate-600">{d.nama_component}</td><td className="py-2.5 px-4 text-right font-mono text-slate-800">({formatRupiah(Math.abs(d.amount))})</td></tr>))}</tbody><tfoot><tr className="font-bold bg-red-100"><td className="py-2.5 px-4 text-red-800">Total Potongan</td><td className="py-2.5 px-4 text-right font-mono text-red-800">({formatRupiah(Math.abs(payroll.total_potongan))})</td></tr></tfoot></table>) : (<p className="text-center text-slate-500 py-10 text-xs italic">Tidak ada potongan.</p>)}</div></div>
                    </section>
                    <section className="mt-8 p-6 bg-sky-600 text-white rounded-lg shadow-lg"><div className="flex justify-between items-center"><h3 className="text-xl font-bold uppercase tracking-wider text-sky-200">Take-Home Pay</h3><p className="text-3xl font-extrabold font-mono tracking-tight">{formatRupiah(payroll.total_gaji_bersih)}</p></div></section>
                    <footer className="mt-8 text-center text-xs text-slate-400">Dokumen ini dibuat oleh sistem pada {new Date().toLocaleString('id-ID')} dan sah tanpa tanda tangan.</footer>
                </div>
                <div className="no-print mt-auto p-4 bg-slate-100 border-t flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-200">Tutup</button><button onClick={handlePrint} className="px-5 py-2 bg-sky-600 text-white rounded-md text-sm font-medium hover:bg-sky-700">Cetak</button></div>
            </div>
        </div>
    );
};

interface PayrollRowData {
  karyawan: Karyawan;
  payroll: Payroll | undefined;
}

const PenggajianPage: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const { selectedBranchId, selectableBranches, userRoleType } = useBranch();
    const { currentUser } = useAuth();
    const { canUpdate, canDelete, isAccessDataLoaded } = useAccess();

    const [allPayrolls, setAllPayrolls] = useState<Payroll[]>([]);
    const [allKaryawan, setAllKaryawan] = useState<Karyawan[]>([]);
    const [allPayrollComponents, setAllPayrollComponents] = useState<PayrollComponent[]>([]);
    const [allAbsensiLogs, setAllAbsensiLogs] = useState<AbsensiLog[]>([]);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [allGrups, setAllGrups] = useState<Grup[]>([]);
    
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [isGenerating, setIsGenerating] = useState(false);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
    const [editablePayrollDetails, setEditablePayrollDetails] = useState<PayrollDetail[]>([]);
    const [includedComponentIds, setIncludedComponentIds] = useState<Set<string>>(new Set());
    const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
    const [payrollForSlip, setPayrollForSlip] = useState<Payroll | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [payrollToDelete, setPayrollToDelete] = useState<Payroll | null>(null);
    
    // State untuk modal konfirmasi publish dan paid
    const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
    const [payrollToPublish, setPayrollToPublish] = useState<Payroll | null>(null);
    const [isPaidConfirmOpen, setIsPaidConfirmOpen] = useState(false);
    const [payrollToMarkPaid, setPayrollToMarkPaid] = useState<Payroll | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const [payrolls, karyawan, components, logs, branches, grups] = await Promise.all([
            getPayrolls(), getKaryawan(), getPayrollComponents(), getAbsensiLogs(), getBranches(), getGrups()
        ]);
        setAllPayrolls(payrolls);
        setAllKaryawan(karyawan);
        setAllPayrollComponents(components);
        setAllAbsensiLogs(logs);
        setAllBranches(branches);
        setAllGrups(grups);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const generatePayrollsForPeriod = async () => {
            if (isLoading || isGenerating || !allKaryawan.length || !allPayrollComponents.length) return;

            const karyawanInScope = allKaryawan.filter(k => {
                if (k.status_karyawan !== 'aktif') return false;
                if (!selectedBranchId) {
                    if (userRoleType === 'superuser') return true;
                    return selectableBranches.some(b => b.id_cabang === k.id_cabang);
                }
                return k.id_cabang === selectedBranchId;
            });

            const needsGeneration = karyawanInScope.some(k => 
                !allPayrolls.some(p => p.id_karyawan === k.id_karyawan && p.periode_tahun === selectedYear && p.periode_bulan === selectedMonth)
            );

            if (!needsGeneration) return;

            setIsGenerating(true);
            const newPayrollsToAdd: Payroll[] = [];

            for (const karyawan of karyawanInScope) {
                const payrollExists = allPayrolls.some(p => p.id_karyawan === karyawan.id_karyawan && p.periode_tahun === selectedYear && p.periode_bulan === selectedMonth);

                if (!payrollExists) {
                    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
                    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
                    
                    const previousPayroll = allPayrolls.find(p => p.id_karyawan === karyawan.id_karyawan && p.periode_bulan === prevMonth && p.periode_tahun === prevYear);
                    
                    let details: PayrollDetail[];
                    if (previousPayroll) {
                        details = deepClone(previousPayroll.details);
                    } else {
                        details = allPayrollComponents.map(pc => ({
                            id_payroll_component: pc.id_payroll_component,
                            nama_component: pc.nama_component,
                            type: pc.type,
                            amount: pc.calculation_type === 'fixed' ? (pc.amount || 0) : 0,
                            quantity: null
                        }));
                    }

                    // --- Handle Gaji Pokok from Karyawan profile ---
                    const gajiPokokId = 'PC1'; // Hardcoded ID for Gaji Pokok
                    // Ensure Gaji Pokok from previous month is removed to avoid duplicates or old data
                    let detailsWithoutGajiPokok = details.filter(d => d.id_payroll_component !== gajiPokokId);

                    // Add Gaji Pokok only if it has a positive value
                    if (karyawan.gaji_pokok && karyawan.gaji_pokok > 0) {
                        detailsWithoutGajiPokok.unshift({
                            id_payroll_component: gajiPokokId,
                            nama_component: 'Gaji Pokok',
                            type: 'pendapatan',
                            amount: karyawan.gaji_pokok,
                            quantity: null,
                        });
                    }
                    details = detailsWithoutGajiPokok; // Use the updated details array

                    const totalPendapatan = details.filter(d => d.type === 'pendapatan').reduce((s, i) => s + i.amount, 0);
                    const totalPotongan = details.filter(d => d.type === 'potongan').reduce((s, i) => s + i.amount, 0);

                    const newPayroll: Payroll = {
                        id_payroll: `PAY-${karyawan.id_cabang}-${selectedYear}${String(selectedMonth).padStart(2, '0')}-${karyawan.id_karyawan}`,
                        id_karyawan: karyawan.id_karyawan,
                        id_cabang: karyawan.id_cabang,
                        periode_bulan: selectedMonth,
                        periode_tahun: selectedYear,
                        status: 'draft',
                        details,
                        total_pendapatan: totalPendapatan,
                        total_potongan: totalPotongan,
                        total_gaji_bersih: totalPendapatan - totalPotongan,
                        tanggal_pembayaran: null
                    };
                    newPayrollsToAdd.push(newPayroll);
                }
            }

            if (newPayrollsToAdd.length > 0) {
                for (const p of newPayrollsToAdd) { await addPayroll(p); }
                setAllPayrolls(prev => [...prev, ...newPayrollsToAdd]);
            }
            setIsGenerating(false);
        };

        generatePayrollsForPeriod();
    }, [selectedYear, selectedMonth, selectedBranchId, allKaryawan, allPayrolls, allPayrollComponents, isLoading, isGenerating, selectableBranches, userRoleType]);

    const processedPayrolls = useMemo(() => {
        return allPayrolls.map(p => {
            if (p.status === 'draft') {
                const totalHours = calculateTotalHours(p.id_karyawan, p.periode_tahun, p.periode_bulan, allAbsensiLogs);
                const newDetails = p.details.map(detail => {
                    const masterComp = allPayrollComponents.find(mc => mc.id_payroll_component === detail.id_payroll_component);
                    if (masterComp && masterComp.calculation_type === 'hourly') {
                        // Use saved quantity if available, otherwise calculate from attendance
                        const quantity = detail.quantity ?? totalHours;
                        return { ...detail, amount: quantity * (masterComp.amount || 0), quantity: quantity };
                    }
                    return detail;
                });
                const totalPendapatan = newDetails.filter(d => d.type === 'pendapatan').reduce((sum, item) => sum + item.amount, 0);
                const totalPotongan = newDetails.filter(d => d.type === 'potongan').reduce((sum, item) => sum + item.amount, 0);
                return { ...p, details: newDetails, total_pendapatan: totalPendapatan, total_potongan: totalPotongan, total_gaji_bersih: totalPendapatan - totalPotongan };
            }
            return p;
        });
    }, [allPayrolls, allAbsensiLogs, allPayrollComponents]);

    const karyawanMap = useMemo(() => allKaryawan.reduce((map, k) => ({ ...map, [k.id_karyawan]: k }), {} as Record<string, Karyawan>), [allKaryawan]);
    const branchMap = useMemo(() => allBranches.reduce((map, b) => ({ ...map, [b.id_cabang]: b.Nama }), {} as Record<string, string>), [allBranches]);
    const grupMap = useMemo(() => {
        const grupDataMap = allGrups.reduce((map, g) => ({ ...map, [g.id_grup]: g.nama_grup }), {} as Record<string, string>);
        return allBranches.reduce((map, b) => ({ ...map, [b.id_cabang]: grupDataMap[b.id_grup] || 'Grup Tidak Diketahui' }), {} as Record<string, string>);
    }, [allBranches, allGrups]);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);
    const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('id-ID', { month: 'long' }) })), []);

    const karyawanWithPayrollData: PayrollRowData[] = useMemo(() => {
        const karyawanInScope = allKaryawan.filter(k => {
            if (k.status_karyawan !== 'aktif') return false;
            if (!selectedBranchId) {
                if (userRoleType === 'superuser') return true;
                return selectableBranches.some(b => b.id_cabang === k.id_cabang);
            }
            return k.id_cabang === selectedBranchId;
        });

        return karyawanInScope.map(karyawan => {
            const payroll = processedPayrolls.find(p => p.id_karyawan === karyawan.id_karyawan && p.periode_tahun === selectedYear && p.periode_bulan === selectedMonth);
            return { karyawan, payroll };
        });
    }, [allKaryawan, processedPayrolls, selectedYear, selectedMonth, selectedBranchId, userRoleType, selectableBranches]);
    
    const { totalPendapatan, totalPotongan, gajiBersih } = useMemo(() => {
        if (!isDetailModalOpen || !selectedPayroll) return { totalPendapatan: 0, totalPotongan: 0, gajiBersih: 0 };
        
        const karyawan = karyawanMap[selectedPayroll.id_karyawan];
        const gajiPokokAmount = (karyawan?.gaji_pokok && karyawan.gaji_pokok > 0) ? karyawan.gaji_pokok : 0;

        const otherPendapatan = editablePayrollDetails.filter(d => d.type === 'pendapatan' && includedComponentIds.has(d.id_payroll_component)).reduce((sum, item) => sum + item.amount, 0);
        const totalPendapatan = gajiPokokAmount + otherPendapatan;

        const totalPotongan = editablePayrollDetails.filter(d => d.type === 'potongan' && includedComponentIds.has(d.id_payroll_component)).reduce((sum, item) => sum + item.amount, 0);
        return { totalPendapatan, totalPotongan, gajiBersih: totalPendapatan - totalPotongan };
    }, [isDetailModalOpen, selectedPayroll, editablePayrollDetails, includedComponentIds, karyawanMap]);

    const handleDetailQuantityChange = (componentId: string, hours: number) => {
        setEditablePayrollDetails(prevDetails => {
            return prevDetails.map(detail => {
                if (detail.id_payroll_component === componentId) {
                    const masterComp = allPayrollComponents.find(mc => mc.id_payroll_component === componentId);
                    const rate = masterComp?.amount || 0;
                    return { ...detail, quantity: hours, amount: hours * rate };
                }
                return detail;
            });
        });
    };

    const handleDetailInclusionChange = (componentId: string, isIncluded: boolean) => {
        setIncludedComponentIds(prev => { const newSet = new Set(prev); if (isIncluded) newSet.add(componentId); else newSet.delete(componentId); return newSet; });
        
        if (isIncluded) {
            const masterComp = allPayrollComponents.find(mc => mc.id_payroll_component === componentId);
            if (masterComp && masterComp.calculation_type === 'hourly' && selectedPayroll) {
                const totalHours = calculateTotalHours(selectedPayroll.id_karyawan, selectedPayroll.periode_tahun, selectedPayroll.periode_bulan, allAbsensiLogs);
                setEditablePayrollDetails(prevDetails => 
                    prevDetails.map(detail => {
                        if (detail.id_payroll_component === componentId) {
                            const rate = masterComp.amount || 0;
                            return { ...detail, quantity: totalHours, amount: totalHours * rate };
                        }
                        return detail;
                    })
                );
            }
        }
    };
    const handleDetailAmountChange = (componentId: string, newAmount: number) => {
        setEditablePayrollDetails(prevDetails => prevDetails.map(detail => detail.id_payroll_component === componentId ? { ...detail, amount: newAmount } : detail));
    };
    const handleOpenDetailModal = (payroll: Payroll) => {
        const payrollToView = deepClone(processedPayrolls.find(p => p.id_payroll === payroll.id_payroll) || payroll);
        const allPossibleDetails: PayrollDetail[] = allPayrollComponents.map(masterComp => {
            const existingDetail = payrollToView.details.find(d => d.id_payroll_component === masterComp.id_payroll_component);
            const detail: PayrollDetail = {
                id_payroll_component: masterComp.id_payroll_component,
                nama_component: masterComp.nama_component,
                type: masterComp.type,
                amount: existingDetail ? existingDetail.amount : (masterComp.calculation_type === 'fixed' ? masterComp.amount || 0 : 0),
                quantity: existingDetail ? existingDetail.quantity : null
            };

            if (masterComp.calculation_type === 'hourly') {
                const rate = masterComp.amount || 0;
                if (detail.quantity !== null && detail.quantity !== undefined) {
                    detail.amount = detail.quantity * rate;
                } else {
                    const totalAbsenceHours = calculateTotalHours(payrollToView.id_karyawan, payrollToView.periode_tahun, payrollToView.periode_bulan, allAbsensiLogs);
                    detail.quantity = totalAbsenceHours;
                    detail.amount = totalAbsenceHours * rate;
                }
            }
            return detail;
        });
        setIncludedComponentIds(new Set(payrollToView.details.map(d => d.id_payroll_component)));
        setEditablePayrollDetails(allPossibleDetails);
        setSelectedPayroll(payrollToView);
        setIsDetailModalOpen(true);
    };
    const handleCloseDetailModal = () => { setIsDetailModalOpen(false); setSelectedPayroll(null); setEditablePayrollDetails([]); setIncludedComponentIds(new Set()); };
    const handleSlipAction = (payroll: Payroll) => { const payrollToView = processedPayrolls.find(p => p.id_payroll === payroll.id_payroll) || payroll; setPayrollForSlip(payrollToView); setIsSlipModalOpen(true); };
    const handleCloseSlipModal = () => setIsSlipModalOpen(false);
    const handleSaveDetail = async () => {
        if (!selectedPayroll) return;
        const finalDetailsToSave = editablePayrollDetails.filter(d => includedComponentIds.has(d.id_payroll_component));
        
        // Re-insert Gaji Pokok from the master employee data, if it exists and has value
        const karyawan = karyawanMap[selectedPayroll.id_karyawan];
        if (karyawan?.gaji_pokok && karyawan.gaji_pokok > 0) {
            const gajiPokokAmount = karyawan.gaji_pokok;
            finalDetailsToSave.unshift({
                id_payroll_component: 'PC1', // Hardcoded ID
                nama_component: 'Gaji Pokok',
                type: 'pendapatan',
                amount: gajiPokokAmount,
                quantity: null,
            });
        }

        const updatedPayroll = { ...selectedPayroll, details: finalDetailsToSave };
        const totalPendapatan = updatedPayroll.details.filter(d => d.type === 'pendapatan').reduce((sum, item) => sum + item.amount, 0);
        const totalPotongan = updatedPayroll.details.filter(d => d.type === 'potongan').reduce((sum, item) => sum + item.amount, 0);
        updatedPayroll.total_pendapatan = totalPendapatan;
        updatedPayroll.total_potongan = totalPotongan;
        updatedPayroll.total_gaji_bersih = totalPendapatan - totalPotongan;
        await updatePayroll(updatedPayroll);
        fetchData();
        handleCloseDetailModal();
    };

    const handlePublishClick = (payroll: Payroll) => {
        if (!canUpdate(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk mempublikasikan gaji."); return; }
        setPayrollToPublish(payroll);
        setIsPublishConfirmOpen(true);
    };

    const handleMarkPaidClick = (payroll: Payroll) => {
        if (!canUpdate(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk menandai gaji sebagai lunas."); return; }
        setPayrollToMarkPaid(payroll);
        setIsPaidConfirmOpen(true);
    };
    
    const confirmPublish = async () => {
        if (!payrollToPublish || !currentUser) return;
        const payrollToUpdate = processedPayrolls.find(p => p.id_payroll === payrollToPublish.id_payroll);
        if (!payrollToUpdate) return;
        
        const updatedPayroll = { ...payrollToUpdate, status: 'published' as const };
        await updatePayroll(updatedPayroll);
        await fetchData();
    
        setIsPublishConfirmOpen(false);
        setPayrollToPublish(null);
    };

    const confirmMarkPaid = async () => {
        if (!payrollToMarkPaid || !currentUser) return;
        const payrollToUpdate = processedPayrolls.find(p => p.id_payroll === payrollToMarkPaid.id_payroll);
        if (!payrollToUpdate) return;
        
        const updatedPayroll = { ...payrollToUpdate, status: 'paid' as const, tanggal_pembayaran: new Date().toISOString() };
        await updatePayroll(updatedPayroll);
        await fetchData();
    
        setIsPaidConfirmOpen(false);
        setPayrollToMarkPaid(null);
    };
    
    const handleDeleteClick = (payroll: Payroll) => {
        if (payroll.status !== 'draft') { alert("Hanya gaji dengan status 'Draft' yang bisa dihapus."); return; }
        if (!canDelete(PAGE_PATH)) { alert("Anda tidak memiliki izin untuk menghapus data gaji."); return; }
        setPayrollToDelete(payroll); setIsDeleteConfirmOpen(true);
    };
    const confirmDelete = async () => { if (!payrollToDelete) return; await deletePayroll(payrollToDelete.id_payroll); fetchData(); setIsDeleteConfirmOpen(false); setPayrollToDelete(null); };
    const formatRupiah = (num: number) => `Rp ${new Intl.NumberFormat('id-ID').format(num)}`;

    const columns = useMemo<ColumnDef<PayrollRowData>[]>(() => [
        { header: 'Cabang', accessor: (row) => branchMap[row.karyawan.id_cabang] || row.karyawan.id_cabang, sortable: true },
        { header: 'Karyawan', accessor: (row) => row.karyawan.nama_lengkap, sortable: true },
        { header: 'Departemen', accessor: (row) => row.karyawan.departemen, sortable: true },
        { header: 'Jabatan', accessor: (row) => row.karyawan.posisi, sortable: true },
        { header: 'Gaji Bersih', accessor: (row) => row.payroll?.total_gaji_bersih, sortable: true, render: (row) => <div className="text-right font-semibold">{row.payroll ? formatRupiah(row.payroll.total_gaji_bersih) : '-'}</div> },
        { header: 'Status', accessor: (row) => row.payroll?.status, sortable: true, render: (row) => (
            row.payroll ? (<span className={`capitalize px-2.5 py-1 text-xs font-semibold rounded-full ${row.payroll.status === 'draft' ? 'bg-amber-100 text-amber-800' : row.payroll.status === 'published' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{row.payroll.status}</span>) : (<span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500">Belum Ada</span>)
        )},
    ], [branchMap]);

    const renderActions = useCallback((row: PayrollRowData) => {
        const { payroll } = row;
        if (!payroll) return null;
        
        return (
            <div className="space-x-1">
                {payroll.status === 'draft' && canUpdate(PAGE_PATH) && <button onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(payroll); }} className="p-1 text-sky-600 hover:text-sky-800" title="Edit Detail Gaji"><PencilSquareIcon className="w-5 h-5"/></button>}
                <button onClick={(e) => { e.stopPropagation(); handleSlipAction(payroll); }} className="p-1 text-slate-500 hover:text-slate-700" title="Lihat Slip Gaji"><EyeIcon className="w-5 h-5"/></button>
                {payroll.status === 'draft' && canUpdate(PAGE_PATH) && <button onClick={(e) => { e.stopPropagation(); handlePublishClick(payroll); }} className="p-1 text-blue-600 hover:text-blue-800" title="Publish Gaji"><LockClosedIcon className="w-5 h-5"/></button>}
                {payroll.status === 'published' && canUpdate(PAGE_PATH) && <button onClick={(e) => { e.stopPropagation(); handleMarkPaidClick(payroll); }} className="p-1 text-green-600 hover:text-green-800" title="Tandai Lunas"><CheckCircleIcon className="w-5 h-5"/></button>}
                {payroll.status === 'draft' && canDelete(PAGE_PATH) && <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(payroll); }} className="p-1 text-red-600 hover:text-red-800" title="Hapus Draft Gaji"><TrashIcon className="w-5 h-5"/></button>}
            </div>
        );
    }, [canUpdate, canDelete, handleOpenDetailModal, handleSlipAction, handlePublishClick, handleMarkPaidClick, handleDeleteClick]);

    const headerActions = useMemo(() => (
        <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="form-select text-sm py-2 pl-3 pr-8 border-slate-300 rounded-md shadow-sm">{months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}</select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="form-select text-sm py-2 pl-3 pr-8 border-slate-300 rounded-md shadow-sm">{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
    ), [selectedMonth, selectedYear, months, years]);


    if (isLoading || !isAccessDataLoaded) {
        return <div className="p-6 bg-white shadow-xl rounded-xl min-h-[calc(100vh-8rem)] flex justify-center items-center"><SpinnerIcon className="w-8 h-8 text-sky-500"/></div>;
    }
    
    return (
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 min-h-[calc(100vh-8rem)]">
            {(isGenerating) ? (
                <div className="text-center py-10 text-slate-500"><SpinnerIcon className="w-8 h-8 mx-auto animate-spin text-sky-500"/><p className="mt-2">Memproses data penggajian untuk periode ini...</p></div>
            ) : (
                <TabelFiturStandar
                    data={karyawanWithPayrollData}
                    columns={columns}
                    uniqueIdKey={(row) => row.karyawan.id_karyawan}
                    title="Penggajian"
                    renderActions={renderActions}
                    headerActions={headerActions}
                />
            )}
            
            {isDetailModalOpen && selectedPayroll && (() => {
                const karyawanForModal = karyawanMap[selectedPayroll.id_karyawan];
                const hasGajiPokok = karyawanForModal?.gaji_pokok && karyawanForModal.gaji_pokok > 0;
                
                return (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Pengaturan Gaji: {karyawanMap[selectedPayroll.id_karyawan]?.nama_lengkap}</h3><button onClick={handleCloseDetailModal}><XMarkIcon className="w-5 h-5"/></button></div>
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveDetail(); }} className="flex-grow overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    <div>
                                        <h4 className="text-lg font-semibold text-green-600 mb-3">Pendapatan</h4>
                                        <div className="space-y-3 pr-2">
                                            {hasGajiPokok && (
                                                <div className="flex justify-between items-center text-sm bg-slate-100 p-2 rounded-md">
                                                    <div className="flex items-center"><input type="checkbox" checked={true} disabled className="form-checkbox h-5 w-5 rounded mr-3" /><label className="font-medium">Gaji Pokok (dari Profil)</label></div>
                                                    <span className="font-mono">{new Intl.NumberFormat('id-ID').format(karyawanForModal.gaji_pokok || 0)}</span>
                                                </div>
                                            )}
                                            {editablePayrollDetails.filter(d => d.type === 'pendapatan').map(detail => {
                                                const masterComp = allPayrollComponents.find(mc => mc.id_payroll_component === detail.id_payroll_component)!;
                                                const isChecked = includedComponentIds.has(detail.id_payroll_component);
                                                return (<div key={detail.id_payroll_component}><div className="flex justify-between items-center text-sm"><div className="flex items-center"><input type="checkbox" checked={isChecked} onChange={e => handleDetailInclusionChange(detail.id_payroll_component, e.target.checked)} className="form-checkbox h-5 w-5 rounded mr-3 text-sky-600 focus:ring-sky-500" /><label>{detail.nama_component}</label></div>{isChecked && <div className="flex items-center space-x-2">{masterComp.calculation_type === 'hourly' && (<> <input type="number" step="0.1" value={detail.quantity ?? ''} onChange={e => handleDetailQuantityChange(detail.id_payroll_component, Number(e.target.value))} className="form-input w-20 text-right py-1 px-2 text-sm border-slate-300 rounded" /><span className="text-slate-500 text-xs">jam x</span><span className="text-xs text-slate-500">{new Intl.NumberFormat('id-ID').format(masterComp.amount || 0)}</span></>)}{masterComp.calculation_type === 'manual' && <input type="number" value={detail.amount} onChange={e => handleDetailAmountChange(detail.id_payroll_component, Number(e.target.value))} className="form-input w-28 text-right py-1 px-2 text-sm border-slate-300 rounded" />}{masterComp.calculation_type === 'fixed' && <span className="font-mono">{new Intl.NumberFormat('id-ID').format(detail.amount)}</span>}</div>}</div>{isChecked && masterComp.calculation_type === 'hourly' && <div className="text-right text-sm text-slate-700 font-mono pr-1">= <span className="font-semibold">{formatRupiah(detail.amount)}</span></div>}</div>);
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-semibold text-red-600 mb-3">Potongan</h4>
                                        <div className="space-y-3 pr-2">
                                            {editablePayrollDetails.filter(d => d.type === 'potongan').map(detail => {
                                                 const masterComp = allPayrollComponents.find(mc => mc.id_payroll_component === detail.id_payroll_component)!;
                                                const isChecked = includedComponentIds.has(detail.id_payroll_component);
                                                return (<div key={detail.id_payroll_component}><div className="flex justify-between items-center text-sm"><div className="flex items-center"><input type="checkbox" checked={isChecked} onChange={e => handleDetailInclusionChange(detail.id_payroll_component, e.target.checked)} className="form-checkbox h-5 w-5 rounded mr-3 text-sky-600 focus:ring-sky-500" /><label>{detail.nama_component}</label></div>{isChecked && <div className="flex items-center space-x-2">{masterComp.calculation_type === 'hourly' && (<> <input type="number" step="0.1" value={detail.quantity ?? ''} onChange={e => handleDetailQuantityChange(detail.id_payroll_component, Number(e.target.value))} className="form-input w-20 text-right py-1 px-2 text-sm border-slate-300 rounded" /><span className="text-slate-500 text-xs">jam x</span><span className="text-xs text-slate-500">{new Intl.NumberFormat('id-ID').format(masterComp.amount || 0)}</span></>)}{masterComp.calculation_type === 'manual' && <input type="number" value={detail.amount} onChange={e => handleDetailAmountChange(detail.id_payroll_component, Number(e.target.value))} className="form-input w-28 text-right py-1 px-2 text-sm border-slate-300 rounded" />}{masterComp.calculation_type === 'fixed' && <span className="font-mono">{new Intl.NumberFormat('id-ID').format(detail.amount)}</span>}</div>}</div>{isChecked && masterComp.calculation_type === 'hourly' && <div className="text-right text-sm text-slate-700 font-mono pr-1">= <span className="font-semibold">{formatRupiah(detail.amount)}</span></div>}</div>);
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                                    <div className="flex justify-between items-center text-md"><span className="text-slate-600">Total Pendapatan</span><span className="font-semibold text-green-600">{formatRupiah(totalPendapatan)}</span></div>
                                    <div className="flex justify-between items-center text-md"><span className="text-slate-600">Total Potongan</span><span className="font-semibold text-red-600">{formatRupiah(totalPotongan)}</span></div>
                                    <div className="flex justify-between items-center text-xl pt-2 border-t mt-2"><span className="font-bold text-sky-600">Gaji Bersih (Take-Home Pay)</span><span className="font-bold text-sky-600">{formatRupiah(gajiBersih)}</span></div>
                                </div>
                                <div className="pt-4 mt-auto flex justify-end"><button type="submit" className="bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-sky-700">Simpan Perubahan</button></div>
                            </form>
                        </div>
                    </div>
                );
            })()}
             {isSlipModalOpen && payrollForSlip && (<PayslipModal payroll={payrollForSlip} onClose={handleCloseSlipModal} branchMap={branchMap} karyawanMap={karyawanMap} grupMap={grupMap}/>)}
             {isDeleteConfirmOpen && (<div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-lg font-semibold mb-4">Konfirmasi Hapus</h3><p className="mb-6 text-sm">Yakin ingin menghapus draf gaji untuk "{karyawanMap[payrollToDelete!.id_karyawan]?.nama_lengkap}"?</p><div className="flex justify-end space-x-2"><button onClick={() => setIsDeleteConfirmOpen(false)} className="px-3 py-2 border rounded-md text-xs">Batal</button><button onClick={confirmDelete} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs">Ya, Hapus</button></div></div></div>)}
             {isPublishConfirmOpen && payrollToPublish && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4 flex items-center"><InformationCircleIcon className="w-6 h-6 mr-2 text-blue-500"/>Konfirmasi Publikasi</h3>
                        <p className="mb-6 text-sm">Anda yakin ingin mempublikasikan gaji untuk "{karyawanMap[payrollToPublish!.id_karyawan]?.nama_lengkap}"? Setelah dipublish, data tidak bisa diedit.</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setIsPublishConfirmOpen(false)} className="px-3 py-2 border rounded-md text-xs">Batal</button>
                            <button onClick={confirmPublish} className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs">Ya, Publikasikan</button>
                        </div>
                    </div>
                </div>
            )}
            {isPaidConfirmOpen && payrollToMarkPaid && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4 flex items-center"><DocumentCheckIcon className="w-6 h-6 mr-2 text-green-500"/>Konfirmasi Pembayaran</h3>
                        <p className="mb-6 text-sm">Anda yakin ingin menandai gaji untuk "{karyawanMap[payrollToMarkPaid!.id_karyawan]?.nama_lengkap}" sebagai LUNAS?</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setIsPaidConfirmOpen(false)} className="px-3 py-2 border rounded-md text-xs">Batal</button>
                            <button onClick={confirmMarkPaid} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs">Ya, Tandai Lunas</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PenggajianPage;