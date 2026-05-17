import { SnmpResult } from './snmpTypes';

export interface OidTreeNode {
  num: string;
  sym: string;
  children: Record<string, OidTreeNode>;
}

export const SYMBOLIC_TO_NUMERIC: Record<string, string> = {
  'iso': '1',
  'org': '3',
  'dod': '6',
  'internet': '1',
  'directory': '1',
  'mgmt': '2',
  'mib-2': '1',
  'system': '1',
  'sysDescr': '1',
  'sysObjectID': '2',
  'sysUpTime': '3',
  'sysContact': '4',
  'sysName': '5',
  'sysLocation': '6',
  'sysServices': '7',
  'sysORLastChange': '8',
  'sysORTable': '9',
  'sysOREntry': '1',
  'sysORIndex': '1',
  'sysORID': '2',
  'sysORDescr': '3',
  'sysORUpTime': '4',
  'interfaces': '2',
  'ifNumber': '1',
  'ifTable': '2',
  'ifEntry': '1',
  'ifIndex': '1',
  'ifDescr': '2',
  'ifType': '3',
  'ifMtu': '4',
  'ifSpeed': '5',
  'ifPhysAddress': '6',
  'ifAdminStatus': '7',
  'ifOperStatus': '8',
  'ifLastChange': '9',
  'ifInOctets': '10',
  'ifInUcastPkts': '11',
  'ifInNUcastPkts': '12',
  'ifInDiscards': '13',
  'ifInErrors': '14',
  'ifInUnknownProtos': '15',
  'ifOutOctets': '16',
  'ifOutUcastPkts': '17',
  'ifOutNUcastPkts': '18',
  'ifOutDiscards': '19',
  'ifOutErrors': '20',
  'ifOutQLen': '21',
  'ifSpecific': '22',
  'ip': '4',
  'ipForwarding': '1',
  'ipDefaultTTL': '2',
  'ipInReceives': '3',
  'ipInHdrErrors': '4',
  'ipInAddrErrors': '5',
  'ipForwDatagrams': '6',
  'ipInUnknownProtos': '7',
  'ipInDiscards': '8',
  'ipInDelivers': '9',
  'ipOutRequests': '10',
  'ipOutDiscards': '11',
  'ipOutNoRoutes': '12',
  'ipReasmTimeout': '13',
  'ipReasmReqds': '14',
  'ipReasmOKs': '15',
  'ipReasmFails': '16',
  'ipFragOKs': '17',
  'ipFragFails': '18',
  'ipFragCreates': '19',
  'icmp': '5',
  'tcp': '6',
  'udp': '7',
  'egp': '8',
  'transmission': '10',
  'snmp': '11',
  'private': '4',
  'enterprises': '1',
};

export const OID_TREE: OidTreeNode = {
  num: '1', sym: 'iso', children: {
    '3': { num: '3', sym: 'org', children: {
      '6': { num: '6', sym: 'dod', children: {
        '1': { num: '1', sym: 'internet', children: {
          '2': { num: '2', sym: 'mgmt', children: {
            '1': { num: '1', sym: 'mib-2', children: {
              '1': { num: '1', sym: 'system', children: {
                '1': { num: '1', sym: 'sysDescr', children: {} },
                '2': { num: '2', sym: 'sysObjectID', children: {} },
                '3': { num: '3', sym: 'sysUpTime', children: {} },
                '4': { num: '4', sym: 'sysContact', children: {} },
                '5': { num: '5', sym: 'sysName', children: {} },
                '6': { num: '6', sym: 'sysLocation', children: {} },
                '7': { num: '7', sym: 'sysServices', children: {} },
                '8': { num: '8', sym: 'sysORLastChange', children: {} },
                '9': { num: '9', sym: 'sysORTable', children: {
                  '1': { num: '1', sym: 'sysOREntry', children: {
                    '1': { num: '1', sym: 'sysORIndex', children: {} },
                    '2': { num: '2', sym: 'sysORID', children: {} },
                    '3': { num: '3', sym: 'sysORDescr', children: {} },
                    '4': { num: '4', sym: 'sysORUpTime', children: {} },
                  }}
                } },
              }},
              '2': { num: '2', sym: 'interfaces', children: {
                '1': { num: '1', sym: 'ifNumber', children: {} },
                '2': { num: '2', sym: 'ifTable', children: {
                  '1': { num: '1', sym: 'ifEntry', children: {
                    '1': { num: '1', sym: 'ifIndex', children: {} },
                    '2': { num: '2', sym: 'ifDescr', children: {} },
                    '3': { num: '3', sym: 'ifType', children: {} },
                    '4': { num: '4', sym: 'ifMtu', children: {} },
                    '5': { num: '5', sym: 'ifSpeed', children: {} },
                    '6': { num: '6', sym: 'ifPhysAddress', children: {} },
                    '7': { num: '7', sym: 'ifAdminStatus', children: {} },
                    '8': { num: '8', sym: 'ifOperStatus', children: {} },
                    '9': { num: '9', sym: 'ifLastChange', children: {} },
                    '10': { num: '10', sym: 'ifInOctets', children: {} },
                    '11': { num: '11', sym: 'ifInUcastPkts', children: {} },
                    '12': { num: '12', sym: 'ifInNUcastPkts', children: {} },
                    '13': { num: '13', sym: 'ifInDiscards', children: {} },
                    '14': { num: '14', sym: 'ifInErrors', children: {} },
                    '15': { num: '15', sym: 'ifInUnknownProtos', children: {} },
                    '16': { num: '16', sym: 'ifOutOctets', children: {} },
                    '17': { num: '17', sym: 'ifOutUcastPkts', children: {} },
                    '18': { num: '18', sym: 'ifOutNUcastPkts', children: {} },
                    '19': { num: '19', sym: 'ifOutDiscards', children: {} },
                    '20': { num: '20', sym: 'ifOutErrors', children: {} },
                    '21': { num: '21', sym: 'ifOutQLen', children: {} },
                    '22': { num: '22', sym: 'ifSpecific', children: {} },
                  }}
                }}
              }},
              '4': { num: '4', sym: 'ip', children: {
                '1': { num: '1', sym: 'ipForwarding', children: {} },
                '2': { num: '2', sym: 'ipDefaultTTL', children: {} },
                '3': { num: '3', sym: 'ipInReceives', children: {} },
                '4': { num: '4', sym: 'ipInHdrErrors', children: {} },
                '5': { num: '5', sym: 'ipInAddrErrors', children: {} },
                '6': { num: '6', sym: 'ipForwDatagrams', children: {} },
                '7': { num: '7', sym: 'ipInUnknownProtos', children: {} },
                '8': { num: '8', sym: 'ipInDiscards', children: {} },
                '9': { num: '9', sym: 'ipInDelivers', children: {} },
                '10': { num: '10', sym: 'ipOutRequests', children: {} },
                '11': { num: '11', sym: 'ipOutDiscards', children: {} },
                '12': { num: '12', sym: 'ipOutNoRoutes', children: {} },
                '13': { num: '13', sym: 'ipReasmTimeout', children: {} },
                '14': { num: '14', sym: 'ipReasmReqds', children: {} },
                '15': { num: '15', sym: 'ipReasmOKs', children: {} },
                '16': { num: '16', sym: 'ipReasmFails', children: {} },
                '17': { num: '17', sym: 'ipFragOKs', children: {} },
                '18': { num: '18', sym: 'ipFragFails', children: {} },
                '19': { num: '19', sym: 'ipFragCreates', children: {} },
              }}
            }}
          }},
          '4': { num: '4', sym: 'private', children: {
            '1': { num: '1', sym: 'enterprises', children: {} }
          }}
        }}
      }}
    }}
  }
};

