import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Check, X, AlertTriangle, SwitchCamera, Loader2 } from 'lucide-react';

/**
 * Live passport photo capture.
 *
 * Opens the device camera, frames the subject inside a passport-ratio guide,
 * and returns a JPEG File — the same shape the file picker produces, so the
 * caller treats both sources identically.
 *
 * Handles the things that actually go wrong in the field: permission denied,
 * no camera present, a camera already in use by another app, and pages served
 * over plain HTTP (where browsers block camera access outright).
 */

const PASSPORT_RATIO = 35 / 45; // width / height — standard passport proportion
const OUTPUT_WIDTH = 700;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / PASSPORT_RATIO); // 900

function describeError(err) {
  if (!window.isSecureContext) {
    return 'The camera only works over a secure (https) connection. Please use the file upload instead.';
  }
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow camera permission in your browser settings, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. Please upload a photo instead.';
    case 'NotReadableError':
      return 'Your camera is being used by another app. Close it and try again.';
    default:
      return 'Could not start the camera. Please upload a photo instead.';
  }
}

export default function CameraCapture({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | live | captured | error
  const [error, setError] = useState('');
  const [shot, setShot] = useState(null); // { blob, url }
  const [facing, setFacing] = useState('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (mode) => {
      stop();
      setStatus('starting');
      setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error('unsupported'), { name: 'NotFoundError' });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('live');

        // Only offer the flip control when there is something to flip to.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
        } catch {
          /* non-critical */
        }
      } catch (err) {
        setError(describeError(err));
        setStatus('error');
      }
    },
    [stop]
  );

  useEffect(() => {
    if (open) start(facing);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  // Release the object URL for a discarded shot.
  useEffect(() => {
    return () => {
      if (shot?.url) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && handleClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    stop();
    if (shot?.url) URL.revokeObjectURL(shot.url);
    setShot(null);
    setStatus('starting');
    onClose();
  }

  /** Grab the current frame, cropped to passport proportions. */
  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Centre-crop the source frame to the passport ratio.
    const srcRatio = video.videoWidth / video.videoHeight;
    let sw = video.videoWidth;
    let sh = video.videoHeight;
    if (srcRatio > PASSPORT_RATIO) {
      sw = video.videoHeight * PASSPORT_RATIO;
    } else {
      sh = video.videoWidth / PASSPORT_RATIO;
    }
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;

    // The preview is mirrored for a natural selfie; un-mirror the saved image
    // so the photo is not reversed.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (shot?.url) URL.revokeObjectURL(shot.url);
        setShot({ blob, url: URL.createObjectURL(blob) });
        setStatus('captured');
        stop();
      },
      'image/jpeg',
      0.92
    );
  }

  function usePhoto() {
    if (!shot) return;
    const file = new File([shot.blob], `passport-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="animate-fade-in relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Camera className="h-4.5 w-4.5 text-primary" />
            <h3 className="font-display text-base font-semibold text-ink">Take a live photo</h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-primary-surface hover:text-ink"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative bg-ink" style={{ aspectRatio: '35 / 45' }}>
          {status === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <p className="text-sm text-white/90">{error}</p>
            </div>
          ) : status === 'captured' && shot ? (
            <img src={shot.url} alt="Captured passport" className="h-full w-full object-cover" />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`h-full w-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {status === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/60 text-sm text-white">
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
                </div>
              )}
              {/* Framing guide */}
              {status === 'live' && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-x-[18%] inset-y-[10%] rounded-[45%] border-2 border-dashed border-white/55" />
                  <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-white/85">
                    Centre your face in the oval · plain background · no cap or sunglasses
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          {status === 'captured' ? (
            <>
              <button
                type="button"
                onClick={() => { setShot(null); start(facing); }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-primary-surface"
              >
                <RefreshCw className="h-4 w-4" /> Retake
              </button>
              <button
                type="button"
                onClick={usePhoto}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                <Check className="h-4 w-4" /> Use this photo
              </button>
            </>
          ) : status === 'error' ? (
            <>
              <button
                type="button"
                onClick={() => start(facing)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-primary-surface"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                Upload a file instead
              </button>
            </>
          ) : (
            <>
              {hasMultipleCameras ? (
                <button
                  type="button"
                  onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                  className="rounded-xl border border-border bg-white p-2.5 text-muted transition hover:bg-primary-surface hover:text-ink"
                  aria-label="Switch camera"
                >
                  <SwitchCamera className="h-5 w-5" />
                </button>
              ) : (
                <span className="w-[42px]" />
              )}
              <button
                type="button"
                onClick={capture}
                disabled={status !== 'live'}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> Capture
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
