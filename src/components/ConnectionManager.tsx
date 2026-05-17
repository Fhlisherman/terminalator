import React, { useState, useEffect } from 'react';
import { LogIn, Save, Trash2, KeyRound, FolderOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import appIcon from '../assets/icon.png';

interface SavedSession {
  id: string;
  name: string;
  type?: 'ssh' | 'snmp';
  host: string;
  port: string;
  username?: string;
  privateKey?: string;
  snmpVersion?: string;
  snmpCommunity?: string;
  snmpSecLevel?: string;
  snmpAuthProtocol?: string;
  snmpAuthPassword?: string;
  snmpPrivProtocol?: string;
  snmpPrivPassword?: string;
  snmpWalkedTree?: any[];
  snmpTasks?: any[];
}

interface ValidationErrors {
  host?: string;
  username?: string;
  port?: string;
  auth?: string;
  name?: string;
}

interface Props {
  onConnect: (sessionId: string, label: string, host: string, type?: 'ssh' | 'snmp', snmpCreds?: any) => void;
}

function validate(host: string, username: string, port: string, password: string, privateKey: string): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!host.trim()) errors.host = 'Host is required';
  else if (!/^[\w.-]+$/.test(host.trim())) errors.host = 'Invalid hostname / IP';
  if (!username.trim()) errors.username = 'Username is required';
  const portNum = parseInt(port, 10);
  if (!port || isNaN(portNum) || portNum < 1 || portNum > 65535) errors.port = 'Port must be 1–65535';
  if (!password.trim() && !privateKey.trim()) errors.auth = 'Provide a password or private key (or use SSH agent)';
  return errors;
}

