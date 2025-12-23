import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft, Key, Printer, Upload, Paperclip, File as FileIcon, Image as ImageIcon, BarChart3, TrendingUp, PieChart, Zap } from 'lucide-react';

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

// --- Market Data (2024-2025) ---
const MARKET_DATA = {
    overview: [
        { year: '2024', total: 44200, evShare: 64.3, topBrand: 'Tesla' },
        { year: '2025 (預測)', total: 41500, evShare: 70.5, topBrand: 'BYD' }
    ],
    brands_2025_1H: [
        { name: 'BYD', units: 3937, share: 18.0, change: '+22.5%', color: 'bg-green-500' },
        { name: 'Tesla', units: 3822, share: 17.5, change: '-37.7%', color: 'bg-red-500' },
        { name: 'BMW', units: 2244, share: 10.2, change: '+29.8%', color: 'bg-blue-500' },
        { name: 'Toyota', units: 1867, share: 8.5, change: '+46.5%', color: 'bg-red-600' }, // 雖然MPV跌，但整體靠混能支撐
        { name: 'Mercedes-Benz', units: 1674, share: 7.6, change: '-5.2%', color: 'bg-gray-500' },
        { name: 'XPeng', units: 1301, share: 5.9, change: '+159.5%', color: 'bg-orange-500' }
    ],
    insights: [
        { title: "電動車市佔率突破 70%", desc: "2025年數據顯示，每10部新登記私家車中有7部為電動車，傳統燃油車生存空間進一步被壓縮。", type: "trend" },
        { title: "國產 MPV 重新定義市場", desc: "2025年9月數據顯示，Toyota Alphard 跌出 MPV 三甲。XPeng X9 (72輛)、Zeekr 009 (55輛)、Denza D9 (49輛) 瓜分了豪華保姆車市場。", type: "warning" },
        { title: "BYD 超越 Tesla", desc: "憑藉海豹 (Seal) 及海獅 (Sealion) 等多款車型，BYD 在 2025 年多次蟬聯單月銷量冠軍，打破 Tesla 長期壟斷。", type: "info" }
    ]
};

