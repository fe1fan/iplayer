use rodio::{source::SeekError, Source};
use std::{
    fs::File,
    io::ErrorKind,
    path::Path,
    sync::{atomic::{AtomicU32, Ordering}, Arc},
    time::Duration,
};
use symphonia::{
    core::{
        audio::{SampleBuffer, SignalSpec},
        codecs::{Decoder as CodecDecoder, DecoderOptions},
        errors::Error,
        formats::{FormatOptions, FormatReader, SeekMode, SeekTo},
        io::{MediaSource, MediaSourceStream, MediaSourceStreamOptions},
        meta::MetadataOptions,
        probe::Hint,
        units::Time,
    },
    default::{get_codecs, get_probe},
};

/// Symphonia-backed audio source with seek support.
///
/// We bypass rodio's `Decoder::new` because its internal `ReadSeekSource` always
/// reports `byte_len() = None`, which makes symphonia's format readers refuse to
/// seek. Wrapping a `File` as `MediaSource` directly preserves seekability.
pub struct SymphoniaSource {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn CodecDecoder>,
    track_id: u32,
    spec: SignalSpec,
    sample_buf: Option<SampleBuffer<f32>>,
    cursor: usize,
    cursor_end: usize,
    total_duration: Option<Duration>,
}

impl SymphoniaSource {
    pub fn from_path(path: &Path) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("cannot open file: {e}"))?;
        let mss = MediaSourceStream::new(
            Box::new(file) as Box<dyn MediaSource>,
            MediaSourceStreamOptions::default(),
        );

        let mut hint = Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let probed = get_probe()
            .format(
                &hint,
                mss,
                &FormatOptions {
                    enable_gapless: true,
                    ..Default::default()
                },
                &MetadataOptions::default(),
            )
            .map_err(|e| format!("probe failed: {e}"))?;
        let format = probed.format;

        let track = format
            .default_track()
            .ok_or_else(|| "no default track".to_string())?;
        let track_id = track.id;
        let codec_params = track.codec_params.clone();

        let decoder = get_codecs()
            .make(&codec_params, &DecoderOptions::default())
            .map_err(|e| format!("decoder init failed: {e}"))?;

        let total_duration = codec_params
            .n_frames
            .zip(codec_params.sample_rate)
            .map(|(frames, rate)| Duration::from_secs_f64(frames as f64 / rate as f64));

        let spec = SignalSpec::new(
            codec_params.sample_rate.unwrap_or(44_100),
            codec_params.channels.unwrap_or(
                symphonia::core::audio::Channels::FRONT_LEFT
                    | symphonia::core::audio::Channels::FRONT_RIGHT,
            ),
        );

        Ok(Self {
            format,
            decoder,
            track_id,
            spec,
            sample_buf: None,
            cursor: 0,
            cursor_end: 0,
            total_duration,
        })
    }

    fn fill_next_packet(&mut self) -> Result<(), Error> {
        loop {
            let packet = self.format.next_packet()?;
            if packet.track_id() != self.track_id {
                continue;
            }
            match self.decoder.decode(&packet) {
                Ok(decoded) => {
                    let frames = decoded.frames();
                    let spec = *decoded.spec();
                    let needed = frames * spec.channels.count();
                    let buf = match self.sample_buf.as_mut() {
                        Some(buf) if buf.capacity() >= needed => buf,
                        _ => {
                            self.sample_buf = Some(SampleBuffer::<f32>::new(frames as u64, spec));
                            self.sample_buf.as_mut().unwrap()
                        }
                    };
                    buf.copy_interleaved_ref(decoded);
                    self.spec = spec;
                    self.cursor = 0;
                    self.cursor_end = buf.samples().len();
                    return Ok(());
                }
                Err(Error::DecodeError(_)) => continue,
                Err(e) => return Err(e),
            }
        }
    }
}

impl Iterator for SymphoniaSource {
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.cursor >= self.cursor_end && self.fill_next_packet().is_err() {
            return None;
        }
        let sample = self.sample_buf.as_ref()?.samples().get(self.cursor).copied();
        self.cursor += 1;
        sample
    }
}

impl Source for SymphoniaSource {
    fn current_frame_len(&self) -> Option<usize> {
        let remaining = self.cursor_end.saturating_sub(self.cursor);
        if remaining == 0 {
            None
        } else {
            Some(remaining)
        }
    }

    fn channels(&self) -> u16 {
        self.spec.channels.count() as u16
    }

    fn sample_rate(&self) -> u32 {
        self.spec.rate
    }

    fn total_duration(&self) -> Option<Duration> {
        self.total_duration
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let target = Time::new(pos.as_secs(), pos.subsec_nanos() as f64 / 1_000_000_000.0);
        self.format
            .seek(
                SeekMode::Coarse,
                SeekTo::Time {
                    time: target,
                    track_id: Some(self.track_id),
                },
            )
            .map_err(|e| {
                SeekError::Other(Box::new(std::io::Error::new(ErrorKind::Other, e.to_string())))
            })?;
        self.decoder.reset();
        self.cursor = 0;
        self.cursor_end = 0;
        Ok(())
    }
}

/// Wraps an `f32` source and records the most recent peak amplitude into a
/// shared atomic. Reader sees u32 = clamp(|sample|, 0.0, 1.0) * u32::MAX.
pub struct MeterSource<S> {
    inner: S,
    amplitude: Arc<AtomicU32>,
    window_size: usize,
    window_peak: f32,
    window_count: usize,
}

impl<S: Source<Item = f32>> MeterSource<S> {
    pub fn new(inner: S, amplitude: Arc<AtomicU32>) -> Self {
        let window_size = (inner.sample_rate() as usize / 60).max(256);
        Self {
            inner,
            amplitude,
            window_size,
            window_peak: 0.0,
            window_count: 0,
        }
    }

    fn commit(&mut self) {
        let scaled = (self.window_peak.clamp(0.0, 1.0) * u32::MAX as f32) as u32;
        self.amplitude.store(scaled, Ordering::Relaxed);
        self.window_peak = 0.0;
        self.window_count = 0;
    }
}

impl<S: Source<Item = f32>> Iterator for MeterSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let sample = self.inner.next();
        if let Some(value) = sample {
            let abs = value.abs();
            if abs > self.window_peak {
                self.window_peak = abs;
            }
            self.window_count += 1;
            if self.window_count >= self.window_size {
                self.commit();
            }
        }
        sample
    }
}

impl<S: Source<Item = f32>> Source for MeterSource<S> {
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.inner.channels()
    }

    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.inner.try_seek(pos)
    }
}
