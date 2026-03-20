CREATE TABLE IF NOT EXISTS css_decision_graph_nodes (
    node_id TEXT PRIMARY KEY,
    node_kind TEXT NOT NULL,
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    label TEXT NOT NULL,
    subject_kind TEXT,
    subject_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_decision_graph_nodes_source
ON css_decision_graph_nodes(source_system, source_id);

CREATE INDEX IF NOT EXISTS idx_css_decision_graph_nodes_subject
ON css_decision_graph_nodes(subject_kind, subject_id);

CREATE TABLE IF NOT EXISTS css_decision_graph_edges (
    edge_id TEXT PRIMARY KEY,
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    edge_kind TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_decision_graph_edges_from
ON css_decision_graph_edges(from_node_id);

CREATE INDEX IF NOT EXISTS idx_css_decision_graph_edges_to
ON css_decision_graph_edges(to_node_id);

CREATE INDEX IF NOT EXISTS idx_css_decision_graph_edges_kind
ON css_decision_graph_edges(edge_kind);
