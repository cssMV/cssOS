(() => {
  const bindBridge = (name, coreKey) => {
    globalThis[name] ??= (...args) => {
      const current = globalThis[name];
      if (typeof current?.__moduleImpl === "function") {
        return current.__moduleImpl(...args);
      }
      return globalThis.__actionPermissionCore?.[coreKey]?.(...args);
    };
  };

  bindBridge("buildPermissionCellForTier", "buildPermissionCellForTier");
  bindBridge("deliveryPermissionScopeFromAttr", "deliveryPermissionScopeFromAttr");
  bindBridge("deliveryPermissionPanelFromAttr", "deliveryPermissionPanelFromAttr");
  bindBridge("deliveryPermissionActionLabel", "deliveryPermissionActionLabel");
  bindBridge("permissionBooleanLabel", "permissionBooleanLabel");
  bindBridge("isBasicPlusTier", "isBasicPlusTier");
  bindBridge("isProPlusTier", "isProPlusTier");
  bindBridge("isEnterprisePlusTier", "isEnterprisePlusTier");
  bindBridge("deliveryScopeAllowedForTier", "deliveryScopeAllowedForTier");
  bindBridge("deliveryScopeDescribeForTier", "deliveryScopeDescribeForTier");
  bindBridge("buildActionPermissionRegistry", "buildActionPermissionRegistry");
  bindBridge("getActionPermissionRule", "getActionPermissionRule");
  bindBridge("describeActionPermission", "describeActionPermission");
  bindBridge("permissionRequirementLabel", "permissionRequirementLabel");
  bindBridge("buildActionPermissionMatrixRows", "buildActionPermissionMatrixRows");
  bindBridge("filterActionPermissionMatrixRows", "filterActionPermissionMatrixRows");
})();
