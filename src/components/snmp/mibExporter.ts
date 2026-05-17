import { SnmpResult } from './snmpTypes';

export const generateMibContent = (results: SnmpResult[], moduleName: string): string => {
  const cleanModuleName = moduleName.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() || 'CUSTOM-GENERATED-MIB';
  
  let content = `${cleanModuleName} DEFINITIONS ::= BEGIN
 
IMPORTS
    OBJECT-TYPE, MODULE-IDENTITY, enterprises
        FROM SNMPv2-SMI
    DISPLAY-STRING, TimeTicks, IpAddress, Counter32, Gauge32
        FROM SNMPv2-TC;

${cleanModuleName.toLowerCase()} MODULE-IDENTITY
    LAST-UPDATED "202605171934Z"
    ORGANIZATION "Terminalator"
    CONTACT-INFO "Generated via Terminalator SNMP Walk"
    DESCRIPTION
        "Reconstructed MIB module generated from SNMP walk results."
    ::= { enterprises 9999 }

`;

  interface TempNode {
    name: string;
    parent: string;
    subId: string;
    isLeaf: boolean;
    valueType?: string;
    value?: string;
  }

  const nodes = new Map<string, TempNode>();
  const usedNames = new Set<string>([cleanModuleName.toLowerCase(), 'enterprises', 'iso', 'org', 'dod', 'internet', 'mgmt', 'mib-2', 'system']);

  function getUniqueName(base: string): string {
    let clean = base.replace(/[^a-zA-Z0-9-]/g, '');
    if (!clean) clean = "node";
    clean = clean.charAt(0).toLowerCase() + clean.slice(1);
    clean = clean.replace(/--+/g, '-').replace(/-$/, '').replace(/^-/, '');
    
    let candidate = clean;
    let counter = 1;
    while (usedNames.has(candidate)) {
      candidate = `${clean}-${counter}`;
      counter++;
    }
    usedNames.add(candidate);
    return candidate;
  }

  const standardMap: { [key: string]: { name: string; parent: string; subId: string } } = {
    'iso': { name: 'iso', parent: 'ccitt', subId: '1' },
    'iso.org': { name: 'org', parent: 'iso', subId: '3' },
    'iso.org.dod': { name: 'dod', parent: 'org', subId: '6' },
    'iso.org.dod.internet': { name: 'internet', parent: 'dod', subId: '1' },
    'iso.org.dod.internet.mgmt': { name: 'mgmt', parent: 'internet', subId: '2' },
    'iso.org.dod.internet.mgmt.mib-2': { name: 'mib2', parent: 'mgmt', subId: '1' },
    'iso.org.dod.internet.private': { name: 'private', parent: 'internet', subId: '4' },
    'iso.org.dod.internet.private.enterprises': { name: 'enterprises', parent: 'private', subId: '1' },
  };

  const oidToName = new Map<string, string>();
  for (const [key, val] of Object.entries(standardMap)) {
    oidToName.set('.' + key, val.name);
    oidToName.set(key, val.name);
  }

  for (const item of results) {
    if (!item.success || !item.oid) continue;
    const cleanOid = item.oid.startsWith('.') ? item.oid.substring(1) : item.oid;
    const parts = cleanOid.split('.');
    
    let currentPath = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}.${part}` : part;
      
      if (oidToName.has(currentPath)) continue;
      
      let baseName = part;
      let subId = "1";
      
      if (/^\d+$/.test(part)) {
        baseName = `node${part}`;
        subId = part;
      } else {
        const match = part.match(/^([a-zA-Z0-9-]+)\.(\d+)$/);
        if (match) {
          baseName = match[1];
          subId = match[2];
        } else {
          subId = (i + 1).toString();
        }
      }
      
      const uniqueName = getUniqueName(baseName);
      oidToName.set(currentPath, uniqueName);
      
      const isLeaf = (i === parts.length - 1);
      
      let valType = "OCTET STRING";
      if (isLeaf && item.value) {
        const valStr = item.value.toUpperCase();
        if (valStr.startsWith("INTEGER:") || valStr.startsWith("INTEGER32:")) {
          valType = "Integer32";
        } else if (valStr.startsWith("GAUGE32:") || valStr.startsWith("GAUGE:")) {
          valType = "Gauge32";
        } else if (valStr.startsWith("COUNTER32:") || valStr.startsWith("COUNTER:")) {
          valType = "Counter32";
        } else if (valStr.startsWith("OID:") || valStr.startsWith("OBJECTIDENTIFIER:")) {
          valType = "OBJECT IDENTIFIER";
        } else if (valStr.startsWith("TIMETICKS:")) {
          valType = "TimeTicks";
        } else if (valStr.startsWith("IPADDRESS:")) {
          valType = "IpAddress";
        }
      }

      nodes.set(currentPath, {
        name: uniqueName,
        parent: prevPath ? (oidToName.get(prevPath) || 'mgmt') : `${cleanModuleName.toLowerCase()}`,
        subId,
        isLeaf,
        valueType: valType,
        value: item.value,
      });
    }
  }

  const sortedPaths = Array.from(nodes.keys()).sort((a, b) => a.split('.').length - b.split('.').length);

  for (const path of sortedPaths) {
    const node = nodes.get(path)!;
    if (node.isLeaf) {
      content += `${node.name} OBJECT-TYPE
    SYNTAX      ${node.valueType}
    MAX-ACCESS  read-only
    STATUS      current
    DESCRIPTION
        "Reconstructed OID leaf. Original value: ${node.value?.replace(/"/g, "'")}"
    ::= { ${node.parent} ${node.subId} }

`;
    } else {
      content += `${node.name} OBJECT IDENTIFIER ::= { ${node.parent} ${node.subId} }
`;
    }
  }

  content += `END\n`;
  return content;
};

export const generateWalkContent = (results: SnmpResult[]): string => {
  return results
    .filter(r => r.success && r.oid)
    .map(r => `${r.oid} = ${r.value}`)
    .join('\n');
};

export const triggerDownload = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