export default function ConnectionManager({ onConnect }: Props) {
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('22');
  const [privateKey, setPrivateKey] = useState('');
  const [sessionName, setSessionName] = useState('');

  const [sessionType, setSessionType] = useState<'ssh' | 'snmp'>('ssh');
  const [snmpTarget, setSnmpTarget] = useState('');
  const [snmpPort, setSnmpPort] = useState('161');
  const [snmpVersion, setSnmpVersion] = useState('2c');
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  const [snmpSecLevel, setSnmpSecLevel] = useState('noAuthNoPriv');
  const [snmpAuthProtocol, setSnmpAuthProtocol] = useState('SHA');
  const [snmpAuthPassword, setSnmpAuthPassword] = useState('');
  const [snmpPrivProtocol, setSnmpPrivProtocol] = useState('AES');
  const [snmpPrivPassword, setSnmpPrivPassword] = useState('');

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  useEffect(() => {
    const loaded = localStorage.getItem('terminalator_sessions');
    if (loaded) {
      try { setSavedSessions(JSON.parse(loaded)); } catch (e) { /* ignore */ }
    }
  }, []);

  const persistSessions = (sessions: SavedSession[]) => {
    setSavedSessions(sessions);
    localStorage.setItem('terminalator_sessions', JSON.stringify(sessions));
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setConnectError(null);

    if (sessionType === 'snmp') {
      const errors: ValidationErrors = {};
      if (!snmpTarget.trim()) errors.host = 'Target is required';
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setConnecting(false);
        return;
      }
      
      const label = sessionName.trim() || `SNMP: ${snmpTarget}`;
      
      // Find loaded or matched saved session to restore walked tree and tasks
      const matchedSaved = savedSessions.find(s => s.id === loadedSessionId);
      const sessionId = loadedSessionId || `snmp_${Date.now()}`;
      
      onConnect(sessionId, label, snmpTarget.trim(), 'snmp', {
        target: snmpTarget.trim(),
        port: parseInt(snmpPort, 10),
        version: snmpVersion,
        community: snmpVersion !== '3' ? snmpCommunity : undefined,
        username: snmpVersion === '3' ? username.trim() : undefined,
        sec_level: snmpSecLevel,
        auth_protocol: snmpAuthProtocol,
        auth_password: snmpAuthPassword,
        priv_protocol: snmpPrivProtocol,
        priv_password: snmpPrivPassword,
        
        // Pass session persistence context
        savedSessionId: loadedSessionId || null,
        walkedTree: matchedSaved?.snmpWalkedTree || [],
        tasks: matchedSaved?.snmpTasks || [],
      });
      setConnecting(false);
      return;
    }

    const errors = validate(host, username, port, password, privateKey);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setConnecting(false);
      return;
    }
    try {
      const label = sessionName.trim() || `${username}@${host}`;
      const sessionId = await invoke<string>('connect_ssh', {
        host: host.trim(),
        username: username.trim(),
        password: password || null,
        privateKey: privateKey || null,
        port: parseInt(port, 10),
        label,
      });
      onConnect(sessionId, label, host.trim(), 'ssh');
    } catch (err: any) {
      setConnectError(err.toString());
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveSession = () => {
    const nameErrors: ValidationErrors = {};
    if (!sessionName.trim()) {
      nameErrors.name = 'Provide a session name to save';
    }

    let allErrors = { ...nameErrors };
    if (sessionType === 'ssh') {
      const fieldErrs = validate(host, username, port, password, privateKey);
      allErrors = { ...allErrors, ...fieldErrs };
    } else {
      if (!snmpTarget.trim()) allErrors.host = 'Target is required';
    }
    
    setFieldErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;

    const isUpdate = loadedSessionId && savedSessions.some(s => s.id === loadedSessionId);
    const existing = isUpdate ? savedSessions.find(s => s.id === loadedSessionId) : null;

    const newSession: SavedSession = {
      id: isUpdate ? loadedSessionId! : Date.now().toString(),
      name: sessionName.trim(),
      type: sessionType,
      host: sessionType === 'ssh' ? host.trim() : snmpTarget.trim(),
      port: sessionType === 'ssh' ? port : snmpPort,
      snmpWalkedTree: existing?.snmpWalkedTree || [],
      snmpTasks: existing?.snmpTasks || [],
    };
    
    if (sessionType === 'ssh') {
      newSession.username = username.trim();
      newSession.privateKey = privateKey;
    } else {
      newSession.snmpVersion = snmpVersion;
      if (snmpVersion !== '3') {
        newSession.snmpCommunity = snmpCommunity;
      } else {
        newSession.username = username.trim();
        newSession.snmpSecLevel = snmpSecLevel;
        newSession.snmpAuthProtocol = snmpAuthProtocol;
        newSession.snmpAuthPassword = snmpAuthPassword;
        newSession.snmpPrivProtocol = snmpPrivProtocol;
        newSession.snmpPrivPassword = snmpPrivPassword;
      }
    }

    if (isUpdate) {
      persistSessions(savedSessions.map(s => s.id === loadedSessionId ? newSession : s));
    } else {
      persistSessions([...savedSessions, newSession]);
    }
    
    setSessionName('');
    setSaveSuccess(true);
    setLoadedSessionId(null);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleDeleteSession = (id: string) => {
    if (loadedSessionId === id) setLoadedSessionId(null);
    persistSessions(savedSessions.filter(s => s.id !== id));
  };

  const loadSession = (session: SavedSession) => {
    const isSnmp = session.type === 'snmp';
    setSessionType(isSnmp ? 'snmp' : 'ssh');
    setLoadedSessionId(session.id);
    
    if (isSnmp) {
      setSnmpTarget(session.host);
      setSnmpPort(session.port);
      setSnmpVersion(session.snmpVersion || '2c');
      setSnmpCommunity(session.snmpCommunity || 'public');
      setUsername(session.username || '');
      setSnmpSecLevel(session.snmpSecLevel || 'noAuthNoPriv');
      setSnmpAuthProtocol(session.snmpAuthProtocol || 'SHA');
      setSnmpAuthPassword(session.snmpAuthPassword || '');
      setSnmpPrivProtocol(session.snmpPrivProtocol || 'AES');
      setSnmpPrivPassword(session.snmpPrivPassword || '');
    } else {
      setHost(session.host);
      setUsername(session.username || '');
      setPort(session.port);
      setPrivateKey(session.privateKey || '');
      setPassword('');
    }
    
    setSessionName(session.name);
    setFieldErrors({});
    setConnectError(null);
  };

  const handleBrowseKey = async () => {
    try {
      const selected = await open({ multiple: false, directory: false, title: 'Select SSH Private Key', defaultPath: '~/.ssh' });
      if (selected) setPrivateKey(selected as string);
    } catch (err) { console.error('Dialog error:', err); }
  };

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{msg}</span> : null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', padding: '20px', overflow: 'hidden' }}>
      <div className="glass-panel" style={{ display: 'flex', width: '820px', maxHeight: '92vh', borderRadius: '12px', overflow: 'hidden' }}>

        {/* Left Sidebar */}
        <div style={{ width: '240px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Saved Sessions</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {savedSessions.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px' }}>No saved sessions</p>
              : savedSessions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', marginBottom: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onClick={() => loadSession(s)}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontSize: '0.65rem', padding: '1px 4px', background: s.type === 'snmp' ? 'var(--accent-secondary)' : 'var(--accent-primary)', color: 'white', borderRadius: '4px', marginRight: '6px', verticalAlign: 'text-bottom' }}>
                        {s.type === 'snmp' ? 'SNMP' : 'SSH'}
                      </span>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {s.type === 'snmp' ? `${s.host}:${s.port}` : `${s.username}@${s.host}:${s.port}`}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDeleteSession(s.id); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Right: Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <img src={appIcon} alt="Terminalator Icon" style={{ width: '36px', height: '36px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Terminalator</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>New Session</p>
            </div>
            
            {/* Session Type Picker */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '4px' }}>
              <button 
                type="button"
                onClick={() => { setSessionType('ssh'); setLoadedSessionId(null); }}
                style={{ padding: '6px 12px', borderRadius: '6px', background: sessionType === 'ssh' ? 'var(--bg-primary)' : 'transparent', border: 'none', color: sessionType === 'ssh' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', boxShadow: sessionType === 'ssh' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
              >SSH</button>
              <button 
                type="button"
                onClick={() => { setSessionType('snmp'); setLoadedSessionId(null); }}
                style={{ padding: '6px 12px', borderRadius: '6px', background: sessionType === 'snmp' ? 'var(--bg-primary)' : 'transparent', border: 'none', color: sessionType === 'snmp' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', boxShadow: sessionType === 'snmp' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
              >SNMP</button>
            </div>
          </div>

          {/* Form body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <form onSubmit={handleConnect} className="form-container" style={{ gap: '12px' }}>

              {connectError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', wordBreak: 'break-word' }}>
                  {connectError}
                </div>
              )}

              {sessionType === 'ssh' ? (
                <>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 3 }}>
                      <label style={labelStyle}>Host</label>
                      <input className={`input-field${fieldErrors.host ? ' input-error' : ''}`} style={{ width: '100%' }} type="text" placeholder="192.168.1.1" value={host} onChange={e => setHost(e.target.value)} />
                      <FieldError msg={fieldErrors.host} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Port</label>
                      <input className={`input-field${fieldErrors.port ? ' input-error' : ''}`} style={{ width: '100%' }} type="number" value={port} onChange={e => setPort(e.target.value)} />
                      <FieldError msg={fieldErrors.port} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Username</label>
                    <input className={`input-field${fieldErrors.username ? ' input-error' : ''}`} style={{ width: '100%' }} type="text" placeholder="root" value={username} onChange={e => setUsername(e.target.value)} />
                    <FieldError msg={fieldErrors.username} />
                  </div>

                  <div>
                    <label style={labelStyle}>Password</label>
                    <input className="input-field" style={{ width: '100%' }} type="password" placeholder="Leave empty to use key/agent" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>

                  <div>
                    <label style={labelStyle}>Private Key</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', flexShrink: 0 }}>
                        <KeyRound size={14} color="var(--text-muted)" />
                      </div>
                      <input className="input-field" style={{ flex: 1 }} type="text" placeholder="~/.ssh/id_rsa" value={privateKey} onChange={e => setPrivateKey(e.target.value)} />
                      <button type="button" onClick={handleBrowseKey} style={browseBtnStyle}>
                        <FolderOpen size={14} /> Browse
                      </button>
                    </div>
                    <FieldError msg={fieldErrors.auth} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 3 }}>
                      <label style={labelStyle}>Target IP / Host</label>
                      <input className={`input-field${fieldErrors.host ? ' input-error' : ''}`} style={{ width: '100%' }} type="text" placeholder="192.168.1.1" value={snmpTarget} onChange={e => setSnmpTarget(e.target.value)} />
                      <FieldError msg={fieldErrors.host} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Port</label>
                      <input className="input-field" style={{ width: '100%' }} type="number" value={snmpPort} onChange={e => setSnmpPort(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Version</label>
                      <select className="input-field" style={{ width: '100%' }} value={snmpVersion} onChange={e => setSnmpVersion(e.target.value)}>
                        <option value="1">v1</option>
                        <option value="2c">v2c</option>
                        <option value="3">v3</option>
                      </select>
                    </div>
                    {snmpVersion !== '3' ? (
                      <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Community</label>
                        <input className="input-field" style={{ width: '100%' }} type="text" value={snmpCommunity} onChange={e => setSnmpCommunity(e.target.value)} />
                      </div>
                    ) : (
                      <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Username</label>
                        <input className="input-field" style={{ width: '100%' }} type="text" value={username} onChange={e => setUsername(e.target.value)} />
                      </div>
                    )}
                  </div>

                  {snmpVersion === '3' && (
                    <>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Security Level</label>
                          <select className="input-field" style={{ width: '100%' }} value={snmpSecLevel} onChange={e => setSnmpSecLevel(e.target.value)}>
                            <option value="noAuthNoPriv">noAuthNoPriv</option>
                            <option value="authNoPriv">authNoPriv</option>
                            <option value="authPriv">authPriv</option>
                          </select>
                        </div>
                      </div>

                      {snmpSecLevel !== 'noAuthNoPriv' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Auth Protocol</label>
                            <select className="input-field" style={{ width: '100%' }} value={snmpAuthProtocol} onChange={e => setSnmpAuthProtocol(e.target.value)}>
                              <option value="MD5">MD5</option>
                              <option value="SHA">SHA</option>
                            </select>
                          </div>
                          <div style={{ flex: 2 }}>
                            <label style={labelStyle}>Auth Password</label>
                            <input className="input-field" style={{ width: '100%' }} type="password" value={snmpAuthPassword} onChange={e => setSnmpAuthPassword(e.target.value)} />
                          </div>
                        </div>
                      )}

                      {snmpSecLevel === 'authPriv' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Priv Protocol</label>
                            <select className="input-field" style={{ width: '100%' }} value={snmpPrivProtocol} onChange={e => setSnmpPrivProtocol(e.target.value)}>
                              <option value="DES">DES</option>
                              <option value="AES">AES</option>
                            </select>
                          </div>
                          <div style={{ flex: 2 }}>
                            <label style={labelStyle}>Priv Password</label>
                            <input className="input-field" style={{ width: '100%' }} type="password" value={snmpPrivPassword} onChange={e => setSnmpPrivPassword(e.target.value)} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    Custom MIBs can be configured within the SNMP Explorer tab after connecting.
                  </div>
                </>
              )}

              {/* Save + Connect row */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                <input
                  className="input-field"
                  style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px' }}
                  type="text"
                  placeholder="Session name (to save)"
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSaveSession}
                  style={{ ...browseBtnStyle, background: saveSuccess ? 'rgba(16,185,129,0.15)' : undefined, color: saveSuccess ? 'var(--success)' : undefined, gap: '6px' }}
                >
                  {saveSuccess ? <><CheckCircle2 size={14} /> Saved!</> : <><Save size={14} /> Save</>}
                </button>
                <button type="submit" className="btn-primary" disabled={connecting} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '0.9rem' }}>
                  {connecting ? 'Connecting…' : <><LogIn size={16} /> Start Session</>}
                </button>
              </div>
              <FieldError msg={fieldErrors.name} />

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  marginBottom: '5px',
  fontWeight: 500,
};

const browseBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '8px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s',
  flexShrink: 0,
};
