use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};

use crate::dag_v3::stage::{StageDef, StageName};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DagTopoError {
    CycleDetected,
}

pub fn topo_sort(stages: &[StageDef]) -> Result<Vec<StageName>, DagTopoError> {
    let mut indeg = BTreeMap::<String, usize>::new();
    let mut outs = BTreeMap::<String, Vec<String>>::new();

    for st in stages {
        indeg.entry(st.name.0.clone()).or_insert(0);
    }
    for st in stages {
        for dep in &st.deps {
            *indeg.entry(st.name.0.clone()).or_insert(0) += 1;
            outs.entry(dep.0.clone())
                .or_default()
                .push(st.name.0.clone());
        }
    }

    let mut q = VecDeque::<String>::new();
    for (k, v) in &indeg {
        if *v == 0 {
            q.push_back(k.clone());
        }
    }

    let mut order = Vec::<StageName>::new();
    while let Some(n) = q.pop_front() {
        order.push(StageName(n.clone()));
        if let Some(children) = outs.get(&n) {
            for ch in children {
                if let Some(d) = indeg.get_mut(ch) {
                    *d -= 1;
                    if *d == 0 {
                        q.push_back(ch.clone());
                    }
                }
            }
        }
    }

    if order.len() != stages.len() {
        return Err(DagTopoError::CycleDetected);
    }
    Ok(order)
}
