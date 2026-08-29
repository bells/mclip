//! 本地敏感文本分类与安全展示。
//!
//! 这里只处理有明确结构的高置信度文本形式。分类有硬字节上限，
//! 不记录命中片段，也不尝试用熵规则猜测通用密钥。

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

pub const SECRET_DETECTOR_VERSION: u16 = 1;
pub const MAX_SECRET_CLASSIFICATION_BYTES: usize = 64 * 1024;
pub const MASKED_SECRET_TEXT: &str = "••••••••";

pub const CLASSIFICATION_NO_MATCH_CODE: &str = "noMatch";
pub const CLASSIFICATION_MATCHED_CODE: &str = "matched";
pub const CLASSIFICATION_INPUT_TOO_LARGE_CODE: &str = "inputTooLarge";

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SecretType {
    PemPrivateKey,
    Jwt,
    AwsAccessKeyId,
    OpenAiApiKey,
}

impl SecretType {
    pub const fn code(self) -> &'static str {
        match self {
            Self::PemPrivateKey => "pemPrivateKey",
            Self::Jwt => "jwt",
            Self::AwsAccessKeyId => "awsAccessKeyId",
            Self::OpenAiApiKey => "openAiApiKey",
        }
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ClassificationStatus {
    NoMatch,
    Matched,
    InputTooLarge,
}

impl ClassificationStatus {
    pub const fn code(self) -> &'static str {
        match self {
            Self::NoMatch => CLASSIFICATION_NO_MATCH_CODE,
            Self::Matched => CLASSIFICATION_MATCHED_CODE,
            Self::InputTooLarge => CLASSIFICATION_INPUT_TOO_LARGE_CODE,
        }
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct ClassificationResult {
    pub secret_type: Option<SecretType>,
    pub detector_version: Option<u16>,
    pub status: ClassificationStatus,
}

impl ClassificationResult {
    const fn no_match() -> Self {
        Self {
            secret_type: None,
            detector_version: None,
            status: ClassificationStatus::NoMatch,
        }
    }

    const fn input_too_large() -> Self {
        Self {
            secret_type: None,
            detector_version: None,
            status: ClassificationStatus::InputTooLarge,
        }
    }

    const fn matched(secret_type: SecretType) -> Self {
        Self {
            secret_type: Some(secret_type),
            detector_version: Some(SECRET_DETECTOR_VERSION),
            status: ClassificationStatus::Matched,
        }
    }
}

// Rust regex guarantees linear-time matching for these non-backtracking patterns.
static PEM_PRIVATE_KEY_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----")
        .expect("PEM private-key detector must compile")
});
static JWT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})(?:$|[^A-Za-z0-9_-])")
        .expect("JWT detector must compile")
});
static AWS_ACCESS_KEY_ID_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:^|[^A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?:$|[^A-Z0-9])")
        .expect("AWS access-key ID detector must compile")
});
static OPENAI_API_KEY_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:^|[^A-Za-z0-9_-])sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}(?:$|[^A-Za-z0-9_-])")
        .expect("OpenAI API-key detector must compile")
});

pub fn classify_text(text: &str) -> ClassificationResult {
    if text.len() > MAX_SECRET_CLASSIFICATION_BYTES {
        return ClassificationResult::input_too_large();
    }

    if PEM_PRIVATE_KEY_PATTERN.is_match(text) {
        return ClassificationResult::matched(SecretType::PemPrivateKey);
    }
    if JWT_PATTERN.is_match(text) {
        return ClassificationResult::matched(SecretType::Jwt);
    }
    if AWS_ACCESS_KEY_ID_PATTERN.is_match(text) {
        return ClassificationResult::matched(SecretType::AwsAccessKeyId);
    }
    if OPENAI_API_KEY_PATTERN.is_match(text) {
        return ClassificationResult::matched(SecretType::OpenAiApiKey);
    }

    ClassificationResult::no_match()
}

pub const fn mask_secret(_secret_type: SecretType) -> &'static str {
    // 不保留任何原文片段，避免前后缀本身仍可用于识别或误入诊断信息。
    MASKED_SECRET_TEXT
}

