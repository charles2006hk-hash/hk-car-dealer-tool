import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft } from 'lucide-react';

// --- Firebase CDN Imports ---
// 確保所有 Firebase 模組都從單一 CDN 版本導入，以避免重複載入或版本衝突
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, inMemoryPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Global Constants & FRT Calculation ---
const DEFAULT_RATES = { JP: 0.053, UK: 10.2, DE: 8.6 };
const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  DE: { id: 'DE', name: '德國 (Germany)', currency: 'EUR', symbol: '€' },
};
const DEFAULT_FEES = {
  JP: { origin: { auctionFee: { label: '拍賣場/FOB費用', val: '20000' }, shipping: { label: '船運費', val: '100000' } }, hk: { transport: { label: '本地拖車/運輸', val: '2000' }, inspection: { label: '驗車/政府排氣', val: '5500' }, parts: { label: '更換配件/維修', val: '3000' }, insurance: { label: '保險費', val: '1500' }, license: { label: '牌費', val: '5800' } } },
  UK: { origin: { auctionFee: { label: '出口手續費', val: '500' }, shipping: { label: '1500' } }, hk: { transport: { label: '本地拖車/運輸', val: '2000' }, inspection: { label: '驗車/政府排氣', val: '6500' }, parts: { label: '更換配件/維修', val: '4000' }, insurance: { label: '保險費', val: '2000' }, license: { label: '牌費', val: '5800' } } },
  DE: { origin: { auctionFee: { label: '出口手續費', val: '400' }, shipping: { label: '1200' } }, hk: { transport: { label: '本地拖車/運輸', val: '2000' }, inspection: { label: '驗車/政府排氣', val: '6500' }, parts: { label: '更換配件/維修', val: '4000' }, insurance: { label: '保險費', val: '2000' }, license: { label: '牌費', val: '5800' } } }
};
const DEFAULT_INVENTORY = {
  Toyota: { models: [{ id: 'Alphard', years: ['2023', '2022'], codes: ['AH30', 'AH40'] }], },
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

// --- UI Components ---
const Card = ({ children, className = "" }) => <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>{children}</div>;
const SectionHeader = ({ icon: Icon, title, color="text-gray-800" }) => <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100"><Icon className={`w-5 h-5 ${color}`} /><h3 className="font-bold text-gray-700">{title}</h3></div>;

const InputGroup = ({ label, value, onChange, prefix, placeholder = "", required = false, type = 'number', step = 'any', min }) => (
  <div className="mb-3">
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
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
          <div className={`p-4 border-b ${type === 'danger' ? 'bg-red-50 border-red-100 text-red-800' : type === 'warning' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}><h3 className="font-bold flex gap-2"><AlertTriangle className="w-5 h-5" />{title}</h3></div>
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
  // --- State ---
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isReady, setIsReady] = useState(false); // Indicates Firebase init and Auth check is complete
  const [saveMsg, setSaveMsg] = useState(null);
  const [modal, setModal] = useState(null);

  // App Data (synced with Firestore settings document)
  const [activeTab, setActiveTab] = useState('calculator');
  const [country, setCountry] = useState('JP');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [defaultFees, setDefaultFees] = useState(DEFAULT_FEES); // Renamed state to avoid conflict with `fees` in Firebase
  const [inventory, setInventory] = useState(DEFAULT_INVENTORY);
  const [history, setHistory] = useState([]);

  // Calculator Inputs (local state)
  const [carPrice, setCarPrice] = useState('');
  const [prp, setPrp] = useState('');
  // Fees being used in the calculator - cloned from defaultFees[country]
  const [currOriginFees, setCurrOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currHkFees, setCurrHkFees] = useState(DEFAULT_FEES['JP'].hk);
  const [details, setDetails] = useState({ manufacturer: '', model: '', year: '', code: '' });
  
  // Inventory Management UI (local state)
  const [newManufacturer, setNewManufacturer] = useState('');
  const [editingMfr, setEditingMfr] = useState(null);
  const [newModel, setNewModel] = useState({ id: '', years: '', codes: '' });

  // --- Effects & Logic ---

  const showMsg = (msg, type = 'success') => {
      setSaveMsg({ msg, type });
      setTimeout(() => setSaveMsg(null), 3000);
  };

  // 1. Firebase Init: **使用環境變數和正確的認證邏輯**
  useEffect(() => {
      setLogLevel('debug');
      const init = async () => {
          let app = null;
          let auth = null;
          let firestore = null;
          
          try {
              // 1. 取得全域配置
              const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
              const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
              
              if (!firebaseConfig || !firebaseConfig.apiKey) {
                  throw new Error("Firebase config not found. Please ensure __firebase_config is set.");
              }

              app = initializeApp(firebaseConfig);
              auth = getAuth(app);
              firestore = getFirestore(app);
              
              // 2. 設置內存持久化以避免 iFrame 儲存錯誤
              await setPersistence(auth, inMemoryPersistence);

              // 3. 處理認證邏輯：使用 Custom Token 或匿名登入
              if (initialAuthToken) { 
                  await signInWithCustomToken(auth, initialAuthToken); 
              } else { 
                  await signInAnonymously(auth); 
              }
              
              // 4. 監聽認證狀態變更
              onAuthStateChanged(auth, (user) => {
                  if (user) {
                      setUserId(user.uid);
                      setDb(firestore);
                      console.log("Firebase initialized and signed in. User ID:", user.uid);
                  } else {
                      setUserId(null);
                      console.log("Authentication failed or not ready.");
                  }
                  // 無論成功與否，都標記為就緒，避免阻塞
                  setIsReady(true);
              });
          } catch (e) {
              console.error("Firebase Init Error:", e);
              showMsg("初始化失敗: " + e.message, "error");
              setIsReady(true);
          }
      };
      init();
  }, []);

  // Refs: 使用全域 APP_ID 來建構路徑
  const APP_ID_PATH = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  
  const getSettingsRef = useCallback(() => db && userId ? doc(db, `artifacts/${APP_ID_PATH}/users/${userId}/settings/user_config`) : null, [db, userId, APP_ID_PATH]);
  const getHistoryRef = useCallback(() => db && userId ? collection(db, `artifacts/${APP_ID_PATH}/users/${userId}/history`) : null, [db, userId, APP_ID_PATH]);

  // 2. Sync Settings (Rates, Fees, Inventory)
  useEffect(() => {
      const settingsDocRef = getSettingsRef();
      // Guard clause: 確保 Auth 流程已完成
      if (!isReady || !db || !userId || !settingsDocRef) return;
      
      const unsub = onSnapshot(settingsDocRef, (snap) => {
          if (snap.exists()) {
              const d = snap.data();
              if(d.rates) setRates(d.rates);
              if(d.fees) setDefaultFees(d.fees); // 使用 setDefaultFees
              if(d.inventory) setInventory(d.inventory);
          } else {
              // 如果設定文件不存在，則創建一個新的預設值
              setDoc(settingsDocRef, { rates: DEFAULT_RATES, fees: DEFAULT_FEES, inventory: DEFAULT_INVENTORY }, { merge: true });
          }
      }, (error) => {
          console.error("Settings Snapshot Error:", error);
          showMsg("設定同步失敗: " + error.message, "error");
      });
      return () => unsub();
  }, [db, userId, isReady, getSettingsRef]);

  // 3. Sync History (Real-time updates)
  useEffect(() => {
      const historyColRef = getHistoryRef();
      // Guard clause: 確保 Auth 流程已完成
      if (!isReady || !db || !userId || !historyColRef) return;
      
      // 注意: 避免使用 orderBy() 來避免索引錯誤，改在客戶端排序
      const q = query(historyColRef);
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // 在客戶端排序，以確保顯示最新記錄
          list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
          setHistory(list);
      }, (error) => {
           console.error("History Snapshot Error:", error);
           showMsg("歷史記錄同步失敗: " + error.message, "error");
      });
      return () => unsub();
  }, [db, userId, isReady, getHistoryRef]);

  // 4. Sync Fees on Country Change or Default Fees Change
  useEffect(() => {
      // 當國家切換 或 defaultFees 從 Firestore 同步更新時，更新計算器中的費用
      if (defaultFees[country]) {
          setCurrOriginFees(defaultFees[country].origin);
          setCurrHkFees(defaultFees[country].hk);
          setCarPrice(''); // 清空價格，鼓勵重新輸入
          setPrp('');
      }
  }, [country, defaultFees]);

  // Calculations (Memoized for performance)
  const calculationResults = useMemo(() => {
      const rate = rates[country] || 0;
      const carPriceHKD = (parseFloat(carPrice) || 0) * rate;
      const frt = calculateFRT(prp);
      
      let originTotal = 0;
      Object.values(currOriginFees).forEach(v => originTotal += (parseFloat(v.val) || 0));
      const originTotalHKD = originTotal * rate;
      
      let hkTotal = 0;
      Object.values(currHkFees).forEach(v => hkTotal += (parseFloat(v.val) || 0));
      
      const grandTotal = carPriceHKD + originTotalHKD + hkTotal + frt;
      
      return { rate, carPriceHKD, frt, originTotalHKD, hkTotal, grandTotal };
  }, [country, rates, carPrice, prp, currOriginFees, currHkFees]);

  const { rate, carPriceHKD, frt, originTotalHKD, hkTotal, grandTotal } = calculationResults;
  const fmt = (n) => new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(n);

  // --- Actions ---

  const saveHistory = async () => {
      if (!db || !userId) return showMsg("未連接資料庫或未登入", "error");
      if (grandTotal <= 0) return showMsg("總金額必須大於 0", "error");
      
      const record = {
          ts: Date.now(),
          // 使用 Firestore 的 serverTimestamp() 確保時間準確性
          timestamp: serverTimestamp(),
          date: new Date().toLocaleString('zh-HK'),
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
      } catch (e) {
          showMsg("儲存失敗: " + e.message, "error");
      }
  };

  const saveConfig = async () => {
      if (!db || !userId) return showMsg("未連接資料庫或未登入", "error");
      try {
        // 儲存 Rates, Fees, Inventory
        await setDoc(getSettingsRef(), { rates, fees: defaultFees, inventory }, { merge: true });
        showMsg("設定已儲存");
      } catch (e) {
          showMsg("設定儲存失敗: " + e.message, "error");
      }
  };

  const toggleLock = async (item) => {
      if (!db || !userId) return;
      try {
        await updateDoc(doc(db, `artifacts/${APP_ID_PATH}/users/${userId}/history`, item.id), { isLocked: !item.isLocked });
      } catch (e) {
          showMsg("更新鎖定狀態失敗: " + e.message, "error");
      }
  };

  // *** 修正後的刪除記錄功能 ***
  const deleteHistoryItem = (item) => {
      // 1. 如果記錄已鎖定，彈出提示，不執行刪除
      if (item.isLocked) {
          return setModal({
              title: "無法刪除",
              message: "此記錄已被鎖定，請先點擊鎖頭圖標解鎖後再進行刪除。",
              type: "warning",
              onConfirm: () => setModal(null), // 點擊確認，僅關閉
              onClose: () => setModal(null),
          });
      }

      // 2. 彈出確認刪除對話框
      setModal({
          title: "刪除記錄",
          message: "確定要刪除此記錄嗎？此操作不可撤銷。",
          type: "danger",
          onClose: () => setModal(null),
          onConfirm: async () => {
              if (!db || !userId) {
                  setModal(null);
                  return showMsg("錯誤：未連接資料庫", "error");
              }
              try {
                console.log("嘗試刪除 Firestore 文件 ID:", item.id); // 偵錯日誌
                await deleteDoc(doc(db, `artifacts/${APP_ID_PATH}/users/${userId}/history`, item.id));
                setModal(null);
                showMsg("已刪除");
              } catch (e) {
                  console.error("Firestore 刪除錯誤:", e); // 錯誤日誌
                  setModal(null);
                  showMsg("刪除失敗: " + e.message, "error");
              }
          }
      });
  };

  const loadHistoryItem = (item) => {
      setCountry(item.country);
      setCarPrice(item.vals.carPrice);
      setPrp(item.vals.prp);
      setDetails(item.details);
      // 從歷史記錄載入的費用直接設置到當前計算器狀態，不會影響預設費用
      setCurrOriginFees(item.fees.origin);
      setCurrHkFees(item.fees.hk);
      setActiveTab('calculator');
      showMsg("記錄已載入");
  };

  // Inventory Actions
  const addMfr = () => {
      if (!newManufacturer) return;
      const normalizedMfr = newManufacturer.trim();
      if(inventory[normalizedMfr]) return showMsg("品牌已存在", "error");

      setDefaultFees(prev => ({ ...prev, [normalizedMfr]: { models: [] } }));
      setInventory(prev => ({ ...prev, [normalizedMfr]: { models: [] } }));
      setNewManufacturer('');
      setTimeout(saveConfig, 100);
  };

  const deleteMfr = (mfr) => {
      setModal({
          title: "刪除品牌",
          message: `確定要刪除 ${mfr} 及其所有型號嗎？這將影響您的庫存和設定。`,
          type: "danger",
          onConfirm: () => {
              const newInv = { ...inventory };
              delete newInv[mfr];
              setInventory(newInv);
              setEditingMfr(null);
              setModal(null);
              setTimeout(() => saveConfig(), 100);
          }
      });
  };

  const addModel = (mfr) => {
      if (!newModel.id) return;
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
  
  const handleRateChange = (countryId, value) => {
      setRates(r => ({...r, [countryId]: value}));
  };

  const handleDefaultFeeChange = (countryId, type, key, value) => {
    setDefaultFees(f => ({
        ...f,
        [countryId]: {
            ...f[countryId],
            [type]: {
                ...f[countryId][type],
                [key]: { ...f[countryId][type][key], val: value }
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
              {/* 顯示 UserId 供多用戶協作參考 */}
              <div className="text-xs text-slate-400 truncate max-w-[80px] sm:max-w-none">
                  {userId ? `ID: ${userId}` : '未登入'}
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
          
          {/* === CALCULATOR === */}
          {activeTab === 'calculator' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                  {/* Country */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                      {Object.values(COUNTRIES).map(c => (
                          <button key={c.id} onClick={() => setCountry(c.id)} 
                              className={`flex-1 py-3 px-4 rounded-xl border flex flex-col items-center transition min-w-[80px] ${country === c.id ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600' : 'bg-white border-gray-200'}`}>
                              <span className="font-bold">{c.name.split(' ')[0]}</span>
                              <span className="text-xs text-gray-500">Ex: {rates[c.id] || 'N/A'}</span>
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
                          {Object.entries(currOriginFees).map(([k, v]) => (
                              <InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrOriginFees(p => ({...p, [k]: {...p[k], val}}))} />
                          ))}
                          <div className="text-right text-xs text-gray-500 mt-2">折合: {fmt(originTotalHKD)}</div>
                      </Card>
                      <Card className="p-4">
                          <SectionHeader icon={Ship} title="香港雜費" color="text-green-600" />
                          {Object.entries(currHkFees).map(([k, v]) => (
                              <InputGroup key={k} label={v.label} value={v.val} onChange={val => setCurrHkFees(p => ({...p, [k]: {...p[k], val}}))} />
                          ))}
                          <div className="text-right text-xs text-gray-500 mt-2">小計: {fmt(hkTotal)}</div>
                      </Card>
                  </div>

                  {/* Total Bar */}
                  <div className="sticky bottom-0 bg-slate-800 text-white p-4 rounded-xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 z-10">
                      <div>
                          <div className="text-xs text-gray-400">預計總成本 (HKD)</div>
                          <div className="text-3xl font-bold leading-none">{fmt(grandTotal)}</div>
                          <div className="text-[10px] text-gray-400 mt-1 flex gap-2">
                              <span>稅: {fmt(frt)}</span>
                              <span>雜: {fmt(originTotalHKD + hkTotal)}</span>
                          </div>
                      </div>
                      <button 
                          onClick={saveHistory} 
                          disabled={grandTotal<=0 || !userId} 
                          className="w-full sm:w-auto bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                          <PlusCircle className="w-5 h-5"/> {userId ? '記錄預算' : '請等待登入'}
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
                                      {/* *** 修正：移除 disabled 屬性，讓點擊事件始終觸發 *** */}
                                      <button onClick={() => deleteHistoryItem(item)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4"/></button>
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
                                               <button onClick={() => addModel(mfr)} disabled={!newModel.id} className="bg-blue-500 text-white rounded text-xs hover:bg-blue-600">新增</button>
                                           </div>
                                           {(inventory[mfr]?.models || []).map(m => (
                                               <div key={m.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                                                   <span><b>{m.id}</b> <span className="text-gray-500">[{m.codes.join(', ')}]</span></span>
                                                   <X className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600" onClick={() => deleteModel(mfr, m.id)} />
                                               </div>
                                           ))}
                                           {inventory[mfr]?.models?.length === 0 && <div className="text-xs text-gray-400 text-center py-2">無型號</div>}
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                   </Card>

                   <Card className="p-4">
                      <SectionHeader icon={DollarSign} title="匯率設定" />
                      <div className="grid grid-cols-3 gap-3">
                          {/* 修正：使用 Object.keys(DEFAULT_RATES) 以確保順序和完整性 */}
                          {Object.keys(DEFAULT_RATES).map(c => (
                              <InputGroup 
                                key={c} 
                                label={`${c} (1 ${COUNTRIES[c].currency} = HKD)`} 
                                value={rates[c]} 
                                onChange={val => handleRateChange(c, val)}
                              />
                          ))}
                      </div>
                   </Card>

                   <Card className="p-4">
                       <SectionHeader icon={Settings} title="預設費用" />
                       <div className="text-sm text-gray-500 mb-4">在此修改各國預設費用，將應用於新計算。</div>
                       {Object.values(COUNTRIES).map(c => (
                            <div key={c.id} className="mb-6 last:mb-0">
                                <h4 className="font-bold text-gray-700 mb-2 border-l-4 border-blue-500 pl-2">{c.name}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Local Origin Fees */}
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-gray-400">當地費用 ({c.currency})</div>
                                        {/* FIX: 使用 ?. 和 || {} 確保結構存在 */}
                                        {Object.entries(defaultFees[c.id]?.origin || {}).map(([key, item]) => (
                                            <InputGroup 
                                                key={key} 
                                                label={item.label} 
                                                value={item.val} 
                                                onChange={(val) => handleDefaultFeeChange(c.id, 'origin', key, val)} 
                                                prefix={c.symbol}
                                                min={0}
                                            />
                                        ))}
                                    </div>
                                    {/* HK Fees */}
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-gray-400">香港固定費用 (HKD)</div>
                                        {/* FIX: 使用 ?. 和 || {} 確保結構存在 */}
                                        {Object.entries(defaultFees[c.id]?.hk || {}).map(([key, item]) => (
                                            <InputGroup 
                                                key={key} 
                                                label={item.label} 
                                                value={item.val} 
                                                onChange={(val) => handleDefaultFeeChange(c.id, 'hk', key, val)} 
                                                prefix='$'
                                                min={0}
                                            />
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
                                   setRates(DEFAULT_RATES); 
                                   setDefaultFees(DEFAULT_FEES); 
                                   setInventory(DEFAULT_INVENTORY);
                                   setModal(null);
                                   saveConfig();
                               }
                           });
                       }} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">重置為預設值</button>
                       <button onClick={saveConfig} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4"/> 儲存設定</button>
                   </div>
              </div>
          )}
      </div>
    </div>
  );
}
