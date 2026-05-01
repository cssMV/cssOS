function flattenHierarchyWorks(items) {
  return globalThis.flattenHierarchyWorksModule ? globalThis.flattenHierarchyWorksModule(items) : [];
}

function sortHierarchyNodes(nodes) {
  return globalThis.sortHierarchyNodesModule ? globalThis.sortHierarchyNodesModule(nodes) : [...(Array.isArray(nodes) ? nodes : [])];
}

function buildWorkHierarchy(items) {
  return globalThis.buildWorkHierarchyModule ? globalThis.buildWorkHierarchyModule(items) : [];
}

function filterDisplayWorkRoots(nodes) {
  return globalThis.filterDisplayWorkRootsModule ? globalThis.filterDisplayWorkRootsModule(nodes) : [];
}

function renderHierarchyTree(nodes, context = "market") {
  return globalThis.renderHierarchyTreeModule ? globalThis.renderHierarchyTreeModule(nodes, context) : "";
}
