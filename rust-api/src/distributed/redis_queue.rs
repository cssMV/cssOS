use async_trait::async_trait;
use redis::{AsyncCommands, Value};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, Duration};

use super::queue::DistributedQueue;

#[derive(Clone)]
pub struct RedisQueue {
    client: redis::Client,
    key: String,
    delayed_key: String,
}

impl RedisQueue {
    pub fn new(url: &str, key: &str) -> anyhow::Result<Self> {
        let client = redis::Client::open(url)?;
        Ok(Self {
            client,
            key: key.to_string(),
            delayed_key: format!("{key}:delayed"),
        })
    }

    fn lease_key(run_id: &str) -> String {
        format!("cssmv:lease:{run_id}")
    }

    fn now_millis() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0)
    }

    async fn promote_due(&self, conn: &mut redis::aio::Connection, limit: usize) {
        let script = r#"
            local delayed = KEYS[1]
            local ready = KEYS[2]
            local now = tonumber(ARGV[1])
            local n = tonumber(ARGV[2])
            local ids = redis.call('ZRANGEBYSCORE', delayed, '-inf', now, 'LIMIT', 0, n)
            for _, id in ipairs(ids) do
                redis.call('RPUSH', ready, id)
                redis.call('ZREM', delayed, id)
            end
            return #ids
        "#;
        let _: redis::RedisResult<i32> = redis::cmd("EVAL")
            .arg(script)
            .arg(2)
            .arg(&self.delayed_key)
            .arg(&self.key)
            .arg(Self::now_millis())
            .arg(limit)
            .query_async(conn)
            .await;
    }
}

#[async_trait]
impl DistributedQueue for RedisQueue {
    async fn push(&self, run_id: String) {
        let Ok(mut conn) = self.client.get_async_connection().await else {
            return;
        };
        let _: redis::RedisResult<()> = conn.rpush(&self.key, run_id).await;
    }

    async fn pop(&self) -> Option<String> {
        loop {
            let Ok(mut conn) = self.client.get_async_connection().await else {
                sleep(Duration::from_millis(200)).await;
                continue;
            };
            self.promote_due(&mut conn, 128).await;

            let out: redis::RedisResult<Option<(String, String)>> = redis::cmd("BLPOP")
                .arg(&self.key)
                .arg(1)
                .query_async(&mut conn)
                .await;
            match out {
                Ok(Some((_, run_id))) => return Some(run_id),
                Ok(None) => {}
                Err(_) => sleep(Duration::from_millis(200)).await,
            }
        }
    }

    async fn defer(&self, run_id: String, delay_ms: u64) {
        let Ok(mut conn) = self.client.get_async_connection().await else {
            return;
        };
        let score = Self::now_millis().saturating_add(delay_ms as i64);
        let _: redis::RedisResult<()> = conn.zadd(&self.delayed_key, run_id, score).await;
    }

    fn uses_blocking_pop(&self) -> bool {
        true
    }

    async fn try_acquire_lease(&self, run_id: &str, worker_id: &str, ttl_seconds: u64) -> bool {
        let Ok(mut conn) = self.client.get_async_connection().await else {
            return false;
        };
        let key = Self::lease_key(run_id);
        let res: redis::RedisResult<Value> = redis::cmd("SET")
            .arg(key)
            .arg(worker_id)
            .arg("NX")
            .arg("EX")
            .arg(ttl_seconds as usize)
            .query_async(&mut conn)
            .await;
        matches!(res, Ok(Value::Okay))
    }

    async fn renew_lease(&self, run_id: &str, worker_id: &str, ttl_seconds: u64) -> bool {
        let Ok(mut conn) = self.client.get_async_connection().await else {
            return false;
        };
        let key = Self::lease_key(run_id);
        let script = r#"
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('EXPIRE', KEYS[1], ARGV[2])
            else
                return 0
            end
        "#;
        let res: redis::RedisResult<i32> = redis::cmd("EVAL")
            .arg(script)
            .arg(1)
            .arg(key)
            .arg(worker_id)
            .arg(ttl_seconds as usize)
            .query_async(&mut conn)
            .await;
        matches!(res, Ok(v) if v > 0)
    }

    async fn release_lease(&self, run_id: &str, worker_id: &str) {
        let Ok(mut conn) = self.client.get_async_connection().await else {
            return;
        };
        let key = Self::lease_key(run_id);
        let script = r#"
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        "#;
        let _: redis::RedisResult<i32> = redis::cmd("EVAL")
            .arg(script)
            .arg(1)
            .arg(key)
            .arg(worker_id)
            .query_async(&mut conn)
            .await;
    }
}
