use once_cell::sync::Lazy;
use prometheus::{
    Encoder, HistogramOpts, HistogramVec, IntCounter, IntGauge, IntGaugeVec, Registry,
    TextEncoder,
};

pub static REGISTRY: Lazy<Registry> = Lazy::new(Registry::new);

pub static RUNS_CREATED_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::new("css_runs_created_total", "total runs created").unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

pub static RUNS_RUNNING: Lazy<IntGauge> = Lazy::new(|| {
    let g = IntGauge::new("css_runs_running", "running runs").unwrap();
    REGISTRY.register(Box::new(g.clone())).unwrap();
    g
});

pub static RUNS_QUEUE: Lazy<IntGauge> = Lazy::new(|| {
    let g = IntGauge::new("css_runs_queue", "queued runs").unwrap();
    REGISTRY.register(Box::new(g.clone())).unwrap();
    g
});

pub static RUNS_GLOBAL_SLOTS_USED: Lazy<IntGauge> = Lazy::new(|| {
    let g = IntGauge::new(
        "css_runs_global_slots_used",
        "global run concurrency slots currently used",
    )
    .unwrap();
    REGISTRY.register(Box::new(g.clone())).unwrap();
    g
});

pub static RUNS_GLOBAL_SLOTS_TOTAL: Lazy<IntGauge> = Lazy::new(|| {
    let g = IntGauge::new(
        "css_runs_global_slots_total",
        "global run concurrency slots configured",
    )
    .unwrap();
    REGISTRY.register(Box::new(g.clone())).unwrap();
    g
});

pub static RUNS_QUEUE_WAIT_SECONDS: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = HistogramOpts::new(
        "css_runs_queue_wait_seconds",
        "run wait time in queue before worker starts",
    )
    .buckets(vec![0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 40.0, 80.0, 120.0]);
    let h = HistogramVec::new(opts, &["tier"]).unwrap();
    REGISTRY.register(Box::new(h.clone())).unwrap();
    h
});

pub static STAGE_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    let opts = HistogramOpts::new("css_stage_duration_seconds", "stage duration seconds");
    let h = HistogramVec::new(opts, &["stage"]).unwrap();
    REGISTRY.register(Box::new(h.clone())).unwrap();
    h
});

pub static STAGE_RUNNING: Lazy<IntGaugeVec> = Lazy::new(|| {
    let g = IntGaugeVec::new(
        prometheus::Opts::new("css_stage_running", "running stages"),
        &["stage"],
    )
    .unwrap();
    REGISTRY.register(Box::new(g.clone())).unwrap();
    g
});

pub fn set_global_slots_total(v: usize) {
    RUNS_GLOBAL_SLOTS_TOTAL.set(v as i64);
}

pub fn incr_runs_created() {
    RUNS_CREATED_TOTAL.inc();
}

pub fn gather() -> String {
    let encoder = TextEncoder::new();
    let mf = REGISTRY.gather();
    let mut buf = Vec::new();
    if encoder.encode(&mf, &mut buf).is_err() {
        return String::new();
    }
    String::from_utf8(buf).unwrap_or_default()
}
