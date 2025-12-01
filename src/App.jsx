import React, { useState, useEffect } from 'react';
import { Settings, Calculator, Save, RotateCcw, Truck, Ship, FileText, DollarSign, Globe, Info, Car, Calendar, List, Trash2, PlusCircle } from 'lucide-react';

// --- Default Data & Configuration ---

const DEFAULT_RATES = {
  JP: 0.053, // JPY to HKD
  UK: 10.2,  // GBP to HKD
  DE: 8.6,   // EUR to HKD
};

const COUNTRIES = {
  JP: { id: 'JP', name: '日本 (Japan)', currency: 'JPY', symbol: '¥' },
  UK: { id: 'UK', name: '英國 (UK)', currency: 'GBP', symbol: '£' },
  DE: { id: 'DE', name: '德國 (Germany)', currency: 'EUR', symbol: '€' },
};

// Default Fees Structure
const DEFAULT_FEES = {
  JP: {
    origin: {
      auctionFee: { label: '拍賣場/FOB費用', val: 20000 },
      shipping: { label: '船運費', val: 100000 },
    },
    hk: {
      transport: { label: '本地拖車/運輸', val: 2000 },
      inspection: { label: '驗車/政府排氣', val: 5500 },
      parts: { label: '更換配件/維修', val: 3000 },
      insurance: { label: '保險費', val: 1500 },
      license: { label: '牌費', val: 5800 },
      tax: { label: '預算首次登記稅 (FRT)', val: 0 },
    }
  },
  UK: {
    origin: {
      auctionFee: { label: '出口手續費', val: 500 },
      shipping: { label: '船運費', val: 1500 },
    },
    hk: {
      transport: { label: '本地拖車/運輸', val: 2000 },
      inspection: { label: '驗車/政府排氣', val: 6500 },
      parts: { label: '更換配件/維修', val: 4000 },
      insurance: { label: '保險費', val: 2000 },
      license: { label: '牌費', val: 5800 },
      tax: { label: '預算首次登記稅 (FRT)', val: 0 },
    }
  },
  DE: {
    origin: {
      auctionFee: { label: '出口手續費', val: 400 },
      shipping: { label: '船運費', val: 1200 },
    },
    hk: {
      transport: { label: '本地拖車/運輸', val: 2000 },
      inspection: { label: '驗車/政府排氣', val: 6500 },
      parts: { label: '更換配件/維修', val: 4000 },
      insurance: { label: '保險費', val: 2000 },
      license: { label: '牌費', val: 5800 },
      tax: { label: '預算首次登記稅 (FRT)', val: 0 },
    }
  }
};

// --- Components ---

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

