function renderDeliveryReportsPanelModule() {
  renderDeliveryReportTabs();
  renderReportHeader(deliveryReportState.response);
  renderDeliveryReportBody(deliveryReportState.response);
  renderMusicDeliveryDashboard();
  renderDeliveryExportPanel();
}
