import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Bike, Settings, DollarSign, Wrench, Package, Camera } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './components/Dashboard';
import TechnicalData from './components/TechnicalData';
import Finance from './components/Finance';
import Service from './components/Service';
import Accessories from './components/Accessories';
import Gallery from './components/Gallery';
import Login from './components/Login';
import PinLock from './components/PinLock';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

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
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState(localStorage.getItem('mopped_pin') || '1234');

  if (!currentUser) {
    return <Login />;
  }

  if (isLocked) {
    const checkPin = (inputPin) => {
      if (inputPin === pin) {
        setIsLocked(false);
        return true;
      }
      return false;
    };
    return <PinLock onUnlock={checkPin} />;
  }

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <MainLayout onLock={() => setIsLocked(true)} />
    </Router>
  );
}

function MainLayout({ onLock }) {
  const navigate = useNavigate();
  const location = useLocation();

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
        <button onClick={onLock} style={{ background: 'none', color: 'var(--text-secondary)' }}>
          <Lock size={20} />
        </button>
      </header>

      <main style={{ padding: '0 1rem 6rem 1rem' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tech" element={<TechnicalData />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/service" element={<Service />} />
          <Route path="/accessories" element={<Accessories />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>
      </main>

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
