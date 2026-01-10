import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft, User, Key, Printer, FileOutput, Upload, Paperclip, File as FileIcon, Image as ImageIcon, Palette, Download, Eye } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, inMemoryPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 1. Firebase 配置 ---
const MANUAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBMSujR0hN0sVniMpeyYHVgdN0bJOKNAmg",
  authDomain: "hk-car-dealer-tool.firebaseapp.com",
  projectId: "hk-car-dealer-tool",
  storageBucket: "hk-car-dealer-tool.firebasestorage.app",
  messagingSenderId: "53318644210",
  appId: "1:53318644210:web:43a35553f825247c7cbb6b",
  measurementId: "G-92FJL41BGT"
};

const APP_ID_PATH = 'hk-car-dealer-app';

// --- Constants & Defaults ---
const DEFAULT_RATES = { JP: 0.053, UK: 10.2, OT: 7.8 };
const DEFAULT_CONFIG = { maxFiles: 5, maxFileSizeKB: 2000, logo: null }; 

const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  OT: { id: 'OT', name: '其他國家 (Others)', currency: 'USD', symbol: '$' },
};

const DEFAULT_FEES = {
  JP: {
    origin: { 
        auctionFee: { label: '拍賣場/FOB費用', val: '20000' }, 
        shipping: { label: '船運費', val: '100000' } 
    },
    hk_misc: { 
        terminal: { label: '碼頭費', val: '500' },
        emission: { label: '檢驗廢氣', val: '5500' },
        glass: { label: '更換玻璃', val: '2000' },
        booking: { label: '排期驗車', val: '1000' },
        fuel: { label: '入油', val: '500' },
        process: { label: '工序費', val: '2000' },
        misc: { label: '雜項支出', val: '1000' }
    },
    hk_license: {
        licenseFee: { label: '政府牌費', val: '5794' },
        insurance: { label: '保險', val: '2000' }
    }
  },
  UK: {
    origin: { 
        shipping: { label: '船運費', val: '1500' },
        inspection: { label: '當地驗車', val: '300' },
        other: { label: '其他費用', val: '200' }
    },
    hk_misc: { 
        terminal: { label: '碼頭費', val: '500' },
        emission: { label: '檢驗廢氣', val: '6500' },
        glass: { label: '更換玻璃', val: '2500' },
        booking: { label: '排期驗車', val: '1000' },
        fuel: { label: '入油', val: '500' },
        process: { label: '工序費', val: '2500' },
        misc: { label: '雜項支出', val: '1000' }
    },
    hk_license: {
        licenseFee: { label: '政府牌費', val: '5794' },
        insurance: { label: '保險', val: '2500' }
    }
  },
  OT: {
    origin: { 
        shipping: { label: '船運費', val: '2000' },
        inspection: { label: '當地驗車', val: '500' },
        other: { label: '其他費用', val: '500' }
    },
    hk_misc: { 
        terminal: { label: '碼頭費', val: '500' },
        emission: { label: '檢驗廢氣', val: '6500' },
        glass: { label: '更換玻璃', val: '2500' },
        booking: { label: '排期驗車', val: '1000' },
        fuel: { label: '入油', val: '500' },
        process: { label: '工序費', val: '2500' },
        misc: { label: '雜項支出', val: '1000' }
    },
    hk_license: {
        licenseFee: { label: '政府牌費', val: '5794' },
        insurance: { label: '保險', val: '2500' }
    }
  }
};

const DEFAULT_INVENTORY = {
  Toyota: { models: [{ id: 'Alphard', years: ['2023', '2022'], codes: ['AH30', 'AH40'] }, { id: 'Noah', years: ['2023', '2021'], codes: ['ZWR90', 'ZRR80'] }] },
  Honda: { models: [{ id: 'Stepwgn', years: ['2024', '2022'], codes: ['RP6', 'RK5'] }] },
  BMW: { models: [] },
};

const calculateFRT = (prp) => {
    let v = parseFloat(prp) || 0;
    let t = 0;
    if (v > 0) { let taxable = Math.min(v, 150000); t += taxable * 0.46; v -= taxable; }
    if (v > 0) { let taxable = Math.min(v, 150000); t += taxable * 0.86; v -= taxable; }
    if (v > 0) { let taxable = Math.min(v, 200000); t += taxable * 1.15; v -= taxable; }
    if (v > 0) { t += v * 1.32; }
    return t;
};

const getLicenseFeeByCC = (cc) => {
    const val = parseFloat(cc);
    if (!val) return 0;
    if (val <= 1500) return 5074;
    if (val <= 2500) return 7498;
    if (val <= 3500) return 9929;
    if (val <= 4500) return 12360;
    return 14694; 
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// --- UI Components ---
const Card = ({ children, className = "" }) => <div className={`bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden ${className}`}>{children}</div>;
const SectionHeader = ({ icon: Icon, title, color="text-slate-900" }) => <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-slate-200"><Icon className={`w-6 h-6 ${color}`} /><h3 className="font-extrabold text-slate-800 text-lg tracking-tight">{title}</h3></div>;

const InputGroup = ({ label, value, onChange, prefix, placeholder = "", required = false, type = 'number', step = 'any', min }) => {
  const displayValue = useMemo(() => {
    if (value === '' || value === null || value === undefined) return '';
    if (type === 'number') {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    return value;
  }, [value, type]);

  const handleChange = (e) => {
    let rawValue = e.target.value;
    if (type === 'number') {
        rawValue = rawValue.replace(/,/g, '');
        if (rawValue === '' || rawValue === '-') {
            onChange(rawValue);
            return;
        }
        if (!isNaN(rawValue)) {
            onChange(rawValue);
        }
    } else {
        onChange(rawValue);
    }
  };

  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-bold text-slate-800 mb-1.5">{label}{required && <span className="text-red-600 ml-1">*</span>}</label>}
      <div className="relative rounded-md shadow-sm">
        {prefix && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-600 font-bold sm:text-sm">{prefix}</span></div>}
        <input 
          type={type === 'number' ? 'text' : type} 
          inputMode={type === 'number' ? 'decimal' : 'text'}
          className={`block w-full rounded-lg py-2.5 ${prefix ? 'pl-8' : 'pl-3'} pr-3 text-black placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm border-2 border-slate-300 font-bold shadow-sm transition-colors`} 
          placeholder={placeholder} 
          value={displayValue} 
          onChange={handleChange} 
        />
      </div>
    </div>
  );
};

const AutocompleteInput = ({ label, value, onChange, options = [], disabled = false, placeholder = "" }) => {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => (Array.isArray(options) ? options : []).filter(o => o.toLowerCase().includes((value||'').toLowerCase())), [value, options]);
  return (
    <div className="mb-4 relative">
      <label className="block text-sm font-bold text-slate-800 mb-1.5">{label}</label>
      <div className="relative">
        <input type="text" className={`block w-full rounded-lg py-2.5 pl-3 pr-10 text-black border-2 border-slate-300 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm shadow-sm transition-colors ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`} placeholder={placeholder} value={value} onChange={e => {onChange(e.target.value); setOpen(true);}} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} disabled={disabled} />
        {!value && <ChevronDown className="w-5 h-5 absolute right-3 top-3 text-slate-500 pointer-events-none" />}
        {value && <X className="w-5 h-5 absolute right-3 top-3 text-slate-500 cursor-pointer hover:text-red-600 transition-colors" onClick={() => onChange('')} />}
      </div>
      {open && filtered.length > 0 && !disabled && (
        <ul className="absolute z-30 w-full mt-1 max-h-60 overflow-y-auto bg-white border-2 border-slate-200 rounded-lg shadow-xl ring-1 ring-black/5">
          {filtered.map((opt, i) => <li key={i} className="px-4 py-2.5 text-sm text-slate-900 hover:bg-blue-50 cursor-pointer font-bold" onMouseDown={() => onChange(opt)}>{opt}</li>)}
        </ul>
      )}
    </div>
  );
};