export function translateSymbolicToNumeric(symbolicOid: string): string {
  const parts = symbolicOid.split('.').filter(Boolean);
  if (parts.length === 0) return '';
  
  const result: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const match = part.match(/^([a-zA-Z0-9-]+)\.(\d+)$/);
    const partName = match ? match[1] : part;
    const partIndex = match ? match[2] : null;
    
    const isNum = /^\d+$/.test(partName);
    if (isNum) {
      result.push(partName);
    } else {
      const mapped = SYMBOLIC_TO_NUMERIC[partName];
      if (mapped) {
        result.push(mapped);
      } else {
        result.push(partName);
      }
    }
    
    if (partIndex) {
      result.push(partIndex);
    }
  }
  
  return '.' + result.join('.');
}

export function translateNumericToSymbolic(numericOid: string): string {
  const parts = numericOid.split('.').filter(Boolean);
  if (parts.length === 0) return '';
  
  let current: OidTreeNode | undefined = OID_TREE;
  const result: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (current && part === current.num) {
      result.push(current.sym);
      const nextPart = parts[i + 1];
      if (nextPart && current.children[nextPart]) {
        current = current.children[nextPart];
      } else {
        current = undefined;
      }
    } else {
      result.push(part);
      current = undefined;
    }
  }
  
  return '.' + result.join('.');
}

export const resolveOidRepresentations = (oidStr: string): { symbolic: string; numeric: string } => {
  const clean = oidStr.startsWith('.') ? oidStr : '.' + oidStr;
  
  // 1. Convert to pure numeric representation first
  const numeric = translateSymbolicToNumeric(clean);
  
  // 2. Convert pure numeric representation to fully-expanded symbolic representation
  const symbolic = translateNumericToSymbolic(numeric);
  
  return {
    numeric,
    symbolic
  };
};

export const getOidProperties = (item: SnmpResult) => {
  const oidStr = item.oid;
  const valStr = item.value || "";
  
  const representations = resolveOidRepresentations(oidStr);
  
  const parts = oidStr.split('.').filter(Boolean);
  let name = "";
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    const isIndex = /^\d+$/.test(last);
    if (isIndex && parts.length > 1) {
      name = parts[parts.length - 2] + '.' + last;
    } else {
      name = last;
    }
  } else {
    name = "unknown";
  }
  
  if (/^\d+(\.\d+)*$/.test(name) || name === "unknown") {
    const symParts = representations.symbolic.split('.').filter(Boolean);
    if (symParts.length > 0) {
      const symLast = symParts[symParts.length - 1];
      const isIndex = /^\d+$/.test(symLast);
      if (isIndex && symParts.length > 1) {
        name = symParts[symParts.length - 2] + '.' + symLast;
      } else {
        name = symLast;
      }
    }
  }
  
  const valUpper = valStr.toUpperCase();
  const nameLower = name.toLowerCase();
  
  let isMutable = true;
  
  if (
    valUpper.includes("COUNTER") ||
    valUpper.includes("GAUGE") ||
    valUpper.includes("TIMETICKS") ||
    valUpper.includes("OID:") ||
    nameLower.includes("descr") ||
    nameLower.includes("uptime") ||
    nameLower.includes("physaddr") ||
    nameLower.includes("objectid") ||
    nameLower.includes("ident") ||
    nameLower.includes("index") ||
    nameLower.includes("count") ||
    nameLower.includes("gauge") ||
    nameLower.includes("speed") ||
    nameLower.includes("type")
  ) {
    isMutable = false;
  }
  
  return {
    name,
    oid: oidStr,
    isMutable,
    numericOid: representations.numeric,
    symbolicOid: representations.symbolic
  };
};
