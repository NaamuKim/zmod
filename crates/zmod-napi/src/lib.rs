use napi::bindgen_prelude::*;
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingIdentifier, IdentifierName, IdentifierReference, ImportDeclaration,
    ImportDeclarationSpecifier, JSXMemberExpression, JSXMemberExpressionObject,
    ModuleExportName, StaticMemberExpression,
};
use oxc_ast_visit::{walk, Visit};
use oxc_parser::Parser;
use oxc_span::SourceType;
use std::collections::HashMap;

#[napi(object)]
pub struct ImportTransforms {
    pub replace_source: Option<HashMap<String, String>>,
    pub rename_specifier: Option<HashMap<String, String>>,
    pub remove_specifier: Option<Vec<String>>,
    pub add_import: Option<Vec<AddImport>>,
}

#[napi(object)]
pub struct AddImport {
    pub from: String,
    pub names: Option<Vec<String>>,
    pub default_name: Option<String>,
}

#[napi(object)]
pub struct ReplaceTextRule {
    pub match_text: String,
    pub replace: String,
    pub context: Option<String>,
}

#[napi(object)]
pub struct TransformOptions {
    pub renames: Option<HashMap<String, String>>,
    pub imports: Option<ImportTransforms>,
    pub remove_jsx_member_suffix: Option<Vec<String>>,
    pub replace_text: Option<Vec<ReplaceTextRule>>,
}

#[napi(object)]
pub struct TransformResult {
    pub success: bool,
    pub modified: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// A patch: (start, end, replacement).
/// When replacement is empty and start..end covers a range, it's a deletion.
struct PatchCollector<'a> {
    renames: Option<&'a HashMap<String, String>>,
    imports: Option<&'a ImportTransforms>,
    remove_jsx_member_suffix: Option<&'a Vec<String>>,
    replace_text: Option<&'a Vec<ReplaceTextRule>>,
    patches: Vec<(u32, u32, String)>,
    /// Track import specifiers to remove (we handle removal at import_declaration level)
    source_code: &'a str,
}

impl<'a> PatchCollector<'a> {
    fn module_export_name_str<'b>(name: &'b ModuleExportName<'_>) -> &'b str {
        match name {
            ModuleExportName::IdentifierName(id) => id.name.as_str(),
            ModuleExportName::IdentifierReference(id) => id.name.as_str(),
            ModuleExportName::StringLiteral(s) => s.value.as_str(),
        }
    }
}

