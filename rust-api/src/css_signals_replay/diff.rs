use std::collections::{HashMap, HashSet};

fn severity_rank(s: &crate::css_signals_hub::types::SignalSeverity) -> i32 {
    match s {
        crate::css_signals_hub::types::SignalSeverity::Info => 0,
        crate::css_signals_hub::types::SignalSeverity::Low => 1,
        crate::css_signals_hub::types::SignalSeverity::Medium => 2,
        crate::css_signals_hub::types::SignalSeverity::High => 3,
        crate::css_signals_hub::types::SignalSeverity::Critical => 4,
    }
}

fn to_map(
    signals: &[crate::css_signals_hub::types::CssSignal],
) -> HashMap<crate::css_signals_hub::types::SignalKind, crate::css_signals_hub::types::CssSignal> {
    let mut m = HashMap::new();
    for s in signals {
        m.insert(s.signal_kind.clone(), s.clone());
    }
    m
}

pub fn diff_signals(
    prev: &[crate::css_signals_hub::types::CssSignal],
    curr: &[crate::css_signals_hub::types::CssSignal],
) -> Vec<crate::css_signals_replay::types::SignalReplayDelta> {
    let prev_map = to_map(prev);
    let curr_map = to_map(curr);

    let mut seen = HashSet::new();
    let mut keys = Vec::new();

    for key in prev_map.keys() {
        if seen.insert(key.clone()) {
            keys.push(key.clone());
        }
    }
    for key in curr_map.keys() {
        if seen.insert(key.clone()) {
            keys.push(key.clone());
        }
    }

    keys.sort_by_key(|k| format!("{:?}", k));

    let mut out = Vec::new();

    for key in keys {
        match (prev_map.get(&key), curr_map.get(&key)) {
            (None, Some(c)) => {
                out.push(crate::css_signals_replay::types::SignalReplayDelta {
                    signal_kind: key,
                    change_kind: crate::css_signals_replay::types::ReplayChangeKind::Added,
                    from_severity: None,
                    to_severity: Some(c.severity.clone()),
                    description: format!("新增信号：{}", c.title),
                });
            }
            (Some(p), None) => {
                out.push(crate::css_signals_replay::types::SignalReplayDelta {
                    signal_kind: key,
                    change_kind: crate::css_signals_replay::types::ReplayChangeKind::Removed,
                    from_severity: Some(p.severity.clone()),
                    to_severity: None,
                    description: format!("信号消失：{}", p.title),
                });
            }
            (Some(p), Some(c)) => {
                let pr = severity_rank(&p.severity);
                let cr = severity_rank(&c.severity);

                let (change_kind, description) = if cr > pr {
                    (
                        crate::css_signals_replay::types::ReplayChangeKind::SeverityIncreased,
                        format!(
                            "信号升级：{}（{:?} -> {:?}）",
                            c.title, p.severity, c.severity
                        ),
                    )
                } else if cr < pr {
                    (
                        crate::css_signals_replay::types::ReplayChangeKind::SeverityDecreased,
                        format!(
                            "信号下降：{}（{:?} -> {:?}）",
                            c.title, p.severity, c.severity
                        ),
                    )
                } else {
                    (
                        crate::css_signals_replay::types::ReplayChangeKind::Unchanged,
                        format!("信号保持不变：{}", c.title),
                    )
                };

                out.push(crate::css_signals_replay::types::SignalReplayDelta {
                    signal_kind: key,
                    change_kind,
                    from_severity: Some(p.severity.clone()),
                    to_severity: Some(c.severity.clone()),
                    description,
                });
            }
            (None, None) => {}
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::diff_signals;

    fn signal(
        kind: crate::css_signals_hub::types::SignalKind,
        severity: crate::css_signals_hub::types::SignalSeverity,
        title: &str,
    ) -> crate::css_signals_hub::types::CssSignal {
        crate::css_signals_hub::types::CssSignal {
            signal_kind: kind,
            severity,
            title: title.to_string(),
            description: title.to_string(),
            source_system: None,
            source_id: None,
        }
    }

    #[test]
    fn v185_diff_marks_added_and_removed_signals() {
        let prev = vec![signal(
            crate::css_signals_hub::types::SignalKind::CreditLow,
            crate::css_signals_hub::types::SignalSeverity::Medium,
            "信用分偏低",
        )];
        let curr = vec![signal(
            crate::css_signals_hub::types::SignalKind::ActivePenalty,
            crate::css_signals_hub::types::SignalSeverity::High,
            "存在活跃处罚",
        )];

        let deltas = diff_signals(&prev, &curr);
        assert!(deltas.iter().any(|d| {
            d.signal_kind == crate::css_signals_hub::types::SignalKind::CreditLow
                && d.change_kind == crate::css_signals_replay::types::ReplayChangeKind::Removed
        }));
        assert!(deltas.iter().any(|d| {
            d.signal_kind == crate::css_signals_hub::types::SignalKind::ActivePenalty
                && d.change_kind == crate::css_signals_replay::types::ReplayChangeKind::Added
        }));
    }

    #[test]
    fn v185_diff_marks_severity_changes() {
        let prev = vec![signal(
            crate::css_signals_hub::types::SignalKind::CreditLow,
            crate::css_signals_hub::types::SignalSeverity::Medium,
            "信用分偏低",
        )];
        let curr = vec![signal(
            crate::css_signals_hub::types::SignalKind::CreditLow,
            crate::css_signals_hub::types::SignalSeverity::High,
            "信用分偏低",
        )];

        let deltas = diff_signals(&prev, &curr);
        assert!(deltas.iter().any(|d| {
            d.signal_kind == crate::css_signals_hub::types::SignalKind::CreditLow
                && d.change_kind
                    == crate::css_signals_replay::types::ReplayChangeKind::SeverityIncreased
        }));
    }
}