const ConfirmationModal = ({ config, onClose }) => {
    if (!config) return null;
    const { title, message, onConfirm, type } = config;
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full animate-in fade-in zoom-in-95 shadow-2xl border-0 ring-1 ring-white/20">
          <div className={`p-5 border-b ${type === 'danger' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}><h3 className="font-bold flex gap-2 items-center text-lg"><AlertTriangle className="w-6 h-6" />{title}</h3></div>
          <div className="p-6 text-base text-slate-700 font-medium leading-relaxed">{message}</div>
          <div className="flex justify-end gap-3 p-5 border-t bg-gray-50">
            <button onClick={onClose} className="px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all">取消</button>
            <button onClick={onConfirm} className={`px-5 py-2.5 text-white rounded-xl shadow-lg font-bold transition-all transform active:scale-95 ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>確認</button>
          </div>
        </Card>
      </div>
    );
};

const ImagePreviewModal = ({ file, onClose }) => {
    if (!file) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition"><X className="w-10 h-10" /></button>
            <div className="relative w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                <img src={file.data} alt={file.name} className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl" />
                <div className="mt-6 flex gap-4">
                    <a href={file.data} download={file.name} className="flex items-center gap-2 bg-white text-slate-900 px-8 py-3 rounded-full font-bold shadow-2xl hover:bg-slate-100 transition transform hover:scale-105" onClick={(e) => e.stopPropagation()}>
                        <Download className="w-5 h-5" /> 下載原圖
                    </a>
                </div>
                <div className="mt-4 text-white/60 text-sm font-mono">{file.name}</div>
            </div>
        </div>
    );
};

