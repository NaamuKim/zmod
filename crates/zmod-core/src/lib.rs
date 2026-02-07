use serde::{Deserialize, Serialize};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

/// Represents the result of a transformation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformResult {
    pub success: bool,
    pub modified: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// A collection of AST nodes
pub struct Collection<T> {
    nodes: Vec<T>,
    source: String,
}

impl<T> Collection<T> {
    pub fn new(nodes: Vec<T>, source: String) -> Self {
        Self { nodes, source }
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }
}
