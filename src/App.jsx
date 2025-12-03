import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft } from 'lucide-react';

// --- Firebase Imports (CDN) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, inMemoryPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 1. 您的專用 Firebase 配置 ---
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBMSujR0hN0sVniMpeyYHVgdN0bJOKNAmg",
  authDomain: "hk-car-dealer-tool.firebaseapp.com",
  projectId: "hk-car-dealer-tool",
  storageBucket: "hk-car-dealer-tool.firebasestorage.app",
  messagingSenderId: "53318644210",
  appId: "1:53318644210:web:43a35553f825247c7cbb6b",
  measurementId: "G-92FJL41BGT"
};

// --- Constants & Logic ---
const DEFAULT_RATES = { JP: 0.053, UK: 10.2, DE: 8.6 };
const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  DE: { id: 'DE', name: '德國 (Germany)', currency: 'EUR', symbol: '€' },
};

// 預設費用結構
const DEFAULT_FEES = {
  JP: {
    origin: { auctionFee: { label: '拍賣場/FOB費用', val: '20000' }, shipping: { label: '船運費', val: '100000' } },
    hk: { transport: { label: '本地拖車/運輸', val: '2000' }, inspection: { label: '驗車/政府排氣', val: '5500' }, parts: { label: '更換配件/維修', val: '3000' }, insurance: { label: '保險費', val: '1500' }, license: { label: '牌費', val: '5800' } }
  },
  UK: {
    origin: { auctionFee: { label: '出口手續費', val: '500' }, shipping: { label: '船運費', val: '1500' } },
    hk: { transport: { label: '本地拖車/運輸', val: '2000' }, inspection: { label: '驗車/政府排氣', val: '6500' }, parts: { label: '更換配件/維修', val: '4000' }, insurance: { label: '保險費', val: '2000' }, license: { label: '牌費', val: '5800' } }
  },
  DE: {
    origin: { auctionFee: { label: '出口手續費', val: '400' }, shipping: { label: '船運費', val: '1200' } },
    hk: { transport: { label: '本地拖車/運輸', val: '2000' }, inspection: { label: '驗車/政府排氣', val: '6500' }, parts: { label: '更換配件/維修', val: '4000' }, insurance: { label: '保險費', val: '2000' }, license: { label: '牌費', val: '5800' } }
  }
};

const DEFAULT_INVENTORY = {
  Toyota: { models: [{ id: 'Alphard', years: ['2023', '2022'], codes: ['AH30', 'AH40'] }, { id: 'Noah', years: ['2023', '2021'], codes: ['ZWR90', 'ZRR80'] }] },
  Honda: { models: [{ id: 'Stepwgn', years: ['2024', '2022'], codes: ['RP6', 'RK5'] }] },
  BMW: { models: [] },
};

