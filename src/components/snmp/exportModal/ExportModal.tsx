import React, { useState } from 'react';
import { Download } from 'lucide-react';
import styles from './ExportModal.module.css';

interface ExportModalProps {
  onClose: () => void;
  onExport: (format: 'mib' | 'walk' | 'json', moduleName: string) => void;
  defaultFormat?: 'mib' | 'walk' | 'json';
  defaultModuleName?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  onClose,
  onExport,
  defaultFormat = 'mib',
  defaultModuleName = 'CUSTOM-GENERATED-MIB'
}) => {
  const [exportFormat, setExportFormat] = useState<'mib' | 'walk' | 'json'>(defaultFormat);
  const [mibModuleName, setMibModuleName] = useState<string>(defaultModuleName);

  const handleDownload = () => {
    onExport(exportFormat, mibModuleName);
  };

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} glass-panel`}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <Download size={18} color="var(--accent-primary)" /> Export MIB Tree
          </h3>
          <button onClick={onClose} className={styles.closeBtn}>
            &times;
          </button>
        </div>

        <div>
          <label className={styles.label}>Export Format</label>
          <select 
            className={`${styles.input} input-field`}
            value={exportFormat} 
            onChange={e => setExportFormat(e.target.value as any)}
          >
            <option value="mib">SMIv2 MIB File (.mib)</option>
            <option value="walk">SNMP Walk File (.walk)</option>
            <option value="json">Structured JSON (.json)</option>
          </select>
        </div>

        {exportFormat === 'mib' && (
          <div>
            <label className={styles.label}>MIB Module Name</label>
            <input 
              className={`${styles.input} input-field`}
              type="text" 
              value={mibModuleName} 
              onChange={e => setMibModuleName(e.target.value)}
              placeholder="CUSTOM-GENERATED-MIB"
            />
            <span className={styles.helpText}>
              A valid ASN.1 module identifier (all caps, letters/numbers/hyphens).
            </span>
          </div>
        )}

        <div className={styles.btnRow}>
          <button 
            className={`${styles.cancelBtn} icon-btn`} 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className={`${styles.downloadBtn} btn-primary`} 
            onClick={handleDownload}
          >
            Download File
          </button>
        </div>
      </div>
    </div>
  );
};
