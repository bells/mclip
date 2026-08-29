//! Bounded deterministic text transformations shared by desktop and CLI.

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use percent_encoding::{percent_decode_str, utf8_percent_encode, AsciiSet, CONTROLS};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::State;

use crate::performance::{
    record_text_transform_performance, PerformanceOutcome, PerformanceRecorder,
};

pub const MAX_TEXT_TRANSFORM_INPUT_BYTES: usize = 1024 * 1024;
pub const MAX_TEXT_TRANSFORM_OUTPUT_BYTES: usize = 4 * 1024 * 1024;

const URL_COMPONENT_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'!')
    .add(b'"')
    .add(b'#')
    .add(b'$')
    .add(b'%')
    .add(b'&')
    .add(b'\'')
    .add(b'(')
    .add(b')')
    .add(b'*')
    .add(b'+')
    .add(b',')
    .add(b'/')
    .add(b':')
    .add(b';')
    .add(b'=')
    .add(b'?')
    .add(b'@')
    .add(b'[')
    .add(b'\\')
    .add(b']')
    .add(b'^')
    .add(b'`')
    .add(b'{')
    .add(b'|')
    .add(b'}')
    .add(b'\x7f');

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TextTransformAction {
    JsonPrettify,
    JsonMinify,
    Base64Encode,
    Base64Decode,
    UrlComponentEncode,
    UrlComponentDecode,
}

impl TextTransformAction {
    pub const ALL: [Self; 6] = [
        Self::JsonPrettify,
        Self::JsonMinify,
        Self::Base64Encode,
        Self::Base64Decode,
        Self::UrlComponentEncode,
        Self::UrlComponentDecode,
    ];