// --- REPORT COMPONENT ---
const PrintableReport = ({ data, onClose, logo }) => {
    const { details, vals, fees, results, country, date, attachments } = data;
    const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

    const handlePrint = () => window.print();

    const hkMiscFees = fees.hk_misc || {};
    const hkLicenseFees = fees.hk_license || {};
    const safeHkMiscTotal = results.hkMiscTotal !== undefined ? results.hkMiscTotal : Object.values(hkMiscFees).reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0);
    const safeHkLicenseTotal = results.hkLicenseTotal !== undefined ? results.hkLicenseTotal : (Object.values(hkLicenseFees).reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0) + (results.frt || 0));

    return (
        <div className="fixed inset-0 z-[100] bg-slate-800/90 backdrop-blur-sm flex justify-center overflow-auto print:p-0 print:bg-white print:static print:block">
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    html, body { height: 100%; margin: 0 !important; padding: 0 !important; overflow: visible; }
                    body { visibility: hidden; background: white; }
                    #printable-report-container { visibility: visible; position: absolute; left: 0; top: 0; width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: white; z-index: 9999; }
                    #printable-report-container * { visibility: visible; }
                    #printable-report { padding: 15mm 20mm; box-shadow: none; border: none; }
                    .no-print { display: none !important; }
                    .page-break-inside-avoid { page-break-inside: avoid; }
                    /* Ensure colors print correctly */
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>

            <div id="printable-report-container" className="relative w-full max-w-[210mm] min-h-[297mm] my-8 bg-white shadow-2xl print:shadow-none print:my-0 print:w-full transform transition-transform">
                <div id="printable-report" className="p-12 text-slate-900 h-full flex flex-col font-sans">
                    <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-8">
                        <div><h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">車輛成本估價單</h1><p className="text-md text-slate-600 font-bold">日期: {date}</p></div>
                        <div className="text-right">
                             {logo ? (
                                <img src={logo} alt="Company Logo" className="h-16 object-contain mb-2 ml-auto" />
                            ) : (
                                <h2 className="text-2xl font-black text-blue-900 flex items-center justify-end gap-2"><Truck className='w-8 h-8'/> HK Car Dealer</h2>
                            )}
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Internal Use Only</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider mb-4 border-l-8 border-blue-600 pl-3">車輛資料</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm bg-slate-50 p-6 rounded-xl border-2 border-slate-200">
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">品牌</span> <span className="font-bold text-lg text-slate-900">{details.manufacturer}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">型號</span> <span className="font-bold text-lg text-slate-900">{details.model}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">年份</span> <span className="font-bold text-lg text-slate-900">{details.year}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">代號</span> <span className="font-bold text-lg text-slate-900">{details.code}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">排氣量</span> <span className="font-bold text-slate-900">{details.engineCapacity ? `${details.engineCapacity} cc` : '-'}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">座位數</span> <span className="font-bold text-slate-900">{details.seats || '-'}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">外觀顏色</span> <span className="font-bold text-slate-900">{details.exteriorColor || '-'}</span></div>
                            <div><span className="text-slate-500 block text-xs font-bold uppercase mb-1">內飾顏色</span> <span className="font-bold text-slate-900">{details.interiorColor || '-'}</span></div>
                            <div className="col-span-2 border-t-2 border-slate-200 pt-3 mt-1 flex items-center gap-2"><span className="text-slate-500 text-xs font-bold uppercase">車身號碼:</span> <span className="font-mono font-bold text-base text-slate-900">{details.chassisNo || '-'}</span></div>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider mb-4 border-l-8 border-blue-600 pl-3">核心成本</h3>
                        <table className="w-full text-sm border-2 border-slate-200 rounded-lg overflow-hidden">
                            <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                    <th className="text-left py-3 px-4 font-bold border-b-2 border-slate-300">項目</th>
                                    <th className="text-right py-3 px-4 font-bold border-b-2 border-slate-300">金額 ({COUNTRIES[country].currency})</th>
                                    <th className="text-right py-3 px-4 font-bold border-b-2 border-slate-300">匯率</th>
                                    <th className="text-right py-3 px-4 font-bold border-b-2 border-slate-300 bg-blue-50/50">港幣 (HKD)</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-200'>
                                <tr>
                                    <td className="py-3 px-4 font-bold text-slate-800">當地車價</td>
                                    <td className="text-right px-4 font-mono font-medium">{vals.carPrice}</td>
                                    <td className="text-right px-4 font-mono font-medium">{vals.rate}</td>
                                    <td className="text-right px-4 font-bold text-slate-900 bg-blue-50/30">{fmt(results.carPriceHKD)}</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-bold text-slate-800">當地雜費 <span className='text-xs font-normal text-slate-500 ml-1'>({Object.values(fees.origin).map(f => f.label).join('/')})</span></td>
                                    <td className="text-right px-4 text-slate-400">-</td>
                                    <td className="text-right px-4 text-slate-400">-</td>
                                    <td className="text-right px-4 font-bold text-slate-900 bg-blue-50/30">{fmt(results.originTotalHKD)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-10 mb-8">
                        <div>
                            <h4 className="font-bold text-slate-800 border-b-2 border-slate-300 pb-2 mb-3 text-sm uppercase tracking-wide">香港雜費</h4>
                            <ul className="text-sm space-y-2">
                                {Object.entries(hkMiscFees).map(([k, v]) => (
                                    <li key={k} className="flex justify-between items-center"><span className="text-slate-600 font-bold">{v.label}</span><span className="font-mono font-medium text-slate-800">${v.val}</span></li>
                                ))}
                                <li className="flex justify-between items-center font-black border-t-2 border-slate-800 pt-2 mt-3 text-base bg-slate-50 p-2 rounded"><span>小計</span><span>{fmt(safeHkMiscTotal)}</span></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 border-b-2 border-slate-300 pb-2 mb-3 text-sm uppercase tracking-wide">出牌費用</h4>
                            <ul className="text-sm space-y-2">
                                {Object.entries(hkLicenseFees).map(([k, v]) => (
                                    <li key={k} className="flex justify-between items-center"><span className="text-slate-600 font-bold">{v.label}</span><span className="font-mono font-medium text-slate-800">${v.val}</span></li>
                                ))}
                                <li className="flex justify-between items-center bg-orange-50 -mx-2 px-2 py-1 rounded border border-orange-100"><span className="text-orange-900 font-bold">首次登記稅 (A1)</span><span className="font-mono font-black text-orange-700">{fmt(results.frt)}</span></li>
                                <li className="text-xs text-slate-400 text-right -mt-1 mb-1">(PRP: ${vals.prp})</li>
                                <li className="flex justify-between items-center font-black border-t-2 border-slate-800 pt-2 mt-2 text-base bg-slate-50 p-2 rounded"><span>小計 (含稅)</span><span>{fmt(safeHkLicenseTotal)}</span></li>
                            </ul>
                        </div>
                    </div>

                    {attachments && attachments.length > 0 && (
                        <div className="mb-6 page-break-inside-avoid">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">附件文件</h3>
                            <div className="grid grid-cols-4 gap-3">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="border-2 border-slate-200 rounded-lg p-2 flex flex-col items-center gap-2 bg-slate-50">
                                        {file.type.startsWith('image/') ? (
                                            <div className="w-full h-24 bg-white rounded overflow-hidden flex items-center justify-center border border-slate-200">
                                                <img src={file.data} className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-full h-24 flex items-center justify-center bg-white rounded border border-slate-200 text-slate-400"><FileText className="w-10 h-10" /></div>
                                        )}
                                        <span className="truncate w-full text-[10px] text-center font-bold text-slate-700" title={file.name}>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-auto">
                         <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-8 space-y-6 break-inside-avoid shadow-sm">
                            <div className="flex justify-between items-center border-b-2 border-slate-200 pb-4">
                                <div>
                                    <span className="text-slate-700 font-extrabold block text-xl">車輛到港成本</span>
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Landed Cost (含A1稅，不含牌費保險)</span>
                                </div>
                                <span className="text-3xl font-black text-slate-800 tracking-tight">{fmt(results.landedCost)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <div>
                                    <span className="text-blue-900 font-extrabold block text-2xl">預計總成本</span>
                                    <span className="text-xs text-blue-600 font-bold uppercase tracking-wide">Total Cost (All Inclusive)</span>
                                </div>
                                <span className="text-5xl font-black text-blue-700 tracking-tighter">{fmt(results.totalCost)}</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t-2 border-slate-200 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                             <p>© {new Date().getFullYear()} HK Car Dealer Tool | Confidential Document</p>
                        </div>
                    </div>
                </div>

                <div className="absolute top-4 right-4 flex gap-2 no-print">
                     <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl hover:bg-blue-700 flex items-center gap-2 font-bold transition transform hover:scale-105 active:scale-95"><Printer className="w-5 h-5" /> 列印 / PDF</button>
                     <button onClick={onClose} className="bg-white text-slate-700 border-2 border-slate-300 px-6 py-3 rounded-full shadow-xl hover:bg-slate-50 flex items-center gap-2 font-bold transition transform hover:scale-105 active:scale-95"><X className="w-5 h-5" /> 關閉</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---
export default function App() {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); 
  
  const [dataKey, setDataKey] = useState(() => { try { return localStorage.getItem('hk_car_dealer_key') || 'demo-shop'; } catch(e) { return 'demo-shop'; } });
  const [isKeyEditing, setIsKeyEditing] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const [activeTab, setActiveTab] = useState('calculator');
  const [country, setCountry] = useState('JP');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [fees, setFees] = useState(DEFAULT_FEES);
  const [appConfig, setAppConfig] = useState(DEFAULT_CONFIG); 
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [history, setHistory] = useState([]);
  const [reportData, setReportData] = useState(null);

  const [carPrice, setCarPrice] = useState('');
  const [prp, setPrp] = useState('');
  
  const [currOriginFees, setCurrOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currHkMiscFees, setCurrHkMiscFees] = useState(DEFAULT_FEES['JP'].hk_misc);
  const [currHkLicenseFees, setCurrHkLicenseFees] = useState(DEFAULT_FEES['JP'].hk_license);
  
  const [details, setDetails] = useState({ manufacturer: '', model: '', year: '', code: '', chassisNo: '', seats: '', engineCapacity: '', exteriorColor: '', interiorColor: '' });
  const [attachments, setAttachments] = useState([]);

  const [newManufacturer, setNewManufacturer] = useState('');
  const [editingMfr, setEditingMfr] = useState(null);
  const [newModel, setNewModel] = useState({ id: '', years: '', codes: '' });

  const showMsg = (msg, type = 'success') => {
      setSaveMsg({ msg, type });
      setTimeout(() => setSaveMsg(null), 3000);
  };

  useEffect(() => {
      const init = async () => {
          try {
              const app = initializeApp(MANUAL_FIREBASE_CONFIG);
              const auth = getAuth(app);
              const firestore = getFirestore(app);
              await setPersistence(auth, inMemoryPersistence);
              await signInAnonymously(auth);
              onAuthStateChanged(auth, (user) => { if (user) { setUserId(user.uid); setDb(firestore); } setIsReady(true); });
          } catch (e) { console.error(e); setIsReady(true); }
      };
      init();
  }, []);

  const getSettingsRef = useCallback(() => db && dataKey ? doc(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/settings/config`) : null, [db, dataKey]);
  const getHistoryRef = useCallback(() => db && dataKey ? collection(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/history`) : null, [db, dataKey]);

  useEffect(() => {
      const ref = getSettingsRef();
      if (!ref) return;
      const unsub = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const d = snap.data();
              if(d.rates) setRates(d.rates);
              if(d.fees) setFees(d.fees);
              if(d.inventory) setInventory(d.inventory);
              if(d.appConfig) setAppConfig(d.appConfig);
          } else {
              setDoc(ref, { rates: DEFAULT_RATES, fees: DEFAULT_FEES, inventory: DEFAULT_INVENTORY, appConfig: DEFAULT_CONFIG }, { merge: true });
          }
      });
      return () => unsub();
  }, [db, dataKey, getSettingsRef]);

  useEffect(() => {
      const ref = getHistoryRef();
      if (!ref) return;
      const q = query(ref); 
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
          setHistory(list);
      });
      return () => unsub();
  }, [db, dataKey, getHistoryRef]);

  useEffect(() => {
      if (fees[country]) {
          setCurrOriginFees(fees[country].origin);
          setCurrHkMiscFees(fees[country].hk_misc);
          setCurrHkLicenseFees(fees[country].hk_license);
          setCarPrice('');
          setPrp('');
          setAttachments([]);
      }
  }, [country, fees]);
  
  useEffect(() => {
      if (details.engineCapacity) {
          const fee = getLicenseFeeByCC(details.engineCapacity);
          setCurrHkLicenseFees(prev => ({
              ...prev,
              licenseFee: { ...prev.licenseFee, val: fee.toString() }
          }));
      }
  }, [details.engineCapacity]);

  const handleKeyChange = () => {
      if (tempKey.trim()) {
          const newKey = tempKey.trim();
          setDataKey(newKey);
          try { localStorage.setItem('hk_car_dealer_key', newKey); } catch (e) {}
          setIsKeyEditing(false);
          showMsg(`已切換至: ${newKey}`);
      }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const currentCount = attachments.length;
    const maxFiles = appConfig.maxFiles || 5;
    const maxSizeKB = appConfig.maxFileSizeKB || 500;
    if (currentCount + files.length > maxFiles) return showMsg(`最多只能上傳 ${maxFiles} 個文件`, 'error');
    const newAttachments = [];
    for (const file of files) {
        if (file.size > maxSizeKB * 1024) { showMsg(`${file.name} 超過 ${maxSizeKB}KB 限制`, 'error'); continue; }
        try {
            const base64 = await fileToBase64(file);
            newAttachments.push({ name: file.name, type: file.type, size: file.size, data: base64 });
        } catch (error) { console.error("File reading error", error); }
    }
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = null; 
  };

  const removeAttachment = (index) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const rate = rates[country] || 0;
  const carPriceHKD = (parseFloat(carPrice) || 0) * rate;
  const frt = calculateFRT(prp); 
  let originTotal = 0;
  Object.values(currOriginFees || {}).forEach(v => originTotal += (parseFloat(v.val) || 0));
  const originTotalHKD = originTotal * rate;
  let hkMiscTotal = 0;
  Object.values(currHkMiscFees || {}).forEach(v => hkMiscTotal += (parseFloat(v.val) || 0));
  let hkLicenseTotal = 0; 
  Object.values(currHkLicenseFees || {}).forEach(v => hkLicenseTotal += (parseFloat(v.val) || 0));
  const totalLicenseCost = hkLicenseTotal + frt;
  const landedCost = carPriceHKD + originTotalHKD + hkMiscTotal + frt;
  const totalCost = landedCost + hkLicenseTotal;
  const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

  const saveConfig = async (overrides = {}) => {
      if (!db) return;
      const dataToSave = { rates, fees, inventory, appConfig, ...overrides };
      try { await setDoc(getSettingsRef(), dataToSave, { merge: false }); showMsg("設定已儲存"); } catch(e) { showMsg("儲存失敗", "error"); }
  };

  const saveHistoryRecord = async () => {
      if (!db) return showMsg("未連接資料庫", "error");
      if (totalCost <= 0) return showMsg("金額無效", "error");
      const record = {
          ts: Date.now(),
          date: new Date().toLocaleString('zh-HK'),
          timestamp: serverTimestamp(),
          country, details,
          vals: { carPrice, prp, rate },
          fees: { origin: currOriginFees, hk_misc: currHkMiscFees, hk_license: currHkLicenseFees },
          results: { carPriceHKD, originTotalHKD, hkMiscTotal, hkLicenseTotal: totalLicenseCost, frt, landedCost, totalCost },
          attachments: attachments, 
          isLocked: false
      };
      try { await addDoc(getHistoryRef(), record); showMsg("已記錄"); setTimeout(() => setActiveTab('history'), 500); } catch(e) { showMsg("儲存失敗: " + e.message, "error"); }
  };

  const generateCurrentReport = () => {
      if(totalCost <= 0) return showMsg("無效的計算數據", "error");
      const currentData = {
          details,
          vals: { carPrice, prp, rate },
          fees: { origin: currOriginFees, hk_misc: currHkMiscFees, hk_license: currHkLicenseFees },
          results: { carPriceHKD, originTotalHKD, hkMiscTotal, hkLicenseTotal: totalLicenseCost, frt, landedCost, totalCost },
          country,
          date: new Date().toLocaleString('zh-HK'),
          attachments
      };
      setReportData(currentData);
  };

  const toggleLock = async (item) => { if (!db) return; try { await updateDoc(doc(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/history`, item.id), { isLocked: !item.isLocked }); } catch(e) {} };
  const deleteHistoryItem = (item) => {
      if (item.isLocked) return showMsg("記錄已鎖定", "error");
      setModal({ title: "刪除記錄", message: "確定要刪除此記錄嗎？", type: "danger", onConfirm: async () => { try { await deleteDoc(doc(getHistoryRef(), item.id)); setModal(null); showMsg("已刪除"); } catch(e) { showMsg("刪除失敗", "error"); } } });
  };
  const loadHistoryItem = (item) => {
      setCountry(item.country); setCarPrice(item.vals.carPrice); setPrp(item.vals.prp); setDetails(item.details);
      setCurrOriginFees(item.fees.origin); setCurrHkMiscFees(item.fees.hk_misc); setCurrHkLicenseFees(item.fees.hk_license);
      setAttachments(item.attachments || []); 
      setActiveTab('calculator'); showMsg("記錄已載入");
  };
  const generateReport = (item) => { setReportData(item); };

  const addMfr = () => { if (!newManufacturer) return; const name = newManufacturer.trim(); if (inventory[name]) return showMsg("已存在", "error"); const newInventory = { ...inventory, [name]: { models: [] } }; setInventory(newInventory); setNewManufacturer(''); saveConfig({ inventory: newInventory }); };
  const deleteMfr = (mfr) => { setModal({ title: "刪除品牌", message: `確定刪除 ${mfr}？`, type: "danger", onConfirm: () => { const newInventory = {...inventory}; delete newInventory[mfr]; setInventory(newInventory); setEditingMfr(null); setModal(null); saveConfig({ inventory: newInventory }); } }); };
  const addModel = (mfr) => { if(!newModel.id) return; const newCar = { id: newModel.id.trim(), years: newModel.years.split(',').filter(Boolean), codes: newModel.codes.split(',').filter(Boolean) }; const newInventory = { ...inventory, [mfr]: { ...inventory[mfr], models: [...(inventory[mfr].models || []), newCar] } }; setInventory(newInventory); setNewModel({ id: '', years: '', codes: '' }); saveConfig({ inventory: newInventory }); };
  const deleteModel = (mfr, modelId) => { const newInventory = { ...inventory, [mfr]: { ...inventory[mfr], models: (inventory[mfr].models || []).filter(m => m.id !== modelId) } }; setInventory(newInventory); saveConfig({ inventory: newInventory }); };
  
  const handleRateChange = (cid, val) => setRates(p => ({...p, [cid]: val}));
  const handleFeeChange = (cid, category, key, val) => { setFees(prev => ({ ...prev, [cid]: { ...prev[cid], [category]: { ...prev[cid][category], [key]: { ...prev[cid][category][key], val } } } })); };

  // --- LOGO Handling ---
  const handleLogoUpload = async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      if(file.size > 500 * 1024) return showMsg("Logo 檔案過大 (Max 500KB)", "error");
      try {
          const base64 = await fileToBase64(file);
          setAppConfig(prev => ({ ...prev, logo: base64 }));
          saveConfig({ appConfig: { ...appConfig, logo: base64 } });
          showMsg("Logo 已更新");
      } catch(e) { console.error(e); }
  };
  const removeLogo = () => {
      setAppConfig(prev => ({ ...prev, logo: null }));
      saveConfig({ appConfig: { ...appConfig, logo: null } });
      showMsg("Logo 已移除");
  };

  if (!isReady) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 font-sans">
      <ConfirmationModal config={modal} onClose={() => setModal(null)} />
      {previewImage && <ImagePreviewModal file={previewImage} onClose={() => setPreviewImage(null)} />}
      {reportData && <PrintableReport data={reportData} onClose={() => setReportData(null)} logo={appConfig.logo} />}

      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-xl print:hidden border-b-4 border-blue-600">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 font-black text-2xl tracking-tight text-white">
                      {appConfig.logo ? <img src={appConfig.logo} className="h-10 w-auto rounded bg-white p-1"/> : <Truck className="w-8 h-8 text-blue-400"/>}
                      HK 汽車行家助手
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-slate-800 p-2 rounded-xl border border-slate-600 shadow-inner">
                      <Key className="w-3 h-3 text-yellow-400 ml-1" />
                      {isKeyEditing ? (
                          <div className="flex items-center gap-1">
                              <input autoFocus className="bg-slate-700 text-white px-2 py-1 rounded outline-none w-28 border border-slate-500 font-mono" defaultValue={dataKey} onChange={(e) => setTempKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleKeyChange()} />
                              <button onClick={handleKeyChange} className="px-2 text-green-400 hover:bg-slate-700 rounded">✓</button>
                              <button onClick={() => setIsKeyEditing(false)} className="px-1 text-red-400 hover:bg-slate-700 rounded">✕</button>
                          </div>
                      ) : (
                          <div className="flex items-center gap-2 px-2 py-0.5 cursor-pointer hover:bg-slate-700 rounded transition group" onClick={() => { setTempKey(dataKey); setIsKeyEditing(true); }}>
                              <span className="font-mono text-blue-300 font-bold tracking-wide group-hover:text-white transition">{dataKey}</span><span className="text-slate-400">(切換)</span>
                          </div>
                      )}
                  </div>
              </div>
              <div className="flex bg-slate-800/80 backdrop-blur rounded-xl p-1.5 self-start shadow-inner">
                  {[{id:'calculator', icon: Calculator, label:'計算'}, {id:'history', icon: List, label:`記錄 (${history.length})`}, {id:'settings', icon: Settings, label:'設定'}].map(t => (
                      <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab===t.id ? 'bg-blue-600 text-white shadow-lg transform scale-105 ring-2 ring-blue-400/50' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}><t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span></button>
                  ))}
              </div>
          </div>
      </div>

      {saveMsg && <div className={`fixed top-28 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-white font-bold text-sm animate-in slide-in-from-top-4 fade-in duration-300 ${saveMsg.type === 'error' ? 'bg-red-600' : 'bg-green-600'} print:hidden border-2 border-white/20`}>{saveMsg.type === 'error' ? <AlertTriangle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}{saveMsg.msg}</div>}

      <div className="max-w-7xl mx-auto p-4 space-y-8 print:hidden">
          {/* === CALCULATOR TAB === */}
          {activeTab === 'calculator' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-7 space-y-6">
                           <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                              {Object.values(COUNTRIES).map(c => (
                                  <button key={c.id} onClick={() => setCountry(c.id)} className={`flex-1 py-4 px-6 rounded-2xl border-2 flex flex-col items-center transition-all duration-200 min-w-[100px] shadow-sm hover:shadow-lg active:scale-95 ${country === c.id ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-200' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}><span className="font-black text-lg">{c.name.split(' ')[0]}</span><span className="text-xs font-bold opacity-70 mt-1">Ex: {rates[c.id] || '-'}</span></button>
                              ))}
                          </div>

                          <Card className="p-6 border-l-8 border-l-blue-500">
                              <SectionHeader icon={Car} title="車輛資料" />
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div className="col-span-2 md:col-span-2"><AutocompleteInput label="品牌" value={details.manufacturer} onChange={v => setDetails(d => ({...d, manufacturer:v}))} options={Object.keys(inventory)} /></div>
                                  <div className="col-span-2 md:col-span-2"><AutocompleteInput label="型號" value={details.model} onChange={v => setDetails(d => ({...d, model:v}))} options={inventory[details.manufacturer]?.models.map(m=>m.id) || []} /></div>
                                  <AutocompleteInput label="年份" value={details.year} onChange={v => setDetails(d => ({...d, year:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.years || []} />
                                  <AutocompleteInput label="代號" value={details.code} onChange={v => setDetails(d => ({...d, code:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.codes || []} />
                                  <InputGroup label="外觀顏色" value={details.exteriorColor} onChange={v => setDetails(d => ({...d, exteriorColor:v}))} type="text" placeholder="e.g. White" />
                                  <InputGroup label="內飾顏色" value={details.interiorColor} onChange={v => setDetails(d => ({...d, interiorColor:v}))} type="text" placeholder="e.g. Black" />
                                  <InputGroup label="排氣量 (cc)" value={details.engineCapacity} onChange={v => setDetails(d => ({...d, engineCapacity:v}))} type="number" placeholder="2494" />
                                  <InputGroup label="座位數" value={details.seats} onChange={v => setDetails(d => ({...d, seats:v}))} type="text" placeholder="7" />
                                  <div className="col-span-2 md:col-span-4"><InputGroup label="車身號碼 (Chassis No)" value={details.chassisNo} onChange={v => setDetails(d => ({...d, chassisNo:v}))} type="text" placeholder="e.g. NHP10-1234567" /></div>
                              </div>
                          </Card>

                          <Card className="p-6 border-l-8 border-l-slate-700">
                              <SectionHeader icon={DollarSign} title="核心成本" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <InputGroup label={`當地車價 (${COUNTRIES[country].currency})`} value={carPrice} onChange={setCarPrice} required prefix={COUNTRIES[country].symbol} />
                                  <InputGroup label="首次登記稅基準 (PRP)" value={prp} onChange={setPrp} required prefix="$" />
                              </div>
                              <div className="mt-4 p-5 bg-slate-100 rounded-xl flex justify-between items-center border border-slate-200">
                                  <span className="text-slate-600 font-bold uppercase tracking-wide">車價折合 (HKD)</span>
                                  <span className="text-3xl font-black text-slate-800">{fmt(carPriceHKD)}</span>
                              </div>
                          </Card>
                          
                          <Card className="p-6 border-l-8 border-purple-500">
                              <SectionHeader icon={Paperclip} title={`文件上傳 (Max ${appConfig.maxFiles})`} color="text-purple-700" />
                              <div className="flex flex-col gap-5">
                                  <label className="flex flex-col items-center justify-center w-full h-28 border-3 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-purple-400 transition group">
                                      <Upload className="w-10 h-10 text-slate-400 group-hover:text-purple-500 mb-2 transition transform group-hover:scale-110" />
                                      <p className="text-sm font-bold text-slate-500 group-hover:text-purple-600">點擊上傳圖片/PDF</p>
                                      <input type="file" className="hidden" multiple onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
                                  </label>
                                  {attachments.length > 0 && (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                          {attachments.map((file, idx) => (
                                              <div key={idx} className="relative group border-2 border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden" onClick={() => file.type.startsWith('image/') && setPreviewImage(file)}>
                                                  <div className="flex items-center gap-3">
                                                      {file.type.startsWith('image/') ? <img src={file.data} className="w-12 h-12 object-cover rounded-lg bg-slate-100 border border-slate-200" /> : <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400"><FileText className="w-8 h-8"/></div>}
                                                      <div className="flex-1 min-w-0">
                                                          <div className="truncate text-xs font-bold text-slate-700">{file.name}</div>
                                                          <div className="text-[10px] text-slate-400 font-bold">{(file.size/1024).toFixed(0)}KB</div>
                                                      </div>
                                                  </div>
                                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                      <button className="text-white hover:text-blue-200"><Eye className="w-6 h-6"/></button>
                                                      <button onClick={(e) => {e.stopPropagation(); removeAttachment(idx)}} className="text-white hover:text-red-400"><Trash2 className="w-6 h-6"/></button>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </Card>
                      </div>

                      <div className="lg:col-span-5 space-y-6">
                          <Card className="p-6 border-l-8 border-indigo-600"><SectionHeader icon={Globe} title="當地雜費" color="text-indigo-800" /><div className="grid grid-cols-2 gap-x-4 gap-y-3">{Object.entries(currOriginFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrOriginFees(p => ({...p, [k]: {...p[k], val}}))} prefix={COUNTRIES[country].symbol} />))}</div><div className="mt-4 pt-3 border-t-2 border-slate-100 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">折合港幣</span><span className="font-black text-indigo-700 text-xl">{fmt(originTotalHKD)}</span></div></Card>
                          <Card className="p-6 border-l-8 border-green-600"><SectionHeader icon={Ship} title="香港雜費 (到港成本)" color="text-green-800" /><div className="grid grid-cols-2 gap-x-4 gap-y-3">{Object.entries(currHkMiscFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkMiscFees(p => ({...p, [k]: {...p[k], val}}))} prefix="$" />))}</div><div className="mt-4 pt-3 border-t-2 border-slate-100 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">小計</span><span className="font-black text-green-700 text-xl">{fmt(hkMiscTotal)}</span></div></Card>
                          <Card className="p-6 border-l-8 border-orange-500"><SectionHeader icon={FileText} title="香港出牌費用" color="text-orange-700" /><div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">{Object.entries(currHkLicenseFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkLicenseFees(p => ({...p, [k]: {...p[k], val}}))} prefix="$" />))}</div><div className="flex justify-between items-center bg-orange-50 p-4 rounded-xl border border-orange-100 mb-2"><span className="text-sm font-bold text-slate-700">首次登記稅 (A1)</span><span className="font-black text-orange-700 text-xl">{fmt(frt)}</span></div><div className="flex justify-between items-center px-2"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">小計 (含稅)</span><span className="font-black text-slate-800 text-xl">{fmt(totalLicenseCost)}</span></div></Card>
                      </div>
                  </div>

                  <div className="sticky bottom-4 bg-slate-900/95 backdrop-blur-md text-white p-6 rounded-2xl shadow-2xl flex flex-col justify-between gap-6 z-10 border border-slate-700 ring-1 ring-white/10">
                      <div className="flex justify-between w-full border-b border-slate-700 pb-4">
                          <span className="text-base text-slate-400 font-bold">車輛到港成本 <span className="text-xs font-normal text-slate-500 ml-1">(含A1稅)</span></span>
                          <span className="text-2xl font-bold tracking-tight">{fmt(landedCost)}</span>
                      </div>
                      <div className="flex justify-between w-full items-end">
                          <div><div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">預計總成本 (Total)</div><div className="text-5xl font-black leading-none text-green-400 tracking-tighter shadow-black drop-shadow-sm">{fmt(totalCost)}</div></div>
                          <div className="flex gap-3">
                              <button onClick={generateCurrentReport} disabled={totalCost<=0} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg transition transform active:scale-95 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"><Printer className="w-5 h-5"/> 報告</button>
                              <button onClick={saveHistoryRecord} disabled={totalCost<=0 || !db} className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg transition transform active:scale-95 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"><PlusCircle className="w-5 h-5"/> 記錄</button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* === HISTORY TAB === */}
          {activeTab === 'history' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  {history.length === 0 ? (<div className="text-center py-20 text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-300">暫無記錄</div>) : (
                      history.map(item => (
                          <Card key={item.id} className="p-6 group hover:shadow-xl transition-all duration-200 border-l-8 border-l-blue-500 hover:translate-x-1">
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="bg-blue-100 text-blue-900 text-xs font-black px-2 py-0.5 rounded uppercase tracking-wider">{item.country}</span>
                                          <span className="text-xs text-slate-400 font-bold">{item.date}</span>
                                      </div>
                                      <div className="font-black text-slate-900 text-xl tracking-tight">{item.details.manufacturer} {item.details.model} <span className="font-bold text-slate-500 text-lg">{item.details.year}</span></div>
                                      <div className="text-xs text-slate-500 mt-1 font-mono font-medium">{item.details.chassisNo}</div>
                                      {item.attachments && item.attachments.length > 0 && <div className="flex items-center gap-1 mt-2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded w-fit"><Paperclip className="w-3 h-3"/> {item.attachments.length} 附件</div>}
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => generateReport(item)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition" title="列印"><Printer className="w-5 h-5"/></button>
                                      <button onClick={() => loadHistoryItem(item)} className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition" title="載入"><ArrowLeft className="w-5 h-5"/></button>
                                      <button onClick={() => toggleLock(item)} className={`p-2 rounded-lg transition ${item.isLocked ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:bg-slate-100'}`}>{item.isLocked ? <Lock className="w-5 h-5"/> : <Unlock className="w-5 h-5"/>}</button>
                                      <button onClick={() => deleteHistoryItem(item)} disabled={item.isLocked} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 rounded-lg transition"><Trash2 className="w-5 h-5"/></button>
                                  </div>
                              </div>
                              <div className="flex justify-between items-end border-t-2 border-slate-100 pt-4 mt-2">
                                  <div className="text-xs text-slate-500 font-bold space-y-1">
                                      <div>到港: <span className="text-slate-800">{fmt(item.results.landedCost)}</span></div>
                                      <div>A1稅: <span className="text-slate-800">{fmt(item.results.frt)}</span></div>
                                  </div>
                                  <div className="text-3xl font-black text-blue-700 tracking-tighter">{fmt(item.results.totalCost)}</div>
                              </div>
                          </Card>
                      ))
                  )}
              </div>
          )}

          {/* === SETTINGS TAB === */}
          {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-300 space-y-8">
                   <Card className="p-6 border-l-8 border-l-blue-600">
                       <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">當前資料帳號</div>
                       <div className="font-mono text-2xl font-black text-blue-900 bg-blue-50 p-4 rounded-xl border border-blue-100">{dataKey}</div>
                   </Card>
                   
                   {/* Logo Upload */}
                   <Card className="p-6 border-l-8 border-indigo-500">
                       <SectionHeader icon={ImageIcon} title="系統 Logo" color="text-indigo-700" />
                       <div className="flex items-center gap-6">
                           <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                               {appConfig.logo ? <img src={appConfig.logo} className="w-full h-full object-contain" /> : <span className="text-xs text-slate-400 font-bold">無 Logo</span>}
                           </div>
                           <div className="flex flex-col gap-3">
                               <label className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 cursor-pointer flex items-center gap-2 shadow-md transition transform hover:-translate-y-0.5">
                                   <Upload className="w-4 h-4"/> 上傳圖片
                                   <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                               </label>
                               {appConfig.logo && <button onClick={removeLogo} className="text-red-600 text-xs font-bold hover:underline">移除 Logo</button>}
                           </div>
                       </div>
                   </Card>

                   <Card className="p-6 border-l-8 border-purple-500">
                       <SectionHeader icon={Settings} title="系統設定" color="text-purple-700" />
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <InputGroup label="最大附件數量" value={appConfig.maxFiles} onChange={v => setAppConfig(p => ({...p, maxFiles: v}))} />
                           <InputGroup label="最大附件大小 (KB)" value={appConfig.maxFileSizeKB} onChange={v => setAppConfig(p => ({...p, maxFileSizeKB: v}))} />
                       </div>
                   </Card>
                   
                   <Card className="p-6 border-l-8 border-green-600">
                       <SectionHeader icon={Car} title="車輛庫存管理" color="text-green-700" />
                       <div className="flex gap-3 mb-6"><input value={newManufacturer} onChange={e => setNewManufacturer(e.target.value)} placeholder="新增品牌 (e.g. Porsche)" className="flex-1 text-sm p-3 border-2 border-slate-300 rounded-xl font-bold focus:border-green-500 focus:ring-0 placeholder:text-slate-400" /><button onClick={addMfr} disabled={!newManufacturer} className="bg-green-600 text-white px-6 rounded-xl text-sm font-bold shadow hover:bg-green-700 disabled:opacity-50 transition transform hover:-translate-y-0.5">新增</button></div>
                       <div className="space-y-3">
                           {Object.keys(inventory).map(mfr => (
                               <div key={mfr} className="border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition">
                                   <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50" onClick={() => setEditingMfr(editingMfr === mfr ? null : mfr)}>
                                       <span className="font-black text-slate-800">{mfr} <span className="text-xs font-bold text-slate-500 ml-2">({inventory[mfr]?.models?.length || 0} 款)</span></span>
                                       <div className="flex gap-3 items-center">
                                            <Trash2 className="w-5 h-5 text-slate-300 hover:text-red-500 transition" onClick={(e) => {e.stopPropagation(); deleteMfr(mfr)}} />
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${editingMfr === mfr ? 'rotate-180' : ''}`} />
                                       </div>
                                   </div>
                                   {editingMfr === mfr && (
                                       <div className="p-4 border-t-2 border-slate-100 bg-slate-50/50">
                                           <div className="grid grid-cols-10 gap-2 mb-4">
                                               <input placeholder="型號" value={newModel.id} onChange={e => setNewModel(m => ({...m, id: e.target.value}))} className="col-span-3 text-xs p-2.5 border-2 border-slate-300 rounded-lg font-bold" />
                                               <input placeholder="年份" value={newModel.years} onChange={e => setNewModel(m => ({...m, years: e.target.value}))} className="col-span-2 text-xs p-2.5 border-2 border-slate-300 rounded-lg font-bold" />
                                               <input placeholder="代號" value={newModel.codes} onChange={e => setNewModel(m => ({...m, codes: e.target.value}))} className="col-span-3 text-xs p-2.5 border-2 border-slate-300 rounded-lg font-bold" />
                                               <button onClick={() => addModel(mfr)} disabled={!newModel.id} className="col-span-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow hover:bg-blue-700 transition">新增</button>
                                           </div>
                                           <div className="space-y-1">
                                               {(inventory[mfr]?.models || []).map(m => (
                                                   <div key={m.id} className="flex justify-between items-center text-xs py-2 px-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                                       <span><b className="text-slate-900">{m.id}</b> <span className="text-slate-400 ml-2 font-medium">[{m.codes.join(', ')}]</span></span>
                                                       <X className="w-4 h-4 text-slate-300 cursor-pointer hover:text-red-500" onClick={() => deleteModel(mfr, m.id)} />
                                                   </div>
                                               ))}
                                               {inventory[mfr]?.models?.length === 0 && <div className="text-xs text-slate-400 text-center py-2 italic font-bold">暫無型號資料</div>}
                                           </div>
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                   </Card>
                   
                   <Card className="p-6"><SectionHeader icon={DollarSign} title="匯率設定" /><div className="grid grid-cols-1 sm:grid-cols-3 gap-6">{Object.keys(DEFAULT_RATES).map(c => (<InputGroup key={c} label={`${c} (1 ${COUNTRIES[c].currency})`} value={rates[c]} onChange={v => handleRateChange(c, v)} />))}</div></Card>
                   <Card className="p-6">
                       <SectionHeader icon={Settings} title="預設費用" />
                       {Object.keys(COUNTRIES).map(c => (
                           <div key={c} className="mb-8 last:mb-0"><h4 className="font-black text-slate-800 text-lg mb-4 border-l-4 border-blue-500 pl-3">{COUNTRIES[c].name}</h4>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                   <div className="space-y-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-200"><div className="text-xs font-black text-slate-400 uppercase tracking-wider">當地費用 ({c.currency})</div><div className='grid grid-cols-1 gap-3'>{Object.entries(fees[c]?.origin || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'origin', k, val)} />))}</div></div>
                                   <div className="space-y-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-200"><div className="text-xs font-black text-slate-400 uppercase tracking-wider">香港雜費 (HKD)</div><div className='grid grid-cols-1 gap-3'>{Object.entries(fees[c]?.hk_misc || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'hk_misc', k, val)} />))}</div></div>
                                   <div className="space-y-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-200"><div className="text-xs font-black text-slate-400 uppercase tracking-wider">香港出牌費用 (HKD)</div><div className='grid grid-cols-1 gap-3'>{Object.entries(fees[c]?.hk_license || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'hk_license', k, val)} />))}</div></div>
                               </div>
                           </div>
                       ))}
                   </Card>
                   <div className="flex justify-end gap-4"><button onClick={() => {setModal({title: "重置設定", message: "確定重置？", type: "danger", onConfirm: () => {setRates(DEFAULT_RATES); setFees(DEFAULT_FEES); setInventory(DEFAULT_INVENTORY); setAppConfig(DEFAULT_CONFIG); setModal(null); saveConfig();}});}} className="px-6 py-3 text-red-600 hover:bg-red-50 rounded-xl font-bold transition">重置為預設值</button><button onClick={saveConfig} className="px-8 py-3 bg-blue-600 text-white rounded-xl flex items-center gap-2 font-bold shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-0.5"><Save className="w-5 h-5"/> 儲存設定</button></div>
              </div>
          )}
      </div>
    </div>
  );
}