// 首次登記稅計算
const calculateFRT = (prp) => {
    let v = parseFloat(prp) || 0;
    let t = 0;
    if (v > 0) { let taxable = Math.min(v, 150000); t += taxable * 0.46; v -= taxable; }
    if (v > 0) { let taxable = Math.min(v, 150000); t += taxable * 0.86; v -= taxable; }
    if (v > 0) { let taxable = Math.min(v, 200000); t += taxable * 1.15; v -= taxable; }
    if (v > 0) { t += v * 1.32; }
    return t;
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
  // 安全過濾，避免 options 為 undefined
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

// --- MAIN APP ---
export default function App() {
  // Firebase State
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [modal, setModal] = useState(null);

  // App Data
  const [activeTab, setActiveTab] = useState('calculator');
  const [country, setCountry] = useState('JP');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [fees, setFees] = useState(DEFAULT_FEES);
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [history, setHistory] = useState([]);

  // Calculator Inputs
  const [carPrice, setCarPrice] = useState('');
  const [prp, setPrp] = useState('');
  const [currOriginFees, setCurrOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currHkFees, setCurrHkFees] = useState(DEFAULT_FEES['JP'].hk);
  const [details, setDetails] = useState({ manufacturer: '', model: '', year: '', code: '' });
  
  // Inventory UI
  const [newManufacturer, setNewManufacturer] = useState('');
  const [editingMfr, setEditingMfr] = useState(null);
  const [newModel, setNewModel] = useState({ id: '', years: '', codes: '' });

  const showMsg = (msg, type = 'success') => {
      setSaveMsg({ msg, type });
      setTimeout(() => setSaveMsg(null), 3000);
  };

  // 1. Firebase Initialization
  useEffect(() => {
      const init = async () => {
          try {
              // Initialize App
              const app = initializeApp(YOUR_FIREBASE_CONFIG);
              const auth = getAuth(app);
              const firestore = getFirestore(app);
              
              // 關鍵修正：強制使用內存持久化，避免瀏覽器阻擋
              await setPersistence(auth, inMemoryPersistence);
              
              // 匿名登入
              await signInAnonymously(auth);
              
              // 監聽登入狀態
              onAuthStateChanged(auth, (user) => {
                  if (user) {
                      setUserId(user.uid);
                      setDb(firestore);
                      console.log("Connected to Firestore as:", user.uid);
                  }
                  setIsReady(true);
              });
          } catch (e) {
              console.error("Firebase Init Error:", e);
              showMsg("連線錯誤: " + e.message, "error");
              setIsReady(true); // Allow app to render even if offline
          }
      };
      init();
  }, []);

  // Helper refs for Firestore paths (使用使用者的獨立 collection)
  // 使用 'users/{userId}/settings' 和 'users/{userId}/history' 結構
  const getSettingsRef = () => db && userId ? doc(db, 'users', userId, 'settings', 'config') : null;
  const getHistoryRef = () => db && userId ? collection(db, 'users', userId, 'history') : null;

  // 2. Sync Settings from Firestore
  useEffect(() => {
      const ref = getSettingsRef();
      if (!ref) return;

      const unsub = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const d = snap.data();
              if(d.rates) setRates(d.rates);
              if(d.fees) setFees(d.fees);
              if(d.inventory) setInventory(d.inventory);
          } else {
              // Initialize defaults if new user
              setDoc(ref, { rates: DEFAULT_RATES, fees: DEFAULT_FEES, inventory: DEFAULT_INVENTORY }, { merge: true });
          }
      });
      return () => unsub();
  }, [db, userId]);

  // 3. Sync History from Firestore
  useEffect(() => {
      const ref = getHistoryRef();
      if (!ref) return;

      // 使用 orderBy 確保順序，如果索引報錯，則在客戶端排序
      // const q = query(ref, orderBy('ts', 'desc')); 
      const q = query(ref); // 暫時移除 orderBy 避免需要建立索引

      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Client-side sort to be safe
          list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
          setHistory(list);
      });
      return () => unsub();
  }, [db, userId]);

  // 4. Fees Sync Logic
  useEffect(() => {
      if (fees[country]) {
          setCurrOriginFees(fees[country].origin);
          setCurrHkFees(fees[country].hk);
          setCarPrice('');
          setPrp('');
      }
  }, [country, fees]);

  // Calculation Logic
  const rate = rates[country] || 0;
  const carPriceHKD = (parseFloat(carPrice) || 0) * rate;
  const frt = calculateFRT(prp);
  
  let originTotal = 0;
  Object.values(currOriginFees || {}).forEach(v => originTotal += (parseFloat(v.val) || 0));
  const originTotalHKD = originTotal * rate;

  let hkTotal = 0;
  Object.values(currHkFees || {}).forEach(v => hkTotal += (parseFloat(v.val) || 0));
  
  const grandTotal = carPriceHKD + originTotalHKD + hkTotal + frt;
  const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

  // Actions
  const saveHistoryRecord = async () => {
      if (!db || !userId) return showMsg("未連接資料庫", "error");
      if (grandTotal <= 0) return showMsg("金額無效", "error");
      
      const record = {
          ts: Date.now(),
          date: new Date().toLocaleString('zh-HK'),
          timestamp: serverTimestamp(),
          country, details,
          vals: { carPrice, prp, rate },
          fees: { origin: currOriginFees, hk: currHkFees },
          results: { carPriceHKD, originTotalHKD, hkTotal, frt, grandTotal },
          isLocked: false
      };

      try {
        await addDoc(getHistoryRef(), record);
        showMsg("已記錄");
        setTimeout(() => setActiveTab('history'), 500);
      } catch(e) {
        showMsg("儲存失敗: " + e.message, "error");
      }
  };

  const saveConfig = async () => {
      if (!db || !userId) return;
      try {
        await setDoc(getSettingsRef(), { rates, fees, inventory }, { merge: true });
        showMsg("設定已儲存");
      } catch(e) {
        showMsg("儲存失敗", "error");
      }
  };

  const deleteHistoryItem = (item) => {
      if (item.isLocked) return showMsg("記錄已鎖定，請先解鎖", "error");
      
      setModal({
          title: "刪除記錄",
          message: "確定要刪除此記錄嗎？",
          type: "danger",
          onConfirm: async () => {
             try {
                 await deleteDoc(doc(db, 'users', userId, 'history', item.id));
                 setModal(null);
                 showMsg("已刪除");
             } catch(e) {
                 showMsg("刪除失敗: " + e.message, "error");
             }
          }
      });
  };

  const toggleLock = async (item) => {
      if (!db) return;
      try {
        await updateDoc(doc(db, 'users', userId, 'history', item.id), { isLocked: !item.isLocked });
      } catch(e) {
          console.error(e);
      }
  };

  const loadHistoryItem = (item) => {
      setCountry(item.country);
      setCarPrice(item.vals.carPrice);
      setPrp(item.vals.prp);
      setDetails(item.details);
      setCurrOriginFees(item.fees.origin);
      setCurrHkFees(item.fees.hk);
      setActiveTab('calculator');
      showMsg("記錄已載入");
  };

  // Inventory Actions
  const addMfr = () => {
      if (!newManufacturer) return;
      const name = newManufacturer.trim();
      if (inventory[name]) return showMsg("品牌已存在", "error");
      
      setInventory(prev => ({ ...prev, [name]: { models: [] } }));
      setNewManufacturer('');
      setTimeout(saveConfig, 100);
  };

  const deleteMfr = (mfr) => {
      setModal({
          title: "刪除品牌",
          message: `確定要刪除 ${mfr} 及其所有型號嗎？`,
          type: "danger",
          onConfirm: () => {
              const newInv = {...inventory};
              delete newInv[mfr];
              setInventory(newInv);
              setEditingMfr(null);
              setModal(null);
              setTimeout(saveConfig, 100);
          }
      });
  };

  const addModel = (mfr) => {
      if(!newModel.id) return;
      const newCar = { 
        id: newModel.id.trim(), 
        years: newModel.years.split(',').map(s=>s.trim()).filter(Boolean),
        codes: newModel.codes.split(',').map(s=>s.trim()).filter(Boolean)
      };
      
      setInventory(prev => ({
          ...prev,
          [mfr]: { ...prev[mfr], models: [...(prev[mfr].models || []), newCar] }
      }));
      setNewModel({ id: '', years: '', codes: '' });
      setTimeout(saveConfig, 100);
  };

  const deleteModel = (mfr, modelId) => {
      setInventory(prev => ({
          ...prev,
          [mfr]: { ...prev[mfr], models: (prev[mfr].models || []).filter(m => m.id !== modelId) }
      }));
      setTimeout(saveConfig, 100);
  };
  
  // Settings Handlers
  const handleRateChange = (cid, val) => setRates(p => ({...p, [cid]: val}));
  
  const handleFeeChange = (cid, type, key, val) => {
      setFees(prev => ({
          ...prev,
          [cid]: {
              ...prev[cid],
              [type]: {
                  ...prev[cid][type],
                  [key]: { ...prev[cid][type][key], val }
              }
          }
      }));
  };

  if (!isReady) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 font-sans">
      <ConfirmationModal config={modal} onClose={() => setModal(null)} />
      
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-lg">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-lg"><Truck className="w-6 h-6 text-blue-400"/> HK 汽車行家助手</div>
              <div className="flex bg-slate-800 rounded-lg p-1">
                  {[
                      {id:'calculator', icon: Calculator, label:'計算'},
                      {id:'history', icon: List, label:`記錄 (${history.length})`},
                      {id:'settings', icon: Settings, label:'設定'}
                  ].map(t => (
                      <button key={t.id} onClick={() => setActiveTab(t.id)} 
                          className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition ${activeTab===t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}>
                          <t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span>
                      </button>
                  ))}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                  {userId ? <span className="text-green-400">● 連線中</span> : <span className="text-red-400">● 離線</span>}
              </div>
          </div>
      </div>

      {/* Status Msg */}
      {saveMsg && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow-lg flex items-center gap-2 text-white text-sm ${saveMsg.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
              {saveMsg.type === 'error' ? <AlertTriangle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>}
              {saveMsg.msg}
          </div>
      )}

      <div className="max-w-3xl mx-auto p-4 space-y-6">
          
          {/* === CALCULATOR TAB === */}
          {activeTab === 'calculator' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                  {/* Country */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                      {Object.values(COUNTRIES).map(c => (
                          <button key={c.id} onClick={() => setCountry(c.id)} 
                              className={`flex-1 py-3 px-4 rounded-xl border flex flex-col items-center transition min-w-[80px] ${country === c.id ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'bg-white border-gray-200'}`}>
                              <span className="font-bold">{c.name.split(' ')[0]}</span>
                              <span className="text-xs text-gray-500">Ex: {rates[c.id] || '-'}</span>
                          </button>
                      ))}
                  </div>

                  {/* Car Details */}
                  <Card className="p-4">
                      <SectionHeader icon={Car} title="車輛資料" />
                      <div className="grid grid-cols-2 gap-3">
                          <AutocompleteInput label="品牌" value={details.manufacturer} onChange={v => setDetails(d => ({...d, manufacturer:v}))} options={Object.keys(inventory)} />
                          <AutocompleteInput label="型號" value={details.model} onChange={v => setDetails(d => ({...d, model:v}))} options={inventory[details.manufacturer]?.models.map(m=>m.id) || []} />
                          <AutocompleteInput label="年份" value={details.year} onChange={v => setDetails(d => ({...d, year:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.years || []} />
                          <AutocompleteInput label="代號" value={details.code} onChange={v => setDetails(d => ({...d, code:v}))} options={inventory[details.manufacturer]?.models.find(m=>m.id===details.model)?.codes || []} />
                      </div>
                  </Card>

                  {/* Costs */}
                  <Card className="p-4 border-l-4 border-l-blue-600">
                      <SectionHeader icon={DollarSign} title="核心成本" color="text-blue-600" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <InputGroup label={`當地車價 (${COUNTRIES[country].currency})`} value={carPrice} onChange={setCarPrice} required />
                          <InputGroup label="首次登記稅基準 (PRP)" value={prp} onChange={setPrp} required />
                      </div>
                      <div className="mt-2 text-right text-sm font-medium text-gray-600">
                          車價折合: <span className="text-blue-600 text-lg">{fmt(carPriceHKD)}</span>
                      </div>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="p-4">
                          <SectionHeader icon={Globe} title="當地雜費" color="text-indigo-600" />
                          {Object.entries(currOriginFees || {}).map(([k, v]) => (
                              <InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrOriginFees(p => ({...p, [k]: {...p[k], val}}))} />
                          ))}
                          <div className="text-right text-xs text-gray-500 mt-2">折合: {fmt(originTotalHKD)}</div>
                      </Card>
                      <Card className="p-4">
                          <SectionHeader icon={Ship} title="香港雜費" color="text-green-600" />
                          {Object.entries(currHkFees || {}).map(([k, v]) => (
                              <InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkFees(p => ({...p, [k]: {...p[k], val}}))} />
                          ))}
                          <div className="text-right text-xs text-gray-500 mt-2">小計: {fmt(hkTotal)}</div>
                      </Card>
                  </div>

                  {/* Total Bar */}
                  <div className="sticky bottom-4 bg-slate-800 text-white p-4 rounded-xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                          <div className="text-xs text-gray-400">預計總成本 (HKD)</div>
                          <div className="text-3xl font-bold leading-none">{fmt(grandTotal)}</div>
                          <div className="text-[10px] text-gray-400 mt-1 flex gap-2">
                              <span>稅: {fmt(frt)}</span>
                              <span>雜: {fmt(originTotalHKD + hkTotal)}</span>
                          </div>
                      </div>
                      <button onClick={saveHistoryRecord} disabled={grandTotal<=0 || !userId} className="w-full sm:w-auto bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                          <PlusCircle className="w-5 h-5"/> 記錄預算
                      </button>
                  </div>
              </div>
          )}

          {/* === HISTORY TAB === */}
          {activeTab === 'history' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                  {history.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed">暫無記錄</div>
                  ) : (
                      history.map(item => (
                          <Card key={item.id} className="p-4 group hover:shadow-md transition">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded mr-2">{item.country}</span>
                                      <span className="text-xs text-gray-500">{item.date}</span>
                                      <div className="font-bold text-gray-800 mt-1">
                                          {item.details.manufacturer} {item.details.model} <span className="font-normal text-sm text-gray-500">{item.details.year}</span>
                                      </div>
                                  </div>
                                  <div className="flex gap-1">
                                      <button onClick={() => loadHistoryItem(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="載入"><ArrowLeft className="w-4 h-4"/></button>
                                      <button onClick={() => toggleLock(item)} className={`p-1.5 rounded ${item.isLocked ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}`}>{item.isLocked ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4"/>}</button>
                                      <button onClick={() => deleteHistoryItem(item)} className={`p-1.5 rounded ${item.isLocked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500'}`}><Trash2 className="w-4 h-4"/></button>
                                  </div>
                              </div>
                              <div className="flex justify-between items-end border-t pt-2 mt-2">
                                  <div className="text-xs text-gray-500">
                                      <div>車價: {fmt(item.results.carPriceHKD)}</div>
                                      <div>稅: {fmt(item.results.frt)}</div>
                                  </div>
                                  <div className="text-xl font-bold text-blue-600">{fmt(item.results.grandTotal)}</div>
                              </div>
                          </Card>
                      ))
                  )}
              </div>
          )}

          {/* === SETTINGS TAB === */}
          {activeTab === 'settings' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                   {/* Inventory Config */}
                   <Card className="p-4 border-l-4 border-green-500">
                       <SectionHeader icon={Car} title="車輛庫存管理" color="text-green-700" />
                       
                       <div className="flex gap-2 mb-4">
                           <input value={newManufacturer} onChange={e => setNewManufacturer(e.target.value)} placeholder="新增品牌 (e.g. Honda)" className="flex-1 text-sm p-2 border rounded" />
                           <button onClick={addMfr} disabled={!newManufacturer} className="bg-green-600 text-white px-3 rounded text-sm hover:bg-green-700 disabled:opacity-50">新增</button>
                       </div>

                       <div className="space-y-2">
                           {Object.keys(inventory).map(mfr => (
                               <div key={mfr} className="border rounded-lg bg-gray-50 overflow-hidden">
                                   <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-100" onClick={() => setEditingMfr(editingMfr === mfr ? null : mfr)}>
                                       <span className="font-bold text-sm">{mfr} ({inventory[mfr]?.models?.length || 0})</span>
                                       <div className="flex gap-2">
                                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" onClick={(e) => {e.stopPropagation(); deleteMfr(mfr)}} />
                                            <ChevronDown className={`w-4 h-4 transition ${editingMfr === mfr ? 'rotate-180' : ''}`} />
                                       </div>
                                   </div>
                                   
                                   {editingMfr === mfr && (
                                       <div className="p-3 border-t bg-white">
                                           <div className="grid grid-cols-4 gap-2 mb-3">
                                               <input placeholder="型號" value={newModel.id} onChange={e => setNewModel(m => ({...m, id: e.target.value}))} className="text-xs p-1.5 border rounded" />
                                               <input placeholder="年份 (2023,2024)" value={newModel.years} onChange={e => setNewModel(m => ({...m, years: e.target.value}))} className="text-xs p-1.5 border rounded" />
                                               <input placeholder="代號 (AE110)" value={newModel.codes} onChange={e => setNewModel(m => ({...m, codes: e.target.value}))} className="text-xs p-1.5 border rounded" />
                                               <button onClick={() => addModel(mfr)} disabled={!newModel.id} className="bg-blue-500 text-white rounded text-xs">新增</button>
                                           </div>
                                           {(inventory[mfr]?.models || []).map(m => (
                                               <div key={m.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                                                   <span><b>{m.id}</b> <span className="text-gray-500">[{m.codes.join(',')}]</span></span>
                                                   <X className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600" onClick={() => deleteModel(mfr, m.id)} />
                                               </div>
                                           ))}
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                   </Card>

                   <Card className="p-4">
                      <SectionHeader icon={DollarSign} title="匯率設定" />
                      <div className="grid grid-cols-3 gap-3">
                          {Object.keys(DEFAULT_RATES).map(c => (
                              <InputGroup key={c} label={c} value={rates[c]} onChange={v => handleRateChange(c, v)} />
                          ))}
                      </div>
                   </Card>

                   <Card className="p-4">
                       <SectionHeader icon={Settings} title="預設費用" />
                       {Object.keys(COUNTRIES).map(c => (
                           <div key={c} className="mb-6 last:mb-0">
                               <h4 className="font-bold text-gray-700 mb-2 border-l-4 border-blue-500 pl-2">{COUNTRIES[c].name}</h4>
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-2">
                                       <div className="text-xs font-bold text-gray-400">當地</div>
                                       {Object.entries(fees[c]?.origin || {}).map(([k, v]) => (
                                           <InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'origin', k, val)} />
                                       ))}
                                   </div>
                                   <div className="space-y-2">
                                       <div className="text-xs font-bold text-gray-400">香港</div>
                                       {Object.entries(fees[c]?.hk || {}).map(([k, v]) => (
                                           <InputGroup key={k} label={v.label} value={v.val} onChange={val => handleFeeChange(c, 'hk', k, val)} />
                                       ))}
                                   </div>
                               </div>
                           </div>
                       ))}
                   </Card>
                   
                   <div className="flex justify-end gap-3">
                       <button onClick={() => {
                           setModal({
                               title: "重置所有設定",
                               message: "這將把所有匯率、費用和庫存重置為預設值，確定嗎？",
                               type: "danger",
                               onConfirm: () => {
                                   setRates(DEFAULT_RATES); setFees(DEFAULT_FEES); setInventory(DEFAULT_INVENTORY);
                                   setModal(null);
                                   saveConfig();
                               }
                           });
                       }} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">重置</button>
                       <button onClick={saveConfig} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4"/> 儲存設定</button>
                   </div>
              </div>
          )}
      </div>
    </div>
  );
}
