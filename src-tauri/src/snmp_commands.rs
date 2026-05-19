use snmp2::{SyncSession, Value, Oid};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnmpCreds {
    pub target: String,
    pub port: u16,
    pub version: String,
    pub community: Option<String>,
    pub username: Option<String>,
    pub sec_level: Option<String>,
    pub auth_protocol: Option<String>,
    pub auth_password: Option<String>,
    pub priv_protocol: Option<String>,
    pub priv_password: Option<String>,
    pub mib_dirs: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnmpTask {
    pub operation: String,
    pub oid: String,
    pub value: Option<String>,
    pub value_type: Option<String>,
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

// ── Session Builder ───────────────────────────────────────────────────────────

fn create_session(creds: &SnmpCreds) -> Result<SyncSession, String> {
    let target = format!("{}:{}", creds.target, creds.port);
    let timeout = Duration::from_secs(5);
    
    log::info!("[SNMP] connecting to {} version={}", target, creds.version);

    if creds.version == "3" {
        use snmp2::v3;

        let username = creds.username.as_deref().unwrap_or("");
        let auth_password = creds.auth_password.as_deref().unwrap_or("");

        let mut security = v3::Security::new(username.as_bytes(), auth_password.as_bytes());

        // Configure Auth Protocol
        let auth_proto = match creds.auth_protocol.as_deref().unwrap_or("SHA") {
            "MD5" => v3::AuthProtocol::Md5,
            _ => v3::AuthProtocol::Sha1,
        };
        security = security.with_auth_protocol(auth_proto);

        // Configure Auth/Priv
        let sec_level = creds.sec_level.as_deref().unwrap_or("noAuthNoPriv");
        let auth = match sec_level {
            "authPriv" => {
                let priv_proto = creds.priv_protocol.as_deref().unwrap_or("AES");
                let cipher = match priv_proto {
                    "DES" => v3::Cipher::Des,
                    _ => v3::Cipher::Aes128,
                };
                let priv_password = creds.priv_password.as_deref().unwrap_or("").as_bytes().to_vec();
                v3::Auth::AuthPriv { cipher, privacy_password: priv_password }
            }
            "authNoPriv" => v3::Auth::AuthNoPriv,
            _ => v3::Auth::NoAuthNoPriv,
        };
        security = security.with_auth(auth);

        let mut session = SyncSession::new_v3(
            &target,
            Some(timeout),
            3,
            security,
        ).map_err(|e| format!("Failed to create SNMPv3 session: {:?}", e))?;

        session.init().map_err(|e| format!("Failed to initialize SNMPv3 session: {:?}", e))?;
        Ok(session)
    } else {
        let community = creds.community.clone().unwrap_or_else(|| "public".to_string());
        if creds.version == "1" {
            SyncSession::new_v1(&target, community.as_bytes(), Some(timeout), 3)
                .map_err(|e| format!("Failed to create SNMP session: {:?}", e))
        } else {
            SyncSession::new_v2c(&target, community.as_bytes(), Some(timeout), 3)
                .map_err(|e| format!("Failed to create SNMP session: {:?}", e))
        }
    }
}

// ── Formatting & Parsing ──────────────────────────────────────────────────────

// Bumped to u64 to match snmp2's strict OID types
fn oid_to_vec(oid: &Oid) -> Vec<u64> {
    let debug_str = format!("{:?}", oid);
    let mut nums = Vec::new();
    let mut current_num = String::new();
    
    for c in debug_str.chars() {
        if c.is_ascii_digit() {
            current_num.push(c);
        } else if !current_num.is_empty() {
            if let Ok(n) = current_num.parse::<u64>() {
                nums.push(n);
            }
            current_num.clear();
        }
    }
    if !current_num.is_empty() {
        if let Ok(n) = current_num.parse::<u64>() {
            nums.push(n);
        }
    }
    nums
}

fn format_oid(oid: &[u64]) -> String {
    let parts: Vec<String> = oid.iter().map(|n| n.to_string()).collect();
    format!(".{}", parts.join("."))
}

fn parse_oid(root_oid: &str) -> Result<Vec<u64>, String> {
    let trimmed = root_oid.trim().strip_prefix('.').unwrap_or(root_oid.trim());
    
    // FIX: If the OID is empty, seed it with the standard internet root (1.3.6.1)
    if trimmed.is_empty() {
        return Ok(vec![1, 3, 6, 1]); 
    }
    
    trimmed.split('.')
        .map(|s| s.parse::<u64>().map_err(|_| format!("Invalid OID part '{}'", s)))
        .collect()
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ")
}

fn hex_decode(hex: &str) -> Result<Vec<u8>, String> {
    if hex.len() % 2 != 0 { return Err("Odd number of hex digits".to_string()); }
    (0..hex.len()).step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).map_err(|e| format!("Hex parse error: {}", e)))
        .collect()
}

