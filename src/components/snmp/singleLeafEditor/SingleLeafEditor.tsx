import React from 'react';
import { SnmpResult } from '../snmpTypes';
import styles from './SingleLeafEditor.module.css';

interface SingleLeafEditorProps {
  singleOid: string;
  onChangeOid: (val: string) => void;
  singleValue: string;
  onChangeValue: (val: string) => void;
  singleType: string;
  onChangeType: (val: string) => void;
  singleResult: SnmpResult | null;
  onGet: (oid: string) => void;
  onSet: (oid: string, value: string, type: string) => void;
  isSingleOidMutable: boolean;
}

export const SingleLeafEditor: React.FC<SingleLeafEditorProps> = ({
  singleOid,
  onChangeOid,
  singleValue,
  onChangeValue,
  singleType,
  onChangeType,
  singleResult,
  onGet,
  onSet,
  isSingleOidMutable
}) => {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Single Leaf Editor</h3>
      <input
        className={`${styles.oidInput} input-field`}
        placeholder="OID (e.g. sysDescr.0)"
        value={singleOid}
        onChange={e => onChangeOid(e.target.value)}
      />
      <div className={styles.valueRow}>
        <input
          className={`${styles.valueInput} input-field`}
          placeholder="Value (for SET)"
          value={singleValue}
          onChange={e => onChangeValue(e.target.value)}
        />
        <select
          className={`${styles.typeSelect} input-field`}
          value={singleType}
          onChange={e => onChangeType(e.target.value)}
        >
          <option value="s">String (s)</option>
          <option value="i">Int (i)</option>
          <option value="u">Unsigned (u)</option>
        </select>
      </div>
      <div className={styles.btnRow}>
        <button
          className={`${styles.getBtn} btn-primary`}
          onClick={() => onGet(singleOid)}
          disabled={!singleOid}
        >
          GET
        </button>
        <button
          className={`${styles.setBtn} ${isSingleOidMutable ? styles.setBtnMutable : styles.setBtnImmutable} btn-primary`}
          onClick={() => onSet(singleOid, singleValue, singleType)}
          disabled={!singleOid || !isSingleOidMutable}
        >
          {isSingleOidMutable ? 'SET' : 'READ-ONLY'}
        </button>
      </div>
      {singleResult && (
        <div
          className={`${styles.resultBox} ${singleResult.success ? styles.resultBoxSuccess : styles.resultBoxError}`}
        >
          {singleResult.success ? `Result: ${singleResult.value}` : `Error: ${singleResult.error}`}
        </div>
      )}
    </div>
  );
};
