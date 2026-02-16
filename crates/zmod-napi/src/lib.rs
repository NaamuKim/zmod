use napi::bindgen_prelude::*;
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::{IdentifierName, IdentifierReference};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::SourceType;
use std::collections::HashMap;

#[napi(object)]
pub struct TransformOptions {
    pub renames: HashMap<String, String>,
}

#[napi(object)]
pub struct TransformResult {
    pub success: bool,
    pub modified: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

struct RenameCollector<'a> {
    renames: &'a HashMap<String, String>,
    patches: Vec<(u32, u32, String)>,
}

impl<'a> Visit<'_> for RenameCollector<'a> {
    fn visit_identifier_reference(&mut self, ident: &IdentifierReference<'_>) {
        if let Some(to) = self.renames.get(ident.name.as_str()) {
            self.patches
                .push((ident.span.start, ident.span.end, to.clone()));
        }
        walk::walk_identifier_reference(self, ident);
    }

    fn visit_identifier_name(&mut self, ident: &IdentifierName<'_>) {
        if let Some(to) = self.renames.get(ident.name.as_str()) {
            self.patches
                .push((ident.span.start, ident.span.end, to.clone()));
        }
        walk::walk_identifier_name(self, ident);
    }
}

#[napi]
pub fn transform_code(code: String, options: TransformOptions) -> Result<TransformResult> {
    let allocator = Allocator::default();
    let source_type = SourceType::tsx();
    let parsed = Parser::new(&allocator, &code, source_type).parse();

    if !parsed.errors.is_empty() {
        let error_msg = parsed
            .errors
            .iter()
            .map(|e| format!("{}", e))
            .collect::<Vec<_>>()
            .join("; ");
        return Ok(TransformResult {
            success: false,
            modified: false,
            output: None,
            error: Some(format!("Parse error: {}", error_msg)),
        });
    }

    let mut collector = RenameCollector {
        renames: &options.renames,
        patches: Vec::new(),
    };
    collector.visit_program(&parsed.program);

    if collector.patches.is_empty() {
        return Ok(TransformResult {
            success: true,
            modified: false,
            output: None,
            error: None,
        });
    }

    // Apply patches in reverse order to preserve positions
    collector.patches.sort_by(|a, b| b.0.cmp(&a.0));
    let mut result = code;
    for (start, end, replacement) in &collector.patches {
        result.replace_range(*start as usize..*end as usize, replacement);
    }

    Ok(TransformResult {
        success: true,
        modified: true,
        output: Some(result),
        error: None,
    })
}
