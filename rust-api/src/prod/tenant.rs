use std::collections::HashMap;

#[derive(Clone)]
pub struct Tenant {
    pub id: String,
    pub credits: i64,
}

pub struct TenantManager {
    pub tenants: HashMap<String, Tenant>,
}

impl TenantManager {
    pub fn new() -> Self {
        Self {
            tenants: HashMap::new(),
        }
    }

    pub fn get(&mut self, id: &str) -> &mut Tenant {
        self.tenants.entry(id.to_string()).or_insert(Tenant {
            id: id.to_string(),
            credits: 1000,
        })
    }
}