const InputGroup = ({ label, value, onChange, prefix, type = "number", step = "1", placeholder = "" }) => (
  <div className="mb-3">
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    <div className="relative rounded-md shadow-sm">
      {prefix && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500 sm:text-sm">{prefix}</span>
        </div>
      )}
      <input
        type={type}
        step={step}
        className={`focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 ${prefix ? 'pl-8' : 'pl-3'}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState('calculator'); // 'calculator' | 'settings' | 'history'
  const [selectedCountry, setSelectedCountry] = useState('JP');
  
  // Settings State (Persisted)
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [defaultFees, setDefaultFees] = useState(DEFAULT_FEES);

  // Calculator State (Temporary)
  const [carPrice, setCarPrice] = useState('');
  const [currentOriginFees, setCurrentOriginFees] = useState(DEFAULT_FEES['JP'].origin);
  const [currentHKFees, setCurrentHKFees] = useState(DEFAULT_FEES['JP'].hk);
  
  // New Car Details State
  const [carDetails, setCarDetails] = useState({
    make: '',
    model: '',
    year: '',
    code: ''
  });

  // History State
  const [history, setHistory] = useState([]);

  // Load settings & history from local storage on mount
  useEffect(() => {
    const savedRates = localStorage.getItem('hkCarDealer_rates');
    const savedFees = localStorage.getItem('hkCarDealer_fees');
    const savedHistory = localStorage.getItem('hkCarDealer_history');

    if (savedRates) setRates(JSON.parse(savedRates));
    if (savedFees) setDefaultFees(JSON.parse(savedFees));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // When country changes, reset fees to defaults but KEEP car details
  useEffect(() => {
    setCurrentOriginFees(defaultFees[selectedCountry].origin);
    setCurrentHKFees(defaultFees[selectedCountry].hk);
    setCarPrice('');
  }, [selectedCountry, defaultFees]);

  // Save settings handler
  const saveSettings = () => {
    localStorage.setItem('hkCarDealer_rates', JSON.stringify(rates));
    localStorage.setItem('hkCarDealer_fees', JSON.stringify(defaultFees));
    alert('設定已儲存！');
  };

  const resetSettings = () => {
    if(window.confirm('確定要重置所有設定回預設值嗎？')) {
      setRates(DEFAULT_RATES);
      setDefaultFees(DEFAULT_FEES);
      localStorage.removeItem('hkCarDealer_rates');
      localStorage.removeItem('hkCarDealer_fees');
    }
  };

  // --- Calculations ---
  
  const currentCurrency = COUNTRIES[selectedCountry];
  const currentRate = rates[selectedCountry];

  // 1. Car Cost in HKD
  const carPriceVal = parseFloat(carPrice) || 0;
  const carPriceHKD = carPriceVal * currentRate;

  // 2. Origin Fees in HKD
  let totalOriginFeesNative = 0;
  Object.values(currentOriginFees).forEach(fee => {
    totalOriginFeesNative += parseFloat(fee.val) || 0;
  });
  const totalOriginFeesHKD = totalOriginFeesNative * currentRate;

  // 3. HK Fees in HKD
  let totalHKFees = 0;
  Object.values(currentHKFees).forEach(fee => {
    totalHKFees += parseFloat(fee.val) || 0;
  });

  // 4. Grand Total
  const grandTotal = carPriceHKD + totalOriginFeesHKD + totalHKFees;

  // Formatters
  const fmtMoney = (amount, currency = 'HKD') => {
    return new Intl.NumberFormat('zh-HK', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(amount);
  };

  // --- Handlers ---

  const handleCarDetailChange = (field, value) => {
    setCarDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleOriginFeeChange = (key, value) => {
    setCurrentOriginFees(prev => ({
      ...prev,
      [key]: { ...prev[key], val: value }
    }));
  };

  const handleHKFeeChange = (key, value) => {
    setCurrentHKFees(prev => ({
      ...prev,
      [key]: { ...prev[key], val: value }
    }));
  };

  const handleRateChange = (countryId, val) => {
    setRates(prev => ({ ...prev, [countryId]: val }));
  };

  const handleDefaultFeeChange = (countryId, type, key, val) => {
    setDefaultFees(prev => ({
      ...prev,
      [countryId]: {
        ...prev[countryId],
        [type]: {
          ...prev[countryId][type],
          [key]: { ...prev[countryId][type][key], val: val }
        }
      }
    }));
  };

  const saveToHistory = () => {
    if (grandTotal === 0) {
      alert('估算總額為 0，無法儲存。');
      return;
    }

    const newRecord = {
      id: Date.now(),
      date: new Date().toLocaleString('zh-HK'),
      countryId: selectedCountry,
      carDetails: { ...carDetails },
      calculations: {
        rate: currentRate,
        carPriceNative: carPriceVal,
        carPriceHKD,
        totalOriginFeesHKD,
        totalHKFees,
        grandTotal
      }
    };

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('hkCarDealer_history', JSON.stringify(updatedHistory));
    
    // Optional: Clear form or give feedback
    if(window.confirm('已儲存至記錄！是否查看記錄？')) {
        setActiveTab('history');
    }
  };

  const deleteHistoryItem = (id) => {
    if (window.confirm('確定要刪除這條記錄嗎？')) {
      const updatedHistory = history.filter(item => item.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('hkCarDealer_history', JSON.stringify(updatedHistory));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* Header */}
      <div className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-300" />
            <h1 className="text-lg font-bold tracking-wide hidden sm:block">HK 汽車行家助手</h1>
            <h1 className="text-lg font-bold tracking-wide sm:hidden">行家助手</h1>
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
                  <span className="text-xs text-gray-500">匯率: {rates[c.id]}</span>
                </button>
              ))}
            </div>

            {/* Car Details Form */}
            <Card className="p-5">
              <SectionHeader icon={Car} title="車輛資料 (可選填)" color="text-gray-600" />
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label="製造商 (Manufacturer)" 
                  type="text" 
                  placeholder="e.g. Toyota" 
                  value={carDetails.make} 
                  onChange={(v) => handleCarDetailChange('make', v)} 
                  prefix=""
                />
                <InputGroup 
                  label="型號 (Model)" 
                  type="text" 
                  placeholder="e.g. Alphard" 
                  value={carDetails.model} 
                  onChange={(v) => handleCarDetailChange('model', v)} 
                  prefix=""
                />
                <InputGroup 
                  label="製造年份 (Year)" 
                  type="text" 
                  placeholder="e.g. 2023" 
                  value={carDetails.year} 
                  onChange={(v) => handleCarDetailChange('year', v)} 
                  prefix=""
                />
                <InputGroup 
                  label="型號代碼 (Model Code)" 
                  type="text" 
                  placeholder="e.g. AGH30" 
                  value={carDetails.code} 
                  onChange={(v) => handleCarDetailChange('code', v)} 
                  prefix=""
                />
              </div>
            </Card>

            {/* Main Input: Car Price */}
            <Card className="p-5 border-l-4 border-l-blue-600">
              <SectionHeader icon={DollarSign} title="車輛成本 (來源地)" color="text-blue-600" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <InputGroup 
                  label={`車價 (${currentCurrency.currency})`}
                  prefix={currentCurrency.symbol}
                  value={carPrice}
                  onChange={setCarPrice}
                  placeholder="例如: 1500000"
                />
                <div className="bg-gray-100 p-3 rounded-lg text-right mb-3">
                  <span className="text-xs text-gray-500 block">折合港幣 (不含稅費)</span>
                  <span className="text-xl font-bold text-gray-800">{fmtMoney(carPriceHKD)}</span>
                </div>
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
                    <span className="text-gray-500">小計 (HKD)</span>
                    <span className="font-bold text-indigo-700">{fmtMoney(totalOriginFeesHKD)}</span>
                  </div>
                </div>
              </Card>

              {/* HK Fees */}
              <Card className="p-4">
                <SectionHeader icon={Ship} title="香港本地雜費 (HKD)" color="text-green-600" />
                <div className="space-y-2">
                  {Object.entries(currentHKFees).map(([key, item]) => (
                    <InputGroup
                      key={key}
                      label={item.label}
                      prefix="$"
                      value={item.val}
                      onChange={(val) => handleHKFeeChange(key, val)}
                    />
                  ))}
                  <div className="pt-2 border-t mt-2 flex justify-between items-center text-sm">
                    <span className="text-gray-500">小計</span>
                    <span className="font-bold text-green-700">{fmtMoney(totalHKFees)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Grand Total Bar */}
            <div className="sticky bottom-4 bg-gray-900 text-white p-4 rounded-2xl shadow-xl z-20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-gray-400 text-xs sm:text-sm">預計總成本 (HKD)</span>
                     <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">匯率 {currentRate}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-baseline gap-1">
                    {fmtMoney(grandTotal)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 hidden sm:flex gap-4">
                    <span>車價: {fmtMoney(carPriceHKD)}</span>
                    <span>當地雜: {fmtMoney(totalOriginFeesHKD)}</span>
                    <span>香港雜: {fmtMoney(totalHKFees)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={saveToHistory}
                  disabled={grandTotal <= 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>記錄預算</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <List className="w-6 h-6 text-blue-600" />
                過往估算記錄
              </h2>
              <span className="text-sm text-gray-500">共 {history.length} 筆</span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">暫無記錄，請到計算器進行估算。</p>
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
                          {item.carDetails.make || '---'} {item.carDetails.model}
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
                          匯率 @ {item.calculations.rate}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs text-center text-gray-500">
                      <div>
                        <div className="font-medium text-gray-400">當地車價 (HKD)</div>
                        <div>{fmtMoney(item.calculations.carPriceHKD)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-400">當地雜費 (HKD)</div>
                        <div>{fmtMoney(item.calculations.totalOriginFeesHKD)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-400">香港雜費 (HKD)</div>
                        <div>{fmtMoney(item.calculations.totalHKFees)}</div>
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
                  <Save className="w-4 h-4" /> 儲存設定
                </button>
              </div>
            </div>

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
                <p>修改此處匯率會影響所有計算結果。請定期更新以保持準確性。</p>
              </div>
            </Card>

            <div className="space-y-8">
              {Object.values(COUNTRIES).map(c => (
                <div key={c.id} className="border-t pt-6 first:border-t-0 first:pt-0">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-sm">{c.id}</span>
                    {c.name} 預設費用
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
                         香港費用 (HKD)
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