impl<'a> Visit<'_> for PatchCollector<'a> {
    fn visit_identifier_reference(&mut self, ident: &IdentifierReference<'_>) {
        if let Some(renames) = self.renames {
            if let Some(to) = renames.get(ident.name.as_str()) {
                self.patches
                    .push((ident.span.start, ident.span.end, to.clone()));
            }
        }
        walk::walk_identifier_reference(self, ident);
    }

    fn visit_identifier_name(&mut self, ident: &IdentifierName<'_>) {
        if let Some(renames) = self.renames {
            if let Some(to) = renames.get(ident.name.as_str()) {
                self.patches
                    .push((ident.span.start, ident.span.end, to.clone()));
            }
        }
        walk::walk_identifier_name(self, ident);
    }

    fn visit_binding_identifier(&mut self, ident: &BindingIdentifier<'_>) {
        if let Some(renames) = self.renames {
            if let Some(to) = renames.get(ident.name.as_str()) {
                self.patches
                    .push((ident.span.start, ident.span.end, to.clone()));
            }
        }
        walk::walk_binding_identifier(self, ident);
    }

    fn visit_import_declaration(&mut self, decl: &ImportDeclaration<'_>) {
        if let Some(imports) = self.imports {
            let source_value = decl.source.value.as_str();

            // replace_source: change the import source string
            if let Some(replace_source) = &imports.replace_source {
                if let Some(new_source) = replace_source.get(source_value) {
                    // Replace just the string content inside quotes (span includes quotes)
                    // StringLiteral span includes the quotes, so we replace start+1..end-1
                    self.patches.push((
                        decl.source.span.start + 1,
                        decl.source.span.end - 1,
                        new_source.clone(),
                    ));
                }
            }

            if let Some(specifiers) = &decl.specifiers {
                let rename_specifier = imports.rename_specifier.as_ref();
                let remove_specifier = imports.remove_specifier.as_ref();

                // Collect indices of specifiers to remove
                let mut remove_indices: Vec<usize> = Vec::new();

                for (i, spec) in specifiers.iter().enumerate() {
                    match spec {
                        ImportDeclarationSpecifier::ImportSpecifier(s) => {
                            let imported_name = Self::module_export_name_str(&s.imported);
                            let local_name = s.local.name.as_str();

                            // remove_specifier: check if this specifier should be removed
                            if let Some(remove_list) = remove_specifier {
                                if remove_list.iter().any(|r| r == imported_name || r == local_name)
                                {
                                    remove_indices.push(i);
                                    continue; // Don't also rename if we're removing
                                }
                            }

                            // rename_specifier: rename the local binding
                            if let Some(rename_map) = rename_specifier {
                                if let Some(new_name) = rename_map.get(local_name) {
                                    // If imported name equals local name (no alias), we need to
                                    // rewrite as `oldName as newName` or just change local
                                    if imported_name == local_name {
                                        // `import { foo } from 'x'` → `import { foo as bar } from 'x'`
                                        // But if rename maps foo→bar, we want `import { bar } from 'x'`
                                        // which means rename both imported and local.
                                        // Actually for codemod purposes: rename the specifier entirely.
                                        // Replace the entire specifier span.
                                        self.patches.push((
                                            s.span.start,
                                            s.span.end,
                                            new_name.clone(),
                                        ));
                                    } else {
                                        // `import { foo as bar }` → rename just local
                                        self.patches.push((
                                            s.local.span.start,
                                            s.local.span.end,
                                            new_name.clone(),
                                        ));
                                    }
                                }
                            }
                        }
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                            let local_name = s.local.name.as_str();
                            if let Some(remove_list) = remove_specifier {
                                if remove_list.iter().any(|r| r == local_name) {
                                    remove_indices.push(i);
                                    continue;
                                }
                            }
                            if let Some(rename_map) = rename_specifier {
                                if let Some(new_name) = rename_map.get(local_name) {
                                    self.patches.push((
                                        s.local.span.start,
                                        s.local.span.end,
                                        new_name.clone(),
                                    ));
                                }
                            }
                        }
                        ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                            let local_name = s.local.name.as_str();
                            if let Some(remove_list) = remove_specifier {
                                if remove_list.iter().any(|r| r == local_name) {
                                    remove_indices.push(i);
                                    continue;
                                }
                            }
                            if let Some(rename_map) = rename_specifier {
                                if let Some(new_name) = rename_map.get(local_name) {
                                    self.patches.push((
                                        s.local.span.start,
                                        s.local.span.end,
                                        new_name.clone(),
                                    ));
                                }
                            }
                        }
                    }
                }

                // Handle specifier removal
                if !remove_indices.is_empty() {
                    let total = specifiers.len();
                    if remove_indices.len() == total {
                        // Remove the entire import declaration
                        // Find the end including newline
                        let end = decl.span.end as usize;
                        let trailing = if end < self.source_code.len()
                            && self.source_code.as_bytes()[end] == b'\n'
                        {
                            1
                        } else {
                            0
                        };
                        self.patches.push((
                            decl.span.start,
                            decl.span.end + trailing as u32,
                            String::new(),
                        ));
                    } else {
                        // Remove individual specifiers with proper comma handling
                        for &idx in remove_indices.iter().rev() {
                            let spec = &specifiers[idx];
                            let spec_span = match spec {
                                ImportDeclarationSpecifier::ImportSpecifier(s) => s.span,
                                ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => s.span,
                                ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => s.span,
                            };

                            // Determine removal range including comma/whitespace
                            let mut start = spec_span.start as usize;
                            let mut end = spec_span.end as usize;

                            // Look for trailing comma and whitespace
                            let after = &self.source_code[end..];
                            let trimmed = after.trim_start();
                            if trimmed.starts_with(',') {
                                let comma_offset = after.len() - trimmed.len() + 1;
                                end += comma_offset;
                                // Also consume whitespace after comma
                                let after_comma = &self.source_code[end..];
                                let ws_len =
                                    after_comma.len() - after_comma.trim_start_matches(' ').len();
                                end += ws_len;
                            } else if start > 0 {
                                // No trailing comma — look for leading comma
                                let before = &self.source_code[..start];
                                let rtrimmed = before.trim_end();
                                if rtrimmed.ends_with(',') {
                                    let comma_pos = rtrimmed.len() - 1;
                                    start = comma_pos;
                                }
                            }

                            self.patches
                                .push((start as u32, end as u32, String::new()));
                        }
                    }
                }
            }
        }

        walk::walk_import_declaration(self, decl);
    }

    fn visit_jsx_member_expression(&mut self, expr: &JSXMemberExpression<'_>) {
        if let Some(suffixes) = self.remove_jsx_member_suffix {
            let property_name = expr.property.name.as_str();
            if suffixes.iter().any(|s| s == property_name) {
                // Replace the entire member expression span with just the object part
                // e.g., <Context.Provider> → <Context>
                let object_end = match &expr.object {
                    JSXMemberExpressionObject::IdentifierReference(id) => id.span.end,
                    JSXMemberExpressionObject::MemberExpression(me) => me.span.end,
                    JSXMemberExpressionObject::ThisExpression(te) => te.span.end,
                };
                // Remove from object_end (the dot) to the end of property
                self.patches.push((
                    object_end,
                    expr.span.end,
                    String::new(),
                ));
            }
        }
        walk::walk_jsx_member_expression(self, expr);
    }

    fn visit_static_member_expression(&mut self, expr: &StaticMemberExpression<'_>) {
        if let Some(rules) = self.replace_text {
            // Build the full text of this member expression from source
            let full_text =
                &self.source_code[expr.span.start as usize..expr.span.end as usize];
            for rule in rules {
                let ctx = rule.context.as_deref();
                // Only apply if no context or context matches
                if ctx.is_none() || ctx == Some("member-expression") {
                    if full_text == rule.match_text {
                        self.patches.push((
                            expr.span.start,
                            expr.span.end,
                            rule.replace.clone(),
                        ));
                        // Don't walk children — we replaced the whole thing
                        return;
                    }
                }
            }
        }
        walk::walk_static_member_expression(self, expr);
    }
}

