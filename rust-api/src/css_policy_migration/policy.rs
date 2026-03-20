use crate::css_policy_migration::types::MigrationDecision;

pub fn catalog_migration_allowed() -> MigrationDecision {
    MigrationDecision {
        allowed: true,
        code: "catalog_migration_allowed".into(),
        message: "catalog 允许执行 policy 版本迁移。".into(),
    }
}

pub fn auction_migration_allowed(finalized: bool) -> MigrationDecision {
    if !finalized {
        return MigrationDecision {
            allowed: false,
            code: "auction_in_progress_migration_blocked".into(),
            message: "进行中的拍卖不允许中途迁移 policy 版本。".into(),
        };
    }

    MigrationDecision {
        allowed: true,
        code: "auction_migration_allowed".into(),
        message: "已完成拍卖允许进行 policy 版本迁移。".into(),
    }
}

pub fn deal_migration_allowed(status: &str) -> MigrationDecision {
    if status != "pendingselection" && status != "pending_selection" {
        return MigrationDecision {
            allowed: false,
            code: "deal_migration_blocked_by_status".into(),
            message: "当前 deal 状态不允许迁移 policy 版本。".into(),
        };
    }

    MigrationDecision {
        allowed: true,
        code: "deal_migration_allowed".into(),
        message: "当前 deal 状态允许迁移 policy 版本。".into(),
    }
}

pub fn ownership_migration_allowed() -> MigrationDecision {
    MigrationDecision {
        allowed: true,
        code: "ownership_migration_allowed".into(),
        message: "ownership 允许执行 policy 版本迁移。".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v173_in_progress_auction_is_blocked() {
        let out = auction_migration_allowed(false);
        assert!(!out.allowed);
        assert_eq!(out.code, "auction_in_progress_migration_blocked");
    }

    #[test]
    fn v173_pending_selection_deal_is_allowed() {
        let out = deal_migration_allowed("pendingselection");
        assert!(out.allowed);
    }
}
