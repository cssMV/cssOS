function syncDeliveryDashboardActionPermissions() {
  return globalThis.syncDeliveryDashboardActionPermissionsModule?.();
}

function renderDeliveryReportBody(response) {
  return globalThis.renderDeliveryReportBodyModule?.(response) ?? "";
}

function deliverySubscriptionStatusLabel(status) {
  return globalThis.deliverySubscriptionStatusLabelModule?.(status) ?? "";
}

function deliverySubscriptionFrequencyLabel(frequency) {
  return globalThis.deliverySubscriptionFrequencyLabelModule?.(frequency) ?? "";
}

function deliveryExecutionStateLabel(status) {
  return globalThis.deliveryExecutionStateLabelModule?.(status) ?? "";
}

function deliveryExecutionBadgeClass(status) {
  return globalThis.deliveryExecutionBadgeClassModule?.(status) ?? "";
}

function deliveryRecoveryPriorityLabel(priority) {
  return globalThis.deliveryRecoveryPriorityLabelModule?.(priority) ?? "";
}

function deliveryRecoveryBadgeClass(priority) {
  return globalThis.deliveryRecoveryBadgeClassModule?.(priority) ?? "";
}

function recoveryRetryAction(item) {
  return globalThis.recoveryRetryActionModule?.(item) ?? null;
}

function renderDeliveryRecoveryItem(item) {
  return globalThis.renderDeliveryRecoveryItemModule?.(item) ?? "";
}

function bindDeliveryRecoveryRetryButtons(container) {
  globalThis.bindDeliveryRecoveryRetryButtonsModule?.(container);
}

function renderDeliveryRecoveryPanel() {
  globalThis.renderDeliveryRecoveryPanelModule?.();
}

function renderDeliveryOpsConsolePanel() {
  globalThis.renderDeliveryOpsConsolePanelModule?.();
}

function renderDeliveryExecutionStatusPanel() {
  globalThis.renderDeliveryExecutionStatusPanelModule?.();
}

function renderDeliveryRetryResultPanel() {
  globalThis.renderDeliveryRetryResultPanelModule?.();
}

Object.assign(globalThis, {
  syncDeliveryDashboardActionPermissions,
  renderDeliveryReportBody,
  deliverySubscriptionStatusLabel,
  deliverySubscriptionFrequencyLabel,
  deliveryExecutionStateLabel,
  deliveryExecutionBadgeClass,
  deliveryRecoveryPriorityLabel,
  deliveryRecoveryBadgeClass,
  recoveryRetryAction,
  renderDeliveryRecoveryItem,
  bindDeliveryRecoveryRetryButtons,
  renderDeliveryRecoveryPanel,
  renderDeliveryOpsConsolePanel,
  renderDeliveryExecutionStatusPanel,
  renderDeliveryRetryResultPanel
});
