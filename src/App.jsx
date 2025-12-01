import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Loader } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';


// --- Global Constants & FRT Calculation ---

// NOTE: These constants serve as initial defaults only. Actual state is loaded from Firestore.
const DEFAULT_RATES = {
  JP: 0.053, 
  UK: 10.2, 
  DE: 8.6,   
};

const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  DE: { id: 'DE', name: '德國 (Germany)', currency: 'EUR', symbol: '€' },
};

const DEFAULT_FEES = {
  JP: {
    origin: { auctionFee: { label: '拍賣場/FOB費用', val: 20000 }, shipping: { label: '船運費', val: 100000 } },
    hk: { transport: { label: '本地拖車/運輸', val: 2000 }, inspection: { label: '驗車/政府排氣', val: 5500 }, parts: { label: '更換配件/維修', val: 3000 }, insurance: { label: '保險費', val: 1500 }, license: { label: '牌費', val: 5800 } }
  },
  UK: {
    origin: { auctionFee: { label: '出口手續費', val: 500 }, shipping: { label: '船運費', val: 1500 } },
    hk: { transport: { label: '本地拖車/運輸', val: 2000 }, inspection: { label: '驗車/政府排氣', val: 6500 }, parts: { label: '更換配件/維修', val: 4000 }, insurance: { label: '保險費', val: 2000 }, license: { label: '牌費', val: 5800 } }
  },
  DE: {
    origin: { auctionFee: { label: '出口手續費', val: 400 }, shipping: { label: '船運費', val: 1200 } },
    hk: { transport: { label: '本地拖車/運輸', val: 2000 }, inspection: { label: '驗車/政府排氣', val: 6500 }, parts: { label: '更換配件/維修', val: 4000 }, insurance: { label: '保險費', val: 2000 }, license: { label: '牌費', val: 5800 } }
  }
};

const DEFAULT_INVENTORY = {
  Toyota: { models: [{ id: 'Alphard', years: ['2023', '2022', '2021'], codes: ['AH30', 'AH40'] }, { id: 'Noah', years: ['2023', '2021'], codes: ['ZWR90', 'ZRR80'] }] },
  Honda: { models: [{ id: 'Stepwgn', years: ['2024', '2022'], codes: ['RP6', 'RK5'] }, { id: 'Vezel', years: ['2023', '2020'], codes: ['RV3', 'RU1'] }] },
  BMW: { models: [] },
};

/**
 * 根據香港累進稅率計算汽車首次登記稅 (FRT)
 */
const calculateFRT = (prp) => {
    let taxableValue = parseFloat(prp) || 0;
    let frt = 0;
    if (taxableValue > 0) { frt += Math.min(taxableValue, 150000) * 0.46; taxableValue -= Math.min(taxableValue, 150000); }
    if (taxableValue > 0) { frt += Math.min(taxableValue, 150000) * 0.86; taxableValue -= Math.min(taxableValue, 150000); }
    if (taxableValue > 0) { frt += Math.min(taxableValue, 200000) * 1.15; taxableValue -= Math.min(taxableValue, 200000); }
    if (taxableValue > 0) { frt += taxableValue * 1.32; }
    return frt;
};

// --- Helper Components ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, color = "text-gray-800" }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
    <Icon className={`w-5 h-5 ${color}`} />
    <h3 className="font-bold text-gray-700">{title}</h3>
  </div>
);

const AutocompleteInput = ({ label, value, onChange, options = [], disabled = false, placeholder = "輸入或選擇" }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(option => typeof option === 'string' && option.toLowerCase().includes(lowerSearch));
  }, [searchTerm, options]);

  const handleSelect = useCallback((option) => {
    setSearchTerm(option);
    onChange(option);
    setIsOpen(false);
  }, [onChange]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setSearchTerm(newVal);
    setIsOpen(true);
    onChange(newVal); 
  };
  
  const handleClear = () => {
      setSearchTerm('');
      onChange('');
      setIsOpen(false);
  };

  return (
    <div className="mb-3 relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          className={`focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 pl-3 pr-8 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
        
        {searchTerm && (
          <button 
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-red-500"
            disabled={disabled}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        {!searchTerm && (
          <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
        )}
      </div>

      {(isOpen && filteredOptions.length > 0 && !disabled) && (
        <ul className="absolute z-30 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {filteredOptions.slice(0, 10).map((option, index) => (
            <li
              key={index}
              className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-blue-600"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(option); }} // Use onMouseDown to prevent blur/loss of focus issue
            >
              {option}
            </li>
          ))}
          {filteredOptions.length > 10 && (
            <li className="px-3 py-1 text-xs text-gray-400 border-t">顯示前 10 項...</li>
          )}
        </ul>
      )}
    </div>
  );
};

