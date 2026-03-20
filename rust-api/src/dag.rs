use crate::run_state::RunState;
use crate::schema_keys::{video_shot_stage_key, VIDEO_ASSEMBLE_STAGE, VIDEO_PLAN_STAGE};
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
                name: VIDEO_PLAN_STAGE,
                deps: &["lyrics", "vocals"],
            },
            DagNode {
                name: VIDEO_ASSEMBLE_STAGE,
                deps: &[VIDEO_PLAN_STAGE],
            },
            DagNode {
                name: "subtitles",
                deps: &["lyrics"],
            },
            DagNode {
                name: "mix",
                deps: &["music", "vocals"],
            },
            DagNode {
                name: "render",
                deps: &[VIDEO_ASSEMBLE_STAGE, "mix", "subtitles"],
            },
        ],
    }
}

pub fn cssmv_dag_v3() -> Dag {
    Dag {
        nodes: vec![
            DagNode {
                name: "input_normalize",
                deps: &[],
            },
            DagNode {
                name: "prompt_build",
                deps: &["input_normalize"],
            },
            DagNode {
                name: "lyrics",
                deps: &["prompt_build"],
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
                name: "mix",
                deps: &["music", "vocals"],
            },
            DagNode {
                name: VIDEO_PLAN_STAGE,
                deps: &["lyrics", "vocals"],
            },
            DagNode {
                name: VIDEO_ASSEMBLE_STAGE,
                deps: &[VIDEO_PLAN_STAGE],
            },
            DagNode {
                name: "subtitles",
                deps: &["lyrics", "mix"],
            },
            DagNode {
                name: "localize",
                deps: &["lyrics"],
            },
            DagNode {
                name: "voice_style",
                deps: &["vocals"],
            },
            DagNode {
                name: "render_master",
                deps: &[VIDEO_ASSEMBLE_STAGE, "mix", "subtitles"],
            },
            DagNode {
                name: "render_lang_pack",
                deps: &["render_master", "localize"],
            },
            DagNode {
                name: "publish",
                deps: &["render_lang_pack"],
            },
        ],
    }
}

pub fn cssmv_dag_active() -> Dag {
    match std::env::var("CSS_DAG_VERSION").ok().as_deref() {
        Some("v3") => cssmv_dag_v3(),
        _ => cssmv_dag_v1(),
    }
}

pub fn topo_order_for_state(state: &RunState) -> Vec<String> {
    let mut shot_indices: Vec<usize> = state
        .stages
        .keys()
        .filter_map(|k| {
            k.strip_prefix(crate::schema_keys::VIDEO_SHOT_PREFIX)
                .and_then(|s| s.parse::<usize>().ok())
        })
        .collect();
    shot_indices.sort();
    let shots: Vec<String> = shot_indices.into_iter().map(video_shot_stage_key).collect();

    let preferred = [
        "input_normalize",
        "prompt_build",
        "lyrics",
        "music",
        "vocals",
        "mix",
        VIDEO_PLAN_STAGE,
        "subtitles",
        "localize",
        "voice_style",
    ];
    let mut out: Vec<String> = preferred
        .iter()
        .filter(|name| state.stages.contains_key(**name))
        .map(|s| (*s).to_string())
        .collect();
    out.extend(shots);
    for name in [
        VIDEO_ASSEMBLE_STAGE,
        "render",
        "render_master",
        "render_lang_pack",
        "publish",
    ] {
        if state.stages.contains_key(name) {
            out.push(name.to_string());
        }
    }
    for name in state.stages.keys() {
        if !out.iter().any(|x| x == name) {
            out.push(name.clone());
        }
    }
    out
}
