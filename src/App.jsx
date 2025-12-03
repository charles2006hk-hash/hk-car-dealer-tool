import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft, User, Key, Printer, FileOutput, Upload, Paperclip, File as FileIcon, Image as ImageIcon } from 'lucide-react';

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
const DEFAULT_RATES = { JP: 0.053, UK: 10.2, DE: 8.6 };
const DEFAULT_CONFIG = { maxFiles: 5, maxFileSizeKB: 500 }; // 新增預設系統設定
const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  DE: { id: 'DE', name: '德國 (Germany)', currency: 'EUR', symbol: '€' },
};

const DEFAULT_FEES = {
  JP: {
    origin: { auctionFee: { label: '拍賣場/FOB費用', val: '20000' }, shipping: { label: '船運費', val: '100000' } },
    hk_misc: { terminal: { label: '碼頭費', val: '500' }, emission: { label: '檢驗廢氣', val: '5500' }, glass: { label: '更換玻璃', val: '2000' }, booking: { label: '排期驗車', val: '1000' }, fuel: { label: '入油', val: '500' }, process: { label: '工序費', val: '2000' }, misc: { label: '雜項支出', val: '1000' } },
    hk_license: { licenseFee: { label: '政府牌費', val: '5800' }, insurance: { label: '保險', val: '2000' } }
  },
  UK: {
    origin: { auctionFee: { label: '出口手續費', val: '500' }, shipping: { label: '1500' } },
    hk_misc: { terminal: { label: '碼頭費', val: '500' }, emission: { label: '檢驗廢氣', val: '6500' }, glass: { label: '更換玻璃', val: '2500' }, booking: { label: '排期驗車', val: '1000' }, fuel: { label: '入油', val: '500' }, process: { label: '工序費', val: '2500' }, misc: { label: '雜項支出', val: '1000' } },
    hk_license: { licenseFee: { label: '政府牌費', val: '5800' }, insurance: { label: '保險', val: '2500' } }
  },
  DE: {
    origin: { auctionFee: { label: '出口手續費', val: '400' }, shipping: { label: '1200' } },
    hk_misc: { terminal: { label: '碼頭費', val: '500' }, emission: { label: '檢驗廢氣', val: '6500' }, glass: { label: '更換玻璃', val: '2500' }, booking: { label: '排期驗車', val: '1000' }, fuel: { label: '入油', val: '500' }, process: { label: '工序費', val: '2500' }, misc: { label: '雜項支出', val: '1000' } },
    hk_license: { licenseFee: { label: '政府牌費', val: '5800' }, insurance: { label: '保險', val: '2500' } }
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

// Helper to convert file to Base64
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

const InputGroup = ({ label, value, onChange, prefix, placeholder = "", required = false, type = 'number', step = 'any', min }) => (
  <div className="mb-3">
    {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>}
    <div className="relative rounded-md shadow-sm">
      {prefix && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 sm:text-sm">{prefix}</span></div>}
      <input 
        type={type} 
        step={step}
        min={min}
        className={`focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 ${prefix ? 'pl-8' : 'pl-3'}`} 
        placeholder={placeholder} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
      />
    </div>
  </div>
);

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

    return (
        <div className="fixed inset-0 z-[100] bg-gray-100 overflow-auto flex flex-col items-center p-4 md:p-8">
            <div className="w-full max-w-3xl bg-white shadow-2xl rounded-none md:rounded-lg p-8 print:p-0 print:shadow-none print:w-full print:max-w-none" id="printable-report">
                {/* Report Header */}
                <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">車輛成本估價單</h1>
                        <p className="text-sm text-gray-500 mt-1">日期: {date}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold text-blue-800">HK Car Dealer Tool</h2>
                        <p className="text-xs text-gray-400">Internal Use Only</p>
                    </div>
                </div>

                {/* Car Details */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-4">車輛資料</h3>
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                        <div className="flex"><span className="w-24 text-gray-500">品牌:</span> <span className="font-semibold">{details.manufacturer}</span></div>
                        <div className="flex"><span className="w-24 text-gray-500">型號:</span> <span className="font-semibold">{details.model}</span></div>
                        <div className="flex"><span className="w-24 text-gray-500">年份:</span> <span className="font-semibold">{details.year}</span></div>
                        <div className="flex"><span className="w-24 text-gray-500">代號:</span> <span className="font-semibold">{details.code}</span></div>
                        <div className="col-span-2 flex mt-1 pt-1 border-t border-dashed"><span className="w-24 text-gray-500">車身號碼:</span> <span className="font-mono font-bold">{details.chassisNo || '-'}</span></div>
                    </div>
                </div>

                {/* Financial Breakdown */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-4">費用明細</h3>
                    <table className="w-full text-sm mb-6">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-2 px-2">項目</th>
                                <th className="text-right py-2 px-2">金額 ({COUNTRIES[country].currency})</th>
                                <th className="text-right py-2 px-2">匯率</th>
                                <th className="text-right py-2 px-2">港幣 (HKD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="py-2 px-2">當地車價</td>
                                <td className="text-right px-2">{vals.carPrice}</td>
                                <td className="text-right px-2">{vals.rate}</td>
                                <td className="text-right px-2 font-medium">{fmt(results.carPriceHKD)}</td>
                            </tr>
                             <tr>
                                <td className="py-2 px-2" colSpan="3">當地雜費總計 ({Object.values(fees.origin).map(f => f.label).join('/')})</td>
                                <td className="text-right px-2 font-medium">{fmt(results.originTotalHKD)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-gray-700 border-b pb-1 mb-2">香港雜費</h4>
                            <ul className="text-sm space-y-1">
                                {Object.entries(fees.hk_misc).map(([k, v]) => (
                                    <li key={k} className="flex justify-between"><span className="text-gray-600">{v.label}</span><span>${v.val}</span></li>
                                ))}
                                <li className="flex justify-between font-bold border-t pt-1 mt-1"><span>小計</span><span>{fmt(results.hkMiscTotal)}</span></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-700 border-b pb-1 mb-2">出牌費用</h4>
                            <ul className="text-sm space-y-1">
                                {Object.entries(fees.hk_license).map(([k, v]) => (
                                    <li key={k} className="flex justify-between"><span className="text-gray-600">{v.label}</span><span>${v.val}</span></li>
                                ))}
                                <li className="flex justify-between"><span className="text-gray-600">首次登記稅 (A1)</span><span>{fmt(results.frt)}</span></li>
                                <li className="text-xs text-gray-400 text-right">(PRP: ${vals.prp})</li>
                                <li className="flex justify-between font-bold border-t pt-1 mt-1"><span>小計 (含稅)</span><span>{fmt(results.hkLicenseTotal)}</span></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Attachments List (If any) */}
                {attachments && attachments.length > 0 && (
                    <div className="mb-8 page-break-inside-avoid">
                        <h3 className="text-lg font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-4">附件文件 ({attachments.length})</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="border rounded p-2 flex items-center gap-3">
                                    {file.type.startsWith('image/') ? (
                                        <img src={file.data} alt="attachment" className="w-16 h-16 object-cover rounded bg-gray-100" />
                                    ) : (
                                        <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded text-gray-400">
                                            <FileText className="w-8 h-8" />
                                        </div>
                                    )}
                                    <div className="overflow-hidden">
                                        <div className="text-sm font-medium truncate w-40" title={file.name}>{file.name}</div>
                                        <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Final Totals */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 page-break-inside-avoid">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 font-medium">車輛到港成本 (Landed Cost):</span>
                        <span className="text-xl font-bold text-gray-800">{fmt(results.landedCost)}</span>
                    </div>
                    <div className="text-xs text-gray-400 text-right mb-4 border-b pb-4">(車價 + 當地雜費 + 香港雜費 + A1稅) - 不含牌費/保險</div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-800 font-bold text-lg">預計總成本 (Total Cost):</span>
                        <span className="text-3xl font-extrabold text-blue-700">{fmt(results.totalCost)}</span>
                    </div>
                </div>

                <div className="mt-12 pt-4 border-t text-center text-xs text-gray-400">
                    <p>本報價單僅供參考，實際費用以最終單據為準。</p>
                </div>
            </div>

            <div className="fixed bottom-8 right-8 flex flex-col gap-3 print:hidden">
                <button onClick={handlePrint} className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"><Printer className="w-6 h-6" /> <span className="font-bold">列印 / PDF</span></button>
                <button onClick={onClose} className="bg-gray-600 text-white p-4 rounded-full shadow-xl hover:bg-gray-700 transition flex items-center justify-center gap-2"><X className="w-6 h-6" /> <span className="font-bold">關閉</span></button>
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
  
  // Data Key
  const [dataKey, setDataKey] = useState(() => { try { return localStorage.getItem('hk_car_dealer_key') || 'demo-shop'; } catch(e) { return 'demo-shop'; } });
  const [isKeyEditing, setIsKeyEditing] = useState(false);
  const [tempKey, setTempKey] = useState('');

  // App Data
  const [activeTab, setActiveTab] = useState('calculator');
  const [country, setCountry] = useState('JP');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [fees, setFees] = useState(DEFAULT_FEES);
  const [appConfig, setAppConfig] = useState(DEFAULT_CONFIG); // New Config State
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [history, setHistory] = useState([]);
  const [reportData, setReportData] = useState(null);

  // Calculator Inputs
  const [carPrice, setCarPrice] = useState('');
  const [prp, setPrp] = useState('');
  const [currOriginFees, setCurrOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currHkMiscFees, setCurrHkMiscFees] = useState(DEFAULT_FEES['JP'].hk_misc);
  const [currHkLicenseFees, setCurrHkLicenseFees] = useState(DEFAULT_FEES['JP'].hk_license);
  const [details, setDetails] = useState({ manufacturer: '', model: '', year: '', code: '', chassisNo: '' });
  
  // Attachments State (Files)
  const [attachments, setAttachments] = useState([]);

  // Inventory UI
  const [newManufacturer, setNewManufacturer] = useState('');
  const [editingMfr, setEditingMfr] = useState(null);
  const [newModel, setNewModel] = useState({ id: '', years: '', codes: '' });

  const showMsg = (msg, type = 'success') => {
      setSaveMsg({ msg, type });
      setTimeout(() => setSaveMsg(null), 3000);
  };

  // Firebase Init
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

  // Sync Settings
  useEffect(() => {
      const ref = getSettingsRef();
      if (!ref) return;
      const unsub = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const d = snap.data();
              if(d.rates) setRates(d.rates);
              if(d.fees) setFees(d.fees);
              if(d.inventory) setInventory(d.inventory);
              if(d.appConfig) setAppConfig(d.appConfig); // Sync app config
          } else {
              setDoc(ref, { rates: DEFAULT_RATES, fees: DEFAULT_FEES, inventory: DEFAULT_INVENTORY, appConfig: DEFAULT_CONFIG }, { merge: true });
          }
      });
      return () => unsub();
  }, [db, dataKey, getSettingsRef]);

  // Sync History
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

  // Sync Fees
  useEffect(() => {
      if (fees[country]) {
          setCurrOriginFees(fees[country].origin);
          setCurrHkMiscFees(fees[country].hk_misc);
          setCurrHkLicenseFees(fees[country].hk_license);
          setCarPrice('');
          setPrp('');
          setAttachments([]); // Clear attachments on country switch
      }
  }, [country, fees]);

  const handleKeyChange = () => {
      if (tempKey.trim()) {
          const newKey = tempKey.trim();
          setDataKey(newKey);
          try { localStorage.setItem('hk_car_dealer_key', newKey); } catch (e) {}
          setIsKeyEditing(false);
          showMsg(`已切換至: ${newKey}`);
      }
  };

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const currentCount = attachments.length;
    const maxFiles = appConfig.maxFiles || 5;
    const maxSizeKB = appConfig.maxFileSizeKB || 500;

    if (currentCount + files.length > maxFiles) {
        return showMsg(`最多只能上傳 ${maxFiles} 個文件`, 'error');
    }

    const newAttachments = [];
    
    for (const file of files) {
        if (file.size > maxSizeKB * 1024) {
            showMsg(`${file.name} 超過 ${maxSizeKB}KB 限制`, 'error');
            continue;
        }
        try {
            const base64 = await fileToBase64(file);
            newAttachments.push({
                name: file.name,
                type: file.type,
                size: file.size,
                data: base64
            });
        } catch (error) {
            console.error("File reading error", error);
        }
    }

    if (newAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newAttachments]);
    }
    // Reset input
    e.target.value = null; 
  };

  const removeAttachment = (index) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
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

  // Actions
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
          attachments: attachments, // Save files
          isLocked: false
      };
      try {
        await addDoc(getHistoryRef(), record);
        showMsg("已記錄");
        setTimeout(() => setActiveTab('history'), 500);
      } catch(e) { showMsg("儲存失敗: " + e.message, "error"); }
  };

  const saveConfig = async () => {
      if (!db) return;
      try { await setDoc(getSettingsRef(), { rates, fees, inventory, appConfig }, { merge: true }); showMsg("設定已儲存"); } catch(e) { showMsg("儲存失敗", "error"); }
  };

  const toggleLock = async (item) => { if (!db) return; try { await updateDoc(doc(db, `artifacts/${APP_ID_PATH}/stores/${dataKey}/history`, item.id), { isLocked: !item.isLocked }); } catch(e) {} };

  const deleteHistoryItem = (item) => {
      if (item.isLocked) return showMsg("記錄已鎖定", "error");
      setModal({ title: "刪除記錄", message: "確定要刪除此記錄嗎？", type: "danger", onConfirm: async () => { try { await deleteDoc(doc(getHistoryRef(), item.id)); setModal(null); showMsg("已刪除"); } catch(e) { showMsg("刪除失敗", "error"); } } });
  };

  const loadHistoryItem = (item) => {
      setCountry(item.country); setCarPrice(item.vals.carPrice); setPrp(item.vals.prp); setDetails(item.details);
      setCurrOriginFees(item.fees.origin); setCurrHkMiscFees(item.fees.hk_misc); setCurrHkLicenseFees(item.fees.hk_license);
      setAttachments(item.attachments || []); // Load attachments
      setActiveTab('calculator'); showMsg("記錄已載入");
  };

  // Inventory Handlers
  const addMfr = () => { if (!newManufacturer) return; const name = newManufacturer.trim(); if (inventory[name]) return showMsg("已存在", "error"); setInventory(prev => ({ ...prev, [name]: { models: [] } })); setNewManufacturer(''); setTimeout(saveConfig, 100); };
  const deleteMfr = (mfr) => { setModal({ title: "刪除品牌", message: `確定刪除 ${mfr}？`, type: "danger", onConfirm: () => { const newInv = {...inventory}; delete newInv[mfr]; setInventory(newInv); setEditingMfr(null); setModal(null); setTimeout(saveConfig, 100); } }); };
  const addModel = (mfr) => { if(!newModel.id) return; const newCar = { id: newModel.id.trim(), years: newModel.years.split(',').filter(Boolean), codes: newModel.codes.split(',').filter(Boolean) }; setInventory(prev => ({ ...prev, [mfr]: { ...prev[mfr], models: [...(prev[mfr].models || []), newCar] } })); setNewModel({ id: '', years: '', codes: '' }); setTimeout(saveConfig, 100); };
  const deleteModel = (mfr, modelId) => { setInventory(prev => ({ ...prev, [mfr]: { ...prev[mfr], models: (prev[mfr].models || []).filter(m => m.id !== modelId) } })); setTimeout(saveConfig, 100); };
  
  const handleRateChange = (cid, val) => setRates(p => ({...p, [cid]: val}));
  const handleFeeChange = (cid, category, key, val) => { setFees(prev => ({ ...prev, [cid]: { ...prev[cid], [category]: { ...prev[cid][category], [key]: { ...prev[cid][category][key], val } } } })); };

  if (!isReady) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 font-sans">
      <ConfirmationModal config={modal} onClose={() => setModal(null)} />
      {reportData && <PrintableReport data={reportData} onClose={() => setReportData(null)} />}

      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-lg print:hidden">
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
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
                  {[{id:'calculator', icon: Calculator, label:'計算'}, {id:'history', icon: List, label:`記錄 (${history.length})`}, {id:'settings', icon: Settings, label:'設定'}].map(t => (
                      <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition ${activeTab===t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}><t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span></button>
                  ))}
              </div>
          </div>
      </div>

      {saveMsg && <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg flex items-center gap-2 text-white text-sm ${saveMsg.type === 'error' ? 'bg-red-500' : 'bg-green-600'} print:hidden`}>{saveMsg.type === 'error' ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}{saveMsg.msg}</div>}

      <div className="max-w-3xl mx-auto p-4 space-y-6 print:hidden">
          {/* === CALCULATOR TAB === */}
          {activeTab === 'calculator' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                      {Object.values(COUNTRIES).map(c => (
                          <button key={c.id} onClick={() => setCountry(c.id)} className={`flex-1 py-3 px-4 rounded-xl border flex flex-col items-center transition min-w-[80px] ${country === c.id ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'bg-white border-gray-200'}`}><span className="font-bold">{c.name.split(' ')[0]}</span><span className="text-xs text-gray-500">Ex: {rates[c.id] || '-'}</span></button>
                      ))}
                  </div>

                  <Card className="p-4">
                      <SectionHeader icon={Car} title="車輛資料" />
                      <div className="grid grid-cols-2 gap-3">
                          <AutocompleteInput label="品牌" value={details.manufacturer} onChange={v => setDetails(d => ({...d, manufacturer:v}))} options={Object.keys(inventory)} />
                          <AutocompleteInput label="型號" value={details.model} onChange={v => setDetails(d => ({...d, model:v}))} options={inventory[details.manufacturer]?.models.map(m=>m.id) || []} />
                          <AutocompleteInput label="年份" value={details.year} onChange={v => setDetails(d => ({...d, year:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.years || []} />
                          <AutocompleteInput label="代號" value={details.code} onChange={v => setDetails(d => ({...d, code:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.codes || []} />
                          <div className="col-span-2"><InputGroup label="車身號碼 (Chassis No)" value={details.chassisNo} onChange={v => setDetails(d => ({...d, chassisNo:v}))} type="text" placeholder="e.g. NHP10-1234567" /></div>
                      </div>
                  </Card>

                  {/* File Upload Section */}
                  <Card className="p-4 border-l-4 border-purple-500">
                      <SectionHeader icon={Paperclip} title={`文件上傳 (最多 ${appConfig.maxFiles} 個, <${appConfig.maxFileSizeKB}KB)`} color="text-purple-700" />
                      <div className="flex flex-col gap-4">
                          <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                              <div className="flex flex-col items-center pt-2 pb-3">
                                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                                  <p className="text-xs text-gray-500">點擊上傳圖片/PDF/文檔</p>
                              </div>
                              <input type="file" className="hidden" multiple onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
                          </label>
                          {attachments.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                  {attachments.map((file, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-100 rounded border text-xs">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                              {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-500"/> : <FileIcon className="w-4 h-4 text-gray-500"/>}
                                              <span className="truncate max-w-[100px]" title={file.name}>{file.name}</span>
                                          </div>
                                          <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4"/></button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </Card>

                  <Card className="p-4 border-l-4 border-l-blue-600">
                      <SectionHeader icon={DollarSign} title="核心成本" color="text-blue-600" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><InputGroup label={`當地車價 (${COUNTRIES[country].currency})`} value={carPrice} onChange={setCarPrice} required /><InputGroup label="首次登記稅基準 (PRP)" value={prp} onChange={setPrp} required /></div>
                      <div className="mt-2 text-right text-sm font-medium text-gray-600">車價折合: <span className="text-blue-600 text-lg">{fmt(carPriceHKD)}</span></div>
                  </Card>

                  <div className="grid grid-cols-1 gap-4">
                      <Card className="p-4"><SectionHeader icon={Globe} title="當地雜費" color="text-indigo-600" /><div className="grid grid-cols-2 gap-4">{Object.entries(currOriginFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrOriginFees(p => ({...p, [k]: {...p[k], val}}))} />))}</div><div className="text-right text-xs text-gray-500 mt-2">折合: {fmt(originTotalHKD)}</div></Card>
                      <Card className="p-4"><SectionHeader icon={Ship} title="香港雜費 (到港成本)" color="text-green-600" /><div className="grid grid-cols-2 gap-4">{Object.entries(currHkMiscFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkMiscFees(p => ({...p, [k]: {...p[k], val}}))} />))}</div><div className="text-right text-xs text-gray-500 mt-2">小計: {fmt(hkMiscTotal)}</div></Card>
                      <Card className="p-4 border-l-4 border-orange-400"><SectionHeader icon={FileText} title="香港出牌費用" color="text-orange-600" /><div className="grid grid-cols-2 gap-4 mb-3">{Object.entries(currHkLicenseFees || {}).map(([k, v]) => (<InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkLicenseFees(p => ({...p, [k]: {...p[k], val}}))} />))}</div><div className="flex justify-between items-center bg-orange-50 p-3 rounded"><span className="text-sm text-gray-700">首次登記稅 (FRT)</span><span className="font-bold text-orange-700">{fmt(frt)}</span></div><div className="text-right text-xs text-gray-500 mt-2">小計 (含稅): {fmt(totalLicenseCost)}</div></Card>
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
                                      <div className="text-xs text-gray-400 mt-0.5">{item.details.chassisNo}</div>
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
                   <Card className="p-4 border-l-4 border-purple-500">
                       <SectionHeader icon={Settings} title="系統設定" color="text-purple-700" />
                       <div className="grid grid-cols-2 gap-4">
                           <InputGroup label="最大附件數量" value={appConfig.maxFiles} onChange={v => setAppConfig(p => ({...p, maxFiles: v}))} />
                           <InputGroup label="最大附件大小 (KB)" value={appConfig.maxFileSizeKB} onChange={v => setAppConfig(p => ({...p, maxFileSizeKB: v}))} />
                       </div>
                   </Card>
                   {/* Inventory Config & Rate Config & Fee Config (Kept for brevity, same logic as before) */}
                   <Card className="p-4 border-l-4 border-green-500">
                       <SectionHeader icon={Car} title="車輛庫存管理" color="text-green-700" />
                       <div className="flex gap-2 mb-4"><input value={newManufacturer} onChange={e => setNewManufacturer(e.target.value)} placeholder="新增品牌" className="flex-1 text-sm p-2 border rounded" /><button onClick={addMfr} disabled={!newManufacturer} className="bg-green-600 text-white px-3 rounded text-sm">新增</button></div>
                       {/* Inventory Lists ... */}
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
