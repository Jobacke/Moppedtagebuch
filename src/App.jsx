import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Lock, Unlock, Bike, Wrench, DollarSign, Package, Settings, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';
import TechnicalData from './components/TechnicalData';
import Finance from './components/Finance';
import Service from './components/Service';
import Accessories from './components/Accessories';
import PinLock from './components/PinLock';
import './index.css';

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState(localStorage.getItem('mopped_pin') || '1234');

  const checkPin = (inputPin) => {
    if (inputPin === pin) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Auto-lock on idle could be added here
  }, []);

  if (isLocked) {
    return <PinLock onUnlock={checkPin} />;
  }

  return (
    <Router>
      <MainLayout />
    </Router>
  );
}

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Übersicht', icon: <Bike size={24} /> },
    { path: '/tech', label: 'Technik', icon: <Settings size={24} /> },
    { path: '/finance', label: 'Finanzen', icon: <DollarSign size={24} /> },
    { path: '/service', label: 'Service', icon: <Wrench size={24} /> },
    { path: '/accessories', label: 'Zubehör', icon: <Package size={24} /> },
  ];

  return (
    <div className="app-container fade-in">
      <header style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--kawasaki-green)' }}>Moppedtagebuch</h1>
        <button onClick={() => window.location.reload()} style={{ background: 'none', color: 'var(--text-secondary)' }}>
          <Lock size={20} />
        </button>
      </header>

      <main style={{ padding: '0 1rem 5rem 1rem' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tech" element={<TechnicalData />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/service" element={<Service />} />
          <Route path="/accessories" element={<Accessories />} />
        </Routes>
      </main>

      <nav className="nav-bar">
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
    </div>
  );
}

export default App;