// --- Constants & Defaults ---
const DEFAULT_RATES = { JP: 0.053, UK: 10.2, DE: 8.6 };
const DEFAULT_CONFIG = { maxFiles: 5, maxFileSizeKB: 500 }; 
const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  DE: { id: 'DE', name: '德國 (Germany)', currency: 'EUR', symbol: '€' },
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
    origin: { auctionFee: { label: '出口手續費', val: '500' }, shipping: { label: '1500' } },
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
  DE: {
    origin: { auctionFee: { label: '出口手續費', val: '400' }, shipping: { label: '1200' } },
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
const Card = ({ children, className = "" }) => <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>{children}</div>;
const SectionHeader = ({ icon: Icon, title, color="text-gray-800" }) => <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100"><Icon className={`w-5 h-5 ${color}`} /><h3 className="font-bold text-gray-700">{title}</h3></div>;

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
    <div className="mb-3">
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>}
      <div className="relative rounded-md shadow-sm">
        {prefix && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 sm:text-sm">{prefix}</span></div>}
        <input 
          type={type === 'number' ? 'text' : type} 
          inputMode={type === 'number' ? 'decimal' : 'text'}
          className={`focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 ${prefix ? 'pl-8' : 'pl-3'}`} 
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
    <div className="mb-3 relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input type="text" className={`block w-full sm:text-sm border-gray-300 rounded-md py-2 pl-3 pr-8 ${disabled ? 'bg-gray-100' : 'bg-white'}`} placeholder={placeholder} value={value} onChange={e => {onChange(e.target.value); setOpen(true);}} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} disabled={disabled} />
        {!value && <ChevronDown className="w-4 h-4 absolute right-2 top-3 text-gray-400" />}
        {value && <X className="w-4 h-4 absolute right-2 top-3 text-gray-400 cursor-pointer" onClick={() => onChange('')} />}
      </div>
      {open && filtered.length > 0 && !disabled && (
        <ul className="absolute z-30 w-full mt-1 max-h-40 overflow-y-auto bg-white border rounded-md shadow-lg">
          {filtered.map((opt, i) => <li key={i} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer" onMouseDown={() => onChange(opt)}>{opt}</li>)}
        </ul>
      )}
    </div>
  );
};

const ConfirmationModal = ({ config, onClose }) => {
    if (!config) return null;
    const { title, message, onConfirm, type } = config;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full animate-in fade-in zoom-in-95">
          <div className={`p-4 border-b ${type === 'danger' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}><h3 className="font-bold flex gap-2"><AlertTriangle className="w-5 h-5" />{title}</h3></div>
          <div className="p-4 text-sm text-gray-700">{message}</div>
          <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300">取消</button>
            <button onClick={onConfirm} className={`px-3 py-1.5 text-white rounded text-sm ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>確認</button>
          </div>
        </Card>
      </div>
    );
};

// --- REPORT COMPONENT ---
const PrintableReport = ({ data, onClose }) => {
    const { details, vals, fees, results, country, date, attachments } = data;
    const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

    const handlePrint = () => window.print();

    const hkMiscFees = fees.hk_misc || {};
    const hkLicenseFees = fees.hk_license || {};
    const safeHkMiscTotal = results.hkMiscTotal !== undefined ? results.hkMiscTotal : Object.values(hkMiscFees).reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0);
    const safeHkLicenseTotal = results.hkLicenseTotal !== undefined ? results.hkLicenseTotal : (Object.values(hkLicenseFees).reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0) + (results.frt || 0));

    return (
        <div className="fixed inset-0 z-[100] bg-gray-600/75 flex justify-center overflow-auto print:p-0 print:bg-white print:static print:block">
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
                }
            `}</style>

            <div id="printable-report-container" className="relative w-full max-w-[210mm] min-h-[297mm] my-8 bg-white shadow-2xl print:shadow-none print:my-0 print:w-full">
                <div id="printable-report" className="p-10 text-gray-900 h-full flex flex-col">
                    <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4 mb-6">
                        <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">車輛成本估價單</h1><p className="text-sm text-gray-500 mt-1">日期: {date}</p></div>
                        <div className="text-right"><h2 className="text-xl font-bold text-blue-800 flex items-center justify-end gap-2"><Truck className='w-5 h-5'/> HK Car Dealer Tool</h2><p className="text-xs text-gray-400">Internal Use Only</p></div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-md font-bold text-gray-800 uppercase tracking-wider mb-3 border-l-4 border-blue-500 pl-2">車輛資料</h3>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">品牌</span> <span className="font-semibold">{details.manufacturer}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">型號</span> <span className="font-semibold">{details.model}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">年份</span> <span className="font-semibold">{details.year}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">代號</span> <span className="font-semibold">{details.code}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">排氣量</span> <span className="font-semibold">{details.engineCapacity ? `${details.engineCapacity} cc` : '-'}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">座位數</span> <span className="font-semibold">{details.seats || '-'}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">外觀顏色</span> <span className="font-semibold">{details.exteriorColor || '-'}</span></div>
                            <div className='flex'><span className="w-20 text-gray-500 text-xs">內飾顏色</span> <span className="font-semibold">{details.interiorColor || '-'}</span></div>
                            <div className="col-span-2 border-t border-gray-200 pt-2 mt-1 flex"><span className="w-20 text-gray-500 text-xs">車身號碼</span> <span className="font-mono font-bold">{details.chassisNo || '-'}</span></div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-md font-bold text-gray-800 uppercase tracking-wider mb-3 border-l-4 border-blue-500 pl-2">核心成本</h3>
                        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                    <th className="text-left py-2 px-3 font-semibold">項目</th>
                                    <th className="text-right py-2 px-3 font-semibold">外幣 ({COUNTRIES[country].currency})</th>
                                    <th className="text-right py-2 px-3 font-semibold">匯率</th>
                                    <th className="text-right py-2 px-3 font-semibold">港幣 (HKD)</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-gray-100'>
                                <tr>
                                    <td className="py-2 px-3">當地車價</td>
                                    <td className="text-right px-3 text-gray-600">{vals.carPrice}</td>
                                    <td className="text-right px-3 text-gray-600">{vals.rate}</td>
                                    <td className="text-right px-3 font-medium">{fmt(results.carPriceHKD)}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3">當地雜費 <span className='text-xs text-gray-400'>({Object.values(fees.origin).map(f => f.label).join('/')})</span></td>
                                    <td className="text-right px-3 text-gray-600">-</td>
                                    <td className="text-right px-3 text-gray-600">{vals.rate}</td>
                                    <td className="text-right px-3 font-medium">{fmt(results.originTotalHKD)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div>
                            <h4 className="font-bold text-gray-700 border-b border-gray-200 pb-1 mb-2 text-sm uppercase">香港雜費</h4>
                            <ul className="text-sm space-y-1">
                                {Object.entries(hkMiscFees).map(([k, v]) => (
                                    <li key={k} className="flex justify-between"><span className="text-gray-600">{v.label}</span><span>${v.val}</span></li>
                                ))}
                                <li className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-2"><span>小計</span><span>{fmt(safeHkMiscTotal)}</span></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-700 border-b border-gray-200 pb-1 mb-2 text-sm uppercase">出牌費用</h4>
                            <ul className="text-sm space-y-1">
                                {Object.entries(hkLicenseFees).map(([k, v]) => (
                                    <li key={k} className="flex justify-between"><span className="text-gray-600">{v.label}</span><span>${v.val}</span></li>
                                ))}
                                <li className="flex justify-between"><span className="text-gray-600">首次登記稅 (A1)</span><span>{fmt(results.frt)}</span></li>
                                <li className="text-xs text-gray-400 text-right mb-1">(PRP: ${vals.prp})</li>
                                <li className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-2"><span>小計 (含稅)</span><span>{fmt(safeHkLicenseTotal)}</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-auto">
                         <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4 break-inside-avoid">
                            <div className="flex justify-between items-center border-b border-gray-300 pb-4">
                                <div>
                                    <span className="text-gray-600 font-bold block text-lg">車輛到港成本</span>
                                    <span className="text-xs text-gray-400 font-normal">Landed Cost (含A1稅，不含牌費保險)</span>
                                </div>
                                <span className="text-2xl font-bold text-gray-800">{fmt(results.landedCost)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-blue-800 font-bold block text-xl">預計總成本</span>
                                    <span className="text-xs text-gray-400 font-normal">Total Cost (All Inclusive)</span>
                                </div>
                                <span className="text-4xl font-extrabold text-blue-700">{fmt(results.totalCost)}</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t text-center text-xs text-gray-400">
                             <p>© {new Date().getFullYear()} HK Car Dealer Tool | Internal Document</p>
                        </div>
                    </div>
                </div>

                <div className="absolute top-4 right-4 flex gap-2 no-print">
                     <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 flex items-center gap-2"><Printer className="w-4 h-4" /> 列印 / PDF</button>
                     <button onClick={onClose} className="bg-gray-600 text-white px-4 py-2 rounded-lg shadow hover:bg-gray-700 flex items-center gap-2"><X className="w-4 h-4" /> 關閉</button>
                </div>
            </div>
        </div>
    );
};

// --- MARKET ANALYSIS COMPONENT (NEW) ---
const MarketAnalysis = () => {
    // 簡單的比例計算 CSS
    const getWidth = (val, max) => `${(val / max) * 100}%`;
    const maxUnits = Math.max(...MARKET_DATA.brands_2025_1H.map(b => b.units));

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MARKET_DATA.overview.map((data, idx) => (
                    <Card key={idx} className="p-5 border-t-4 border-blue-500">
                        <h3 className="text-lg font-bold text-gray-700 mb-4">{data.year} 年度概覽</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">新車登記總數</span>
                                <span className="text-2xl font-bold text-gray-900">{data.total.toLocaleString()} <span className="text-xs font-normal text-gray-400">輛</span></span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">電動車 (EV) 市佔率</span>
                                <span className="text-xl font-bold text-green-600">{data.evShare}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">銷售冠軍品牌</span>
                                <span className="text-lg font-bold text-blue-600">{data.topBrand}</span>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Brand Performance Chart */}
            <Card className="p-6">
                <SectionHeader icon={BarChart3} title="2025年上半年 品牌銷量排行" />
                <div className="space-y-5 mt-4">
                    {MARKET_DATA.brands_2025_1H.map((brand, idx) => (
                        <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-bold text-gray-700 flex items-center gap-2">
                                    {idx + 1}. {brand.name}
                                    {brand.change.startsWith('+') ? <span className="text-green-500 text-xs bg-green-50 px-1 rounded">{brand.change}</span> : <span className="text-red-500 text-xs bg-red-50 px-1 rounded">{brand.change}</span>}
                                </span>
                                <span className="text-gray-500">{brand.units} 輛 ({brand.share}%)</span>
                            </div>
                            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${brand.color}`} 
                                    style={{ width: getWidth(brand.units, maxUnits) }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Market Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MARKET_DATA.insights.map((insight, idx) => (
                    <Card key={idx} className={`p-4 border-l-4 ${insight.type === 'trend' ? 'border-green-500' : insight.type === 'warning' ? 'border-orange-500' : 'border-blue-500'}`}>
                        <div className="flex items-start gap-3">
                            {insight.type === 'trend' ? <TrendingUp className="w-6 h-6 text-green-600" /> : 
                             insight.type === 'warning' ? <AlertTriangle className="w-6 h-6 text-orange-600" /> : 
                             <Info className="w-6 h-6 text-blue-600" />}
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm mb-1">{insight.title}</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">{insight.desc}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
            
            <div className="text-center text-xs text-gray-400 mt-4">
                資料來源：香港統計處、運輸署 (整合截至 2025年10月)
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
      try { await setDoc(getSettingsRef(), dataToSave, { merge: true }); showMsg("設定已儲存"); } catch(e) { showMsg("儲存失敗", "error"); }
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
      try {
        await addDoc(getHistoryRef(), record);
        showMsg("已記錄");
        setTimeout(() => setActiveTab('history'), 500);
      } catch(e) { showMsg("儲存失敗: " + e.message, "error"); }
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

  if (!isReady) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 font-sans">
      <ConfirmationModal config={modal} onClose={() => setModal(null)} />
      {reportData && <PrintableReport data={reportData} onClose={() => setReportData(null)} />}

      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-lg print:hidden">
          <div className="max-w-7xl mx-auto flex flex-col gap-3">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 font-bold text-lg"><Truck className="w-6 h-6 text-blue-400"/> HK 汽車行家助手</div>
                  <div className="flex items-center gap-2 text-xs bg-slate-800 p-1 rounded-lg border border-slate-700">
                      <Key className="w-3 h-3 text-yellow-400 ml-1" />
                      {isKeyEditing ? (
                          <div className="flex items-center">
                              <input autoFocus className="bg-slate-700 text-white px-2 py-1 rounded outline-none w-24" defaultValue={dataKey} onChange={(e) => setTempKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleKeyChange()} />
                              <button onClick={handleKeyChange} className="px-2 text-green-400">✓</button>
                              <button onClick={() => setIsKeyEditing(false)} className="px-1 text-red-400">✕</button>
                          </div>
                      ) : (
                          <div className="flex items-center gap-2 px-1 cursor-pointer hover:text-blue-300" onClick={() => { setTempKey(dataKey); setIsKeyEditing(true); }}>
                              <span className="font-mono text-blue-300">{dataKey}</span><span className="text-slate-500">(切換)</span>
                          </div>
                      )}
                  </div>
              </div>
              <div className="flex bg-slate-800 rounded-lg p-1 self-start">
                  {[{id:'calculator', icon: Calculator, label:'計算'}, {id:'history', icon: List, label:`記錄 (${history.length})`}, {id:'market', icon: PieChart, label: '市場分析'}, {id:'settings', icon: Settings, label:'設定'}].map(t => (
                      <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition ${activeTab===t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}><t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span></button>
                  ))}
              </div>
          </div>
      </div>

      {saveMsg && <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg flex items-center gap-2 text-white text-sm ${saveMsg.type === 'error' ? 'bg-red-500' : 'bg-green-600'} print:hidden`}>{saveMsg.type === 'error' ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}{saveMsg.msg}</div>}

      <div className="max-w-7xl mx-auto p-4 space-y-6 print:hidden">
          {activeTab === 'market' && <MarketAnalysis />}

          {activeTab === 'calculator' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-7 space-y-6">
                           <div className="flex gap-2 overflow-x-auto pb-1">
                              {Object.values(COUNTRIES).map(c => (
                                  <button key={c.id} onClick={() => setCountry(c.id)} className={`flex-1 py-3 px-4 rounded-xl border flex flex-col items-center transition min-w-[80px] ${country === c.id ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'bg-white border-gray-200'}`}><span className="font-bold">{c.name.split(' ')[0]}</span><span className="text-xs text-gray-500">Ex: {rates[c.id] || '-'}</span></button>
                              ))}
                          </div>

                          <Card className="p-4">
                              <SectionHeader icon={Car} title="車輛資料" />
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div className="col-span-2 md:col-span-2"><AutocompleteInput label="品牌" value={details.manufacturer} onChange={v => setDetails(d => ({...d, manufacturer:v}))} options={Object.keys(inventory)} /></div>
                                  <div className="col-span-2 md:col-span-2"><AutocompleteInput label="型號" value={details.model} onChange={v => setDetails(d => ({...d, model:v}))} options={inventory[details.manufacturer]?.models.map(m=>m.id) || []} /></div>
                                  <AutocompleteInput label="年份" value={details.year} onChange={v => setDetails(d => ({...d, year:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.years || []} />
                                  <AutocompleteInput label="代號" value={details.code} onChange={v => setDetails(d => ({...d, code:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.codes || []} />
                                  <InputGroup label="外觀顏色" value={details.exteriorColor} onChange={v => setDetails(d => ({...d, exteriorColor:v}))} type="text" placeholder="e.g. White" />
                                  <InputGroup label="內飾顏色" value={details.interiorColor} onChange={v => setDetails(d => ({...d, interiorColor:v}))} type="text" placeholder="e.g. Black" />
                                  <InputGroup label="排氣量 (cc)" value={details.engineCapacity} onChange={v => setDetails(d => ({...d, engineCapacity:v}))} type="number" placeholder="e.g. 2494" />
                                  <InputGroup label="座位數" value={details.seats} onChange={v => setDetails(d => ({...d, seats:v}))} type="text" placeholder="e.g. 7" />
                                  <div className="col-span-2 md:col-span-4"><InputGroup label="車身號碼 (Chassis No)" value={details.chassisNo} onChange={v => setDetails(d => ({...d, chassisNo:v}))} type="text" placeholder="e.g. NHP10-1234567" /></div>
                              </div>
                          </Card>

                          <Card className="p-4 border-l-4 border-l-blue-600">
                              <SectionHeader icon={DollarSign} title="核心成本" color="text-blue-600" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><InputGroup label={`當地車價 (${COUNTRIES[country].currency})`} value={carPrice} onChange={setCarPrice} required /><InputGroup label="首次登記稅基準 (PRP)" value={prp} onChange={setPrp} required /></div>
                              <div className="mt-2 text-right text-sm font-medium text-gray-600">車價折合: <span className="text-blue-600 text-lg">{fmt(carPriceHKD)}</span></div>
                          </Card>
                          
                          <Card className="p-4 border-l-4 border-purple-500">
                              <SectionHeader icon={Paperclip} title={`文件上傳 (最多 ${appConfig.maxFiles} 個)`} color="text-purple-700" />
                              <div className="flex flex-col gap-4">
                                  <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                                      <div className="flex flex-col items-center pt-1 pb-2"><Upload className="w-5 h-5 text-gray-400 mb-1" /><p className="text-[10px] text-gray-500">點擊上傳圖片/PDF</p></div>
                                      <input type="file" className="hidden" multiple onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
                                  </label>
                                  {attachments.length > 0 && (
                                      <div className="grid grid-cols-2 gap-2">
                                          {attachments.map((file, idx) => (
                                              <div key={idx} className="flex items-center justify-between p-2 bg-gray-100 rounded border text-xs">
                                                  <div className="flex items-center gap-2 overflow-hidden">{file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-500"/> : <FileIcon className="w-4 h-4 text-gray-500"/>}<span className="truncate max-w-[80px]" title={file.name}>{file.name}</span></div>
                                                  <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4"/></button>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </Card>
                      </div>

                      <div className="lg:col-span-5 space-y-4">
                          <Card className="p-4"><SectionHeader icon={Globe} title="當地雜費" color="text-indigo-600" /><div className="grid grid-cols-2 gap-x-4 gap-y-2">{Object.entries(currOriginFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrOriginFees(p => ({...p, [k]: {...p[k], val}}))} />))}</div><div className="text-right text-xs text-gray-500 mt-2">折合: {fmt(originTotalHKD)}</div></Card>
                          <Card className="p-4"><SectionHeader icon={Ship} title="香港雜費 (到港成本)" color="text-green-600" /><div className="grid grid-cols-2 gap-x-4 gap-y-2">{Object.entries(currHkMiscFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkMiscFees(p => ({...p, [k]: {...p[k], val}}))} />))}</div><div className="text-right text-xs text-gray-500 mt-2">小計: {fmt(hkMiscTotal)}</div></Card>
                          <Card className="p-4 border-l-4 border-orange-400"><SectionHeader icon={FileText} title="香港出牌費用" color="text-orange-600" /><div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">{Object.entries(currHkLicenseFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkLicenseFees(p => ({...p, [k]: {...p[k], val}}))} />))}</div><div className="flex justify-between items-center bg-orange-50 p-3 rounded"><span className="text-sm text-gray-700">首次登記稅 (FRT)</span><span className="font-bold text-orange-700">{fmt(frt)}</span></div><div className="text-right text-xs text-gray-500 mt-2">小計 (含稅): {fmt(totalLicenseCost)}</div></Card>
                      </div>
                  </div>

                  <div className="sticky bottom-0 bg-slate-800 text-white p-4 rounded-xl shadow-xl flex flex-col justify-between gap-4 z-10">
                      <div className="flex justify-between w-full border-b border-slate-600 pb-2 mb-1"><span className="text-sm text-gray-300">車輛到港成本 (含A1稅):</span><span className="text-lg font-semibold">{fmt(landedCost)}</span></div>
                      <div className="flex justify-between w-full items-end">
                          <div><div className="text-xs text-gray-400">總成本 (Total Cost):</div><div className="text-3xl font-bold leading-none text-green-400">{fmt(totalCost)}</div></div>
                          <div className="flex gap-2"><button onClick={generateCurrentReport} disabled={totalCost<=0} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-1 text-sm"><Printer className="w-4 h-4"/> 報告</button><button onClick={saveHistoryRecord} disabled={totalCost<=0 || !db} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-1 text-sm"><PlusCircle className="w-4 h-4"/> 記錄</button></div>
                      </div>
                  </div>
              </div>
          )}

          {/* === HISTORY TAB === */}
          {activeTab === 'history' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  {history.length === 0 ? (<div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed">暫無記錄</div>) : (
                      history.map(item => (
                          <Card key={item.id} className="p-4 group hover:shadow-md transition">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded mr-2">{item.country}</span>
                                      <span className="text-xs text-gray-500">{item.date}</span>
                                      <div className="font-bold text-gray-800 mt-1">{item.details.manufacturer} {item.details.model} <span className="font-normal text-sm text-gray-500">{item.details.year}</span></div>
                                      <div className="text-xs text-gray-400 mt-0.5 flex gap-2"><span>{item.details.chassisNo || 'No Chassis'}</span>{item.details.engineCapacity && <span>| {item.details.engineCapacity}cc</span>}</div>
                                      {item.attachments && item.attachments.length > 0 && <div className="flex items-center gap-1 mt-1 text-xs text-purple-600"><Paperclip className="w-3 h-3"/> {item.attachments.length} 附件</div>}
                                  </div>
                                  <div className="flex gap-1">
                                      <button onClick={() => generateReport(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Printer className="w-4 h-4"/></button>
                                      <button onClick={() => loadHistoryItem(item)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4"/></button>
                                      <button onClick={() => toggleLock(item)} className={`p-1.5 rounded ${item.isLocked ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}`}>{item.isLocked ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4"/>}</button>
                                      <button onClick={() => deleteHistoryItem(item)} disabled={item.isLocked} className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                              </div>
                              <div className="flex justify-between items-end border-t pt-2 mt-2">
                                  <div className="text-xs text-gray-500"><div>到港: {fmt(item.results.landedCost)}</div></div>
                                  <div className="text-xl font-bold text-blue-600">{fmt(item.results.totalCost)}</div>
                              </div>
                          </Card>
                      ))
                  )}
              </div>
          )}

          {/* === SETTINGS TAB === */}
          {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                   <Card className="p-4 border-l-4 border-blue-500">
                       <div className="text-sm text-gray-600 mb-2">當前資料帳號</div>
                       <div className="font-mono text-lg font-bold text-blue-800 bg-blue-50 p-2 rounded">{dataKey}</div>
                   </Card>
                   <Card className="p-4 border-l-4 border-purple-500"><SectionHeader icon={Settings} title="系統設定" color="text-purple-700" /><div className="grid grid-cols-2 gap-4"><InputGroup label="最大附件數量" value={appConfig.maxFiles} onChange={v => setAppConfig(p => ({...p, maxFiles: v}))} /><InputGroup label="最大附件大小 (KB)" value={appConfig.maxFileSizeKB} onChange={v => setAppConfig(p => ({...p, maxFileSizeKB: v}))} /></div></Card>
                   <Card className="p-4 border-l-4 border-green-500">
                       <SectionHeader icon={Car} title="車輛庫存管理" color="text-green-700" />
                       <div className="flex gap-2 mb-4"><input value={newManufacturer} onChange={e => setNewManufacturer(e.target.value)} placeholder="新增品牌" className="flex-1 text-sm p-2 border rounded" /><button onClick={addMfr} disabled={!newManufacturer} className="bg-green-600 text-white px-3 rounded text-sm">新增</button></div>
                       <div className="space-y-2">
                           {Object.keys(inventory).map(mfr => (
                               <div key={mfr} className="border rounded-lg bg-gray-50 overflow-hidden">
                                   <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-100" onClick={() => setEditingMfr(editingMfr === mfr ? null : mfr)}><span className="font-bold text-sm">{mfr} ({inventory[mfr]?.models?.length || 0})</span><div className="flex gap-2"><Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" onClick={(e) => {e.stopPropagation(); deleteMfr(mfr)}} /><ChevronDown className={`w-4 h-4 transition ${editingMfr === mfr ? 'rotate-180' : ''}`} /></div></div>
                                   {editingMfr === mfr && (<div className="p-3 border-t bg-white"><div className="grid grid-cols-4 gap-2 mb-3"><input placeholder="型號" value={newModel.id} onChange={e => setNewModel(m => ({...m, id: e.target.value}))} className="text-xs p-1.5 border rounded" /><input placeholder="年份" value={newModel.years} onChange={e => setNewModel(m => ({...m, years: e.target.value}))} className="text-xs p-1.5 border rounded" /><input placeholder="代號" value={newModel.codes} onChange={e => setNewModel(m => ({...m, codes: e.target.value}))} className="text-xs p-1.5 border rounded" /><button onClick={() => addModel(mfr)} disabled={!newModel.id} className="bg-blue-500 text-white rounded text-xs hover:bg-blue-600">新增</button></div>{(inventory[mfr]?.models || []).map(m => (<div key={m.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0"><span><b>{m.id}</b> <span className="text-gray-500">[{m.codes.join(',')}]</span></span><X className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600" onClick={() => deleteModel(mfr, m.id)} /></div>))}</div>)}
                               </div>
                           ))}
                       </div>
                   </Card>
                   <Card className="p-4"><SectionHeader icon={DollarSign} title="匯率設定" /><div className="grid grid-cols-3 gap-3">{Object.keys(DEFAULT_RATES).map(c => (<InputGroup key={c} label={c} value={rates[c]} onChange={v => handleRateChange(c, v)} />))}</div></Card>
                   <Card className="p-4">
                       <SectionHeader icon={Settings} title="預設費用" />
                       {Object.keys(COUNTRIES).map(c => (
                           <div key={c} className="mb-6 last:mb-0"><h4 className="font-bold text-gray-700 mb-2 border-l-4 border-blue-500 pl-2">{COUNTRIES[c].name}</h4>
                               <div className="grid grid-cols-1 gap-4">
                                   <div className="space-y-2"><div className="text-xs font-bold text-gray-400">當地費用 ({c.currency})</div><div className='grid grid-cols-2 gap-2'>{Object.entries(fees[c]?.origin || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'origin', k, val)} />))}</div></div>
                                   <div className="space-y-2"><div className="text-xs font-bold text-gray-400">香港雜費 (HKD)</div><div className='grid grid-cols-2 gap-2'>{Object.entries(fees[c]?.hk_misc || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'hk_misc', k, val)} />))}</div></div>
                                   <div className="space-y-2"><div className="text-xs font-bold text-gray-400">香港出牌費用 (HKD)</div><div className='grid grid-cols-2 gap-2'>{Object.entries(fees[c]?.hk_license || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'hk_license', k, val)} />))}</div></div>
                               </div>
                           </div>
                       ))}
                   </Card>
                   <div className="flex justify-end gap-3"><button onClick={() => {setModal({title: "重置設定", message: "確定重置？", type: "danger", onConfirm: () => {setRates(DEFAULT_RATES); setFees(DEFAULT_FEES); setInventory(DEFAULT_INVENTORY); setAppConfig(DEFAULT_CONFIG); setModal(null); saveConfig();}});}} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">重置</button><button onClick={saveConfig} className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"><Save className="w-4 h-4"/> 儲存</button></div>
              </div>
          )}
      </div>
    </div>
  );
}
