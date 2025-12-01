import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // 引用您的 App 組件 (即原 HongKongCarDealerTool.jsx)
import './index.css'; // 假設您會設定 Tailwind CSS

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
