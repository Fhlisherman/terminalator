import React, { useState, useMemo } from 'react';
import { Network } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Types & Utilities
import { SnmpCreds, SnmpResult, SnmpTask, SnmpTaskLeaf, WalkResult } from './snmpTypes';
import { getOidProperties } from './oidRegistry';
import { generateMibContent, generateWalkContent, triggerDownload } from './mibExporter';

// Components
import { SnmpCredentials } from './snmpCredentials/SnmpCredentials';
import { MibTreeExplorer } from './minTreeExporter/MibTreeExplorer';
import { SingleLeafEditor } from './singleLeafEditor/SingleLeafEditor';
import { TaskOrchestrator } from './taskOrchestrator/TaskOrchestrator';
import { ExportModal } from './exportModal/ExportModal';

// Styles
import styles from './SnmpManager.module.css';

export default function SnmpManager({ initialCreds }: { initialCreds?: any }) {
  const [creds, setCreds] = useState<SnmpCreds>({
    target: '',
    port: 161,
    version: '2c',
    community: 'public',
    ...(initialCreds || {})
  });
  const [mibDirs, setMibDirs] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<SnmpResult[]>(initialCreds?.walkedTree || []);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchDebouncedValue, setSearchDebouncedValue] = useState('');

  // Debounce search query to prevent heavy MIB filtering lag on rapid keystrokes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebouncedValue(searchInputValue);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInputValue]);

  const [tasks, setTasks] = useState<SnmpTask[]>(() => {
    const rawTasks = initialCreds?.tasks;
    if (Array.isArray(rawTasks)) {
      if (rawTasks.length > 0 && 'leaves' in rawTasks[0]) {
        return rawTasks as SnmpTask[];
      }
      return rawTasks.map((t: any, idx: number) => ({
        id: t.id || `task_${Date.now()}_${idx}`,
        name: `Task #${idx + 1}`,
        enabled: true,
        leaves: [
          {
            id: `leaf_${t.id || Date.now()}_${idx}`,
            operation: t.operation || 'GET',
            oid: t.oid || '',
            value: t.value,
            value_type: t.value_type
          }
        ]
      })) as SnmpTask[];
    }
    return [];
  });

  React.useEffect(() => {
    if (!initialCreds?.savedSessionId) return;
    const loaded = localStorage.getItem('terminalator_sessions');
    if (loaded) {
      try {
        const sessions = JSON.parse(loaded);
        const updated = sessions.map((s: any) => {
          if (s.id === initialCreds.savedSessionId) {
            return {
              ...s,
              snmpWalkedTree: treeData,
              snmpTasks: tasks
            };
          }
          return s;
        });
        localStorage.setItem('terminalator_sessions', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to auto-persist SNMP session data:', e);
      }
    }
  }, [treeData, tasks, initialCreds?.savedSessionId]);

  const [batchMode, setBatchMode] = useState<'sequential' | 'parallel'>('sequential');
  const [batchLoading, setBatchLoading] = useState(false);

  // Single GET/SET state
  const [singleOid, setSingleOid] = useState('');
  const [singleValue, setSingleValue] = useState('');
  const [singleType, setSingleType] = useState('s');
  const [singleResult, setSingleResult] = useState<SnmpResult | null>(null);

  const isSingleOidMutable = useMemo(() => {
    if (!singleOid) return true;
    const cleanOid = singleOid.trim().toLowerCase();

    // 1. Try to find precise match in treeData
    const matched = treeData.find(item => {
      const props = getOidProperties(item);
      return (
        item.oid.toLowerCase() === cleanOid ||
        props.numericOid.toLowerCase() === cleanOid ||
        props.symbolicOid.toLowerCase() === cleanOid
      );
    });

    if (matched) {
      return getOidProperties(matched).isMutable;
    }

    // 2. Simple fallback heuristic
    const parts = cleanOid.split('.');
    const lastPart = parts[parts.length - 1];
    const nameToCheck = (/^\d+$/.test(lastPart) && parts.length > 1)
      ? parts[parts.length - 2]
      : lastPart;

    if (
      nameToCheck.includes("descr") ||
      nameToCheck.includes("uptime") ||
      nameToCheck.includes("physaddr") ||
      nameToCheck.includes("objectid") ||
      nameToCheck.includes("ident") ||
      nameToCheck.includes("index") ||
      nameToCheck.includes("count") ||
      nameToCheck.includes("gauge") ||
      nameToCheck.includes("speed") ||
      nameToCheck.includes("type")
    ) {
      return false;
    }
    return true;
  }, [singleOid, treeData]);

  const autoPopulateEditor = (item: SnmpResult, props: any) => {
    if (props.isMutable) {
      const valType = item.value.split(':')[0]?.trim().toLowerCase();
      if (valType === 'integer') {
        setSingleType('i');
      } else if (valType === 'gauge' || valType === 'counter') {
        setSingleType('u');
      } else {
        setSingleType('s');
      }
      const valParts = item.value.split(':');
      if (valParts.length > 1) {
        setSingleValue(valParts.slice(1).join(':').trim().replace(/^"|"$/g, ''));
      }
    }
  };

  const handleExport = (format: 'mib' | 'walk' | 'json', moduleName: string) => {
    let content = "";
    let filename = "";
    if (format === 'mib') {
      content = generateMibContent(treeData, moduleName);
      filename = `${moduleName.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'custom-mib'}.mib`;
    } else if (format === 'walk') {
      content = generateWalkContent(treeData);
      filename = `${creds.target || 'device'}.walk`;
    } else {
      content = JSON.stringify(treeData.filter(r => r.success), null, 2);
      filename = `${creds.target || 'device'}-tree.json`;
    }
    triggerDownload(filename, content);
    setShowExportModal(false);
  };

  const handleWalk = async () => {
    setLoading(true);
    setTreeData([]);
    try {
      const c = { ...creds, mib_dirs: mibDirs.split(',').map(s => s.trim()).filter(Boolean) };
      const res: WalkResult = await invoke('snmp_connect_and_walk', { creds: c, rootOid: '.' });
      if (res.success) {
        setTreeData(res.results);
      } else {
        alert(res.error || 'Walk failed');
      }
    } catch (e: any) {
      alert(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleSingleGet = async (oid: string) => {
    setLoading(true);
    try {
      const c = { ...creds, mib_dirs: mibDirs.split(',').map(s => s.trim()).filter(Boolean) };
      const res: SnmpResult = await invoke('snmp_get', { creds: c, oid });
      setSingleResult(res);
    } catch (e: any) {
      alert(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleSingleSet = async (oid: string, value: string, valueType: string) => {
    setLoading(true);
    try {
      const c = { ...creds, mib_dirs: mibDirs.split(',').map(s => s.trim()).filter(Boolean) };
      const res: SnmpResult = await invoke('snmp_set', { creds: c, oid, value, valueType });
      setSingleResult(res);
    } catch (e: any) {
      alert(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatch = async () => {
    const enabledTasks = tasks.filter(t => t.enabled);
    const flatLeaves = enabledTasks.flatMap(t => t.leaves);

    if (flatLeaves.length === 0) {
      alert("No enabled tasks with operations to run!");
      return;
    }
    setBatchLoading(true);

    // Reset previous results for the leaves we are about to run
    setTasks(tasks.map(t => {
      if (t.enabled) {
        return {
          ...t,
          leaves: t.leaves.map(l => ({ ...l, result: null }))
        };
      }
      return t;
    }));

    try {
      const c = { ...creds, mib_dirs: mibDirs.split(',').map(s => s.trim()).filter(Boolean) };

      const backendTasks = flatLeaves.map(l => ({
        operation: l.operation,
        oid: l.oid,
        value: l.value || null,
        value_type: l.value_type || null,
      }));

      const res: SnmpResult[] = await invoke('snmp_run_batch', { creds: c, tasks: backendTasks, mode: batchMode });

      let resultIdx = 0;
      const updatedTasks = tasks.map(t => {
        if (!t.enabled) return t;
        const updatedLeaves = t.leaves.map(l => {
          const result = res[resultIdx];
          resultIdx++;
          return { ...l, result };
        });
        return { ...t, leaves: updatedLeaves };
      });

      setTasks(updatedTasks);
    } catch (e: any) {
      alert(e.toString());
    } finally {
      setBatchLoading(false);
    }
  };

  const addTask = () => {
    const taskId = Date.now().toString();
    const newTask: SnmpTask = {
      id: taskId,
      name: `Task #${tasks.length + 1}`,
      enabled: true,
      leaves: [
        { id: `${taskId}_leaf_${Date.now()}`, operation: 'GET', oid: '' }
      ]
    };
    setTasks([...tasks, newTask]);
  };

  const removeTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const toggleTaskEnabled = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, enabled: !t.enabled } : t));
  };

  const updateTaskName = (taskId: string, name: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, name } : t));
  };

  const addLeafToTask = (taskId: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          leaves: [
            ...t.leaves,
            { id: `${taskId}_leaf_${Date.now()}`, operation: 'GET', oid: '' }
          ]
        };
      }
      return t;
    }));
  };

  const updateLeafInTask = (taskId: string, leafId: string, updates: Partial<SnmpTaskLeaf>) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          leaves: t.leaves.map(l => l.id === leafId ? { ...l, ...updates } : l)
        };
      }
      return t;
    }));
  };

  const removeLeafFromTask = (taskId: string, leafId: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          leaves: t.leaves.filter(l => l.id !== leafId)
        };
      }
      return t;
    }));
  };

  const filteredTree = useMemo(() => {
    if (!searchDebouncedValue) return treeData;
    const lower = searchDebouncedValue.toLowerCase();  
      
    return treeData.filter(item => item.oid.toLowerCase().includes(lower) || item.value.toLowerCase().includes(lower));
  }, [treeData, searchDebouncedValue]);

  const handleSelectOid = (numericOid: string, isMutable: boolean, val: string) => {
    setSingleOid(numericOid);
    const mockItem: SnmpResult = { success: true, oid: numericOid, value: val };
    autoPopulateEditor(mockItem, { isMutable });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerIcon}>
            <Network color="white" size={16} />
          </div>
          <h2 className={styles.headerTitle}>SNMP Explorer</h2>
        </div>
      </div>

      <div className={styles.bodyLayout}>
        {/* Left pane: Credentials */}
        <SnmpCredentials
          creds={creds}
          onChangeCreds={setCreds}
          mibDirs={mibDirs}
          onChangeMibDirs={setMibDirs}
          onWalk={handleWalk}
          onOpenExport={() => setShowExportModal(true)}
          loading={loading}
          hasWalkedTree={treeData.length > 0}
        />

        {/* Middle pane: Tree & Single Ops */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', minHeight: 0, overflow: 'hidden' }}>
          <MibTreeExplorer
            treeData={treeData}
            searchInputValue={searchInputValue}
            onChangeSearchInput={setSearchInputValue}
            filteredTree={filteredTree}
            loading={loading}
            onSelectOid={handleSelectOid}
          />

          <SingleLeafEditor
            singleOid={singleOid}
            onChangeOid={setSingleOid}
            singleValue={singleValue}
            onChangeValue={setSingleValue}
            singleType={singleType}
            onChangeType={setSingleType}
            singleResult={singleResult}
            onGet={handleSingleGet}
            onSet={handleSingleSet}
            isSingleOidMutable={isSingleOidMutable}
          />
        </div>

        {/* Right pane: Task Builder */}
        <TaskOrchestrator
          tasks={tasks}
          onAddTask={addTask}
          onRemoveTask={removeTask}
          onToggleTaskEnabled={toggleTaskEnabled}
          onUpdateTaskName={updateTaskName}
          onAddLeafToTask={addLeafToTask}
          onUpdateLeafInTask={updateLeafInTask}
          onRemoveLeafFromTask={removeLeafFromTask}
          batchMode={batchMode}
          onChangeBatchMode={setBatchMode}
          onRunBatch={handleRunBatch}
          batchLoading={batchLoading}
        />
      </div>

      {/* Premium Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          defaultFormat="mib"
          defaultModuleName="CUSTOM-GENERATED-MIB"
        />
      )}
    </div>
  );
}
