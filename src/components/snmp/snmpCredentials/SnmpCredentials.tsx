import React from 'react';
import { Download } from 'lucide-react';
import { SnmpCreds } from '../snmpTypes';
import styles from './SnmpCredentials.module.css';

interface SnmpCredentialsProps {
  creds: SnmpCreds;
  onChangeCreds: (newCreds: SnmpCreds) => void;
  mibDirs: string;
  onChangeMibDirs: (val: string) => void;
  onWalk: () => void;
  onOpenExport: () => void;
  loading: boolean;
  hasWalkedTree: boolean;
}

export const SnmpCredentials: React.FC<SnmpCredentialsProps> = ({
  creds,
  onChangeCreds,
  mibDirs,
  onChangeMibDirs,
  onWalk,
  onOpenExport,
  loading,
  hasWalkedTree
}) => {
  return (
    <div className={styles.pane}>
      <h3 className={styles.paneTitle}>Target configuration</h3>

      <label className={styles.label}>Host / IP</label>
      <input
        className={`${styles.input} input-field`}
        value={creds.target}
        onChange={e => onChangeCreds({ ...creds, target: e.target.value })}
        placeholder="192.168.1.1"
      />

      <label className={styles.label}>Port</label>
      <input
        className={`${styles.input} input-field`}
        type="number"
        value={creds.port}
        onChange={e => onChangeCreds({ ...creds, port: parseInt(e.target.value) || 0 })}
      />

      <label className={styles.label}>Version</label>
      <select
        className={`${styles.input} input-field`}
        value={creds.version}
        onChange={e => onChangeCreds({ ...creds, version: e.target.value })}
      >
        <option value="1">v1</option>
        <option value="2c">v2c</option>
        <option value="3">v3</option>
      </select>

      {creds.version !== '3' ? (
        <>
          <label className={styles.label}>Community</label>
          <input
            className={`${styles.input} input-field`}
            value={creds.community || ''}
            onChange={e => onChangeCreds({ ...creds, community: e.target.value })}
          />
        </>
      ) : (
        <>
          <label className={styles.label}>Username</label>
          <input
            className={`${styles.input} input-field`}
            value={creds.username || ''}
            onChange={e => onChangeCreds({ ...creds, username: e.target.value })}
          />
          <label className={styles.label}>Security Level</label>
          <select
            className={`${styles.input} input-field`}
            value={creds.sec_level || 'noAuthNoPriv'}
            onChange={e => onChangeCreds({ ...creds, sec_level: e.target.value })}
          >
            <option value="noAuthNoPriv">noAuthNoPriv</option>
            <option value="authNoPriv">authNoPriv</option>
            <option value="authPriv">authPriv</option>
          </select>
          {creds.sec_level !== 'noAuthNoPriv' && (
            <>
              <label className={styles.label}>Auth Protocol</label>
              <select
                className={`${styles.input} input-field`}
                value={creds.auth_protocol || 'SHA'}
                onChange={e => onChangeCreds({ ...creds, auth_protocol: e.target.value })}
              >
                <option value="MD5">MD5</option>
                <option value="SHA">SHA</option>
              </select>
              <label className={styles.label}>Auth Password</label>
              <input
                className={`${styles.input} input-field`}
                type="password"
                value={creds.auth_password || ''}
                onChange={e => onChangeCreds({ ...creds, auth_password: e.target.value })}
              />
            </>
          )}
          {creds.sec_level === 'authPriv' && (
            <>
              <label className={styles.label}>Priv Protocol</label>
              <select
                className={`${styles.input} input-field`}
                value={creds.priv_protocol || 'AES'}
                onChange={e => onChangeCreds({ ...creds, priv_protocol: e.target.value })}
              >
                <option value="DES">DES</option>
                <option value="AES">AES</option>
              </select>
              <label className={styles.label}>Priv Password</label>
              <input
                className={`${styles.input} input-field`}
                type="password"
                value={creds.priv_password || ''}
                onChange={e => onChangeCreds({ ...creds, priv_password: e.target.value })}
              />
            </>
          )}
        </>
      )}

      <label className={styles.label}>Custom MIB Dirs (comma separated)</label>
      <input
        className={`${styles.input} input-field`}
        value={mibDirs}
        onChange={e => onChangeMibDirs(e.target.value)}
        placeholder="/usr/share/snmp/mibs"
      />

      <button
        className={`${styles.walkBtn} btn-primary`}
        onClick={onWalk}
        disabled={loading || !creds.target}
      >
        {loading ? 'Walking...' : 'Walk MIB Tree'}
      </button>

      {hasWalkedTree && (
        <button
          className={`${styles.exportBtn} btn-primary`}
          onClick={onOpenExport}
        >
          <Download size={14} /> Export Walked Tree
        </button>
      )}
    </div>
  );
};
