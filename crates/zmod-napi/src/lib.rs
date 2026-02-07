use napi::bindgen_prelude::*;
use napi_derive::napi;
use swc_core::common::{sync::Lrc, SourceMap, FileName};
use swc_core::ecma::ast::*;
use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter};
use swc_core::ecma::parser::{Parser, StringInput, Syntax, TsSyntax};
use swc_core::ecma::visit::{VisitMut, VisitMutWith};

#[napi(object)]
pub struct TransformOptions {
    pub from: String,
    pub to: String,
}

#[napi(object)]
pub struct TransformResult {
    pub success: bool,
    pub modified: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

struct RenameVisitor {
    from: String,
    to: String,
    modified: bool,
}

impl VisitMut for RenameVisitor {
    fn visit_mut_ident(&mut self, n: &mut Ident) {
        if n.sym.as_ref() == self.from {
            n.sym = self.to.clone().into();
            self.modified = true;
        }
    }
}

#[napi]
pub fn transform_code(code: String, options: TransformOptions) -> Result<TransformResult> {
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(FileName::Anon.into(), code);

    let syntax = Syntax::Typescript(TsSyntax {
        tsx: true,
        decorators: true,
        ..Default::default()
    });

    let mut parser = Parser::new(syntax, StringInput::from(&*fm), None);

    match parser.parse_module() {
        Ok(mut module) => {
            let mut visitor = RenameVisitor {
                from: options.from,
                to: options.to,
                modified: false,
            };

            module.visit_mut_with(&mut visitor);

            if visitor.modified {
                let mut buf = vec![];
                {
                    let mut emitter = Emitter {
                        cfg: swc_core::ecma::codegen::Config::default(),
                        cm: cm.clone(),
                        comments: None,
                        wr: JsWriter::new(cm, "\n", &mut buf, None),
                    };
                    emitter.emit_module(&module).map_err(|e| {
                        napi::Error::from_reason(format!("Codegen error: {:?}", e))
                    })?;
                }

                let output = String::from_utf8(buf).map_err(|e| {
                    napi::Error::from_reason(format!("UTF-8 error: {}", e))
                })?;

                Ok(TransformResult {
                    success: true,
                    modified: true,
                    output: Some(output),
                    error: None,
                })
            } else {
                Ok(TransformResult {
                    success: true,
                    modified: false,
                    output: None,
                    error: None,
                })
            }
        }
        Err(e) => Ok(TransformResult {
            success: false,
            modified: false,
            output: None,
            error: Some(format!("Parse error: {:?}", e)),
        }),
    }
}