/// Generate import statement text from AddImport config
fn build_import_statement(add: &AddImport) -> String {
    let mut parts: Vec<String> = Vec::new();

    if let Some(default_name) = &add.default_name {
        parts.push(default_name.clone());
    }

    if let Some(names) = &add.names {
        if !names.is_empty() {
            parts.push(format!("{{ {} }}", names.join(", ")));
        }
    }

    if parts.is_empty() {
        format!("import \"{}\";\n", add.from)
    } else {
        format!("import {} from \"{}\";\n", parts.join(", "), add.from)
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

    let mut patches: Vec<(u32, u32, String)>;

    {
        let mut collector = PatchCollector {
            renames: options.renames.as_ref(),
            imports: options.imports.as_ref(),
            remove_jsx_member_suffix: options.remove_jsx_member_suffix.as_ref(),
            replace_text: options.replace_text.as_ref(),
            patches: Vec::new(),
            source_code: &code,
        };
        collector.visit_program(&parsed.program);

        // Handle replaceText with "string-literal" or "import-source" context
        // These are simple text replacements on string literals, handled separately
        if let Some(rules) = &options.replace_text {
            for rule in rules {
                if let Some(ctx) = &rule.context {
                    if ctx == "string-literal" || ctx == "import-source" {
                        let mut search_from = 0;
                        while let Some(pos) = code[search_from..].find(&rule.match_text) {
                            let abs_pos = search_from + pos;
                            collector.patches.push((
                                abs_pos as u32,
                                (abs_pos + rule.match_text.len()) as u32,
                                rule.replace.clone(),
                            ));
                            search_from = abs_pos + rule.match_text.len();
                        }
                    }
                }
            }
        }

        patches = collector.patches;
    }

    // Build prefix for addImport
    let mut prefix = String::new();
    if let Some(imports) = &options.imports {
        if let Some(add_imports) = &imports.add_import {
            for add in add_imports {
                prefix.push_str(&build_import_statement(add));
            }
        }
    }

    let has_patches = !patches.is_empty();
    let has_prefix = !prefix.is_empty();

    if !has_patches && !has_prefix {
        return Ok(TransformResult {
            success: true,
            modified: false,
            output: None,
            error: None,
        });
    }

    // Apply patches in reverse order to preserve positions
    patches.sort_by(|a, b| b.0.cmp(&a.0));

    // Deduplicate patches (same start position — keep first, which is the last added)
    patches.dedup_by(|a, b| a.0 == b.0 && a.1 == b.1);

    let mut result = code;
    for (start, end, replacement) in &patches {
        result.replace_range(*start as usize..*end as usize, replacement);
    }

    // Prepend new imports
    if has_prefix {
        result = format!("{}{}", prefix, result);
    }

    Ok(TransformResult {
        success: true,
        modified: true,
        output: Some(result),
        error: None,
    })
}
