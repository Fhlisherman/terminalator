use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnmpCreds {
    pub target: String,
    pub port: u16,
    pub version: String, // "1", "2c", "3"
    // v1/v2c
    pub community: Option<String>,
    // v3
    pub username: Option<String>,
    pub sec_level: Option<String>, // noAuthNoPriv, authNoPriv, authPriv
    pub auth_protocol: Option<String>, // MD5, SHA
    pub auth_password: Option<String>,
    pub priv_protocol: Option<String>, // DES, AES
    pub priv_password: Option<String>,
    // MIBs
    pub mib_dirs: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnmpTask {
    pub operation: String, // "GET", "SET"
    pub oid: String,
    pub value: Option<String>,
    pub value_type: Option<String>, // i, u, s, x, d, n, a, t, o
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnmpResult {
    pub success: bool,
    pub oid: String,
    pub value: String,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WalkResult {
    pub success: bool,
    pub results: Vec<SnmpResult>,
    pub error: Option<String>,
}

fn build_snmp_args(creds: &SnmpCreds, base_cmd: &str) -> Vec<String> {
    let mut args = vec![];

    if let Some(dirs) = &creds.mib_dirs {
        if !dirs.is_empty() {
            let joined = dirs.join(":");
            args.push("-M".to_string());
            args.push(format!("+{}", joined));
            args.push("-m".to_string());
            args.push("ALL".to_string());
        }
    }

    // Set output format to include full OID and value type, makes parsing easier
    // -OQ: quick print, -Oe: remove symbolic labels, -OX: extended index format, -O v: print value only
    // Actually, let's use standard output but numeric if we want, but since we WANT MIB translation,
    // we use default output but with full symbolic OIDs: -Of
    args.push("-Of".to_string());

    args.push("-v".to_string());
    args.push(creds.version.clone());

    if creds.version == "1" || creds.version == "2c" {
        args.push("-c".to_string());
        args.push(creds.community.clone().unwrap_or_else(|| "public".to_string()));
    } else if creds.version == "3" {
        if let Some(user) = &creds.username {
            args.push("-u".to_string());
            args.push(user.clone());
        }
        if let Some(level) = &creds.sec_level {
            args.push("-l".to_string());
            args.push(level.clone());
        }
        if let Some(auth_proto) = &creds.auth_protocol {
            args.push("-a".to_string());
            args.push(auth_proto.clone());
        }
        if let Some(auth_pass) = &creds.auth_password {
            args.push("-A".to_string());
            args.push(auth_pass.clone());
        }
        if let Some(priv_proto) = &creds.priv_protocol {
            args.push("-x".to_string());
            args.push(priv_proto.clone());
        }
        if let Some(priv_pass) = &creds.priv_password {
            args.push("-X".to_string());
            args.push(priv_pass.clone());
        }
    }

    let target_str = format!("{}:{}", creds.target, creds.port);
    args.push(target_str);

    args
}

#[tauri::command]
pub fn snmp_connect_and_walk(creds: SnmpCreds, root_oid: String) -> WalkResult {
    let mut args = build_snmp_args(&creds, "snmpwalk");
    args.push(root_oid);

    let output = Command::new("snmpwalk")
        .args(&args)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let mut results = Vec::new();
                for line in stdout.lines() {
                    // Typical output: .iso.org.dod.internet.mgmt.mib-2.system.sysDescr.0 = STRING: "Linux server..."
                    if let Some((oid_part, value_part)) = line.split_once(" = ") {
                        results.push(SnmpResult {
                            success: true,
                            oid: oid_part.trim().to_string(),
                            value: value_part.trim().to_string(),
                            error: None,
                        });
                    }
                }
                WalkResult {
                    success: true,
                    results,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                WalkResult {
                    success: false,
                    results: vec![],
                    error: Some(format!("Error: {}\n{}", stderr, stdout)),
                }
            }
        }
        Err(e) => WalkResult {
            success: false,
            results: vec![],
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn snmp_get(creds: SnmpCreds, oid: String) -> SnmpResult {
    let mut args = build_snmp_args(&creds, "snmpget");
    args.push(oid.clone());

    let output = Command::new("snmpget")
        .args(&args)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let mut val = String::new();
                for line in stdout.lines() {
                    if let Some((_, value_part)) = line.split_once(" = ") {
                        val = value_part.trim().to_string();
                        break;
                    }
                }
                SnmpResult {
                    success: true,
                    oid,
                    value: val,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                SnmpResult {
                    success: false,
                    oid,
                    value: "".to_string(),
                    error: Some(stderr.to_string()),
                }
            }
        }
        Err(e) => SnmpResult {
            success: false,
            oid,
            value: "".to_string(),
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn snmp_set(creds: SnmpCreds, oid: String, value: String, value_type: String) -> SnmpResult {
    let mut args = build_snmp_args(&creds, "snmpset");
    args.push(oid.clone());
    args.push(value_type);
    args.push(value);

    let output = Command::new("snmpset")
        .args(&args)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let mut val = String::new();
                for line in stdout.lines() {
                    if let Some((_, value_part)) = line.split_once(" = ") {
                        val = value_part.trim().to_string();
                        break;
                    }
                }
                SnmpResult {
                    success: true,
                    oid,
                    value: val,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                SnmpResult {
                    success: false,
                    oid,
                    value: "".to_string(),
                    error: Some(stderr.to_string()),
                }
            }
        }
        Err(e) => SnmpResult {
            success: false,
            oid,
            value: "".to_string(),
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub async fn snmp_run_batch(creds: SnmpCreds, tasks: Vec<SnmpTask>, mode: String) -> Vec<SnmpResult> {
    let mut results = Vec::new();

    if mode == "parallel" {
        // Run in parallel
        let mut handles = vec![];
        for task in tasks {
            let c = creds.clone();
            let handle = tokio::spawn(async move {
                if task.operation.to_uppercase() == "GET" {
                    snmp_get(c, task.oid)
                } else if task.operation.to_uppercase() == "SET" {
                    snmp_set(c, task.oid, task.value.unwrap_or_default(), task.value_type.unwrap_or_else(|| "s".to_string()))
                } else {
                    SnmpResult {
                        success: false,
                        oid: task.oid,
                        value: "".to_string(),
                        error: Some("Unknown operation".to_string()),
                    }
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            if let Ok(res) = handle.await {
                results.push(res);
            }
        }
    } else {
        // Sequential
        for task in tasks {
            let res = if task.operation.to_uppercase() == "GET" {
                snmp_get(creds.clone(), task.oid.clone())
            } else if task.operation.to_uppercase() == "SET" {
                snmp_set(creds.clone(), task.oid.clone(), task.value.clone().unwrap_or_default(), task.value_type.clone().unwrap_or_else(|| "s".to_string()))
            } else {
                SnmpResult {
                    success: false,
                    oid: task.oid.clone(),
                    value: "".to_string(),
                    error: Some("Unknown operation".to_string()),
                }
            };
            results.push(res.clone());
            if !res.success {
                // abort on failure in sequential mode? Or continue? Let's continue for now, or user can choose.
            }
        }
    }

    results
}
