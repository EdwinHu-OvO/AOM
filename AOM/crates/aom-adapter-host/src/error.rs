use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdapterError {
    Analyzer {
        code: String,
        message: String,
    },
    ArtifactRead {
        locator: String,
        message: String,
    },
    DuplicateProbe(String),
    DuplicateStaticAdapter(String),
    DuplicateTarget(String),
    InvalidSequence {
        target_id: String,
        previous: u64,
        received: u64,
    },
    Probe(String),
    ProbeNotFound(String),
    StaticAdapterNotFound(String),
    TargetNotFound(String),
    TargetMismatch {
        expected: String,
        received: String,
    },
    Transport(String),
    UnexpectedReply {
        expected: String,
        received: String,
    },
}

impl Display for AdapterError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{self:?}")
    }
}

impl std::error::Error for AdapterError {}

pub type AdapterResult<T> = Result<T, AdapterError>;
