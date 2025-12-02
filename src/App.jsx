import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle, Search, ChevronDown, X, CheckCircle, AlertTriangle, Lock, Unlock, Loader2, ArrowLeft } from 'lucide-react';

// --- Firebase CDN Imports (Using standard React package imports) ---
// Note: These imports are standard for a React environment.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, doc, collection, query, onSnapshot, setDoc, setLogLevel } from 'firebase/firestore';

// 設定 Firebase 偵錯日誌，方便查看連線狀態
setLogLevel('debug');

// --- Component Utilities and Initial State ---

// Define the structure for default fees and settings (using mock initial data based on snippet)
const initialCategories = [
  { id: 'import', name: '進口車', icon: Truck },
  { id: 'local', name: '本地車', icon: Car },
];

const initialDefaultFees = {
  import: {
    global: {
      shipping: { label: '運費 (USD)', val: 2000 },
      insurance: { label: '保險', val: 500 },
    },
    hk: {
      registration: { label: '首次登記稅', val: 5000 },
      license: { label: '牌照費', val: 1000 },
    },
  },
  local: {
    global: {},
    hk: {
      registration: { label: '轉名費', val: 1000 },
      inspection: { label: '驗車費', val: 800 },
    },
  }
};

const InputGroup = ({ label, value, onChange, min = 0, prefix = '' }) => (
  <div className="flex flex-col">
    {label && <label className="text-xs font-medium text-gray-500 mb-1">{label}</label>}
    <div className="flex items-center rounded-lg border border-gray-300 shadow-sm overflow-hidden">
      {prefix && <span className="text-gray-500 pl-3 pr-1 text-sm">{prefix}</span>}
      <input
        type="number"
        value={value === null || value === undefined ? '' : value}
        min={min}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : parseFloat(v));
        }}
        className="w-full p-2 text-sm focus:ring-blue-500 focus:border-blue-500 border-0"
      />
    </div>
  </div>
);

// Helper function to simulate deep merge or update, ensuring state immutability
const updateNestedState = (obj, path, value) => {
  if (!path || path.length === 0) return value;
  const [head, ...tail] = path;

  if (tail.length === 0) {
    // Correctly handle non-existent keys during update
    const nextObj = Array.isArray(obj) ? [...obj] : { ...obj };
    if (Array.isArray(obj)) {
      nextObj[parseInt(head)] = value;
    } else {
      nextObj[head] = value;
    }
    return nextObj;
  }

  const current = obj && obj[head] ? obj[head] : (isNaN(parseInt(tail[0])) ? {} : []);

  const nextObj = Array.isArray(obj) ? [...obj] : { ...obj };
  nextObj[head] = updateNestedState(current, tail, value);
  
  return nextObj;
};