fn format_snmp_value(value: &Value) -> String {
    match value {
        Value::Integer(n) => format!("INTEGER: {}", n),
        Value::OctetString(bytes) => {
            if let Ok(s) = std::str::from_utf8(bytes) {
                if s.chars().all(|c| c.is_ascii_graphic() || c.is_whitespace()) {
                    format!("STRING: \"{}\"", s)
                } else {
                    format!("STRING: {}", hex_encode(bytes))
                }
            } else {
                format!("STRING: {}", hex_encode(bytes))
            }
        }
        Value::Null => "NULL".to_string(),
        Value::ObjectIdentifier(oid) => {
            let vec = oid_to_vec(oid);
            format!("OID: {}", format_oid(&vec))
        },
        Value::IpAddress(ip) => format!("IPADDRESS: {}.{}.{}.{}", ip[0], ip[1], ip[2], ip[3]),
        Value::Counter32(n) => format!("COUNTER32: {}", n),
        Value::Unsigned32(n) => format!("UNSIGNED32: {}", n),
        Value::Timeticks(n) => format!("TIMETICKS: ({})", n),
        Value::Opaque(bytes) => format!("OPAQUE: {}", hex_encode(bytes)),
        Value::Counter64(n) => format!("COUNTER64: {}", n),
        _ => format!("{:?}", value),
    }
}

// Intermediary struct to own memory for SET requests before borrowing into `snmp2::Value`
#[allow(dead_code)]
enum OwnedSnmpValue {
    Integer(i64),
    OctetString(Vec<u8>),
    ObjectIdentifier(Vec<u64>),
    Null,
    IpAddress([u8; 4]),
    Counter32(u32),
    Unsigned32(u32),
    Timeticks(u32),
}

fn parse_owned_value(value_type: &str, value: &str) -> Result<OwnedSnmpValue, String> {
    match value_type {
        "i" => { let n: i64 = value.parse().map_err(|e| format!("Invalid integer '{}': {}", value, e))?; Ok(OwnedSnmpValue::Integer(n)) }
        "u" => { let n: u32 = value.parse().map_err(|e| format!("Invalid unsigned '{}': {}", value, e))?; Ok(OwnedSnmpValue::Counter32(n)) }
        "s" => Ok(OwnedSnmpValue::OctetString(value.as_bytes().to_vec())),
        "x" => {
            let hex = value.replace([' ', ':'], "");
            let bytes = hex_decode(&hex).map_err(|e| format!("Invalid hex '{}': {}", value, e))?;
            Ok(OwnedSnmpValue::OctetString(bytes))
        }
        "n" => Ok(OwnedSnmpValue::Null),
        "o" => {
            let oid = parse_oid(value)?;
            Ok(OwnedSnmpValue::ObjectIdentifier(oid))
        }
        "t" => { let n: u32 = value.parse().map_err(|e| format!("Invalid timeticks '{}': {}", value, e))?; Ok(OwnedSnmpValue::Timeticks(n)) }
        "a" => {
            let parts: Vec<&str> = value.split('.').collect();
            if parts.len() != 4 { return Err(format!("Invalid IP address '{}'", value)); }
            let octets: Result<Vec<u8>, _> = parts.iter().map(|p| p.parse()).collect();
            let ip: [u8; 4] = octets.map_err(|e| format!("Invalid IP '{}': {}", value, e))?.try_into().map_err(|_| format!("Invalid IP '{}'", value))?;
            Ok(OwnedSnmpValue::IpAddress(ip))
        }
        _ => Err(format!("Unknown value type '{}'", value_type)),
    }
}

