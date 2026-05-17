import { useState, useEffect, useRef } from 'react';
import { Cpu, MemoryStick, Clock, Wifi, Server, ChevronDown, Info, Layers } from 'lucide-react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface Stats {
  session_id: string;
  cpu_percent: number;
  mem_used_mb: number;
  mem_total_mb: number;
  uptime_secs: number;
}

interface SystemInfo {
  hostname: string;
  os_pretty: string;
  kernel: string;
  arch: string;
  cpu_model: string;
  cpu_cores: number;
  mem_total_gb: number;
}

interface Props { sessionId: string; }

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: '42px', height: '3px', background: 'var(--separator)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 1.5s ease' }} />
    </div>
  );
}

function Divider() {
  return <div style={{ width: '1px', height: '14px', background: 'var(--separator)', flexShrink: 0 }} />;
}

export default function SystemStats({ sessionId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<Stats>('stats:update', ev => {
      if (ev.payload.session_id === sessionId) setStats(ev.payload);
    }).then(u => { unlisten = u; });
    return () => { if (unlisten) unlisten(); };
  }, [sessionId]);

  useEffect(() => {
    invoke<SystemInfo>('get_system_info', { sessionId })
      .then(setSysInfo)
      .catch(e => console.error('sysinfo:', e));
  }, [sessionId]);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  const cpu = stats?.cpu_percent ?? 0;
  const memPct = stats && stats.mem_total_mb > 0 ? (stats.mem_used_mb / stats.mem_total_mb) * 100 : 0;
  const cpuColor = cpu > 80 ? 'var(--danger)' : cpu > 50 ? 'var(--warning)' : 'var(--success)';
  const memColor = memPct > 80 ? 'var(--danger)' : memPct > 50 ? 'var(--warning)' : 'var(--accent-primary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 14px', background: 'var(--bg-primary)', borderTop: '1px solid var(--separator)', flexShrink: 0, fontSize: '0.75rem', position: 'relative' }}>

      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--success)' }}>
        <Wifi size={11} />
        <span style={{ fontWeight: 500 }}>Connected</span>
      </div>

      <Divider />

      {/* CPU */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Cpu size={11} color={cpuColor} />
        <MiniBar value={cpu} color={cpuColor} />
        <span style={{ color: 'var(--label-secondary)', fontVariantNumeric: 'tabular-nums', minWidth: '38px' }}>
          {stats ? `${cpu.toFixed(1)}%` : '—'}
        </span>
      </div>

      <Divider />

      {/* Memory */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <MemoryStick size={11} color={memColor} />
        <MiniBar value={memPct} color={memColor} />
        <span style={{ color: 'var(--label-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {stats ? `${stats.mem_used_mb}/${stats.mem_total_mb} MB` : '—'}
        </span>
      </div>

      <Divider />

      {/* Uptime */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--label-tertiary)' }}>
        <Clock size={11} />
        <span>{stats ? formatUptime(stats.uptime_secs) : '—'}</span>
      </div>

      {/* System Info chip */}
      {sysInfo && (
        <>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--label-tertiary)' }}>
            <Server size={11} />
            <span style={{ color: 'var(--label-secondary)' }}>{sysInfo.hostname}</span>
            <span>·</span>
            <span>{sysInfo.os_pretty}</span>
          </div>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--label-tertiary)' }}>
            <Layers size={11} />
            <span>{sysInfo.cpu_cores}× CPU</span>
            <span>·</span>
            <span>{sysInfo.mem_total_gb.toFixed(1)} GB RAM</span>
          </div>
        </>
      )}

      {/* Info popover button */}
      <div style={{ marginLeft: 'auto', position: 'relative' }} ref={popoverRef}>
        <button
          onClick={() => setShowPopover(v => !v)}
          className="icon-btn"
          style={{ width: 'auto', padding: '3px 8px', gap: '4px', display: 'flex', alignItems: 'center', color: 'var(--label-tertiary)' }}
          title="System details"
        >
          <Info size={11} />
          <ChevronDown size={10} style={{ transform: showPopover ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showPopover && sysInfo && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
            width: '320px', borderRadius: '12px', overflow: 'hidden',
            background: 'var(--bg-primary)', border: '1px solid var(--separator)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            zIndex: 100,
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--separator)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={14} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{sysInfo.hostname}</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 8px' }}>
              {[
                { label: 'OS', value: sysInfo.os_pretty },
                { label: 'Kernel', value: sysInfo.kernel },
                { label: 'Arch', value: sysInfo.arch },
                { label: 'CPU', value: sysInfo.cpu_model.replace(/\s+/g, ' ').trim() || '—' },
                { label: 'CPU Cores', value: `${sysInfo.cpu_cores} cores` },
                { label: 'Total RAM', value: `${sysInfo.mem_total_gb.toFixed(1)} GB` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--label-tertiary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--label-primary)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
            </div>
            {stats && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--separator)', display: 'flex', gap: '16px' }}>
                {[
                  { label: 'CPU', value: `${cpu.toFixed(1)}%`, color: cpuColor },
                  { label: 'Mem', value: `${memPct.toFixed(0)}%`, color: memColor },
                  { label: 'Uptime', value: formatUptime(stats.uptime_secs), color: 'var(--label-secondary)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--label-tertiary)', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '0.82rem', color, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
