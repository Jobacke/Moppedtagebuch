import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Bike, Wallet, Wrench, Plus, RefreshCw, Gauge } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useDocument, useCollection, triggerManualFirestoreRefresh } from './hooks/useFirestore';
import Dashboard from './components/Dashboard';
import TechnicalData from './components/TechnicalData';
import Finance from './components/Finance';
import Service from './components/Service';
import Accessories from './components/Accessories';
import Gallery from './components/Gallery';
import MachineSection from './components/MachineSection';
import Login from './components/Login';
import PinLock from './components/PinLock';
import QuickEntryModal from './components/QuickEntryModal';
import ErrorBoundary from './components/ErrorBoundary';
import BikeEmblem from './components/BikeEmblem';
import { createPinRecord, verifyPin } from './utils/pin';
import './index.css';

const APP_VERSION = 'v1.20';

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

  if (!currentUser) {
    return <Login />;
  }

  return <PinGate />;
}

const UNLOCK_KEY = 'mopped_unlocked_until';
const UNLOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function PinGate() {
  // PIN liegt nur als PBKDF2-Hash in users/{uid}/data/security – nie im Quellcode
  const { data: security, update: updateSecurity, loading } = useDocument('security');
  const hasQuickLink = Boolean(parseQuickUrlParams());
  const [isLocked, setIsLocked] = useState(() => {
    const unlockedUntil = parseInt(localStorage.getItem(UNLOCK_KEY) || '0', 10);
    return !(unlockedUntil > Date.now() || hasQuickLink);
  });

  // Alte, im Code hinterlegte PIN-Überschreibung entfernen
  useEffect(() => {
    localStorage.removeItem('mopped_pin');
  }, []);

  const unlock = () => {
    localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_DURATION_MS));
    setIsLocked(false);
  };

  const handleLock = () => {
    localStorage.removeItem(UNLOCK_KEY);
    setIsLocked(true);
  };

  if (loading && !security) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <BikeEmblem size={170} state="pulse" />
      </div>
    );
  }

  const hasPin = Boolean(security?.pinHash);

  // Noch kein eigener PIN → einmalig festlegen (Schnell-Links aus der Mail funktionieren trotzdem)
  if (!hasPin && !hasQuickLink) {
    return (
      <PinLock
        mode="setup"
        onSetPin={async (newPin) => {
          await updateSecurity(await createPinRecord(newPin));
          unlock();
        }}
      />
    );
  }

  if (isLocked) {
    return (
      <PinLock
        mode="unlock"
        onUnlock={async (inputPin) => {
          const ok = await verifyPin(inputPin, security);
          if (ok) unlock();
          return ok;
        }}
      />
    );
  }

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <MainLayout onLock={handleLock} />
    </Router>
  );
}

const MACHINE_PATHS = ['/tech', '/accessories', '/gallery'];

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

  // Beim Seitenwechsel nach oben scrollen
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const handleManualSync = () => {
    setIsRefreshing(true);
    triggerManualFirestoreRefresh();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  // Seitenwechsel mit sanfter View-Transition (wo unterstützt)
  const go = useCallback((path, options) => {
    if (path === location.pathname && !options?.state) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(() => {
        flushSync(() => navigate(path, options));
      });
    } else {
      navigate(path, options);
    }
  }, [navigate, location.pathname]);

  const openQuick = () => setIsQuickModalOpen(true);

  const isMachine = MACHINE_PATHS.includes(location.pathname);
  const tabs = [
    { path: '/', label: 'Übersicht', icon: <Gauge size={22} />, active: location.pathname === '/' },
    { path: '/finance', label: 'Kosten', icon: <Wallet size={22} />, active: location.pathname === '/finance' },
    { fab: true },
    { path: '/service', label: 'Service', icon: <Wrench size={22} />, active: location.pathname === '/service' },
    { path: '/tech', label: 'Maschine', icon: <Bike size={22} />, active: isMachine },
  ];

  return (
    <div className="app-container">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><Bike size={20} /></div>
          <span className="brand-name">Moppedtagebuch</span>
          <span className="version-badge">{APP_VERSION}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            onClick={handleManualSync}
            aria-label="Jetzt mit Cloud synchronisieren"
            title="Jetzt mit Cloud synchronisieren"
          >
            <RefreshCw size={18} className={isRefreshing ? 'spin-icon' : ''} />
          </button>
          <button className="icon-btn" onClick={onLock} aria-label="App sperren" title="App sperren">
            <Lock size={18} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard onOpenQuickEntry={openQuick} onNavigate={go} />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/service" element={<Service />} />
          <Route path="/tech" element={<MachineSection onNavigate={go}><TechnicalData /></MachineSection>} />
          <Route path="/accessories" element={<MachineSection onNavigate={go}><Accessories /></MachineSection>} />
          <Route path="/gallery" element={<MachineSection onNavigate={go}><Gallery /></MachineSection>} />
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

      <nav className="nav-bar" aria-label="Hauptnavigation">
        {tabs.map((tab) =>
          tab.fab ? (
            <button
              key="fab"
              className="nav-fab"
              onClick={openQuick}
              aria-label="KM-Stand oder Tankrechnung erfassen"
              title="KM & Tanken erfassen"
            >
              <Plus size={28} strokeWidth={2.6} />
            </button>
          ) : (
            <button
              key={tab.path}
              className={`nav-item ${tab.active ? 'active' : ''}`}
              onClick={() => go(tab.path)}
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.icon}
              <span className="nav-label">{tab.label}</span>
            </button>
          )
        )}
      </nav>
    </div>
  );
}

export default App;
