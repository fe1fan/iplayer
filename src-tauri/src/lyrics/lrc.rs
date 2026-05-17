use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

pub fn parse(content: &str) -> Vec<LyricLine> {
    let mut out: Vec<LyricLine> = Vec::new();
    for raw in content.lines() {
        let line = raw.trim_end_matches('\r');
        let mut rest = line;
        let mut stamps: Vec<u64> = Vec::new();
        loop {
            let trimmed = rest.trim_start();
            if !trimmed.starts_with('[') {
                rest = trimmed;
                break;
            }
            let Some(end) = trimmed.find(']') else { break; };
            let tag = &trimmed[1..end];
            if let Some(ms) = parse_timestamp(tag) {
                stamps.push(ms);
            }
            rest = &trimmed[end + 1..];
        }
        if stamps.is_empty() {
            continue;
        }
        let text = rest.trim().to_string();
        for ms in stamps {
            out.push(LyricLine { time_ms: ms, text: text.clone() });
        }
    }
    out.sort_by_key(|l| l.time_ms);
    out
}

fn parse_timestamp(tag: &str) -> Option<u64> {
    let (mins, rest) = tag.split_once(':')?;
    let mins: u64 = mins.trim().parse().ok()?;
    let secs_f: f64 = rest.trim().parse().ok()?;
    if !secs_f.is_finite() || secs_f < 0.0 {
        return None;
    }
    Some(mins.saturating_mul(60_000) + (secs_f * 1000.0).round() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_lines() {
        let s = "[ti:Title]\n[ar:Artist]\n[00:01.20]hello\n[00:03.50]world\n";
        let lines = parse(s);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time_ms, 1200);
        assert_eq!(lines[0].text, "hello");
        assert_eq!(lines[1].time_ms, 3500);
        assert_eq!(lines[1].text, "world");
    }

    #[test]
    fn parses_multi_timestamp() {
        let s = "[00:01.00][00:05.00]repeat\n";
        let lines = parse(s);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time_ms, 1000);
        assert_eq!(lines[1].time_ms, 5000);
    }

    #[test]
    fn skips_lines_without_timestamps() {
        let s = "header line\n[01:00.00]ok\n";
        let lines = parse(s);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].time_ms, 60_000);
    }
}