export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for the application data
  const [categories, setCategories] = useState(initialCategories);
  const [defaultFees, setDefaultFees] = useState(initialDefaultFees);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'calculator'

  // --- 1. Firebase Initialization and Authentication (FIXED FOR CANVAS ENVIRONMENT) ---
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        setError(null);
        
        // 1. Mandatory Global Variables Access
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        if (!firebaseConfig) {
          throw new Error('Firebase config not found. Please ensure __firebase_config is set.');
        }

        // 2. Initialize App and Services
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authService = getAuth(app);

        // 3. Set Persistence to inMemoryPersistence (CRITICAL FIX for "Access to storage not allowed" error)
        await setPersistence(authService, inMemoryPersistence);

        // 4. Authentication logic
        if (initialAuthToken) {
          await signInWithCustomToken(authService, initialAuthToken);
        } else {
          // Fallback to anonymous sign-in if token is missing
          await signInAnonymously(authService);
        }

        // 5. Set services in state and listen for auth changes
        setDb(firestore);
        setAuth(authService);
        
        const unsubscribe = onAuthStateChanged(authService, (user) => {
          if (user) {
            setUserId(user.uid);
            console.log('User signed in:', user.uid);
          } else {
            setUserId(null);
            console.log('User signed out.');
          }
          setIsAuthReady(true);
        });

        return () => unsubscribe();

      } catch (e) {
        console.error('Firebase Init/Auth Error:', e);
        // Display a user-friendly error
        setError(`Firebase初始化或認證錯誤: ${e.message}`);
        setIsAuthReady(true); 
      } finally {
        setIsLoading(false);
      }
    };

    initializeFirebase();
  }, []); // Run once on component mount

  // --- 2. Data Persistence Functions ---

  // Function to save current settings to Firestore
  const saveSettings = useCallback(async () => {
    if (!db || !userId) {
      console.warn('Cannot save: Database not ready or user not authenticated.');
      return;
    }
    
    // Convert complex objects to JSON strings for robust storage
    const dataToSave = {
      categories: JSON.stringify(categories),
      defaultFees: JSON.stringify(defaultFees),
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };
    
    // Path: /artifacts/{appId}/public/data/settings/default
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const settingsPath = `artifacts/${appId}/public/data/settings`;
    const settingsRef = doc(db, settingsPath, 'default');
    
    try {
      await setDoc(settingsRef, dataToSave, { merge: true });
      console.log('Settings saved successfully.');
    } catch (e) {
      console.error('Error saving settings:', e);
      setError(`儲存設定失敗: ${e.message}`);
    }
  }, [db, userId, categories, defaultFees]);

  // --- 3. Firestore Data Subscription (Settings Data) ---
  useEffect(() => {
    // Guard clause: Do not attempt to query Firestore before Auth is ready and we have a userId/db instance
    if (!isAuthReady || !db || !userId) return;

    // Define the path for public application data
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const settingsPath = `artifacts/${appId}/public/data/settings`;
    const settingsRef = doc(db, settingsPath, 'default');
    
    console.log(`Subscribing to settings at: ${settingsPath}/default`);

    // Real-time listener for the settings document
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Settings data received:', data);
        
        // Safely parse and update state
        try {
          if (data.categories) setCategories(JSON.parse(data.categories));
          if (data.defaultFees) setDefaultFees(JSON.parse(data.defaultFees));
        } catch (e) {
          console.error('Error parsing Firestore data:', e);
          setError('載入設定數據時發生錯誤。數據可能已損壞。');
        }
      } else {
        console.log('Settings document not found. Attempting to save initial state.');
        // If document doesn't exist, create it with the initial data
        saveSettings(); 
      }
    }, (error) => {
      console.error('Firestore subscription error:', error);
      setError('數據庫連線錯誤，請檢查網路。');
    });

    return () => unsubscribe();
  }, [db, userId, isAuthReady, saveSettings]); // Added saveSettings to dependencies

  // --- 4. UI Handlers ---

  // Handler for fee changes (based on the snippet logic)
  const handleDefaultFeeChange = useCallback((categoryId, groupKey, feeKey, val) => {
    setDefaultFees(prev => 
      updateNestedState(prev, [categoryId, groupKey, feeKey, 'val'], val)
    );
  }, []);
  
  // Handler for category name changes
  const handleCategoryNameChange = useCallback((categoryId, newName) => {
    setCategories(prev => prev.map(c => 
      c.id === categoryId ? { ...c, name: newName } : c
    ));
  }, []);

  // Auto-save logic (simple debouncing via useEffect cleanup)
  useEffect(() => {
    if (db && isAuthReady) {
      // Only auto-save if settings have changed since last render
      const handler = setTimeout(saveSettings, 1000); // Wait 1s after last change
      return () => clearTimeout(handler);
    }
  }, [categories, defaultFees, saveSettings, db, isAuthReady]);
  
  // --- UI Components ---
  const Header = ({ title, icon: Icon, children }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shadow-sm rounded-t-xl">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <Icon className="w-5 h-5 text-blue-600" />
        {title}
      </h2>
      {children}
    </div>
  );
  
  const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {children}
    </div>
  );

  const Button = ({ onClick, children, className = '', icon: Icon, disabled = false }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1
        ${disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'}
        ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );

  const Tabs = ({ activeTab, setActiveTab }) => (
    <div className="flex bg-gray-100 rounded-lg p-1 mb-6 mt-6 shadow-inner">
      <button
        onClick={() => setActiveTab('calculator')}
        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === 'calculator' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-600 hover:text-blue-500'
        }`}
      >
        <Calculator className="w-4 h-4 inline mr-2" />
        計算器
      </button>
      <button
        onClick={() => setActiveTab('settings')}
        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === 'settings' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-600 hover:text-blue-500'
        }`}
      >
        <Settings className="w-4 h-4 inline mr-2" />
        設定
      </button>
    </div>
  );

  // --- Main Render ---

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="ml-3 text-lg text-gray-600 mt-4">正在連接數據庫，請稍候...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <Header title="香港汽車交易成本計算器" icon={DollarSign}>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {userId ? (
              <span className="flex items-center gap-1 text-green-600 p-2 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                已連線: {userId}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-600 p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                離線/錯誤
              </span>
            )}
            <Button onClick={saveSettings} icon={Save} disabled={!db || !userId} className="ml-2">手動儲存</Button>
          </div>
        </Header>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* Main Content: Calculator */}
        {activeTab === 'calculator' && (
          <Card className="mt-4">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">成本計算</h3>
            <p className="text-gray-600">這是最終的計算器，將根據您的設定來計算總成本。</p>
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium text-gray-700 mb-3">選擇車輛類別:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center p-3 border rounded-xl bg-white shadow-sm hover:ring-2 ring-blue-500 cursor-pointer transition">
                    <c.icon className="w-5 h-5 mr-2 text-blue-500" />
                    <span className="font-medium text-gray-700 text-sm">{c.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <Info className='w-4 h-4 inline mr-2'/>
                請注意：計算邏輯部分尚未完全實作，目前僅顯示設定介面。
              </div>
            </div>
          </Card>
        )}

        {/* Main Content: Settings */}
        {activeTab === 'settings' && (
          <div className="mt-4">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6">費用與類別設定</h3>

            <div className="space-y-6">
              {categories.map(c => (
                <div key={c.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center">
                      <c.icon className="w-5 h-5 mr-3 text-blue-600" />
                      <div className='flex-1'>
                        <InputGroup
                          label="類別名稱"
                          value={c.name}
                          onChange={(val) => handleCategoryNameChange(c.id, val)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 p-4">
                    
                    {/* Global Defaults */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-medium text-gray-800 mb-3 text-sm flex items-center gap-1">
                        <Globe className='w-4 h-4'/>
                        國際/全球費用
                      </h4>
                      {/* Using safe access and iteration */}
                      {Object.entries(defaultFees[c.id]?.global || {}).map(([key, item]) => (
                        <div key={key} className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            <span className='text-sm text-gray-700'>{item.label}</span>
                          </div>
                          <div className="w-32">
                            <InputGroup
                              label=""
                              value={item.val}
                              onChange={(val) => handleDefaultFeeChange(c.id, 'global', key, val)}
                              min={0}
                              prefix='$' // Assuming USD 
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* HK Defaults */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                       <h4 className="font-medium text-blue-800 mb-3 text-sm flex items-center gap-1">
                         <FileText className='w-4 h-4'/>
                         香港固定費用 (HKD)
                       </h4>
                       {/* FIX: 使用 ?. 和 || {} 確保結構存在 */}
                       {Object.entries(defaultFees[c.id]?.hk || {}).map(([key, item]) => (
                         <div key={key} className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                             <span className='text-sm text-blue-800'>{item.label}</span>
                          </div>
                          <div className="w-32">
                            <InputGroup
                              label=""
                              value={item.val}
                              onChange={(val) => handleDefaultFeeChange(c.id, 'hk', key, val)}
                              min={0}
                              prefix='HK$' // Clarify HKD
                            />
                          </div>
                        </div>
                       ))}
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center p-4">
                <Button className="bg-gray-500 hover:bg-gray-600 text-white" icon={PlusCircle} disabled={!db}>
                  新增車輛類別 (未實作)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
