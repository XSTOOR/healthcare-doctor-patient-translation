import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Menu,
  X,
  LogOut,
  User,
  Stethoscope,
  MessageSquare,
  FileText,
  Search
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: MessageSquare },
    { name: 'Conversations', href: '/dashboard', icon: MessageSquare },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '260px',
        background: 'white',
        borderRight: '1px solid #e5e7eb',
        zIndex: 40,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease'
      }}>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
              borderRadius: '50%'
            }}>
              <Stethoscope size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
                Healthcare
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Translation Platform
              </p>
            </div>
          </div>

          <nav>
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '0.5rem',
                  color: '#374151',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={20} />
                <span style={{ fontWeight: '500' }}>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                background: '#e0e7ff',
                borderRadius: '50%',
                color: '#4f46e5',
                fontWeight: '600',
                fontSize: '0.875rem'
              }}>
                {user?.firstName?.[0] || user?.email?.[0] || 'U'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user?.firstName} {user?.lastName}
                </p>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user?.role === 'doctor' ? 'Doctor' : 'Patient'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-block"
            style={{ fontSize: '0.875rem' }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: '0', width: '100%' }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              '@media (min-width: 768px)': {
                display: 'none'
              }
            }}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div style={{ flex: 1 }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                color: '#374151',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Search size={16} />
              <span style={{ display: 'inline', fontSize: '0.875rem' }}>
                Search
              </span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '1.5rem' }}>
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 35
          }}
        />
      )}
    </div>
  );
};

export default Layout;
