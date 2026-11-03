import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Bike, Settings, DollarSign, Wrench, Package, Camera, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useDocument, useCollection } from './hooks/useFirestore';
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
        // Auf diesem Gerät für 7 Tage merken (bis manuell auf Lock geklickt wird)
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

  const clearUrlParams = () => {
    setQuickParams(null);
    if (window.location.search) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  // Optional: Sync pending email replies from Google Apps Script Bot if configured
  useEffect(() => {
    const webhookUrl = localStorage.getItem('mopped_bot_webhook_url');
    if (!webhookUrl || !techData) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${webhookUrl}?action=getPendingReplies`);
        if (!res.ok) return;
        const payload = await res.json();
        if (cancelled || !payload?.replies?.length) return;

        let latestKm = techData.currentKm;
        let latestDate = techData.lastUpdated || new Date().toISOString().split('T')[0];

        for (const item of payload.replies) {
          const entryDate = item.date || new Date().toISOString().split('T')[0];
          if (item.km) {
            latestKm = String(item.km);
            latestDate = entryDate;
          } else if (item.addKm && latestKm) {
            latestKm = String(parseInt(latestKm, 10) + parseInt(item.addKm, 10));
            latestDate = entryDate;
          }

          if (item.amount && parseFloat(item.amount) > 0) {
            await addFinanceEntry({
              date: entryDate,
              desc: item.desc || `Tanken${latestKm ? ` (${latestKm} km)` : ''}`,
              amount: parseFloat(item.amount).toFixed(2),
              cat: item.cat || 'Fuel',
              km: latestKm || ''
            });
            latestDate = entryDate;
          }
        }

        await updateTechData({
          ...techData,
          currentKm: latestKm,
          lastUpdated: latestDate,
          lastUpdatedIso: new Date().toISOString()
        });

        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ackReplies',
            currentKm: latestKm,
            nextServiceDue: techData.nextServiceDue || '52000',
            lastUpdated: latestDate
          })
        });
      } catch {
        // Silent fallback if bot URL is not reachable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [techData?.currentKm]);

  const navItems = [
    { path: '/', label: 'Übersicht', icon: <Bike size={24} /> },
    { path: '/tech', label: 'Technik', icon: <Settings size={24} /> },
    { path: '/finance', label: 'Finanzen', icon: <DollarSign size={24} /> },
    { path: '/service', label: 'Service', icon: <Wrench size={24} /> },
    { path: '/accessories', label: 'Zubehör', icon: <Package size={24} /> },
    { path: '/gallery', label: 'Galerie', icon: <Camera size={24} /> },
  ];

  return (
    <div className="app-container fade-in">
      <header style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--kawasaki-green)' }}>Moppedtagebuch</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            onClick={() => setIsQuickModalOpen(true)}
            style={{
              background: 'rgba(105, 190, 40, 0.16)',
              border: '1px solid rgba(105, 190, 40, 0.4)',
              color: 'var(--kawasaki-green)',
              borderRadius: '999px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Schnell-Eintrag öffnen"
          >
            <Zap size={14} /> Schnell-Check
          </button>
          <button onClick={onLock} style={{ background: 'none', color: 'var(--text-secondary)' }} title="App sperren">
            <Lock size={20} />
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

      <nav className="nav-bar scrollable-nav">
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span style={{ marginTop: 4 }}>{item.label}</span>
          </button>
        ))}
      </nav>
      {/* Scrollable nav styling */}
      <style>{`
        .scrollable-nav {
            overflow-x: auto;
            justify-content: flex-start;
            padding: 0 0.5rem;
        }
        .nav-item {
            min-width: 70px; /* Ensure 6 items fit or scroll */
        }
      `}</style>
    </div>
  );
}

export default App;
