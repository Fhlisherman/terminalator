import React from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';
import { SnmpTask, SnmpTaskLeaf } from '../snmpTypes';
import styles from './TaskOrchestrator.module.css';

interface TaskOrchestratorProps {
  tasks: SnmpTask[];
  onAddTask: () => void;
  onRemoveTask: (id: string) => void;
  onToggleTaskEnabled: (id: string) => void;
  onUpdateTaskName: (id: string, name: string) => void;
  onAddLeafToTask: (id: string) => void;
  onUpdateLeafInTask: (taskId: string, leafId: string, updates: Partial<SnmpTaskLeaf>) => void;
  onRemoveLeafFromTask: (taskId: string, leafId: string) => void;
  batchMode: 'sequential' | 'parallel';
  onChangeBatchMode: (val: 'sequential' | 'parallel') => void;
  onRunBatch: () => void;
  batchLoading: boolean;
}

export const TaskOrchestrator: React.FC<TaskOrchestratorProps> = ({
  tasks,
  onAddTask,
  onRemoveTask,
  onToggleTaskEnabled,
  onUpdateTaskName,
  onAddLeafToTask,
  onUpdateLeafInTask,
  onRemoveLeafFromTask,
  batchMode,
  onChangeBatchMode,
  onRunBatch,
  batchLoading
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Task Orchestrator</h3>
        <div className={styles.headerControls}>
          <select
            className={`${styles.modeSelect} input-field`}
            value={batchMode}
            onChange={e => onChangeBatchMode(e.target.value as any)}
          >
            <option value="sequential">Sequential</option>
            <option value="parallel">Parallel</option>
          </select>
          <button
            className="icon-btn"
            onClick={onAddTask}
            title="Add Task Group"
          >
            <Plus size={16} />
          </button>
          <button
            className={`${styles.runBtn} btn-primary`}
            onClick={onRunBatch}
            disabled={batchLoading || tasks.length === 0}
          >
            <Play size={12} /> {batchLoading ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      <div className={styles.taskList}>
        {tasks.length === 0 ? (
          <div className={styles.emptyState}>
            Create structured tasks to configure and monitor your devices.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`${styles.taskCard} ${task.enabled ? styles.taskCardEnabled : styles.taskCardDisabled}`}
            >
              {/* Task Header */}
              <div className={styles.taskHeader}>
                <div className={styles.taskTitleGroup}>
                  <input
                    type="checkbox"
                    checked={task.enabled}
                    onChange={() => onToggleTaskEnabled(task.id)}
                    className={styles.taskCheckbox}
                  />
                  <input
                    type="text"
                    value={task.name}
                    onChange={e => onUpdateTaskName(task.id, e.target.value)}
                    className={styles.taskNameInput}
                    placeholder="Task Name"
                  />
                </div>
                <div className={styles.taskHeaderActions}>
                  <button
                    className={`${styles.actionAddBtn} icon-btn`}
                    onClick={() => onAddLeafToTask(task.id)}
                    title="Add Operation Leaf"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    className={`${styles.actionDeleteBtn} icon-btn`}
                    onClick={() => onRemoveTask(task.id)}
                    title="Delete Task Group"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Leaves Operations */}
              <div className={styles.leavesList}>
                {task.leaves.length === 0 ? (
                  <div className={styles.leafEmptyState}>
                    No operations. Click '+' to add one.
                  </div>
                ) : (
                  task.leaves.map((leaf) => (
                    <div key={leaf.id} className={styles.leafRow}>
                      <div className={styles.leafControls}>
                        <select
                          className={`${styles.leafOpSelect} input-field`}
                          value={leaf.operation}
                          onChange={e => onUpdateLeafInTask(task.id, leaf.id, { operation: e.target.value })}
                        >
                          <option value="GET">GET</option>
                          <option value="SET">SET</option>
                        </select>

                        <input
                          className={`${styles.leafOidInput} input-field`}
                          placeholder="OID / Path"
                          value={leaf.oid}
                          onChange={e => onUpdateLeafInTask(task.id, leaf.id, { oid: e.target.value })}
                        />

                        {task.leaves.length > 1 && (
                          <button
                            className={`${styles.leafRemoveBtn} icon-btn`}
                            onClick={() => onRemoveLeafFromTask(task.id, leaf.id)}
                            title="Remove Operation"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      {/* SET Config row */}
                      {leaf.operation === 'SET' && (
                        <div className={styles.leafSetConfigRow}>
                          <input
                            className={`${styles.leafValueInput} input-field`}
                            placeholder="Value"
                            value={leaf.value || ''}
                            onChange={e => onUpdateLeafInTask(task.id, leaf.id, { value: e.target.value })}
                          />
                          <select
                            className={`${styles.leafValueTypeSelect} input-field`}
                            value={leaf.value_type || 's'}
                            onChange={e => onUpdateLeafInTask(task.id, leaf.id, { value_type: e.target.value })}
                          >
                            <option value="s">Str (s)</option>
                            <option value="i">Int (i)</option>
                            <option value="u">Uint (u)</option>
                          </select>
                        </div>
                      )}

                      {/* Leaf Execution Result display */}
                      {leaf.result && (
                        <div
                          className={`${styles.leafResult} ${leaf.result.success ? styles.leafResultSuccess : styles.leafResultError}`}
                        >
                          {leaf.result.success ? `✔ Result: ${leaf.result.value}` : `✖ Error: ${leaf.result.error}`}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
