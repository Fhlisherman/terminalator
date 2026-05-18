import React from 'react';
import { Search, X } from 'lucide-react';
import { SnmpResult } from '../snmpTypes';
import { getOidProperties } from '../oidRegistry';
import styles from './MibTreeExplorer.module.css';

interface MibTreeExplorerProps {
  treeData: SnmpResult[];
  searchInputValue: string;
  onChangeSearchInput: (val: string) => void;
  filteredTree: SnmpResult[];
  loading: boolean;
  onSelectOid: (numericOid: string, isMutable: boolean, value: string) => void;
}

export const MibTreeExplorer: React.FC<MibTreeExplorerProps> = ({
  treeData,
  searchInputValue,
  onChangeSearchInput,
  filteredTree,
  loading,
  onSelectOid
}) => {
  return (
    <div className={styles.pane}>
      {/* Search Header */}
      <div className={styles.searchContainer}>
        <div className={styles.searchBar}>
          <Search
            size={14}
            color={searchInputValue ? 'var(--accent-primary)' : 'var(--label-tertiary)'}
            style={{ transition: 'color var(--t-fast)', flexShrink: 0 }}
          />

          <input
            className={styles.searchInput}
            placeholder="Filter walks by OID, value or property..."
            value={searchInputValue}
            onChange={e => onChangeSearchInput(e.target.value)}
          />
          {treeData.length > 0 && (
            <div className={styles.badgeContainer}>
              <span
                className={styles.badge}
                style={{
                  color: searchInputValue ? 'var(--accent-primary)' : 'var(--label-secondary)',
                }}
              >
                {filteredTree.length} / {treeData.length}
              </span>

              {searchInputValue ? (
                <button
                  onClick={() => onChangeSearchInput('')}
                  className={styles.clearBtn}
                >
                  <X size={12} />
                </button>
              ) : (
                <span className={styles.badgeShortcut}>⌘F</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tree View */}
      <div className={styles.treeView}>
        {treeData.length === 0 ? (
          <div className={styles.emptyState}>
            {loading ? 'Discovering MIB tree...' : 'Provide credentials and click Walk MIB Tree to view.'}
          </div>
        ) : (
          <div className={styles.listContainer}>
            {filteredTree.map((item, idx) => {
              const props = getOidProperties(item);
              return (
                <div
                  key={idx}
                  className={styles.itemCard}
                  onClick={() => onSelectOid(props.numericOid, props.isMutable, item.value)}
                >
                  {/* Name & Badge Row */}
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      {props.name}
                    </span>
                    <span className={`${styles.cardBadge} ${props.isMutable ? styles.cardBadgeMutable : styles.cardBadgeImmutable}`}>
                      {props.isMutable ? 'Mutable' : 'Immutable'}
                    </span>
                  </div>

                  {/* OID Row - Split Symbolic & Numeric */}
                  <div className={styles.oidSection} onClick={e => e.stopPropagation()}>
                    <div className={styles.oidRow}>
                      <span className={styles.oidLabel}>Symbolic Name Path</span>
                      <code
                        onClick={() => onSelectOid(props.symbolicOid, props.isMutable, item.value)}
                        title="Click to copy to editor"
                        className={`${styles.codeBlock} ${styles.codeSymbolic}`}
                      >
                        {props.symbolicOid}
                      </code>
                    </div>
                    <div className={styles.oidRow}>
                      <span className={styles.oidLabel}>Numeric OID Protocol Address</span>
                      <code
                        onClick={() => onSelectOid(props.numericOid, props.isMutable, item.value)}
                        title="Click to copy to editor"
                        className={`${styles.codeBlock} ${styles.codeNumeric}`}
                      >
                        {props.numericOid}
                      </code>
                    </div>
                  </div>

                  {/* Value Row */}
                  <div className={styles.valueSection}>
                    <span className={styles.valueLabel}>Current Value</span>
                    <div className={styles.valueDisplay}>
                      {item.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