pub fn masked_text(text: &str, secret_type: Option<SecretType>, masking_enabled: bool) -> String {
    match (secret_type, masking_enabled) {
        (Some(secret_type), true) => mask_secret(secret_type).to_string(),
        _ => text.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::{
        classify_text, mask_secret, ClassificationStatus, SecretType,
        MAX_SECRET_CLASSIFICATION_BYTES, SECRET_DETECTOR_VERSION,
    };

    const SYNTHETIC_PEM: &str =
        "-----BEGIN PRIVATE KEY-----\nSYNTHETIC-FIXTURE-NOT-A-KEY\n-----END PRIVATE KEY-----";
    const SYNTHETIC_JWT: &str =
        "eyJzeW50aGV0aWMiOnRydWV9.c3ludGhldGljLWZpeHR1cmU.c2lnbmF0dXJlLW5vdC1yZWFs";
    const SYNTHETIC_AWS_ID: &str = "AKIASYNTHETICFIXTURE";
    const SYNTHETIC_OPENAI_KEY: &str = "sk-proj-SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_1234567890";

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Fixture {
        detector_version: u16,
        max_bytes: usize,
        matches: Vec<FixtureMatch>,
        near_misses: Vec<String>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FixtureMatch {
        secret_type: SecretType,
        value: String,
    }

    #[test]
    fn classifies_supported_synthetic_categories() {
        for (value, expected) in [
            (SYNTHETIC_PEM, SecretType::PemPrivateKey),
            (SYNTHETIC_JWT, SecretType::Jwt),
            (SYNTHETIC_AWS_ID, SecretType::AwsAccessKeyId),
            (SYNTHETIC_OPENAI_KEY, SecretType::OpenAiApiKey),
        ] {
            let result = classify_text(value);
            assert_eq!(result.secret_type, Some(expected));
            assert_eq!(result.detector_version, Some(SECRET_DETECTOR_VERSION));
            assert_eq!(result.status, ClassificationStatus::Matched);
        }
    }

    #[test]
    fn reviewed_json_fixture_matches_the_detector_contract() {
        let fixture: Fixture =
            serde_json::from_str(include_str!("../tests/fixtures/sensitive-content-v1.json"))
                .unwrap();
        assert_eq!(fixture.detector_version, SECRET_DETECTOR_VERSION);
        assert_eq!(fixture.max_bytes, MAX_SECRET_CLASSIFICATION_BYTES);

        for fixture_match in fixture.matches {
            assert_eq!(
                classify_text(&fixture_match.value).secret_type,
                Some(fixture_match.secret_type)
            );
        }
        for near_miss in fixture.near_misses {
            assert_eq!(classify_text(&near_miss).secret_type, None);
        }
    }

    #[test]
    fn ordinary_near_misses_remain_unclassified() {
        for value in [
            "-----BEGIN PUBLIC KEY-----",
            "header.payload",
            "AKIASYNTHETICSHORT",
            "sk-proj-too-short",
            "这是普通的 UTF-8 文本 🔐",
        ] {
            let result = classify_text(value);
            assert_eq!(result.secret_type, None, "unexpected match for {value}");
            assert_eq!(result.status, ClassificationStatus::NoMatch);
        }
    }

    #[test]
    fn oversized_utf8_input_is_rejected_before_scanning() {
        let mut value = "密".repeat(MAX_SECRET_CLASSIFICATION_BYTES / 3 + 1);
        value.push_str(SYNTHETIC_OPENAI_KEY);

        let result = classify_text(&value);
        assert_eq!(result.secret_type, None);
        assert_eq!(result.status, ClassificationStatus::InputTooLarge);
        assert_eq!(result.status.code(), "inputTooLarge");
    }

    #[test]
    fn masks_are_fixed_and_content_free_for_every_category() {
        for secret_type in [
            SecretType::PemPrivateKey,
            SecretType::Jwt,
            SecretType::AwsAccessKeyId,
            SecretType::OpenAiApiKey,
        ] {
            assert_eq!(mask_secret(secret_type), "••••••••");
        }
    }
}
