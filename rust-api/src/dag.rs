use crate::run_state::RunState;
use std::collections::{BTreeMap, BTreeSet, VecDeque};

#[derive(Debug, Clone)]
pub struct DagNode {
    pub name: &'static str,
    pub deps: &'static [&'static str],
}

#[derive(Debug, Clone)]
pub struct Dag {
    pub nodes: Vec<DagNode>,
}

#[derive(thiserror::Error, Debug)]
pub enum DagError {
    #[error("unknown dependency: {0}")]
    UnknownDependency(String),
    #[error("cycle detected in dag")]
    CycleDetected,
}

impl Dag {
    pub fn topo_order(&self) -> Result<Vec<&'static str>, DagError> {
        let mut node_set = BTreeSet::<&'static str>::new();
        for n in &self.nodes {
            node_set.insert(n.name);
        }

        let mut indeg = BTreeMap::<&'static str, usize>::new();
        let mut adj = BTreeMap::<&'static str, Vec<&'static str>>::new();

        for n in &self.nodes {
            indeg.insert(n.name, 0);
            adj.entry(n.name).or_default();
        }

        for n in &self.nodes {
            for &d in n.deps {
                if !node_set.contains(d) {
                    return Err(DagError::UnknownDependency(format!(
                        "{} depends on unknown {}",
                        n.name, d
                    )));
                }
                *indeg.get_mut(n.name).unwrap() += 1;
                adj.get_mut(d).unwrap().push(n.name);
            }
        }

        let mut q = VecDeque::<&'static str>::new();
        for (&k, &v) in &indeg {
            if v == 0 {
                q.push_back(k);
            }
        }

        let mut out = Vec::new();
        while let Some(u) = q.pop_front() {
            out.push(u);
            if let Some(next) = adj.get(u) {
                for &v in next {
                    let e = indeg.get_mut(v).unwrap();
                    *e -= 1;
                    if *e == 0 {
                        q.push_back(v);
                    }
                }
            }
        }

        if out.len() != self.nodes.len() {
            return Err(DagError::CycleDetected);
        }
        Ok(out)
    }
}

pub fn cssmv_dag_v1() -> Dag {
    Dag {
        nodes: vec![
            DagNode {
                name: "lyrics",
                deps: &[],
            },
            DagNode {
                name: "music",
                deps: &["lyrics"],
            },
            DagNode {
                name: "vocals",
                deps: &["lyrics", "music"],
            },
            DagNode {
                name: "video_plan",
                deps: &["lyrics", "vocals"],
            },
            DagNode {
                name: "video_assemble",
                deps: &["video_plan"],
            },
            DagNode {
                name: "render",
                deps: &["lyrics", "music", "vocals", "video_assemble"],
            },
        ],
    }
}

pub fn topo_order_v1(state: &RunState) -> Vec<String> {
    let mut shots: Vec<String> = state
        .stages
        .keys()
        .filter(|k| k.starts_with("video_shot_"))
        .cloned()
        .collect();
    shots.sort();

    let mut out = vec![
        "lyrics".to_string(),
        "music".to_string(),
        "vocals".to_string(),
        "video_plan".to_string(),
    ];
    out.extend(shots);
    out.push("video_assemble".to_string());
    out.push("render".to_string());
    out
}