// ── Raw UDP probe ─────────────────────────────────────────────────────────────

fn udp_raw_probe(target: &str, port: u16, community: &str) -> Result<usize, String> {
    use std::net::UdpSocket;

    let community_bytes = community.as_bytes();
    let community_len = community_bytes.len() as u8;

    let pdu: &[u8] = &[
        0xa0, 0x1a,
        0x02, 0x04, 0x01, 0x02, 0x03, 0x04,
        0x02, 0x01, 0x00,
        0x02, 0x01, 0x00,
        0x30, 0x0e, 0x30, 0x0c,
        0x06, 0x08, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00,
        0x05, 0x00,
    ];

    let header_inner_len = 3 + 2 + community_len as usize + pdu.len();
    let mut pkt: Vec<u8> = Vec::with_capacity(2 + header_inner_len);
    pkt.push(0x30);
    pkt.push(header_inner_len as u8);
    pkt.extend_from_slice(&[0x02, 0x01, 0x01]);
    pkt.push(0x04);
    pkt.push(community_len);
    pkt.extend_from_slice(community_bytes);
    pkt.extend_from_slice(pdu);

    let addr = format!("{}:{}", target, port);
    log::info!("[SNMP-PROBE] UDP bind 0.0.0.0:0 → send {} bytes to {}", pkt.len(), addr);

    let sock = UdpSocket::bind("0.0.0.0:0").map_err(|e| format!("UDP bind: {}", e))?;
    sock.set_read_timeout(Some(Duration::from_secs(5))).ok();
    sock.send_to(&pkt, &addr).map_err(|e| format!("UDP send: {}", e))?;

    let mut buf = [0u8; 4096];
    let (n, _) = sock.recv_from(&mut buf).map_err(|e| format!("UDP recv: {}", e))?;
    Ok(n)
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn snmp_connect_and_walk(creds: SnmpCreds, root_oid: String) -> WalkResult {
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    std::thread::Builder::new()
        .name("snmp-walk-thread".to_string())
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let res = (move || {
                log::info!("[SNMP] walk → target={} port={} ver={} oid={}", creds.target, creds.port, creds.version, root_oid);

                if creds.version != "3" {
                    let community = creds.community.clone().unwrap_or_else(|| "public".to_string());
                    if let Err(e) = udp_raw_probe(&creds.target, creds.port, &community) {
                        log::error!("[SNMP] raw probe FAILED: {}", e);
                        return Err(format!("UDP probe failed: {}", e));
                    }
                }

                let parsed_root_oid = parse_oid(&root_oid)?;
                let mut session = create_session(&creds)?;

                let mut results = Vec::new();
                let mut current_oid = parsed_root_oid.clone();
                let mut count = 0usize;

                log::info!("[SNMP] starting synchronous GETNEXT walk loop...");

                loop {
                    let target_oid = Oid::from(&current_oid[..]).map_err(|e| format!("Invalid OID: {:?}", e))?;

                    match session.getnext(&target_oid) {
                        Ok(mut response) => {
                            if let Some((resp_oid, value)) = response.varbinds.next() {
                                let oid_vec = oid_to_vec(&resp_oid);

                                if oid_vec == current_oid {
                                    break;
                                }

                                if !parsed_root_oid.is_empty() && !oid_vec.starts_with(&parsed_root_oid) {
                                    break;
                                }

                                let oid_str = format_oid(&oid_vec);
                                let val_str = format_snmp_value(&value);
                                
                                count += 1;
                                if count <= 5 || count % 50 == 0 { log::info!("[SNMP] varbind #{}: {}", count, oid_str); }

                                results.push(SnmpResult { success: true, oid: oid_str, value: val_str, error: None });
                                current_oid = oid_vec;
                            } else {
                                break;
                            }
                        }
                        Err(e) => {
                            log::error!("[SNMP] GETNEXT error: {:?}", e);
                            return Err(format!("Walk error: {:?}", e));
                        }
                    }
                }

                log::info!("[SNMP] walk complete — {} varbinds", count);
                Ok(results)
            })();

            let walk_res = match res {
                Ok(results) => WalkResult { success: true, results, error: None },
                Err(e) => WalkResult { success: false, results: vec![], error: Some(e) },
            };
            let _ = tx.send(walk_res);
        })
        .expect("Failed to spawn SNMP walk thread");

    rx.await.unwrap_or_else(|e| WalkResult { success: false, results: vec![], error: Some(format!("Thread communication error: {:?}", e)) })
}

