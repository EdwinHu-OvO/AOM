use crate::{AdapterError, AdapterResult};
use aom_protocol_rs::{AnalyzerCommand, AnalyzerReply, AnalyzerSessionConfig};
use std::{
    io::{BufRead, BufReader, BufWriter, Write},
    path::Path,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
};

pub struct StdioAnalyzerClient {
    child: Child,
    stdin: BufWriter<ChildStdin>,
    stdout: BufReader<ChildStdout>,
}

impl StdioAnalyzerClient {
    pub fn spawn(
        program: impl AsRef<Path>,
        args: &[String],
        config: AnalyzerSessionConfig,
    ) -> AdapterResult<(Self, AnalyzerReply)> {
        let mut child = Command::new(program.as_ref())
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| AdapterError::Transport(error.to_string()))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AdapterError::Transport("analyzer stdin unavailable".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AdapterError::Transport("analyzer stdout unavailable".to_string()))?;
        let mut client = Self {
            child,
            stdin: BufWriter::new(stdin),
            stdout: BufReader::new(stdout),
        };
        let reply = client.request(&AnalyzerCommand::Initialize(config))?;
        Ok((client, reply))
    }

    pub fn request(&mut self, command: &AnalyzerCommand) -> AdapterResult<AnalyzerReply> {
        serde_json::to_writer(&mut self.stdin, command)
            .map_err(|error| AdapterError::Transport(error.to_string()))?;
        self.stdin
            .write_all(b"\n")
            .and_then(|_| self.stdin.flush())
            .map_err(|error| AdapterError::Transport(error.to_string()))?;
        let mut line = String::new();
        let read = self
            .stdout
            .read_line(&mut line)
            .map_err(|error| AdapterError::Transport(error.to_string()))?;
        if read == 0 {
            return Err(AdapterError::Transport(format!(
                "analyzer exited before reply: {:?}",
                self.child.try_wait().ok().flatten()
            )));
        }
        let reply: AnalyzerReply = serde_json::from_str(&line)
            .map_err(|error| AdapterError::Transport(error.to_string()))?;
        if let AnalyzerReply::Error(failure) = &reply {
            return Err(AdapterError::Analyzer {
                code: failure.code.clone(),
                message: failure.message.clone(),
            });
        }
        Ok(reply)
    }
}

impl Drop for StdioAnalyzerClient {
    fn drop(&mut self) {
        let _ = self.request(&AnalyzerCommand::Shutdown);
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
