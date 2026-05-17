import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, File, ChevronRight, ArrowUp, RefreshCw, Upload, FolderPlus, Loader2, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';

interface ProgressPayload {
  bytes_processed: number;
  total_bytes: number;
}

interface FileItem {
  filename: string;
  is_dir: boolean;
  size: number;
}

interface DirectoryResult {
  resolved_path: string;
  items: FileItem[];
}

interface Props {
  sessionId: string;
  isActive: boolean;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function FileExplorer({ sessionId, isActive }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferType, setTransferType] = useState<'upload' | 'delete'>('upload');
  const [transferFileNames, setTransferFileNames] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [transferProgress, setTransferProgress] = useState<ProgressPayload | null>(null);

  // Keep a ref to the latest currentPath so the drag-drop listener can access
  // the current value without re-subscribing on every directory change.
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      // Rust now returns the server-resolved absolute path alongside items,
      // so we always have the true canonical path (fixes navigating into subdirs).
      const result = await invoke<DirectoryResult>('request_directory', { sessionId, path });
      setCurrentPath(result.resolved_path);
      setFiles(result.items);
    } catch (err: any) {
      setError(err.toString());
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Load the home directory once on mount
  useEffect(() => { loadDirectory('.'); }, [loadDirectory]);

  // Listen for progress
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<ProgressPayload>(`sftp:progress:${sessionId}`, (event) => {
      setTransferProgress(event.payload);
    }).then(u => { unlisten = u; });
    return () => { if (unlisten) unlisten(); };
  }, [sessionId]);

  // ── Shared upload helper ────────────────────────────────────────────────────
  const uploadFiles = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    const names = paths.map(p => p.split('/').pop() || p);
    setTransferFileNames(names);
    setTransferType('upload');
    setTransferring(true);
    setError(null);
    try {
      const remotePath = currentPathRef.current === '.' ? '.' : currentPathRef.current;
      await Promise.all(paths.map(p => invoke('sftp_upload', { sessionId, localPath: p, remotePath })));
      await loadDirectory(currentPathRef.current);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setTransferring(false);
      setTransferFileNames([]);
      setTransferProgress(null);
    }
  }, [sessionId, loadDirectory]);

  // ── Tauri native drag-and-drop ──────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      setDragOver(false);
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (cancelled) return;
      const { type } = event.payload;
      if (type === 'enter' || type === 'over') {
        setDragOver(true);
      } else if (type === 'drop') {
        setDragOver(false);
        const paths = (event.payload as any).paths as string[];
        if (paths && paths.length > 0) {
          uploadFiles(paths);
        }
      } else if (type === 'leave') {
        setDragOver(false);
      }
    }).then(u => { unlisten = u; });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [isActive, uploadFiles]);

  const navigateTo = (dirname: string) => {
    // currentPath is always an absolute path (resolved by the server),
    // so we can safely append dirname without the '/' vs '.' ambiguity.
    const base = currentPath === '/' ? '' : currentPath;
    loadDirectory(`${base}/${dirname}`);
  };

  const goUp = () => {
    if (currentPath === '/' || currentPath === '.') return;
    const parts = currentPath.split('/');
    parts.pop();
    loadDirectory(parts.join('/') || '/');
  };

  const handleUpload = async () => {
    try {
      const selected = await open({ multiple: true, directory: false, title: 'Upload Files' });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await uploadFiles(paths);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleMkdir = async () => {
    if (!newFolderName.trim()) return;
    const base = currentPath === '.' ? '' : currentPath;
    const newPath = `${base}/${newFolderName.trim()}`;
    try {
      await invoke('sftp_mkdir', { sessionId, remotePath: newPath });
      setNewFolderName('');
      setShowNewFolder(false);
      await loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    const confirmed = await ask(`Are you sure you want to delete "${filename}"?`, {
      title: 'Confirm Deletion',
      kind: 'warning',
    });
    if (!confirmed) return;
    
    setTransferFileNames([filename]);
    setTransferType('delete');
    setTransferring(true);
    setError(null);
    
    try {
      const base = currentPath === '.' ? '' : currentPath;
      const targetPath = `${base}/${filename}`;
      await invoke('sftp_delete', { sessionId, remotePath: targetPath });
      await loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setTransferring(false);
      setTransferFileNames([]);
      setTransferProgress(null);
    }
  };

  return (
    <div className="file-explorer" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 4px 8px', flexShrink: 0 }}>
        <button onClick={goUp} disabled={currentPath === '/' || currentPath === '.'} className="icon-btn" title="Go up"><ArrowUp size={14} /></button>
        <button onClick={() => loadDirectory(currentPath)} className="icon-btn" title="Refresh"><RefreshCw size={13} /></button>
        <button onClick={handleUpload} disabled={transferring} className="icon-btn" title="Upload file(s)"><Upload size={13} /></button>
        <button onClick={() => setShowNewFolder(v => !v)} className="icon-btn" title="New folder"><FolderPlus size={13} /></button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
          {currentPath === '.' ? '~' : currentPath}
        </span>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div style={{ display: 'flex', gap: '6px', padding: '0 4px 8px', flexShrink: 0 }}>
          <input
            className="input-field"
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem' }}
            placeholder="Folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleMkdir(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }}
            autoFocus
          />
          <button onClick={handleMkdir} className="icon-btn" style={{ color: 'var(--success)' }} title="Create">✓</button>
        </div>
      )}

      {/* Error */}
      {error && <div style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', borderRadius: '4px', marginBottom: '6px', flexShrink: 0 }}>{error}</div>}

      {/* File list */}
      <div className="file-list" style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '8px' }}>Loading…</div>}
        {!loading && files.length === 0 && !error && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '8px' }}>Empty</div>}
        {files.map((file, idx) => (
          <div
            key={idx}
            className="file-item"
            onClick={() => file.is_dir && navigateTo(file.filename)}
            style={{ cursor: file.is_dir ? 'pointer' : 'default' }}
          >
            {file.is_dir
              ? <Folder size={15} color="var(--accent-primary)" />
              : <File size={15} color="var(--text-muted)" />
            }
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem' }}>{file.filename}</span>
            {!file.is_dir && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{formatSize(file.size)}</span>}
            {file.is_dir && <ChevronRight size={12} color="var(--text-muted)" />}
            <button className="icon-btn file-delete-btn" onClick={(e) => handleDelete(e, file.filename)} title="Delete">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Drag-and-drop overlay */}
      {(dragOver && !transferring) && (
        <div className="drop-overlay">
          <Upload size={28} />
          <span>Drop files to upload</span>
        </div>
      )}

      {/* Transfer indicator */}
      {transferring && (
        <div style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--border-color)',
          background: transferType === 'delete' ? 'rgba(239,68,68,0.05)' : 'rgba(var(--accent-primary-rgb, 94,92,230), 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={14} color={transferType === 'delete' ? 'var(--danger)' : 'var(--accent-primary)'} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: transferType === 'delete' ? 'var(--danger)' : 'var(--accent-primary)' }}>
                {transferType === 'delete' ? 'Deleting' : 'Uploading'} {transferFileNames.length} file{transferFileNames.length !== 1 ? 's' : ''}…
              </div>
              <div style={{
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '1px',
              }}>
                {transferFileNames.join(', ')}
              </div>
            </div>
            {transferProgress && transferProgress.total_bytes > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingLeft: '8px' }}>
                {Math.round((transferProgress.bytes_processed / transferProgress.total_bytes) * 100)}%
              </span>
            )}
          </div>
          {/* Progress Bar */}
          <div style={{ width: '100%', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: transferType === 'delete' ? 'var(--danger)' : 'var(--accent-primary)',
              width: transferProgress && transferProgress.total_bytes > 0
                ? `${(transferProgress.bytes_processed / transferProgress.total_bytes) * 100}%`
                : '0%',
              transition: 'width 0.15s ease-out'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
