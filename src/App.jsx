import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft, User, Key, Printer, FileOutput, Upload, Paperclip, File as FileIcon, Image as ImageIcon, Palette, Download, Eye, CreditCard, FileSignature, Pencil, Cog } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, inMemoryPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, initializeFirestore, memoryLocalCache } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const DEFAULT_CONFIG = { maxFiles: 5, maxFileSizeKB: 5000, logo: null }; 

// 新增：預設選項 (顏色)
const DEFAULT_OPTIONS = {
    exteriorColors: ['White', 'Black', 'Silver', 'Grey', 'Pearl', 'Blue', 'Red', 'Beige', 'Green', 'Yellow'],
    interiorColors: ['Black', 'Beige', 'Grey', 'Red', 'Brown', 'Tan', 'White']
};

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

// --- IMAGE COMPRESSION HELPER ---
const compressImage = (file, maxWidth = 1024, quality = 0.5) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleSize = maxWidth / img.width;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
            width = maxWidth;
            height = img.height * scaleSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
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
const Card = ({ children, className = "" }) => <div className={`bg-white rounded-xl shadow-md border-2 border-slate-300 overflow-hidden ${className}`}>{children}</div>;
const SectionHeader = ({ icon: Icon, title, color="text-slate-900" }) => <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-slate-200"><Icon className={`w-6 h-6 ${color}`} /><h3 className="font-extrabold text-slate-800 text-lg tracking-tight">{title}</h3></div>;

const InputGroup = ({ label, value, onChange, prefix, placeholder = "", required = false, type = 'number', step = 'any', min }) => {
  const displayValue = useMemo(() => {
    if (value === '' || value === null || value === undefined) return '';
    if (type === 'number') return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return value;
  }, [value, type]);

  const handleChange = (e) => {
    let rawValue = e.target.value;
    if (type === 'number') {
        rawValue = rawValue.replace(/,/g, '');
        if (rawValue === '' || rawValue === '-') { onChange(rawValue); return; }
        if (!isNaN(rawValue)) { onChange(rawValue); }
    } else {
        onChange(rawValue);
    }
  };

  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-bold text-slate-800 mb-1.5">{label}{required && <span className="text-red-600 ml-1">*</span>}</label>}
      <div className="relative rounded-md shadow-sm">
        {prefix && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-600 font-bold sm:text-sm">{prefix}</span></div>}
        <input type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : 'text'} className={`block w-full rounded-lg py-2.5 ${prefix ? 'pl-8' : 'pl-3'} pr-3 text-black placeholder:text-slate-400 focus:ring-2 focus:ring-blue-800 focus:border-blue-800 sm:text-sm border-2 border-slate-400 font-bold shadow-sm transition-colors`} placeholder={placeholder} value={displayValue} onChange={handleChange} />
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
        <input type="text" className={`block w-full rounded-lg py-2.5 pl-3 pr-10 text-black border-2 border-slate-300 font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-800 focus:border-blue-800 sm:text-sm shadow-sm transition-colors ${disabled ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-white'}`} placeholder={placeholder} value={value} onChange={e => {onChange(e.target.value); setOpen(true);}} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} disabled={disabled} />
        {!value && <ChevronDown className="w-5 h-5 absolute right-3 top-3 text-slate-500 pointer-events-none" />}
        {value && <X className="w-5 h-5 absolute right-3 top-3 text-slate-500 cursor-pointer hover:text-red-600 transition-colors" onClick={() => onChange('')} />}
      </div>
      {open && filtered.length > 0 && !disabled && (
        <ul className="absolute z-30 w-full mt-1 max-h-60 overflow-y-auto bg-white border-2 border-slate-200 rounded-lg shadow-xl ring-1 ring-black/10">
          {filtered.map((opt, i) => <li key={i} className="px-4 py-2.5 text-sm text-slate-900 hover:bg-blue-100 cursor-pointer font-bold border-b border-slate-100 last:border-0" onMouseDown={() => onChange(opt)}>{opt}</li>)}
        </ul>
      )}
    </div>
  );
};

// 新增：簡易列表管理組件 (用於設定顏色)
const SimpleListManager = ({ title, items, onAdd, onDelete }) => {
    const [newItem, setNewItem] = useState('');
    return (
        <div className="border-2 border-slate-200 rounded-xl bg-slate-50 p-4">
            <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">{title}</h4>
            <div className="flex gap-2 mb-3">
                <input 
                    value={newItem} 
                    onChange={e => setNewItem(e.target.value)} 
                    placeholder="輸入新選項..." 
                    className="flex-1 text-xs p-2 border-2 border-slate-300 rounded-lg font-bold"
                    onKeyDown={e => e.key === 'Enter' && newItem && (onAdd(newItem), setNewItem(''))}
                />
                <button onClick={() => {if(newItem) { onAdd(newItem); setNewItem(''); }}} className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-xs shadow hover:bg-blue-700">新增</button>
            </div>
            <div className="flex flex-wrap gap-2">
                {items.map((item, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-white border border-slate-300 px-2 py-1 rounded-md text-xs font-bold text-slate-700 shadow-sm">
                        {item}
                        <X className="w-3 h-3 text-slate-400 hover:text-red-500 cursor-pointer" onClick={() => onDelete(item)}/>
                    </span>
                ))}
            </div>
        </div>
    );
};

