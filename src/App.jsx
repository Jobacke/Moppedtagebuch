import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Bike, Settings, DollarSign, Wrench, Package, Camera, Zap, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useDocument, useCollection, triggerManualFirestoreRefresh } from './hooks/useFirestore';
import Dashboard from './components/Dashboard';
import TechnicalData from './components/TechnicalData';
import Finance from './components/Finance';
import Service from './components/Service';
import Accessories from './components/Accessories';
import Gallery from './components/Gallery';
import Login from './components/Login';
import PinLock from './components/PinLock';
import QuickEntryModal from './components/QuickEntryModal';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

function parseQuickUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const hasQuickTrigger =
    params.has('quick') ||
    params.has('km') ||
    params.has('addKm') ||
    params.has('amount');

  if (!hasQuickTrigger) return null;

  return {
    quick: params.get('quick') === '1' || params.get('quick') === 'true',
    km: params.get('km') || '',
    addKm: params.get('addKm') || '',
    amount: params.get('amount') || '',
    station: params.get('station') || '',
    cat: params.get('cat') || 'Fuel',
    desc: params.get('desc') || '',
    date: params.get('date') || '',
    autosave: params.get('autosave') === '1' || params.get('autosave') === 'true'
  };
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function MainRouter() {
  const { currentUser } = useAuth();
  const [pin] = useState(localStorage.getItem('mopped_pin') || '3706');
  const [isLocked, setIsLocked] = useState(() => {
    const unlockedUntil = parseInt(localStorage.getItem('mopped_unlocked_until') || '0', 10);
    const hasQuickLink = Boolean(parseQuickUrlParams());
    if (unlockedUntil > Date.now() || hasQuickLink) {
      return false;
    }
    return true;
  });

  if (!currentUser) {
    return <Login />;
  }

  const handleLock = () => {
    localStorage.removeItem('mopped_unlocked_until');
    setIsLocked(true);
  };

  if (isLocked) {
    const checkPin = (inputPin) => {
      if (inputPin === pin) {
        localStorage.setItem('mopped_unlocked_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
        setIsLocked(false);
        return true;
      }
      return false;
    };
    return <PinLock onUnlock={checkPin} />;
  }

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <MainLayout onLock={handleLock} />
    </Router>
  );
}

function MainLayout({ onLock }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: techData, update: updateTechData } = useDocument('technical_data');
  const { add: addFinanceEntry } = useCollection('finance');

  const [quickParams, setQuickParams] = useState(() => parseQuickUrlParams());
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(() => Boolean(parseQuickUrlParams()));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const clearUrlParams = () => {
    setQuickParams(null);
    if (window.location.search) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  // Alle 15 Sekunden im Vordergrund (besonders für iOS Home-Screen-App) live vom Server abgleichen
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerManualFirestoreRefresh();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = () => {
    setIsRefreshing(true);
    triggerManualFirestoreRefresh();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const navItems = [
    { path: '/', label: 'Übersicht', icon: <Bike size={20} /> },
    { path: '/tech', label: 'Technik', icon: <Settings size={20} /> },
    { path: '/finance', label: 'Finanzen', icon: <DollarSign size={20} /> },
    { path: '/service', label: 'Service', icon: <Wrench size={20} /> },
    { path: '/accessories', label: 'Zubehör', icon: <Package size={20} /> },
    { path: '/gallery', label: 'Galerie', icon: <Camera size={20} /> },
  ];

  return (
    <div className="app-container fade-in">
      <header style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--kawasaki-green)' }}>Moppedtagebuch</h1>
          <span style={{
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '1px 6px',
            borderRadius: '6px',
            fontWeight: '600',
            letterSpacing: '0.3px'
          }}>v1.9</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setIsQuickModalOpen(true)}
            style={{
              background: 'rgba(105, 190, 40, 0.16)',
              border: '1px solid rgba(105, 190, 40, 0.4)',
              color: 'var(--kawasaki-green)',
              borderRadius: '999px',
              padding: '6px 11px',
              fontSize: '0.76rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Schnell-Eintrag öffnen"
          >
            <Zap size={14} /> Schnell-Check
          </button>
          <button
            onClick={handleManualSync}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: isRefreshing ? 'var(--kawasaki-green)' : 'var(--text-secondary)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Jetzt mit Cloud synchronisieren"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-icon' : ''} />
          </button>
          <button onClick={onLock} style={{ background: 'none', color: 'var(--text-secondary)', padding: '4px' }} title="App sperren">
            <Lock size={19} />
          </button>
        </div>
      </header>

      <main style={{ padding: '0 1rem 6rem 1rem' }}>
        <Routes>
          <Route path="/" element={<Dashboard onOpenQuickEntry={() => setIsQuickModalOpen(true)} />} />
          <Route path="/tech" element={<TechnicalData />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/service" element={<Service />} />
          <Route path="/accessories" element={<Accessories />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>
      </main>

      <QuickEntryModal
        isOpen={isQuickModalOpen}
        onClose={() => {
          setIsQuickModalOpen(false);
          clearUrlParams();
        }}
        techData={techData}
        updateTechData={updateTechData}
        addFinanceEntry={addFinanceEntry}
        initialParams={quickParams || {}}
        onClearParams={clearUrlParams}
      />

      <nav className="nav-bar">
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <style>{`
        @keyframes spin360 {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .spin-icon {
            animation: spin360 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default App;