const InputGroup = ({ label, value, onChange, prefix, type = "number", step = "1", placeholder = "", required = false }) => {
  const isInvalid = required && (value === '' || parseFloat(value) <= 0 || isNaN(parseFloat(value)));
  
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative rounded-md shadow-sm">
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">{prefix}</span>
          </div>
        )}
        <input
          type={type}
          step={step}
          className={`
            focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm rounded-md py-2 ${prefix ? 'pl-8' : 'pl-3'}
            ${isInvalid ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}
          `}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {isInvalid && (
           <AlertTriangle className="w-4 h-4 text-red-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" title="必填欄位" />
        )}
      </div>
    </div>
  );
};


// --- Main App Component ---

export default function App() {
  // --- Firebase State ---
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


  // --- Application State (Synced with Firestore) ---
  const [activeTab, setActiveTab] = useState('calculator'); 
  const [selectedCountry, setSelectedCountry] = useState('JP');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [defaultFees, setDefaultFees] = useState(DEFAULT_FEES);
  const [carInventory, setCarInventory] = useState(DEFAULT_INVENTORY); 
  const [history, setHistory] = useState([]);
  
  // --- Temporary Calculator State ---
  const [carPrice, setCarPrice] = useState('');
  const [approvedRetailPrice, setApprovedRetailPrice] = useState(''); 
  const [currentOriginFees, setCurrentOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currentHKFees, setCurrentHKFees] = useState(DEFAULT_FEES['JP'].hk);
  const [carDetails, setCarDetails] = useState({
    manufacturer: '', model: '', year: '', code: ''
  });

  // --- Settings UI State ---
  const [newManufacturer, setNewManufacturer] = useState('');
  const [editingManufacturer, setEditingManufacturer] = useState(null);
  const [newModel, setNewModel] = useState({ id: '', years: '', codes: '' });
  
  // --- Status Message State ---
  const [saveStatus, setSaveStatus] = useState(null); // { message: string, type: 'success' | 'error' }


  // --- 1. Firebase Initialization and Authentication ---
  useEffect(() => {
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing or invalid. Cannot initialize.");
        return;
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    setDb(firestore);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setUserId(user.uid);
        } else {
            // Attempt to sign in using custom token or anonymously
            try {
                if (typeof __initial_auth_token !== 'undefined') {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Firebase sign-in failed:", error);
                // Fallback to anonymous sign-in if custom token fails
                await signInAnonymously(auth);
            }
        }
        setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // --- Firestore Reference Helpers ---
  // Private Data Path: /artifacts/{appId}/users/{userId}/...
  const getSettingsDocRef = useCallback(() => {
      if (!db || !userId) return null;
      return doc(db, `artifacts/${appId}/users/${userId}/settings/dealerSettings`);
  }, [db, userId, appId]);

  const getHistoryCollectionRef = useCallback(() => {
      if (!db || !userId) return null;
      return collection(db, `artifacts/${appId}/users/${userId}/history`);
  }, [db, userId, appId]);

  // --- 2. Data Synchronization (Load and Listen) ---
  useEffect(() => {
      if (!isAuthReady || !db || !userId) return;

      let unsubscribeSettings = () => {};
      let unsubscribeHistory = () => {};

      const settingsRef = getSettingsDocRef();
      const historyCollectionRef = getHistoryCollectionRef();
      
      // 1. Settings Listener (Rates, Fees, Inventory)
      unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setRates(data.rates || DEFAULT_RATES);
              setDefaultFees(data.defaultFees || DEFAULT_FEES);
              setCarInventory(data.carInventory || DEFAULT_INVENTORY);
          } else {
              // If settings doc doesn't exist, create it with defaults
              setDoc(settingsRef, {
                  rates: DEFAULT_RATES,
                  defaultFees: DEFAULT_FEES,
                  carInventory: DEFAULT_INVENTORY
              }, { merge: true }).catch(e => console.error("Error creating default settings:", e));
          }
          setIsLoading(false); // Data loaded, stop loading
      }, (error) => {
          console.error("Settings snapshot error:", error);
          setIsLoading(false);
      });

      // 2. History Listener
      // We query the collection and sort locally since we cannot enforce indexes here.
      const historyQuery = query(historyCollectionRef);
      unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
          const loadedHistory = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          }));
          // Sort locally by ID (which is the timestamp of creation) descending (newest first)
          loadedHistory.sort((a, b) => b.id.localeCompare(a.id)); 
          setHistory(loadedHistory);
      }, (error) => console.error("History snapshot error:", error));

      return () => {
          unsubscribeSettings();
          unsubscribeHistory();
      };
  }, [isAuthReady, db, userId, getSettingsDocRef, getHistoryCollectionRef]);


  // When country changes, reset fees to defaults
  useEffect(() => {
    if (defaultFees[selectedCountry]) {
      setCurrentOriginFees(defaultFees[selectedCountry].origin);
      setCurrentHKFees(defaultFees[selectedCountry].hk);
      setCarPrice('');
      setApprovedRetailPrice('');
    }
  }, [selectedCountry, defaultFees]);

  // --- 3. Data Saving Handlers (Firestore Operations) ---
  const showStatus = (message, type) => {
    setSaveStatus({ message, type });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const saveSettings = async () => {
    const settingsRef = getSettingsDocRef();
    if (!settingsRef) return showStatus('Firestore 未初始化，無法儲存', 'error');

    try {
        await setDoc(settingsRef, { 
            rates, 
            defaultFees, 
            carInventory 
        }, { merge: true });
        showStatus('設定已成功儲存到雲端！', 'success');
    } catch (e) {
        console.error("Failed to save settings to Firestore:", e);
        showStatus('儲存設定失敗，請檢查網路連接。', 'error');
    }
  };

  const resetSettings = async () => {
    if(window.confirm('確定要重置所有設定回預設值嗎？')) {
      const settingsRef = getSettingsDocRef();
      if (!settingsRef) return showStatus('Firestore 未初始化，無法重置', 'error');

      try {
        await setDoc(settingsRef, {
            rates: DEFAULT_RATES,
            defaultFees: DEFAULT_FEES,
            carInventory: DEFAULT_INVENTORY
        });
        showStatus('所有設定已重置回預設值。', 'success');
      } catch (e) {
          console.error("Failed to reset settings:", e);
          showStatus('重置設定失敗。', 'error');
      }
    }
  };
  
  // Update Fee structure in state, preparing for Firestore sync
  const handleDefaultFeeChange = (countryId, type, key, val) => {
    setDefaultFees(prev => {
      const newFees = {
        ...prev,
        [countryId]: {
          ...prev[countryId],
          [type]: {
            ...prev[countryId][type],
            [key]: { ...prev[countryId][type][key], val: val }
          }
        }
      };
      // Immediately sync state for current calculation
      if (countryId === selectedCountry) {
          if (type === 'origin') setCurrentOriginFees(newFees[countryId].origin);
          if (type === 'hk') setCurrentHKFees(newFees[countryId].hk);
      }
      return newFees;
    });
  };

  const handleRateChange = (countryId, val) => {
    setRates(prev => ({ ...prev, [countryId]: val }));
  };


  const saveToHistory = async () => {
    
    // --- Pre-check: Ensure critical fields are non-zero ---
    if (carPriceVal <= 0 || approvedRetailPriceVal <= 0) {
        return showStatus('請輸入有效的車價及PRP以進行記錄!', 'error');
    }
    
    if (grandTotal <= 0) {
      return showStatus('總成本計算結果為零或無效!', 'error');
    }

    const historyCollectionRef = getHistoryCollectionRef();
    if (!historyCollectionRef) return showStatus('Firestore 未初始化，無法儲存記錄', 'error');

    // 將所有計算時使用的數值和結構全部存入記錄中
    const newRecordContent = {
      date: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }), 
      countryId: selectedCountry,
      
      inputValues: {
          rate: currentRate,
          carPriceNative: carPriceVal,
          approvedRetailPrice: approvedRetailPriceVal,
      },
      
      carDetails: { ...carDetails }, 

      feesAtTimeOfSaving: {
          origin: currentOriginFees,
          hk: currentHKFees, 
      },
      
      calculations: {
        carPriceHKD,
        totalOriginFeesHKD,
        totalHKFeesWithoutFRT,
        calculatedFRT,         
        grandTotal
      }
    };

    try {
        // 使用 addDoc，Firestore 會自動生成 ID
        await addDoc(historyCollectionRef, newRecordContent);
        showStatus('記錄成功儲存到雲端！', 'success');
        
        // Go to history tab after a small delay 
        setTimeout(() => setActiveTab('history'), 800);
        
    } catch (e) {
        console.error("Failed to add history record:", e);
        showStatus('儲存記錄失敗，請檢查網路連接。', 'error');
    }
  };

  const deleteHistoryItem = async (id) => {
    if (window.confirm('確定要刪除這條記錄嗎？')) {
      const historyDocRef = doc(getHistoryCollectionRef(), id);
      try {
          await deleteDoc(historyDocRef);
          showStatus('記錄已從雲端刪除!', 'success');
      } catch (e) {
          console.error("Failed to delete history record:", e);
          showStatus('刪除記錄失敗。', 'error');
      }
    }
  };
  
  // --- Inventory Handlers (Update `carInventory` state, then rely on `saveSettings` or prompt for it) ---
  const handleAddManufacturer = () => {
    const name = newManufacturer.trim();
    if (!name || carInventory[name]) {
      return showStatus('製造商名稱無效或已存在!', 'error');
    }
    setCarInventory(prev => ({ ...prev, [name]: { models: [] } }));
    setNewManufacturer('');
    saveSettings(); 
  };

  const handleDeleteManufacturer = (mfrName) => {
    if (window.confirm(`確定要刪除製造商 "${mfrName}" 及其所有車型嗎？`)) {
      setCarInventory(prev => {
        const { [mfrName]: _, ...rest } = prev;
        return rest;
      });
      setEditingManufacturer(null);
      saveSettings();
    }
  };
  
  const handleAddModel = (mfrName) => {
    const modelId = newModel.id.trim();
    if (!modelId || !carInventory[mfrName] || carInventory[mfrName].models.some(m => m.id === modelId)) {
      return showStatus('型號名稱無效或已存在!', 'error');
    }

    const yearsArray = newModel.years.split(',').map(s => s.trim()).filter(s => s);
    const codesArray = newModel.codes.split(',').map(s => s.trim()).filter(s => s);

    const newCar = { id: modelId, years: yearsArray, codes: codesArray };

    setCarInventory(prev => ({
      ...prev,
      [mfrName]: { ...prev[mfrName], models: [...prev[mfrName].models, newCar] }
    }));
    setNewModel({ id: '', years: '', codes: '' });
    saveSettings();
  };

  const handleDeleteModel = (mfrName, modelId) => {
    if (window.confirm(`確定要刪除型號 "${modelId}" 嗎？`)) {
      setCarInventory(prev => ({
        ...prev,
        [mfrName]: { ...prev[mfrName], models: prev[mfrName].models.filter(m => m.id !== modelId) }
      }));
      saveSettings();
    }
  };


  // --- Calculations & Memoizations (Unchanged) ---
  const currentCurrency = COUNTRIES[selectedCountry];
  const currentRate = parseFloat(rates[selectedCountry]) || 0; 

  const carPriceVal = parseFloat(carPrice) || 0;
  const carPriceHKD = carPriceVal * currentRate;

  let totalOriginFeesNative = 0;
  Object.values(currentOriginFees).forEach(fee => { totalOriginFeesNative += parseFloat(fee.val) || 0; });
  const totalOriginFeesHKD = totalOriginFeesNative * currentRate;

  const approvedRetailPriceVal = parseFloat(approvedRetailPrice) || 0;
  const calculatedFRT = calculateFRT(approvedRetailPriceVal);

  let totalHKFeesWithoutFRT = 0;
  Object.values(currentHKFees).forEach(fee => { totalHKFeesWithoutFRT += parseFloat(fee.val) || 0; });

  const totalHKFees = totalHKFeesWithoutFRT + calculatedFRT;
  const grandTotal = carPriceHKD + totalOriginFeesHKD + totalHKFees;

  const fmtMoney = (amount, currency = 'HKD') => {
    if (isNaN(amount) || amount === null) return 'N/A';
    return new Intl.NumberFormat('zh-HK', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(amount);
  };
  
  const handleCarDetailChange = (field, value) => {
    setCarDetails(prev => {
      const newDetails = { ...prev, [field]: value };
      if (field === 'manufacturer' && prev.manufacturer !== value) {
        newDetails.model = ''; newDetails.year = ''; newDetails.code = '';
      } else if (field === 'model' && prev.model !== value) {
        newDetails.year = ''; newDetails.code = '';
      } else if (field === 'year' && prev.year !== value) {
        newDetails.code = '';
      }
      return newDetails;
    });
  };

  const manufacturerOptions = useMemo(() => Object.keys(carInventory), [carInventory]);
  const modelOptions = useMemo(() => {
    const mfrData = carInventory[carDetails.manufacturer];
    return mfrData ? mfrData.models.map(m => m.id) : [];
  }, [carInventory, carDetails.manufacturer]);
  const yearOptions = useMemo(() => {
    const mfrData = carInventory[carDetails.manufacturer];
    if (!mfrData) return [];
    const modelData = mfrData.models.find(m => m.id === carDetails.model);
    return modelData ? modelData.years : [];
  }, [carInventory, carDetails.manufacturer, carDetails.model]);
  const codeOptions = useMemo(() => {
    const mfrData = carInventory[carDetails.manufacturer];
    if (!mfrData) return [];
    const modelData = mfrData.models.find(m => m.id === carDetails.model);
    return modelData ? modelData.codes : [];
  }, [carInventory, carDetails.manufacturer, carDetails.model]);
  

  // --- Render Logic ---
  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="flex flex-col items-center bg-white p-8 rounded-xl shadow-lg">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-700 font-medium">正在連接至雲端數據庫...</p>
          <p className="text-xs text-gray-400 mt-1">請稍候</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* Header */}
      <div className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-40"> 
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-300" />
            <h1 className="text-lg font-bold tracking-wide hidden sm:block">HK 汽車行家助手</h1>
            <h1 className="text-lg font-bold tracking-wide sm:hidden">行家助手</h1>
            {userId && (
              <span className="text-xs bg-blue-700 px-2 py-0.5 rounded-full hidden md:inline-block" title="您的用戶ID (用於數據安全隔離)">
                ID: {userId}
              </span>
            )}
          </div>
          <div className="flex gap-1 bg-blue-800 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeTab === 'calculator' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">計算器</span>
              <span className="sm:hidden">計算</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">記錄</span>
              <span className="sm:hidden">記錄 ({history.length})</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">設定</span>
              <span className="sm:hidden">設定</span>
            </button>
          </div>
        </div>
        {userId && (
            <div className='max-w-3xl mx-auto mt-2 text-center text-xs text-blue-300 md:hidden'>
                ID: {userId}
            </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-4">
        
        {/* --- CALCULATOR TAB --- */}
        {activeTab === 'calculator' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Country Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {Object.values(COUNTRIES).map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCountry(c.id)}
                  className={`flex-1 min-w-[100px] py-3 px-4 rounded-xl border flex flex-col items-center justify-center transition-all ${selectedCountry === c.id ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 shadow-md' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <span className="text-lg font-bold">{c.name.split(' ')[0]}</span>
                  <span className="text-xs text-gray-500">匯率: {currentRate}</span>
                </button>
              ))}
            </div>

            {/* Car Details Form */}
            <Card className="p-5">
              <SectionHeader icon={Car} title="車輛資料 (可選填)" color="text-gray-600" />
              <div className="grid grid-cols-2 gap-4">
                <AutocompleteInput 
                  label="製造商 (Manufacturer)" 
                  placeholder="e.g. Toyota" 
                  value={carDetails.manufacturer}
                  onChange={(v) => handleCarDetailChange('manufacturer', v)}
                  options={manufacturerOptions}
                />
                <AutocompleteInput 
                  label="型號 (Model)" 
                  placeholder="e.g. Alphard" 
                  value={carDetails.model}
                  onChange={(v) => handleCarDetailChange('model', v)}
                  options={modelOptions}
                  disabled={!carDetails.manufacturer}
                />
                <AutocompleteInput 
                  label="製造年份 (Year)" 
                  placeholder="e.g. 2023" 
                  value={carDetails.year}
                  onChange={(v) => handleCarDetailChange('year', v)}
                  options={yearOptions}
                  disabled={!carDetails.model}
                />
                <AutocompleteInput 
                  label="型號代碼 (Model Code)" 
                  placeholder="e.g. AGH30" 
                  value={carDetails.code}
                  onChange={(v) => handleCarDetailChange('code', v)}
                  options={codeOptions}
                  disabled={!carDetails.model}
                />
              </div>
            </Card>

            {/* Main Input: Car Price (REQUIRED FIELDS) */}
            <Card className="p-5 border-l-4 border-l-blue-600">
              <SectionHeader icon={DollarSign} title="車輛成本及稅基 (香港/來源地)" color="text-blue-600" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputGroup 
                  label={`來源地車價 (${currentCurrency.currency})`}
                  prefix={currentCurrency.symbol}
                  value={carPrice}
                  onChange={setCarPrice}
                  placeholder="例如: 1500000"
                  required={true} // Marked as required
                />
                {/* 新增 PRP 輸入 */}
                <InputGroup 
                  label="核准公布零售價 (PRP) - 首次登記稅基 (HKD)"
                  prefix="$"
                  value={approvedRetailPrice}
                  onChange={setApprovedRetailPrice}
                  placeholder="例如: 350000"
                  required={true} // Marked as required
                />
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-right mt-4">
                  <span className="text-xs text-gray-500 block">來源地車價折合港幣 (不含稅費)</span>
                  <span className="text-xl font-bold text-gray-800">{fmtMoney(carPriceHKD)}</span>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Origin Fees */}
              <Card className="p-4">
                <SectionHeader icon={Globe} title={`當地雜費 (${currentCurrency.currency})`} color="text-indigo-600" />
                <div className="space-y-2">
                  {Object.entries(currentOriginFees).map(([key, item]) => (
                    <InputGroup
                      key={key}
                      label={item.label}
                      prefix={currentCurrency.symbol}
                      value={item.val}
                      onChange={(val) => handleOriginFeeChange(key, val)}
                    />
                  ))}
                  <div className="pt-2 border-t mt-2 flex justify-between items-center text-sm">
                    <span className="text-gray-500">當地雜費小計 (HKD)</span>
                    <span className="font-bold text-indigo-700">{fmtMoney(totalOriginFeesHKD)}</span>
                  </div>
                </div>
              </Card>

              {/* HK Fees */}
              <Card className="p-4">
                <SectionHeader icon={Ship} title="香港本地雜費及首次登記稅 (HKD)" color="text-green-600" />
                <div className="space-y-2">
                  {/* 可編輯的香港費用 */}
                  {Object.entries(currentHKFees).map(([key, item]) => (
                    <InputGroup
                      key={key}
                      label={item.label}
                      prefix="$"
                      value={item.val}
                      onChange={(val) => handleHKFeeChange(key, val)}
                    />
                  ))}
                  
                  {/* 首次登記稅 (FRT) - 顯示計算結果 */}
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed">
                      <span className="text-sm font-bold text-red-600">
                          首次登記稅 (FRT)
                          <p className='text-xs font-normal text-gray-500'>基於PRP {fmtMoney(approvedRetailPriceVal)}</p>
                      </span>
                      <span className="font-bold text-red-600">{fmtMoney(calculatedFRT)}</span>
                  </div>


                  <div className="pt-2 border-t mt-2 flex justify-between items-center text-sm">
                    <span className="text-gray-500">香港總費用 (含FRT)</span>
                    <span className="font-bold text-green-700">{fmtMoney(totalHKFees)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Grand Total Bar and Status Message */}
            <div className="sticky bottom-0 bg-gray-900 text-white p-4 rounded-2xl shadow-xl z-20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-gray-400 text-xs sm:text-sm">預計總成本 (HKD)</span>
                     <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">匯率 @ {currentRate}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-baseline gap-1">
                    {fmtMoney(grandTotal)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 hidden sm:flex gap-4">
                    <span>車價: {fmtMoney(carPriceHKD)}</span>
                    <span>當地雜: {fmtMoney(totalOriginFeesHKD)}</span>
                    <span>香港雜費: {fmtMoney(totalHKFeesWithoutFRT)}</span>
                    <span className='text-red-400'>FRT: {fmtMoney(calculatedFRT)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={saveToHistory}
                  disabled={grandTotal <= 0 || carPriceVal <= 0 || approvedRetailPriceVal <= 0} 
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>記錄預算 (儲存至雲端)</span>
                </button>
              </div>

              {/* Status Message Display */}
              {saveStatus && (
                  <div 
                      className={`absolute bottom-full left-0 right-0 p-3 rounded-t-xl shadow-lg transition-all duration-300 
                      ${saveStatus.type === 'success' ? 'bg-green-500' : 'bg-red-500'} 
                      flex items-center gap-2 text-white text-sm font-medium`}
                  >
                      {saveStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {saveStatus.message}
                  </div>
              )}
            </div>
          </div>
        )}

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <List className="w-6 h-6 text-blue-600" />
                雲端儲存記錄
              </h2>
              <span className="text-sm text-gray-500">共 {history.length} 筆</span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">暫無記錄，請到計算器進行估算。</p>
                <p className='text-xs text-gray-300 mt-2'>數據儲存於 Firestore 雲端資料庫</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map(item => (
                  <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                         <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                           {item.countryId}
                         </span>
                         <span className="text-sm text-gray-500 flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> {item.date}
                         </span>
                      </div>
                      <button 
                        onClick={() => deleteHistoryItem(item.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-lg font-bold text-gray-800 mb-1">
                          {item.carDetails.manufacturer} {item.carDetails.model}
                        </div>
                        <div className="text-sm text-gray-500 flex gap-3">
                          <span className="bg-gray-100 px-2 py-0.5 rounded">{item.carDetails.year || '年份?'}</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded">{item.carDetails.code || '代碼?'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-900">
                          {fmtMoney(item.calculations.grandTotal)}
                        </div>
                        <div className="text-xs text-gray-500">
                          當時匯率 @ {item.inputValues.rate}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-xs text-center text-gray-500">
                      <div>
                        <div className="font-medium text-gray-400">車價 (HKD)</div>
                        <div>{fmtMoney(item.calculations.carPriceHKD)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-400">當地雜費 (HKD)</div>
                        <div>{fmtMoney(item.calculations.totalOriginFeesHKD)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-400">香港雜費 (HKD)</div>
                        <div>{fmtMoney(item.calculations.totalHKFeesWithoutFRT)}</div>
                      </div>
                       <div>
                        <div className="font-medium text-red-600">首次登記稅 (FRT)</div>
                        <div className='text-red-600'>{fmtMoney(item.calculations.calculatedFRT)}</div>
                        <div className='text-gray-400'>(PRP {fmtMoney(item.inputValues.approvedRetailPrice)})</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">後台參數設定</h2>
              <div className="flex gap-2">
                <button onClick={resetSettings} className="flex items-center gap-1 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium">
                  <RotateCcw className="w-4 h-4" /> 重置
                </button>
                <button onClick={saveSettings} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium shadow-sm">
                  <Save className="w-4 h-4" /> 儲存設定到雲端
                </button>
              </div>
            </div>

            {/* Car Inventory Management */}
            <Card className="p-5 border-l-4 border-l-blue-600">
              <SectionHeader icon={Car} title="車輛庫存管理 (Car Inventory)" color="text-blue-600" />
              
              {/* Add New Manufacturer */}
              <div className="border-b pb-4 mb-4">
                <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <PlusCircle className="w-4 h-4" /> 新增製造商 (Manufacturer)
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="輸入製造商名稱 (e.g. Mercedes-Benz)"
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button 
                    onClick={handleAddManufacturer} 
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
                    disabled={!newManufacturer.trim()}
                  >
                    新增
                  </button>
                </div>
              </div>

              {/* List Manufacturers */}
              <div className="space-y-4">
                {Object.entries(carInventory).map(([mfrName, data]) => (
                  <div key={mfrName} className="border rounded-lg overflow-hidden">
                    <div 
                      className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() => setEditingManufacturer(mfrName === editingManufacturer ? null : mfrName)}
                    >
                      <span className="font-bold text-gray-800">{mfrName} ({data.models.length} 型號)</span>
                      <div className='flex items-center gap-2'>
                          <Trash2 
                              className="w-4 h-4 text-red-400 hover:text-red-600 transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleDeleteManufacturer(mfrName); }}
                          />
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${mfrName === editingManufacturer ? 'rotate-180' : 'rotate-0'}`} />
                      </div>
                    </div>

                    {/* Model Management Sub-Panel */}
                    {mfrName === editingManufacturer && (
                      <div className="p-4 bg-white border-t space-y-4">
                        <h5 className="font-semibold text-sm mb-2">管理 {mfrName} 的型號</h5>
                        
                        {/* Add New Model Form */}
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                           <h6 className="text-xs font-bold text-blue-700 mb-2">新增型號</h6>
                           <div className="grid grid-cols-1 gap-2">
                             <input
                                placeholder="型號名稱 (e.g. Sienta)"
                                value={newModel.id}
                                onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                                className="px-3 py-1 border rounded-md text-sm"
                             />
                             <input
                                placeholder="年份 (e.g. 2023, 2022) - 以逗號分隔"
                                value={newModel.years}
                                onChange={(e) => setNewModel(prev => ({ ...prev, years: e.target.value }))}
                                className="px-3 py-1 border rounded-md text-sm"
                             />
                             <input
                                placeholder="代碼 (e.g. NSP170, XP170) - 以逗號分隔"
                                value={newModel.codes}
                                onChange={(e) => setNewModel(prev => ({ ...prev, codes: e.target.value }))}
                                className="px-3 py-1 border rounded-md text-sm"
                             />
                           </div>
                           <button 
                              onClick={() => handleAddModel(mfrName)} 
                              className="w-full mt-2 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                              disabled={!newModel.id.trim()}
                            >
                              新增型號
                           </button>
                        </div>
                        
                        {/* Existing Models List */}
                        {data.models.map(model => (
                          <div key={model.id} className="flex justify-between items-start border-b pb-2 text-sm last:border-b-0 last:pb-0">
                            <div>
                                <div className="font-medium text-gray-800">{model.id}</div>
                                <div className="text-xs text-gray-500">
                                    年份: {model.years.join(', ')} | 代碼: {model.codes.join(', ')}
                                </div>
                            </div>
                            <button onClick={() => handleDeleteModel(mfrName, model.id)} className="text-red-400 hover:text-red-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {data.models.length === 0 && <p className="text-center text-gray-400 text-sm py-2">無型號</p>}
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(carInventory).length === 0 && (
                    <p className="text-center text-gray-400 py-4 border-dashed border rounded-lg">請添加第一個製造商</p>
                )}
              </div>
            </Card>


            {/* Exchange Rate and Fee Management */}

            <Card className="p-5">
              <SectionHeader icon={DollarSign} title="匯率管理 (Exchange Rates)" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.values(COUNTRIES).map(c => (
                  <InputGroup
                    key={c.id}
                    label={`${c.currency} -> HKD`}
                    value={rates[c.id]}
                    onChange={(val) => handleRateChange(c.id, val)}
                    step="0.001"
                  />
                ))}
              </div>
              <div className="mt-2 flex items-start gap-2 text-sm text-gray-500 bg-yellow-50 p-2 rounded">
                <Info className="w-4 h-4 mt-0.5 text-yellow-600" />
                <p>匯率數據儲存在雲端。更改後請記得按 **儲存設定**。</p>
              </div>
            </Card>

            <div className="space-y-8">
              {Object.values(COUNTRIES).map(c => (
                <div key={c.id} className="border-t pt-6 first:border-t-0 first:pt-0">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-sm">{c.id}</span>
                    {c.name} 預設費用 (不含首次登記稅)
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Origin Defaults */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm flex items-center gap-2">
                         當地貨幣 ({c.currency})
                      </h4>
                      {Object.entries(defaultFees[c.id].origin).map(([key, item]) => (
                        <div key={key} className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                             <input 
                               type="text" 
                               value={item.label}
                               className="w-full text-xs border-b border-transparent bg-transparent focus:border-blue-500 focus:outline-none"
                               readOnly 
                             />
                          </div>
                          <div className="w-32">
                            <InputGroup
                              label=""
                              value={item.val}
                              onChange={(val) => handleDefaultFeeChange(c.id, 'origin', key, val)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* HK Defaults */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                       <h4 className="font-medium text-blue-800 mb-3 text-sm">
                         香港固定費用 (HKD)
                       </h4>
                       {Object.entries(defaultFees[c.id].hk).map(([key, item]) => (
                        <div key={key} className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                          <div className="w-32">
                            <InputGroup
                              label=""
                              value={item.val}
                              onChange={(val) => handleDefaultFeeChange(c.id, 'hk', key, val)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