#[tauri::command]
pub async fn snmp_get(creds: SnmpCreds, oid: String) -> SnmpResult {
    let fallback_oid = oid.clone();
    let fallback_oid_thread = oid.clone();
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    std::thread::Builder::new()
        .name("snmp-get-thread".to_string())
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let res = (move || {
                let parsed_oid = parse_oid(&oid)?;
                let mut session = create_session(&creds)?;
                let target_oid = Oid::from(&parsed_oid[..]).map_err(|e| format!("Invalid OID: {:?}", e))?;
                match session.get(&target_oid) {
                    Ok(mut response) => {
                        if let Some((resp_oid, value)) = response.varbinds.next() {
                            let oid_vec = oid_to_vec(&resp_oid);
                            Ok(SnmpResult { success: true, oid: format_oid(&oid_vec), value: format_snmp_value(&value), error: None })
                        } else {
                            Err("No varbinds returned".to_string())
                        }
                    }
                    Err(e) => Err(format!("{:?}", e)),
                }
            })();
            
            let snmp_res = match res {
                Ok(r) => r,
                Err(e) => SnmpResult { success: false, oid: fallback_oid_thread, value: String::new(), error: Some(e) },
            };
            let _ = tx.send(snmp_res);
        })
        .expect("Failed to spawn SNMP get thread");
        
    rx.await.unwrap_or_else(|e| SnmpResult { success: false, oid: fallback_oid, value: String::new(), error: Some(format!("Thread communication error: {:?}", e)) })
}

#[tauri::command]
pub async fn snmp_set(creds: SnmpCreds, oid: String, value: String, value_type: String) -> SnmpResult {
    let fallback_oid = oid.clone();
    let fallback_oid_thread = oid.clone();
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    std::thread::Builder::new()
        .name("snmp-set-thread".to_string())
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let res = (move || {
                let parsed_oid = parse_oid(&oid)?;
                let owned_val = parse_owned_value(&value_type, &value)?;
                let mut session = create_session(&creds)?;

                let snmp_val = match &owned_val {
                    OwnedSnmpValue::Integer(i) => Value::Integer(*i),
                    OwnedSnmpValue::OctetString(b) => Value::OctetString(b),
                    OwnedSnmpValue::ObjectIdentifier(_) => {
                        return Err("SET of ObjectIdentifier is unsupported".to_string())
                    },
                    OwnedSnmpValue::Null => Value::Null,
                    OwnedSnmpValue::IpAddress(ip) => Value::IpAddress(*ip),
                    OwnedSnmpValue::Counter32(c) => Value::Counter32(*c),
                    OwnedSnmpValue::Unsigned32(c) => Value::Unsigned32(*c),
                    OwnedSnmpValue::Timeticks(c) => Value::Timeticks(*c),
                };

                let target_oid = Oid::from(&parsed_oid[..]).map_err(|e| format!("Invalid OID: {:?}", e))?;
                match session.set(&[(&target_oid, snmp_val)]) {
                    Ok(mut response) => {
                        if let Some((resp_oid, val)) = response.varbinds.next() {
                            let oid_vec = oid_to_vec(&resp_oid);
                            Ok(SnmpResult { success: true, oid: format_oid(&oid_vec), value: format_snmp_value(&val), error: None })
                        } else {
                            Err("No varbinds returned on SET".to_string())
                        }
                    }
                    Err(e) => Err(format!("{:?}", e)),
                }
            })();
            
            let snmp_res = match res {
                Ok(r) => r,
                Err(e) => SnmpResult { success: false, oid: fallback_oid_thread, value: String::new(), error: Some(e) },
            };
            let _ = tx.send(snmp_res);
        })
        .expect("Failed to spawn SNMP set thread");
        
    rx.await.unwrap_or_else(|e| SnmpResult { success: false, oid: fallback_oid, value: String::new(), error: Some(format!("Thread communication error: {:?}", e)) })
}