    pub const fn cli_name(self) -> &'static str {
        match self {
            Self::JsonPrettify => "json-prettify",
            Self::JsonMinify => "json-minify",
            Self::Base64Encode => "base64-encode",
            Self::Base64Decode => "base64-decode",
            Self::UrlComponentEncode => "url-component-encode",
            Self::UrlComponentDecode => "url-component-decode",
        }
    }

    pub fn from_cli_name(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|action| action.cli_name() == value)
    }
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextTransformRequest {
    pub action: TextTransformAction,
    pub input: String,
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextTransformResult {
    pub action: TextTransformAction,
    pub output: String,
    pub input_bytes: usize,
    pub output_bytes: usize,
}

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TextTransformErrorCode {
    InputTooLarge,
    OutputTooLarge,
    InvalidJson,
    InvalidBase64,
    NonUtf8Base64,
    InvalidPercentEncoding,
    NonUtf8PercentEncoding,
    WorkerFailed,
}

impl TextTransformErrorCode {
    pub const fn code(self) -> &'static str {
        match self {
            Self::InputTooLarge => "inputTooLarge",
            Self::OutputTooLarge => "outputTooLarge",
            Self::InvalidJson => "invalidJson",
            Self::InvalidBase64 => "invalidBase64",
            Self::NonUtf8Base64 => "nonUtf8Base64",
            Self::InvalidPercentEncoding => "invalidPercentEncoding",
            Self::NonUtf8PercentEncoding => "nonUtf8PercentEncoding",
            Self::WorkerFailed => "workerFailed",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextTransformError {
    pub action: TextTransformAction,
    pub code: TextTransformErrorCode,
    pub input_bytes: usize,
    pub output_bytes: Option<usize>,
}

impl TextTransformError {
    fn new(
        action: TextTransformAction,
        code: TextTransformErrorCode,
        input_bytes: usize,
        output_bytes: Option<usize>,
    ) -> Self {
        Self {
            action,
            code,
            input_bytes,
            output_bytes,
        }
    }

    pub fn diagnostic(&self) -> String {
        let output = self
            .output_bytes
            .map(|bytes| format!(" outputBytes={bytes}"))
            .unwrap_or_default();
        format!(
            "action={} code={} inputBytes={}{}",
            self.action.cli_name(),
            self.code.code(),
            self.input_bytes,
            output
        )
    }
}

pub fn perform_text_transform(
    request: TextTransformRequest,
) -> Result<TextTransformResult, TextTransformError> {
    let action = request.action;
    let input_bytes = request.input.len();
    if input_bytes > MAX_TEXT_TRANSFORM_INPUT_BYTES {
        return Err(TextTransformError::new(
            action,
            TextTransformErrorCode::InputTooLarge,
            input_bytes,
            None,
        ));
    }

    let output = match action {
        TextTransformAction::JsonPrettify => {
            serde_json::from_str::<serde_json::Value>(&request.input)
                .and_then(|value| serde_json::to_string_pretty(&value))
                .map_err(|_| {
                    TextTransformError::new(
                        action,
                        TextTransformErrorCode::InvalidJson,
                        input_bytes,
                        None,
                    )
                })?
        }
        TextTransformAction::JsonMinify => {
            serde_json::from_str::<serde_json::Value>(&request.input)
                .and_then(|value| serde_json::to_string(&value))
                .map_err(|_| {
                    TextTransformError::new(
                        action,
                        TextTransformErrorCode::InvalidJson,
                        input_bytes,
                        None,
                    )
                })?
        }
        TextTransformAction::Base64Encode => BASE64_STANDARD.encode(request.input.as_bytes()),
        TextTransformAction::Base64Decode => {
            let bytes = BASE64_STANDARD
                .decode(request.input.as_bytes())
                .map_err(|_| {
                    TextTransformError::new(
                        action,
                        TextTransformErrorCode::InvalidBase64,
                        input_bytes,
                        None,
                    )
                })?;
            String::from_utf8(bytes).map_err(|error| {
                TextTransformError::new(
                    action,
                    TextTransformErrorCode::NonUtf8Base64,
                    input_bytes,
                    Some(error.as_bytes().len()),
                )
            })?
        }
        TextTransformAction::UrlComponentEncode => {
            utf8_percent_encode(&request.input, URL_COMPONENT_ENCODE_SET).to_string()
        }
        TextTransformAction::UrlComponentDecode => {
            validate_percent_encoding(&request.input)
                .map_err(|code| TextTransformError::new(action, code, input_bytes, None))?;
            percent_decode_str(&request.input)
                .decode_utf8()
                .map_err(|_| {
                    TextTransformError::new(
                        action,
                        TextTransformErrorCode::NonUtf8PercentEncoding,
                        input_bytes,
                        None,
                    )
                })?
                .into_owned()
        }
    };

    let output_bytes = validate_output_size(action, input_bytes, &output)?;

    Ok(TextTransformResult {
        action,
        output,
        input_bytes,
        output_bytes,
    })
}

fn validate_output_size(
    action: TextTransformAction,
    input_bytes: usize,
    output: &str,
) -> Result<usize, TextTransformError> {
    let output_bytes = output.len();
    if output_bytes > MAX_TEXT_TRANSFORM_OUTPUT_BYTES {
        return Err(TextTransformError::new(
            action,
            TextTransformErrorCode::OutputTooLarge,
            input_bytes,
            Some(output_bytes),
        ));
    }
    Ok(output_bytes)
}

pub fn applicable_text_transform_actions(input: &str) -> Vec<TextTransformAction> {
    if input.len() > MAX_TEXT_TRANSFORM_INPUT_BYTES {
        return Vec::new();
    }

    let mut actions = vec![
        TextTransformAction::Base64Encode,
        TextTransformAction::UrlComponentEncode,
        TextTransformAction::UrlComponentDecode,
    ];
    if serde_json::from_str::<serde_json::Value>(input).is_ok() {
        actions.splice(
            0..0,
            [
                TextTransformAction::JsonPrettify,
                TextTransformAction::JsonMinify,
            ],
        );
    }
    if BASE64_STANDARD
        .decode(input.as_bytes())
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .is_some()
    {
        actions.push(TextTransformAction::Base64Decode);
    }
    actions
}

#[tauri::command]
pub async fn transform_text(
    request: TextTransformRequest,
    recorder: State<'_, PerformanceRecorder>,
) -> Result<TextTransformResult, TextTransformError> {
    let action = request.action;
    let input_bytes = request.input.len();
    let started_at = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || perform_text_transform(request))
        .await
        .unwrap_or_else(|_| {
            Err(TextTransformError::new(
                action,
                TextTransformErrorCode::WorkerFailed,
                input_bytes,
                None,
            ))
        });
    record_text_transform_performance(
        &recorder,
        action,
        started_at.elapsed().as_secs_f64() * 1_000.0,
        if result.is_ok() {
            PerformanceOutcome::Success
        } else {
            PerformanceOutcome::Failure
        },
    );
    result
}

#[tauri::command]
pub async fn get_applicable_text_transform_actions(
    input: String,
) -> Result<Vec<TextTransformAction>, String> {
    tauri::async_runtime::spawn_blocking(move || applicable_text_transform_actions(&input))
        .await
        .map_err(|_| "textTransformApplicabilityWorkerFailed".to_string())
}

fn validate_percent_encoding(input: &str) -> Result<(), TextTransformErrorCode> {
    let bytes = input.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit()
            {
                return Err(TextTransformErrorCode::InvalidPercentEncoding);
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(action: TextTransformAction, input: impl Into<String>) -> TextTransformResult {
        perform_text_transform(TextTransformRequest {
            action,
            input: input.into(),
        })
        .unwrap()
    }

    #[test]
    fn all_six_actions_are_deterministic() {
        assert_eq!(
            run(TextTransformAction::JsonPrettify, r#"{"b":2,"a":1}"#).output,
            "{\n  \"a\": 1,\n  \"b\": 2\n}"
        );
        assert_eq!(
            run(TextTransformAction::JsonMinify, "{ \"b\": 2, \"a\": 1 }").output,
            r#"{"a":1,"b":2}"#
        );
        let encoded = run(TextTransformAction::Base64Encode, "你好 mclip").output;
        assert_eq!(
            run(TextTransformAction::Base64Decode, encoded).output,
            "你好 mclip"
        );
        let encoded = run(TextTransformAction::UrlComponentEncode, "a/b ? 你好").output;
        assert_eq!(encoded, "a%2Fb%20%3F%20%E4%BD%A0%E5%A5%BD");
        assert_eq!(
            run(TextTransformAction::UrlComponentDecode, encoded).output,
            "a/b ? 你好"
        );
    }

    #[test]
    fn invalid_inputs_return_content_free_typed_errors() {
        let cases = [
            (
                TextTransformAction::JsonPrettify,
                "{",
                TextTransformErrorCode::InvalidJson,
            ),
            (
                TextTransformAction::Base64Decode,
                "***",
                TextTransformErrorCode::InvalidBase64,
            ),
            (
                TextTransformAction::Base64Decode,
                "/w==",
                TextTransformErrorCode::NonUtf8Base64,
            ),
            (
                TextTransformAction::UrlComponentDecode,
                "%GG",
                TextTransformErrorCode::InvalidPercentEncoding,
            ),
            (
                TextTransformAction::UrlComponentDecode,
                "%FF",
                TextTransformErrorCode::NonUtf8PercentEncoding,
            ),
        ];
        for (action, input, expected) in cases {
            let error = perform_text_transform(TextTransformRequest {
                action,
                input: input.to_string(),
            })
            .unwrap_err();
            assert_eq!(error.code, expected);
            assert!(!error.diagnostic().contains(input));
        }
    }

    #[test]
    fn utf8_and_size_boundaries_are_byte_based() {
        let at_limit = "é".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES / 2);
        assert!(perform_text_transform(TextTransformRequest {
            action: TextTransformAction::Base64Encode,
            input: at_limit,
        })
        .is_ok());

        let over_limit = format!("{}x", "é".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES / 2));
        let error = perform_text_transform(TextTransformRequest {
            action: TextTransformAction::Base64Encode,
            input: over_limit,
        })
        .unwrap_err();
        assert_eq!(error.code, TextTransformErrorCode::InputTooLarge);
    }

    #[test]
    fn output_limit_accepts_worst_case_percent_encoding_and_rejects_oversize_results() {
        let input = " ".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES);
        assert_eq!(
            run(TextTransformAction::UrlComponentEncode, input).output_bytes,
            MAX_TEXT_TRANSFORM_INPUT_BYTES * 3
        );
        let oversized = "x".repeat(MAX_TEXT_TRANSFORM_OUTPUT_BYTES + 1);
        let error =
            validate_output_size(TextTransformAction::JsonPrettify, 1, &oversized).unwrap_err();
        assert_eq!(error.code, TextTransformErrorCode::OutputTooLarge);
        assert_eq!(
            error.output_bytes,
            Some(MAX_TEXT_TRANSFORM_OUTPUT_BYTES + 1)
        );
    }

    #[test]
    #[ignore = "implementation benchmark; run explicitly in release mode"]
    fn representative_transform_benchmark() {
        use std::time::Instant;

        let json = format!("[{}]", "0,".repeat(250_000).trim_end_matches(','));
        let spaced_json = format!("[{}]", "0, ".repeat(200_000).trim_end_matches(", "));
        let base64_source = "m".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES);
        let base64_encoded = BASE64_STANDARD.encode("m".repeat(768 * 1024));
        let url_source = " ".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES);
        let url_encoded = "%20".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES / 3);
        for (action, input) in [
            (TextTransformAction::JsonPrettify, json),
            (TextTransformAction::JsonMinify, spaced_json),
            (TextTransformAction::Base64Encode, base64_source),
            (TextTransformAction::Base64Decode, base64_encoded),
            (TextTransformAction::UrlComponentEncode, url_source),
            (TextTransformAction::UrlComponentDecode, url_encoded),
        ] {
            let input_bytes = input.len();
            let started_at = Instant::now();
            let result = perform_text_transform(TextTransformRequest { action, input }).unwrap();
            eprintln!(
                "action={} inputBytes={} outputBytes={} durationMs={:.3}",
                action.cli_name(),
                input_bytes,
                result.output_bytes,
                started_at.elapsed().as_secs_f64() * 1_000.0,
            );
        }
    }

    #[test]
    fn applicability_is_bounded_and_only_enables_valid_decoders() {
        let json = applicable_text_transform_actions(r#"{"ok":true}"#);
        assert!(json.contains(&TextTransformAction::JsonPrettify));
        assert!(json.contains(&TextTransformAction::JsonMinify));
        assert!(!applicable_text_transform_actions("not json")
            .contains(&TextTransformAction::JsonPrettify));
        assert!(
            applicable_text_transform_actions("aGk=").contains(&TextTransformAction::Base64Decode)
        );
        assert!(
            !applicable_text_transform_actions("/w==").contains(&TextTransformAction::Base64Decode)
        );
        assert!(
            applicable_text_transform_actions(&"x".repeat(MAX_TEXT_TRANSFORM_INPUT_BYTES + 1))
                .is_empty()
        );
    }
}
