import { useState, useCallback } from 'react';
import Terminal from './components/Terminal';
import FileExplorer from './components/FileExplorer';
import SystemStats from './components/SystemStats';
import ConnectionManager from './components/ConnectionManager';
import SettingsPanel from './components/SettingsPanel';
import SnmpManager from './components/snmp/SnmpManager';
import { X, Plus, TerminalSquare, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import appIcon from './assets/icon.png';

export interface ActiveSession {
  id: string;
  label: string;
  host: string;
  type?: 'ssh' | 'snmp';
  snmpCreds?: any;
}

export default function App() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showManager, setShowManager] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const handleConnect = useCallback((sessionId: string, label: string, host: string, type: 'ssh' | 'snmp' = 'ssh', snmpCreds?: any) => {
    setSessions(prev => [...prev, { id: sessionId, label, host, type, snmpCreds }]);
    setActiveId(sessionId);
    setShowManager(false);
  }, []);

  const handleDisconnect = useCallback(async (sessionId: string) => {
    try { await invoke('disconnect_ssh', { sessionId }); } catch (e) { console.error(e); }
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (activeId === sessionId) {
        const fallback = next.length > 0 ? next[next.length - 1].id : null;
        setActiveId(fallback);
        if (!fallback) setShowManager(true);
      }
      return next;
    });
  }, [activeId]);

  const handleOpenManager = useCallback(() => {
    setShowManager(true);
    setActiveId(null);
  }, []);


  return (
    <>
      {/* Premium VS Code-inspired Titlebar — Handles macOS Traffic Lights & Dragging */}
      <div className="window-titlebar" data-tauri-drag-region>
        <div className="titlebar-left" style={{ gap: '8px' }}>
          <img src={appIcon} alt="Terminalator Logo" style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0 }} />
          <span className="titlebar-brand">Terminalator</span>
        </div>
        <div className="titlebar-center" data-tauri-drag-region>
          {activeId ? sessions.find(s => s.id === activeId)?.label : 'Dashboard'}
        </div>
        <div className="titlebar-right">
          <button
            className="icon-btn"
            onClick={() => setShowSettings(v => !v)}
            title="Preferences"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Session Tab Bar — Rendered directly below the titlebar */}
      {sessions.length > 0 && (
        <div className="tab-bar">
          {sessions.map(s => (
            <button
              key={s.id}
              className={`tab-item${s.id === activeId && !showManager ? ' tab-active' : ''}`}
              onClick={() => { setActiveId(s.id); setShowManager(false); }}
            >
              <TerminalSquare size={12} />
              <span className="tab-label">{s.label}</span>
              <span className="tab-close" onClick={e => { e.stopPropagation(); handleDisconnect(s.id); }}>
                <X size={11} />
              </span>
            </button>
          ))}
          <button className="tab-new" onClick={handleOpenManager} title="New connection">
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Main body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {showManager ? (
          <ConnectionManager onConnect={handleConnect} />
        ) : (
          <>
            {sessions.map(s => {
              const isActive = s.id === activeId;
              return (
                <div
                  className="app-container"
                  key={s.id}
                  style={{ display: isActive ? 'flex' : 'none' }}
                >
                  {s.type === 'snmp' ? (
                    <SnmpManager initialCreds={s.snmpCreds} />
                  ) : (
                    <>
                      {/* Sidebar */}
                      <div className="sidebar">
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--separator)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.78rem', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.host}
                          </span>
                        </div>
                        <FileExplorer sessionId={s.id} isActive={isActive} />
                      </div>

                      {/* Main: terminal + status bar */}
                      <div className="main-content">
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', overflow: 'hidden', gap: '0' }}>
                          <div
                            className="glass-panel"
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '10px', overflow: 'hidden' }}
                          >
                            <div style={{
                              background: 'rgba(44,44,46,0.6)',
                              padding: '6px 14px',
                              borderBottom: '1px solid var(--separator)',
                              fontSize: '0.75rem',
                              color: 'var(--label-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexShrink: 0,
                            }}>
                              <TerminalSquare size={11} color="var(--accent-primary)" />
                              <span>{s.label}</span>
                            </div>
                            <Terminal sessionId={s.id} />
                          </div>
                        </div>
                        <SystemStats sessionId={s.id} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  );
}
