import { X, RotateCcw, Palette, Monitor, LayoutPanelLeft, Terminal } from 'lucide-react';
import { useSettings, AccentColor, AppTheme, ACCENT_PALETTE } from '../contexts/SettingsContext';

interface Props { onClose: () => void; }

const ACCENT_COLORS: { id: AccentColor; label: string }[] = [
  { id: 'indigo', label: 'Indigo' },
  { id: 'blue',   label: 'Blue'   },
  { id: 'teal',   label: 'Teal'   },
  { id: 'green',  label: 'Green'  },
  { id: 'orange', label: 'Orange' },
  { id: 'rose',   label: 'Rose'   },
];

const THEMES: { id: AppTheme; label: string; desc: string; preview: string[] }[] = [
  { id: 'dark',       label: 'Dark',       desc: 'Classic macOS dark mode',          preview: ['#0a0a0e', '#1c1c1e', '#6366f1'] },
  { id: 'darker',     label: 'Darker',     desc: 'True black — OLED optimised',      preview: ['#000000', '#161618', '#6366f1'] },
  { id: 'graphite',   label: 'Graphite',   desc: 'Warm neutral dark',                preview: ['#1a1a1f', '#232329', '#a0a0b0'] },
  { id: 'night-owl',  label: 'Night Owl',  desc: 'Deep navy — easy on the eyes',     preview: ['#011627', '#01223a', '#7fdbca'] },
  { id: 'cyberpunk',  label: 'Cyberpunk',  desc: 'Neon-on-void — high contrast',     preview: ['#0a0015', '#130025', '#ff00ff'] },
];



function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--label-tertiary)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.84rem', color: 'var(--label-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.84rem', color: 'var(--accent-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer', height: '4px' }}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: '0.84rem', color: 'var(--label-secondary)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
          background: value ? 'var(--accent-primary)' : 'var(--bg-elevated)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: '3px',
          left: value ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </button>
    </div>
  );
}

export default function SettingsPanel({ onClose }: Props) {
  const { settings, update, reset } = useSettings();

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{
          width: '460px', maxHeight: '88vh', borderRadius: '16px', overflow: 'hidden',
          background: 'var(--bg-primary)', border: '1px solid var(--separator)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--separator)', flexShrink: 0 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--label-primary)' }}>Preferences</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={reset} className="icon-btn" title="Reset to defaults"><RotateCcw size={13} /></button>
            <button onClick={onClose} className="icon-btn"><X size={15} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Accent */}
          <Section icon={<Palette size={14} />} title="Accent Color">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map(c => {
                const hsl = ACCENT_PALETTE[c.id];
                const col = `hsl(${hsl.h},${hsl.s}%,${hsl.l}%)`;
                const active = settings.accentColor === c.id;
                return (
                  <button key={c.id} onClick={() => update({ accentColor: c.id })} title={c.label}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                      boxShadow: active ? `0 0 0 3px var(--bg-primary), 0 0 0 5px ${col}` : 'none',
                      transform: active ? 'scale(1.15)' : 'scale(1)',
                      transition: 'box-shadow 0.2s, transform 0.15s',
                    }}
                  />
                );
              })}
            </div>
          </Section>

          {/* Theme */}
          <Section icon={<Monitor size={14} />} title="Theme">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {THEMES.map(t => {
                const active = settings.appTheme === t.id;
                return (
                  <button key={t.id} onClick={() => update({ appTheme: t.id })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 12px', borderRadius: '8px', border: '1px solid',
                      borderColor: active ? 'var(--accent-primary)' : 'transparent',
                      background: active ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
                  >
                    {/* Color preview dots */}
                    <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                      {t.preview.map((col, i) => (
                        <div key={i} style={{ width: i === 0 ? '14px' : '10px', height: i === 0 ? '14px' : '10px', borderRadius: '50%', background: col, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--label-primary)' }}>{t.label}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--label-tertiary)', marginTop: '1px' }}>{t.desc}</div>
                    </div>
                    {active && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Terminal */}
          <Section icon={<Terminal size={14} />} title="Terminal">
            <Slider label="Font Size" value={settings.termFontSize} min={10} max={22} unit="px"
              onChange={v => update({ termFontSize: v })} />
            <Slider label="Terminal Padding" value={settings.terminalPadding} min={0} max={24} unit="px"
              onChange={v => update({ terminalPadding: v })} />
          </Section>

          {/* Layout */}
          <Section icon={<LayoutPanelLeft size={14} />} title="Layout">
            <Slider label="Sidebar Width" value={settings.sidebarWidth} min={180} max={420} unit="px"
              onChange={v => update({ sidebarWidth: v })} />
            <Toggle label="Show Hidden Files" value={settings.showHiddenFiles}
              onChange={v => update({ showHiddenFiles: v })} />
          </Section>

        </div>
      </div>
    </div>
  );
}
