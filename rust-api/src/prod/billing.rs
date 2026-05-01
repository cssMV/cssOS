pub fn cost_per_job(steps: usize, resolution: usize) -> i64 {
    (steps as i64 * resolution as i64) / 10
}

pub fn charge(tenant: &mut crate::prod::tenant::Tenant, cost: i64) -> bool {
    if tenant.credits < cost {
        return false;
    }

    tenant.credits -= cost;
    true
}
