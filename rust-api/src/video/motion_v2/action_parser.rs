#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionType {
    Riding,
    Walking,
    Building,
    Sitting,
    Running,
    Unknown,
}

pub fn detect_action(script: &str) -> ActionType {
    let s = script.to_lowercase();

    if s.contains("骑马") || s.contains("riding") || s.contains("horseback") {
        ActionType::Riding
    } else if s.contains("走") || s.contains("walking") || s.contains("walk") {
        ActionType::Walking
    } else if s.contains("组装") || s.contains("assembling") || s.contains("constructing") {
        ActionType::Building
    } else if s.contains("坐") || s.contains("sitting") || s.contains("seated") {
        ActionType::Sitting
    } else if s.contains("跑") || s.contains("running") || s.contains("sprint") {
        ActionType::Running
    } else {
        ActionType::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::{detect_action, ActionType};

    #[test]
    fn detects_riding_action() {
        assert_eq!(detect_action("骑士在夕阳战场骑马前进"), ActionType::Riding);
    }

    #[test]
    fn detects_building_action() {
        assert_eq!(
            detect_action("机械臂正在组装一名男性仿生人"),
            ActionType::Building
        );
    }
}