const ConfirmationModal = ({ config, onClose }) => {
    if (!config) return null;
    const { title, message, onConfirm, type } = config;
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full animate-in fade-in zoom-in-95 shadow-2xl border-0 ring-1 ring-white/20">
          <div className={`p-5 border-b-2 ${type === 'danger' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}><h3 className="font-black flex gap-2 items-center text-xl"><AlertTriangle className="w-6 h-6" />{title}</h3></div>
          <div className="p-6 text-base text-slate-900 font-bold leading-relaxed">{message}</div>
          <div className="flex justify-end gap-3 p-5 border-t-2 border-slate-200 bg-gray-50">
            <button onClick={onClose} className="px-5 py-2.5 bg-white border-2 border-slate-300 text-slate-800 rounded-xl hover:bg-slate-100 font-bold shadow-sm transition-all">取消</button>
            <button onClick={onConfirm} className={`px-5 py-2.5 text-white rounded-xl shadow-lg font-bold transition-all transform active:scale-95 ${type === 'danger' ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}>確認</button>
          </div>
        </Card>
      </div>
    );
};

const ImagePreviewModal = ({ file, onClose }) => {
    if (!file) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition"><X className="w-10 h-10" /></button>
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

const PaymentModal = ({ historyItem, onClose, onSave }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);

    const existingPayments = historyItem.payments || [];
    const totalPaid = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = historyItem.results.totalCost - totalPaid;

    const startEdit = (index) => {
        const p = existingPayments[index];
        setAmount(p.amount);
        setDate(p.date);
        setNote(p.note || '');
        setEditingIndex(index);
    };

    const cancelEdit = () => {
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setNote('');
        setEditingIndex(null);
    };

    const handleSave = () => {
        if (!amount || isNaN(parseFloat(amount))) return alert('請輸入有效金額');
        const paymentData = { amount: parseFloat(amount), date, note, createdAt: Date.now() };
        let newPaymentList;
        if (editingIndex !== null) {
            newPaymentList = [...existingPayments];
            newPaymentList[editingIndex] = paymentData;
        } else {
            newPaymentList = [...existingPayments, paymentData];
        }
        onSave(newPaymentList);
        cancelEdit(); 
    };

    const handleDelete = (index) => {
        if (!window.confirm("確定要刪除這筆付款紀錄嗎？")) return;
        const newPaymentList = existingPayments.filter((_, i) => i !== index);
        onSave(newPaymentList);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <Card className="max-w-md w-full animate-in zoom-in-95 shadow-2xl border-0 ring-1 ring-white/20">
                <div className="p-5 border-b-2 border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black flex gap-2 items-center text-xl text-slate-800">
                        <CreditCard className="w-6 h-6 text-green-600"/> 付款管理
                    </h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex justify-between mb-1"><span className="text-slate-500 font-bold">總金額</span><span className="font-black text-slate-800">${new Intl.NumberFormat().format(historyItem.results.totalCost)}</span></div>
                        <div className="flex justify-between mb-1"><span className="text-green-600 font-bold">已付總額</span><span className="font-black text-green-600">${new Intl.NumberFormat().format(totalPaid)}</span></div>
                        <div className="flex justify-between border-t border-blue-200 pt-2 mt-2"><span className="text-red-600 font-bold text-lg">尚欠餘額</span><span className="font-black text-red-600 text-lg">${new Intl.NumberFormat().format(balance)}</span></div>
                    </div>
                    <div className={`space-y-3 pt-2 border-t-2 ${editingIndex !== null ? 'border-orange-200 bg-orange-50/50 -mx-6 px-6 py-4' : 'border-slate-100'}`}>
                        <div className="flex justify-between items-center">
                            <h4 className={`font-bold text-sm uppercase ${editingIndex !== null ? 'text-orange-600' : 'text-slate-700'}`}>
                                {editingIndex !== null ? '編輯付款' : '新增付款'}
                            </h4>
                            {editingIndex !== null && <button onClick={cancelEdit} className="text-xs text-slate-500 underline hover:text-slate-800">取消編輯</button>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 border-2 border-slate-300 rounded-lg font-bold text-slate-700 text-sm" />
                             <input type="number" placeholder="金額" value={amount} onChange={e => setAmount(e.target.value)} className="p-2 border-2 border-slate-300 rounded-lg font-bold text-slate-700 text-sm" />
                        </div>
                        <input type="text" placeholder="備註 (e.g. 訂金)" value={note} onChange={e => setNote(e.target.value)} className="w-full p-2 border-2 border-slate-300 rounded-lg font-bold text-slate-700 text-sm" />
                        <button onClick={handleSave} className={`w-full text-white py-2 rounded-lg font-bold shadow-md transition ${editingIndex !== null ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
                            {editingIndex !== null ? '更新紀錄' : '確認付款'}
                        </button>
                    </div>
                    {existingPayments.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-bold text-slate-700 text-sm uppercase mb-2">付款紀錄</h4>
                            <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2 bg-slate-50">
                                {existingPayments.map((p, idx) => (
                                    <div key={idx} className={`flex justify-between items-center text-xs font-bold border-b last:border-0 pb-2 mb-2 border-slate-200 ${editingIndex === idx ? 'bg-orange-100 p-2 rounded border-0' : ''}`}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-slate-500">{p.date}</span>
                                            <span className="text-slate-700">{p.note || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-green-600 text-sm">${new Intl.NumberFormat().format(p.amount)}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEdit(idx)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition" title="編輯"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="刪除"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

// --- REPORT COMPONENT (IFRAME STRATEGY) ---
const PrintableReport = ({ data, onClose, logo, title = "車輛成本估價單" }) => {
    const { details, vals, fees, results, country, date, attachments, payments } = data;
    const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);
    const fmtLocal = (n) => {
        const symbol = COUNTRIES[country]?.symbol || '';
        const val = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0);
        return `${symbol}${val}`;
    };

    const handlePrint = () => {
        const content = document.getElementById('printable-report-content').innerHTML;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>${title}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                    body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4 portrait; margin: 0; }
                    .a4-container { width: 210mm; min-height: 297mm; padding: 10mm 15mm; margin: 0 auto; background: white; display: flex; flex-direction: column; justify-content: space-between; }
                    .no-print { display: none !important; }
                </style>
            </head>
            <body>
                <div class="a4-container">
                    ${content}
                </div>
            </body>
            <script>
                window.onload = () => { setTimeout(() => { window.print(); }, 800); };
            </script>
            </html>
        `);
        doc.close();
        setTimeout(() => document.body.removeChild(iframe), 3000);
    };

    const hkMiscFees = fees.hk_misc || {};
    const hkLicenseFees = fees.hk_license || {};
    const safeHkMiscTotal = results.hkMiscTotal !== undefined ? results.hkMiscTotal : Object.values(hkMiscFees).reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0);
    const safeHkLicenseTotal = results.hkLicenseTotal !== undefined ? results.hkLicenseTotal : (Object.values(hkLicenseFees).reduce((acc, curr) => acc + (parseFloat(curr.val) || 0), 0) + (results.frt || 0));

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex justify-center overflow-auto p-4 md:p-8">
            <div className="relative w-full max-w-[210mm] min-h-[297mm] my-8 bg-white shadow-2xl origin-top transform transition-transform scale-100">
                <div id="printable-report-content" className="p-10 text-slate-900 h-full flex flex-col font-sans min-h-[297mm] bg-white">
                    <div className="flex justify-between items-end border-b-4 border-slate-900 pb-3 mb-4">
                        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{title}</h1><p className="text-sm text-slate-700 font-bold">日期: {date}</p></div>
                        <div className="text-right">
                             {logo ? <img src={logo} alt="Company Logo" className="h-20 object-contain mb-1 ml-auto" /> : <h2 className="text-xl font-black text-blue-900 flex items-center justify-end gap-2">HK Car Dealer</h2>}
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Internal Use Only</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2 border-l-4 border-blue-700 pl-2">車輛資料</h3>
                        <div className="grid grid-cols-4 gap-y-2 gap-x-4 text-xs bg-slate-100 p-4 rounded-xl border-2 border-slate-300">
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">品牌</span> <span className="font-bold text-sm text-black">{details.manufacturer}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">型號</span> <span className="font-bold text-sm text-black">{details.model}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">年份</span> <span className="font-bold text-sm text-black">{details.year}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">代號</span> <span className="font-bold text-sm text-black">{details.code}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">排氣量</span> <span className="font-bold text-black">{details.engineCapacity ? `${details.engineCapacity} cc` : '-'}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">座位</span> <span className="font-bold text-black">{details.seats || '-'}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">波箱</span> <span className="font-bold text-black">{details.transmission || '-'}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">外觀顏色</span> <span className="font-bold text-black">{details.exteriorColor || '-'}</span></div>
                            <div><span className="text-slate-600 block text-[10px] font-bold uppercase mb-0.5">內飾顏色</span> <span className="font-bold text-black">{details.interiorColor || '-'}</span></div>
                            <div className="col-span-3 border-t-2 border-slate-300 pt-2 mt-1 flex items-center gap-2"><span className="text-slate-600 text-[10px] font-bold uppercase">車身號碼:</span> <span className="font-mono font-black text-sm text-black">{details.chassisNo || '-'}</span></div>
                        </div>
                    </div>

                    {title === "車輛成本估價單" ? (
                        <>
                            <div className="mb-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2 border-l-4 border-blue-700 pl-2">核心成本</h3>
                                <table className="w-full text-xs border-2 border-slate-300 rounded-lg overflow-hidden">
                                    <thead className="bg-slate-200 text-slate-900">
                                        <tr>
                                            <th className="text-left py-1 px-2 font-black border-b-2 border-slate-400">項目</th>
                                            <th className="text-right py-1 px-2 font-black border-b-2 border-slate-400">金額 ({COUNTRIES[country].currency})</th>
                                            <th className="text-right py-1 px-2 font-black border-b-2 border-slate-400">匯率</th>
                                            <th className="text-right py-1 px-2 font-black border-b-2 border-slate-400 bg-blue-100">港幣 (HKD)</th>
                                        </tr>
                                    </thead>
                                    <tbody className='divide-y divide-slate-300'>
                                        <tr>
                                            <td className="py-1 px-2 font-bold text-slate-900">當地車價</td>
                                            <td className="text-right px-2 font-mono font-bold">{fmtLocal(vals.carPrice)}</td>
                                            <td className="text-right px-2 font-mono font-bold">{vals.rate}</td>
                                            <td className="text-right px-2 font-black text-black bg-blue-50/50">{fmt(results.carPriceHKD)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 px-2 font-bold text-slate-900">當地雜費 <span className='text-[10px] font-normal text-slate-600 ml-1'>({Object.values(fees.origin).map(f => f.label).join('/')})</span></td>
                                            <td className="text-right px-2 text-slate-500 font-bold">-</td>
                                            <td className="text-right px-2 text-slate-500 font-bold">-</td>
                                            <td className="text-right px-2 font-black text-black bg-blue-50/50">{fmt(results.originTotalHKD)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="grid grid-cols-2 gap-6 mb-4 flex-grow-0">
                                <div className="border border-slate-300 rounded p-2">
                                    <h4 className="font-black text-slate-900 border-b border-slate-300 pb-1 mb-1 text-[10px] uppercase">香港雜費</h4>
                                    <ul className="text-[10px] space-y-0.5">
                                        {Object.entries(hkMiscFees).map(([k, v]) => (
                                            <li key={k} className="flex justify-between items-center"><span className="text-slate-600 font-bold">{v.label}</span><span className="font-mono text-black">{fmt(v.val)}</span></li>
                                        ))}
                                        <li className="flex justify-between items-center font-black border-t border-slate-900 pt-1 mt-1 bg-slate-100 p-1 rounded"><span>小計</span><span>{fmt(safeHkMiscTotal)}</span></li>
                                    </ul>
                                </div>
                                <div className="border border-slate-300 rounded p-2">
                                    <h4 className="font-black text-slate-900 border-b border-slate-300 pb-1 mb-1 text-[10px] uppercase">出牌費用</h4>
                                    <ul className="text-[10px] space-y-0.5">
                                        {Object.entries(hkLicenseFees).map(([k, v]) => (
                                            <li key={k} className="flex justify-between items-center"><span className="text-slate-600 font-bold">{v.label}</span><span className="font-mono text-black">{fmt(v.val)}</span></li>
                                        ))}
                                        <li className="flex justify-between items-center bg-orange-50 -mx-1 px-1 rounded border border-orange-100"><span className="text-orange-900 font-bold">首次登記稅 (A1)</span><span className="font-mono font-black text-orange-800">{fmt(results.frt)}</span></li>
                                        <li className="text-[10px] text-slate-500 text-right -mt-1 mb-1 font-bold">(PRP: ${new Intl.NumberFormat('en-US').format(vals.prp)})</li>
                                        <li className="flex justify-between items-center font-black border-t border-slate-900 pt-1 mt-1 bg-slate-100 p-1 rounded"><span>小計 (含稅)</span><span>{fmt(safeHkLicenseTotal)}</span></li>
                                    </ul>
                                </div>
                            </div>
                            {attachments && attachments.length > 0 && (
                                <div className="mb-4 flex-grow-0">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">附件</h3>
                                    <div className="grid grid-cols-5 gap-2">
                                        {attachments.slice(0, 5).map((file, idx) => (
                                            <div key={idx} className="border-2 border-slate-200 rounded p-1 flex flex-col items-center bg-slate-50 h-20 overflow-hidden">
                                                {file.type.startsWith('image/') ? <img src={file.data} className="w-full h-full object-cover rounded-sm" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><FileText className="w-6 h-6" /></div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mt-auto border-t-4 border-slate-800 pt-3">
                                <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg border border-slate-300">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">車輛到港成本</span>
                                        <span className="text-xl font-black text-slate-800 leading-tight">{fmt(results.landedCost)}</span>
                                    </div>
                                    <div className="h-8 w-px bg-slate-300 mx-4"></div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[10px] font-bold text-blue-600 uppercase">預計總成本 (Total)</span>
                                        <span className="text-3xl font-black text-blue-800 leading-tight">{fmt(results.totalCost)}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-8 flex-grow">
                                <h3 className="text-sm font-black uppercase tracking-wider mb-4 text-slate-500">付款紀錄</h3>
                                <table className="w-full text-sm border-2 border-slate-300">
                                    <thead className="bg-slate-200">
                                        <tr>
                                            <th className="p-3 text-left font-black">日期</th>
                                            <th className="p-3 text-left font-black">備註</th>
                                            <th className="p-3 text-right font-black">金額 (HKD)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map((p, i) => (
                                            <tr key={i} className="border-b border-slate-200">
                                                <td className="p-3 font-bold">{p.date}</td>
                                                <td className="p-3 font-bold">{p.note}</td>
                                                <td className="p-3 text-right font-mono font-bold">{fmt(p.amount)}</td>
                                            </tr>
                                        ))}
                                        {payments.length === 0 && <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">暫無付款紀錄</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end mb-12">
                                <div className="w-1/2 space-y-2">
                                    <div className="flex justify-between text-slate-600 font-bold"><span>車價總額</span><span>{fmt(results.totalCost)}</span></div>
                                    <div className="flex justify-between text-green-700 font-bold"><span>已付總額</span><span>{fmt(payments.reduce((acc, p) => acc + (p.amount || 0), 0))}</span></div>
                                    <div className="flex justify-between text-xl font-black text-slate-900 border-t-4 border-slate-900 pt-2"><span>尚欠餘額</span><span>{fmt(results.totalCost - payments.reduce((acc, p) => acc + (p.amount || 0), 0))}</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-12 mt-auto pt-12 border-t-2 border-slate-200">
                                <div><div className="h-20 border-b-2 border-slate-400 mb-2"></div><p className="text-center font-bold text-slate-600">金田汽車簽署及蓋印</p></div>
                                <div><div className="h-20 border-b-2 border-slate-400 mb-2"></div><p className="text-center font-bold text-slate-600">客戶簽署確認</p></div>
                            </div>
                        </>
                    )}
                    <div className="text-center text-[9px] text-slate-400 mt-2 font-bold uppercase">
                         © {new Date().getFullYear()} Gold Land Auto | Official Document
                    </div>
                </div>
                <div className="absolute top-4 right-4 flex gap-2 no-print">
                     <button onClick={handlePrint} className="bg-blue-700 text-white px-5 py-2 rounded-full shadow-xl hover:bg-blue-800 flex items-center gap-2 font-bold transition transform hover:scale-105 active:scale-95 border-2 border-blue-900"><Printer className="w-5 h-5" /> 列印 / PDF</button>
                     <button onClick={onClose} className="bg-white text-slate-900 border-2 border-slate-400 px-5 py-2 rounded-full shadow-xl hover:bg-slate-100 flex items-center gap-2 font-bold transition transform hover:scale-105 active:scale-95"><ArrowLeft className="w-5 h-5" /> 返回計算器</button>
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
  
  // NEW STATES
  const [sysOptions, setSysOptions] = useState(DEFAULT_OPTIONS); // 顏色選項狀態
  const [reportData, setReportData] = useState(null);
  const [reportTitle, setReportTitle] = useState("車輛成本估價單");
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [hoveredFile, setHoveredFile] = useState(null);

  const [carPrice, setCarPrice] = useState('');
  const [prp, setPrp] = useState('');
  const [currOriginFees, setCurrOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currHkMiscFees, setCurrHkMiscFees] = useState(DEFAULT_FEES['JP'].hk_misc);
  const [currHkLicenseFees, setCurrHkLicenseFees] = useState(DEFAULT_FEES['JP'].hk_license);
  const [details, setDetails] = useState({ manufacturer: '', model: '', year: '', code: '', chassisNo: '', seats: '', transmission: 'AT', engineCapacity: '', exteriorColor: '', interiorColor: '' });
  const [attachments, setAttachments] = useState([]);
  const [newManufacturer, setNewManufacturer] = useState('');
  const [editingMfr, setEditingMfr] = useState(null);
  const [newModel, setNewModel] = useState({ id: '', years: '', codes: '' });

  const showMsg = (msg, type = 'success') => { setSaveMsg({ msg, type }); setTimeout(() => setSaveMsg(null), 3000); };

  // Init
  useEffect(() => {
      const init = async () => {
          try {
              const app = initializeApp(MANUAL_FIREBASE_CONFIG);
              const auth = getAuth(app);
              let firestore;
              try { firestore = initializeFirestore(app, { experimentalForceLongPolling: true, localCache: memoryLocalCache() }); } catch (e) { firestore = getFirestore(app); }
              await setPersistence(auth, inMemoryPersistence);
              await signInAnonymously(auth);
              onAuthStateChanged(auth, (user) => { if (user) { setUserId(user.uid); setDb(firestore); } setIsReady(true); });
          } catch (e) { console.error(e); setIsReady(true); }
      };
      init();
  }, []);

  const getSettingsRef = useCallback(() => db && dataKey ? doc(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/settings/config`) : null, [db, dataKey]);
  const getHistoryRef = useCallback(() => db && dataKey ? collection(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/history`) : null, [db, dataKey]);

  // Syncs
  useEffect(() => {
      const ref = getSettingsRef(); if (!ref) return;
      const unsub = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const d = snap.data();
              let loadedFees = d.fees;
              if (loadedFees && loadedFees.UK && loadedFees.UK.origin && loadedFees.UK.origin.auctionFee) {
                   loadedFees = { ...loadedFees, UK: DEFAULT_FEES.UK, OT: DEFAULT_FEES.OT };
                   setDoc(ref, { fees: loadedFees }, { merge: true });
              }
              if(d.rates) setRates(d.rates);
              setFees(loadedFees || DEFAULT_FEES);
              if(d.inventory) setInventory(d.inventory);
              if(d.appConfig) setAppConfig(d.appConfig);
              if(d.sysOptions) setSysOptions(d.sysOptions); // 同步選項
          } else { 
              setDoc(ref, { rates: DEFAULT_RATES, fees: DEFAULT_FEES, inventory: DEFAULT_INVENTORY, appConfig: DEFAULT_CONFIG, sysOptions: DEFAULT_OPTIONS }, { merge: true }); 
          }
      });
      return () => unsub();
  }, [db, dataKey, getSettingsRef]);

  useEffect(() => {
      const ref = getHistoryRef(); if (!ref) return;
      const q = query(ref); 
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
          setHistory(list);
      });
      return () => unsub();
  }, [db, dataKey, getHistoryRef]);

  useEffect(() => {
      if (fees[country]) { setCurrOriginFees(fees[country].origin); setCurrHkMiscFees(fees[country].hk_misc); setCurrHkLicenseFees(fees[country].hk_license); setCarPrice(''); setPrp(''); setAttachments([]); }
  }, [country, fees]);
  
  useEffect(() => {
      if (details.engineCapacity) {
          const fee = getLicenseFeeByCC(details.engineCapacity);
          setCurrHkLicenseFees(prev => ({ ...prev, licenseFee: { ...prev.licenseFee, val: fee.toString() } }));
      }
  }, [details.engineCapacity]);

  useEffect(() => {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      if (appConfig.logo) { link.href = appConfig.logo; } else { link.href = 'data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVQI12NgATMg38GAA8Zh6wQWiQAyMwEASUkEFTUAAAAASUVORK5CYII='; }
  }, [appConfig.logo]);

  // Handlers
  const handleKeyChange = () => { if (tempKey.trim()) { const newKey = tempKey.trim(); setDataKey(newKey); try { localStorage.setItem('hk_car_dealer_key', newKey); } catch (e) {} setIsKeyEditing(false); showMsg(`已切換至: ${newKey}`); } };
  
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files); 
    const currentCount = attachments.length; 
    const maxFiles = appConfig.maxFiles || 5; 
    const maxSizeKB = appConfig.maxFileSizeKB || 5000;

    if (currentCount + files.length > maxFiles) return showMsg(`最多 ${maxFiles} 個文件`, 'error');
    
    const newAttachments = [];
    for (const file of files) {
        if (file.size > maxSizeKB * 1024) { showMsg(`${file.name} 過大`, 'error'); continue; }
        try { 
            let base64;
            if (file.type.startsWith('image/')) {
                base64 = await compressImage(file, 1024, 0.5); 
            } else {
                base64 = await fileToBase64(file);
            }
            newAttachments.push({ name: file.name, type: file.type, size: file.size, data: base64 }); 
        } catch (error) { console.error(error); }
    }
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = null; 
  };

  const removeAttachment = (index) => setAttachments(prev => prev.filter((_, i) => i !== index));
  const handleRateChange = (cid, val) => setRates(p => ({...p, [cid]: val}));
  const handleFeeChange = (cid, category, key, val) => { setFees(prev => ({ ...prev, [cid]: { ...prev[cid], [category]: { ...prev[cid][category], [key]: { ...prev[cid][category][key], val } } } })); };
  const handleLogoUpload = async (e) => { const file = e.target.files[0]; if(!file) return; try { const base64 = await fileToBase64(file); setAppConfig(prev => ({ ...prev, logo: base64 })); saveConfig({ appConfig: { ...appConfig, logo: base64 } }); showMsg("Logo 更新"); } catch(e) {} };
  const removeLogo = () => { setAppConfig(prev => ({ ...prev, logo: null })); saveConfig({ appConfig: { ...appConfig, logo: null } }); };

  // --- Inventory Functions ---
  const addMfr = () => { if (!newManufacturer.trim()) return; if (inventory[newManufacturer]) return showMsg("品牌已存在", "error"); setInventory(prev => ({ ...prev, [newManufacturer]: { models: [] } })); setNewManufacturer(''); showMsg("品牌已新增"); };
  const deleteMfr = (mfr) => { setInventory(prev => { const next = { ...prev }; delete next[mfr]; return next; }); showMsg("品牌已刪除"); };
  const addModel = (mfr) => { if (!newModel.id) return; const years = newModel.years.split(/[,，]/).map(y => y.trim()).filter(Boolean); const codes = newModel.codes.split(/[,，]/).map(c => c.trim()).filter(Boolean); setInventory(prev => { const mfrData = prev[mfr] || { models: [] }; const updatedModels = [...(mfrData.models || []), { id: newModel.id, years, codes }]; return { ...prev, [mfr]: { ...mfrData, models: updatedModels } }; }); setNewModel({ id: '', years: '', codes: '' }); showMsg("型號已新增"); };
  const deleteModel = (mfr, modelId) => { setInventory(prev => { const mfrData = prev[mfr]; if (!mfrData) return prev; const updatedModels = mfrData.models.filter(m => m.id !== modelId); return { ...prev, [mfr]: { ...mfrData, models: updatedModels } }; }); showMsg("型號已刪除"); };
  
  // --- Options Management (Colors) ---
  const handleAddOption = (type, val) => {
     if(!val.trim()) return;
     setSysOptions(prev => ({...prev, [type]: [...(prev[type]||[]), val.trim()]}));
  };
  const handleDeleteOption = (type, val) => {
     setSysOptions(prev => ({...prev, [type]: (prev[type]||[]).filter(x => x !== val)}));
  };

  // Calculations
  const rate = rates[country] || 0;
  const carPriceHKD = (parseFloat(carPrice) || 0) * rate;
  const frt = calculateFRT(prp); 
  let originTotal = 0; Object.values(currOriginFees || {}).forEach(v => originTotal += (parseFloat(v.val) || 0)); const originTotalHKD = originTotal * rate;
  let hkMiscTotal = 0; Object.values(currHkMiscFees || {}).forEach(v => hkMiscTotal += (parseFloat(v.val) || 0));
  let hkLicenseTotal = 0; Object.values(currHkLicenseFees || {}).forEach(v => hkLicenseTotal += (parseFloat(v.val) || 0));
  const totalLicenseCost = hkLicenseTotal + frt;
  const landedCost = carPriceHKD + originTotalHKD + hkMiscTotal + frt;
  const totalCost = landedCost + hkLicenseTotal;
  const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

  // Actions
  const saveConfig = async (overrides = {}) => {
      if (!db) return;
      // 修正：檢查 overrides 是否為瀏覽器事件物件，如果是則忽略
      const safeOverrides = (overrides && overrides.preventDefault) ? {} : overrides;
      // 加入 sysOptions 儲存
      const dataToSave = { rates, fees, inventory, appConfig, sysOptions, ...safeOverrides };
      try { 
          await setDoc(getSettingsRef(), dataToSave, { merge: false }); 
          showMsg("設定已儲存"); 
      } catch(e) { 
          console.error(e);
          showMsg("儲存失敗", "error"); 
      } 
  };

  const saveHistoryRecord = async () => {
      if (!db) return showMsg("未連接", "error");
      if (totalCost <= 0) return showMsg("金額無效", "error");
      const record = { ts: Date.now(), date: new Date().toLocaleString('zh-HK'), timestamp: serverTimestamp(), country, details, vals: { carPrice, prp, rate }, fees: { origin: currOriginFees, hk_misc: currHkMiscFees, hk_license: currHkLicenseFees }, results: { carPriceHKD, originTotalHKD, hkMiscTotal, hkLicenseTotal: totalLicenseCost, frt, landedCost, totalCost }, attachments, isLocked: false };
      if (JSON.stringify(record).length > 950000) return showMsg("記錄過大", "error");
      try { await addDoc(getHistoryRef(), record); showMsg("已記錄"); setTimeout(() => setActiveTab('history'), 500); } catch(e) { showMsg("失敗", "error"); }
  };
  const toggleLock = async (item) => { if (!db) return; try { await updateDoc(doc(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/history`, item.id), { isLocked: !item.isLocked }); } catch(e) {} };
  const deleteHistoryItem = (item) => { if (item.isLocked) return showMsg("已鎖定", "error"); setModal({ title: "刪除", message: "確定？", type: "danger", onConfirm: async () => { try { await deleteDoc(doc(getHistoryRef(), item.id)); setModal(null); showMsg("已刪除"); } catch(e) {} } }); };
  const loadHistoryItem = (item) => { setCountry(item.country); setCarPrice(item.vals.carPrice); setPrp(item.vals.prp); setDetails(item.details); setCurrOriginFees(item.fees.origin); setCurrHkMiscFees(item.fees.hk_misc); setCurrHkLicenseFees(item.fees.hk_license); setAttachments(item.attachments || []); setActiveTab('calculator'); showMsg("已載入"); };

  // Payment Logic
  const handlePaymentSave = async (newPaymentsList) => {
      if (!paymentModalData || !db) return;
      const item = paymentModalData.item;
      try {
          await updateDoc(doc(getHistoryRef(), item.id), { payments: newPaymentsList });
          setPaymentModalData(prev => ({ ...prev, item: { ...prev.item, payments: newPaymentsList } }));
          showMsg("付款紀錄已更新");
      } catch(e) { console.error(e); showMsg("付款儲存失敗", "error"); }
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
      setReportTitle("車輛成本估價單");
  };

  const handleShowReport = (item) => { setReportData(item); setReportTitle("車輛成本估價單"); };
  const handleShowReceipt = (item) => { setReportData(item); setReportTitle("正式收據 / Official Receipt"); };
  const closeReport = () => { if (activeTab === 'calculator' && reportData) { loadHistoryItem(reportData); } setReportData(null); };
  
  if (reportData) return <PrintableReport data={reportData} onClose={closeReport} logo={appConfig.logo} title={reportTitle} />;
  if (!isReady) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 font-sans">
      <ConfirmationModal config={modal} onClose={() => setModal(null)} />
      {previewImage && <ImagePreviewModal file={previewImage} onClose={() => setPreviewImage(null)} />}
      {paymentModalData && <PaymentModal historyItem={paymentModalData.item} onClose={() => setPaymentModalData(null)} onSave={handlePaymentSave} />}

      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-xl print:hidden border-b-4 border-blue-600">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 font-black text-2xl tracking-tight text-white">
                      {appConfig.logo ? <img src={appConfig.logo} className="h-10 w-auto rounded object-contain"/> : <Truck className="w-8 h-8 text-blue-400"/>}
                      HK入車系統
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
          {/* CALCULATOR TAB */}
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
                                  
                                  {/* 修正：顏色改為下拉選單 */}
                                  <AutocompleteInput label="外觀顏色" value={details.exteriorColor} onChange={v => setDetails(d => ({...d, exteriorColor:v}))} options={sysOptions.exteriorColors} placeholder="e.g. White" />
                                  <AutocompleteInput label="內飾顏色" value={details.interiorColor} onChange={v => setDetails(d => ({...d, interiorColor:v}))} options={sysOptions.interiorColors} placeholder="e.g. Black" />
                                  
                                  {/* 新增：波箱選項 */}
                                  <div className="mb-4">
                                      <label className="block text-sm font-bold text-slate-800 mb-1.5">波箱 (Transmission)</label>
                                      <div className="relative">
                                          <select value={details.transmission} onChange={e => setDetails(d => ({...d, transmission:e.target.value}))} className="block w-full rounded-lg py-2.5 pl-3 pr-10 text-black border-2 border-slate-300 font-bold focus:ring-2 focus:ring-blue-800 focus:border-blue-800 sm:text-sm shadow-sm transition-colors bg-white">
                                              <option value="AT">AT (自動)</option>
                                              <option value="MT">MT (手動)</option>
                                          </select>
                                          <ChevronDown className="w-5 h-5 absolute right-3 top-3 text-slate-500 pointer-events-none" />
                                      </div>
                                  </div>

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
                                              <div 
                                                key={idx} 
                                                // 修正：移除 overflow-hidden, 增加 z-index 管理
                                                className="relative group border-2 border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition cursor-pointer z-0 hover:z-10"
                                                onClick={() => file.type.startsWith('image/') && setPreviewImage(file)}
                                              >
                                                  <div className="flex items-center gap-3">
                                                      {file.type.startsWith('image/') ? (
                                                          <>
                                                              {/* 修正：僅將滑鼠事件綁定在縮圖上 */}
                                                              <img 
                                                                src={file.data} 
                                                                className="w-12 h-12 object-cover rounded-lg bg-slate-100 border border-slate-200 hover:ring-2 hover:ring-blue-400" 
                                                                onMouseEnter={() => setHoveredFile(idx)}
                                                                onMouseLeave={() => setHoveredFile(null)}
                                                              />
                                                              {/* Hover Zoom Popover */}
                                                              {hoveredFile === idx && (
                                                                  <div className="fixed z-[9999] pointer-events-none drop-shadow-2xl" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                                                      <img src={file.data} className="max-w-[80vw] max-h-[80vh] object-contain rounded-lg border-4 border-white bg-white shadow-2xl" />
                                                                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-lg backdrop-blur-sm">
                                                                          預覽模式 ({(file.size/1024).toFixed(0)} KB)
                                                                      </div>
                                                                  </div>
                                                              )}
                                                          </>
                                                      ) : (
                                                          <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400"><FileText className="w-8 h-8"/></div>
                                                      )}
                                                      <div className="flex-1 min-w-0">
                                                          <div className="truncate text-xs font-bold text-slate-700">{file.name}</div>
                                                          <div className="text-[10px] text-slate-400 font-bold">{(file.size/1024).toFixed(0)}KB</div>
                                                      </div>
                                                  </div>
                                                  
                                                  {/* Overlay Actions */}
                                                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center gap-3 rounded-xl backdrop-blur-[1px]">
                                                      <button className="text-white hover:text-blue-200 transform hover:scale-110 transition" title="預覽"><Eye className="w-5 h-5"/></button>
                                                      {file.type.startsWith('image/') && (
                                                          <a href={file.data} download={file.name} className="text-white hover:text-green-300 transform hover:scale-110 transition" onClick={(e) => e.stopPropagation()} title="下載"><Download className="w-5 h-5"/></a>
                                                      )}
                                                      <button onClick={(e) => {e.stopPropagation(); removeAttachment(idx)}} className="text-white hover:text-red-400 transform hover:scale-110 transition" title="刪除"><Trash2 className="w-5 h-5"/></button>
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
                          <Card className="p-6 border-l-8 border-orange-500"><SectionHeader icon={FileText} title="香港出牌費用" color="text-orange-700" /><div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">{Object.entries(currHkLicenseFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkLicenseFees(p => ({...p, [k]: {...p[k], val}}))} prefix="$" />))}</div><div className="flex justify-between items-center bg-orange-50 p-4 rounded-lg mb-2"><span className="text-sm font-bold text-slate-700">首次登記稅 (FRT)</span><span className="font-black text-orange-700 text-xl">{fmt(frt)}</span></div><div className="flex justify-between items-center px-2"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">小計 (含稅)</span><span className="font-black text-slate-800 text-xl">{fmt(totalLicenseCost)}</span></div></Card>
                      </div>
                  </div>

                  <div className="sticky bottom-4 bg-slate-900/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col gap-3 z-10 border-t border-slate-700">
                      <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                          <span className="text-xs sm:text-base text-slate-400 font-bold">車輛到港成本 <span className="text-[10px] sm:text-xs font-normal text-slate-500 ml-1">(含A1稅)</span></span>
                          <span className="text-lg sm:text-2xl font-bold tracking-tight">{fmt(landedCost)}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3">
                          <div className="text-center sm:text-left">
                            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5">預計總成本 (Total)</div>
                            <div className="text-3xl sm:text-4xl font-black leading-none text-green-400 tracking-tighter shadow-black drop-shadow-sm">{fmt(totalCost)}</div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                              <button onClick={generateCurrentReport} disabled={totalCost<=0} className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-500 px-3 sm:px-4 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-1 text-xs sm:text-sm shadow-lg transition transform active:scale-95 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"><Printer className="w-4 h-4"/> 報告</button>
                              <button onClick={saveHistoryRecord} disabled={totalCost<=0 || !db} className="flex-1 sm:flex-none justify-center bg-green-600 hover:bg-green-500 px-4 sm:px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-1 text-xs sm:text-sm shadow-lg transition transform active:scale-95 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"><PlusCircle className="w-4 h-4"/> 記錄</button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* HISTORY TAB */}
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
                                      {item.payments && item.payments.length > 0 && <div className="mt-2 text-xs font-bold text-green-600">已付: ${new Intl.NumberFormat().format(item.payments.reduce((a,b)=>a+(b.amount||0),0))}</div>}
                                  </div>
                                  <div className="flex gap-2">
                                      {item.isLocked && <button onClick={() => setPaymentModalData({ item })} className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition" title="付款"><CreditCard className="w-5 h-5"/></button>}
                                      {(item.payments && item.payments.length > 0) && <button onClick={() => handleShowReceipt(item)} className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition" title="收據"><FileSignature className="w-5 h-5"/></button>}
                                      <button onClick={() => handleShowReport(item)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition" title="列印"><Printer className="w-5 h-5"/></button>
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

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-300 space-y-8">
                   <Card className="p-6 border-l-8 border-l-blue-600">
                       <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">當前資料帳號</div>
                       <div className="font-mono text-2xl font-black text-blue-900 bg-blue-50 p-4 rounded-xl border border-blue-100">{dataKey}</div>
                   </Card>
                   
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

                   {/* 新增：選項設定 */}
                   <Card className="p-6 border-l-8 border-yellow-500">
                       <SectionHeader icon={Palette} title="選項設定" color="text-yellow-700" />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <SimpleListManager 
                                title="外觀顏色 (Exterior)" 
                                items={sysOptions.exteriorColors} 
                                onAdd={val => handleAddOption('exteriorColors', val)}
                                onDelete={val => handleDeleteOption('exteriorColors', val)}
                           />
                           <SimpleListManager 
                                title="內飾顏色 (Interior)" 
                                items={sysOptions.interiorColors} 
                                onAdd={val => handleAddOption('interiorColors', val)}
                                onDelete={val => handleDeleteOption('interiorColors', val)}
                           />
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
                   <div className="flex justify-end gap-4"><button onClick={() => {setModal({title: "重置設定", message: "確定重置？", type: "danger", onConfirm: () => {setRates(DEFAULT_RATES); setFees(DEFAULT_FEES); setInventory(DEFAULT_INVENTORY); setAppConfig(DEFAULT_CONFIG); setSysOptions(DEFAULT_OPTIONS); setModal(null); saveConfig();}});}} className="px-6 py-3 text-red-600 hover:bg-red-50 rounded-xl font-bold transition">重置為預設值</button><button onClick={saveConfig} className="px-8 py-3 bg-blue-600 text-white rounded-xl flex items-center gap-2 font-bold shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-0.5"><Save className="w-5 h-5"/> 儲存設定</button></div>
              </div>
          )}
      </div>
    </div>
  );
}
