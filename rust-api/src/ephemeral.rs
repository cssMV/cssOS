use dashmap::DashMap;
use once_cell::sync::Lazy;
use serde_json::Value;
use std::time::{Duration, Instant};

static STORE: Lazy<DashMap<String, (Instant, Value)>> = Lazy::new(DashMap::new);

fn purge(now: Instant, max_scan: usize) {
    let mut n = 0usize;
    for it in STORE.iter() {
        if n >= max_scan {
            break;
        }
        n += 1;
        if it.value().0 <= now {
            let k = it.key().clone();
            STORE.remove(&k);
        }
    }
}

pub fn set_json(key: impl Into<String>, ttl: Duration, v: Value) {
    let now = Instant::now();
    purge(now, 64);
    let exp = now + ttl;
    STORE.insert(key.into(), (exp, v));
}

pub fn get_json(key: &str) -> Option<Value> {
    let now = Instant::now();
    purge(now, 64);
    match STORE.get(key) {
        Some(v) => {
            if v.value().0 <= now {
                let k = v.key().clone();
                drop(v);
                STORE.remove(&k);
                None
            } else {
                Some(v.value().1.clone())
            }
        }
        None => None,
    }
}

pub fn del(key: &str) {
    STORE.remove(key);
}