#[tauri::command]
pub async fn snmp_run_batch(creds: SnmpCreds, tasks: Vec<SnmpTask>, mode: String) -> Vec<SnmpResult> {
    if mode == "parallel" {
        let mut join_handles = vec![];
        for task in tasks {
            let creds_clone = creds.clone();
            let (tx, rx) = tokio::sync::oneshot::channel();
            
            std::thread::Builder::new()
                .name(format!("snmp-batch-{}", task.oid))
                .stack_size(8 * 1024 * 1024)
                .spawn(move || {
                    let task_oid = task.oid.clone();
                    let res = (move || {
                        let mut session = create_session(&creds_clone)?;
                        let parsed_oid = parse_oid(&task.oid)?;
                        let target_oid = Oid::from(&parsed_oid[..]).map_err(|e| format!("Invalid OID: {:?}", e))?;
                        
                        if task.operation.to_uppercase() == "GET" {
                            match session.get(&target_oid) {
                                Ok(mut response) => {
                                    if let Some((resp_oid, value)) = response.varbinds.next() {
                                        let oid_vec = oid_to_vec(&resp_oid);
                                        Ok(SnmpResult { success: true, oid: format_oid(&oid_vec), value: format_snmp_value(&value), error: None })
                                    } else {
                                        Err("No varbinds".to_string())
                                    }
                                }
                                Err(e) => Err(format!("{:?}", e)),
                            }
                        } else if task.operation.to_uppercase() == "SET" {
                            let owned_val = parse_owned_value(&task.value_type.unwrap_or_else(|| "s".to_string()), &task.value.unwrap_or_default())?;
                            let snmp_val = match &owned_val {
                                OwnedSnmpValue::Integer(i) => Value::Integer(*i),
                                OwnedSnmpValue::OctetString(b) => Value::OctetString(b),
                                OwnedSnmpValue::ObjectIdentifier(_) => {
                                    return Err("SET of ObjectIdentifier is unsupported".to_string())
                                },
                                OwnedSnmpValue::Null => Value::Null,
                                OwnedSnmpValue::IpAddress(ip) => Value::IpAddress(*ip),
                                OwnedSnmpValue::Counter32(c) => Value::Counter32(*c),
                                OwnedSnmpValue::Unsigned32(c) => Value::Unsigned32(*c),
                                OwnedSnmpValue::Timeticks(c) => Value::Timeticks(*c),
                            };

                            match session.set(&[(&target_oid, snmp_val)]) {
                                Ok(mut response) => {
                                    if let Some((resp_oid, val)) = response.varbinds.next() {
                                        let oid_vec = oid_to_vec(&resp_oid);
                                        Ok(SnmpResult { success: true, oid: format_oid(&oid_vec), value: format_snmp_value(&val), error: None })
                                    } else {
                                        Err("No varbinds".to_string())
                                    }
                                }
                                Err(e) => Err(format!("{:?}", e)),
                            }
                        } else {
                            Err("Unknown operation".to_string())
                        }
                    })();

                    let result = match res {
                        Ok(r) => r,
                        Err(e) => SnmpResult { success: false, oid: task_oid, value: String::new(), error: Some(e) },
                    };
                    let _ = tx.send(result);
                })
                .expect("Failed to spawn batch thread");
            
            join_handles.push(rx);
        }
        
        let mut results = Vec::new();
        for handle in join_handles {
            if let Ok(res) = handle.await {
                results.push(res);
            }
        }
        results
    } else {
        // Sequential Mode
        let (tx, rx) = tokio::sync::oneshot::channel();
        
        std::thread::Builder::new()
            .name("snmp-seq-batch".to_string())
            .stack_size(8 * 1024 * 1024)
            .spawn(move || {
                let mut results = Vec::new();
                let mut session = match create_session(&creds) {
                    Ok(s) => s,
                    Err(e) => {
                        for task in tasks {
                            results.push(SnmpResult { success: false, oid: task.oid, value: String::new(), error: Some(e.clone()) });
                        }
                        let _ = tx.send(results);
                        return;
                    }
                };

                for task in tasks {
                    let res = (|| {
                        let parsed_oid = parse_oid(&task.oid)?;
                        let target_oid = Oid::from(&parsed_oid[..]).map_err(|e| format!("Invalid OID: {:?}", e))?;
                        
                        if task.operation.to_uppercase() == "GET" {
                            match session.get(&target_oid) {
                                Ok(mut response) => {
                                    if let Some((resp_oid, value)) = response.varbinds.next() {
                                        let oid_vec = oid_to_vec(&resp_oid);
                                        Ok(SnmpResult { success: true, oid: format_oid(&oid_vec), value: format_snmp_value(&value), error: None })
                                    } else {
                                        Err("No varbinds".to_string())
                                    }
                                }
                                Err(e) => Err(format!("{:?}", e)),
                            }
                        } else if task.operation.to_uppercase() == "SET" {
                            let owned_val = parse_owned_value(&task.value_type.clone().unwrap_or_else(|| "s".to_string()), &task.value.clone().unwrap_or_default())?;
                            let snmp_val = match &owned_val {
                                OwnedSnmpValue::Integer(i) => Value::Integer(*i),
                                OwnedSnmpValue::OctetString(b) => Value::OctetString(b),
                                OwnedSnmpValue::ObjectIdentifier(_) => {
                                    return Err("SET of ObjectIdentifier is unsupported".to_string())
                                },
                                OwnedSnmpValue::Null => Value::Null,
                                OwnedSnmpValue::IpAddress(ip) => Value::IpAddress(*ip),
                                OwnedSnmpValue::Counter32(c) => Value::Counter32(*c),
                                OwnedSnmpValue::Unsigned32(c) => Value::Unsigned32(*c),
                                OwnedSnmpValue::Timeticks(c) => Value::Timeticks(*c),
                            };

                            match session.set(&[(&target_oid, snmp_val)]) {
                                Ok(mut response) => {
                                    if let Some((resp_oid, val)) = response.varbinds.next() {
                                        let oid_vec = oid_to_vec(&resp_oid);
                                        Ok(SnmpResult { success: true, oid: format_oid(&oid_vec), value: format_snmp_value(&val), error: None })
                                    } else {
                                        Err("No varbinds".to_string())
                                    }
                                }
                                Err(e) => Err(format!("{:?}", e)),
                            }
                        } else {
                            Err("Unknown operation".to_string())
                        }
                    })();

                    let result = match res {
                        Ok(r) => r,
                        Err(e) => SnmpResult { success: false, oid: task.oid, value: String::new(), error: Some(e) },
                    };
                    results.push(result);
                }
                
                let _ = tx.send(results);
            })
            .expect("Failed to spawn sequential batch thread");
            
        rx.await.unwrap_or_else(|_| vec![])
    }
}