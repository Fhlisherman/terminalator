export interface SnmpCreds {
  target: string;
  port: number;
  version: string;
  community?: string;
  username?: string;
  sec_level?: string;
  auth_protocol?: string;
  auth_password?: string;
  priv_protocol?: string;
  priv_password?: string;
  mib_dirs?: string[];
}

export interface SnmpResult {
  success: boolean;
  oid: string;
  value: string;
  error?: string;
}

export interface WalkResult {
  success: boolean;
  results: SnmpResult[];
  error?: string;
}

export interface SnmpTaskLeaf {
  id: string;
  operation: string; // 'GET' | 'SET'
  oid: string;
  value?: string;
  value_type?: string;
  result?: SnmpResult | null;
}

export interface SnmpTask {
  id: string;
  name: string;
  enabled: boolean;
  leaves: SnmpTaskLeaf[];
}
