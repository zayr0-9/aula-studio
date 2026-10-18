import { useEffect, useId, useRef, useState } from 'react';
import { F75_DIRECT_KEYS } from '../../protocol/f75-direct';
import { defaultStreamProfile } from '../../shared/stream';
import type { F75DirectKey, StreamProfile, StreamStatus } from '../../shared/stream';
import { Keyboard } from './components/Keyboard';
import type { KeyboardKeyAppearance } from './components/Keyboard';
import { Select } from './components/Select';
import './stream.css';

const modes: { value: StreamProfile['mode']; label: string }[] = [
  { value: 'paint', label: 'Paint individual' },
  { value: 'solid', label: 'Solid' },
  { value: 'wave', label: 'Wave' },
  { value: 'breathe', label: 'Breathe' },
  { value: 'walk', label: 'Walking key' },
];
const physicalKeys = F75_DIRECT_KEYS.map(({ key }) => key);
const waveColors = ['#ff0000', '#ff8000', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'];

// Kept local so the panel can be integrated independently of the preload declaration.
interface StreamApi {
  getStreamStatus(): Promise<StreamStatus>;
  startStream(profile: StreamProfile): Promise<StreamStatus>;
  updateStream(profile: StreamProfile): Promise<StreamStatus>;
  stopStream(): Promise<StreamStatus>;
}

export function StreamPanel({ enabled }: { enabled: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState<StreamProfile>(defaultStreamProfile);
  const [submitted, setSubmitted] = useState<StreamProfile | null>(null);
  const [selected, setSelected] = useState<F75DirectKey[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<StreamStatus>({
    state: 'off',
    message: 'Not started. No hardware read or write requested.',
    frames: 0,
  });
  const [busy, setBusy] = useState(false);
  const [stopQueued, setStopQueued] = useState(false);
  const locked = useRef(false);
  const stopRequested = useRef(false);
  const alive = useRef(false);
  const revision = useRef(0);
  const running = ['starting', 'active', 'stopping'].includes(status.state);
  const dirty =
    !submitted ||
    JSON.stringify(draft) !== JSON.stringify(submitted) ||
    (draft.mode === 'paint' && selected.some((key) => draft.colors[key] !== draft.color));
  const api = window.aula as typeof window.aula & StreamApi;

  useEffect(() => {
    alive.current = true;
    revision.current++;
    return () => {
      alive.current = false;
    };
  }, []);

  // Heartbeat only for a session explicitly started here. No mount-time device query.
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let pending = false;
    const interval = window.setInterval(() => {
      if (locked.current || pending) return;
      pending = true;
      const token = revision.current;
      void api
        .getStreamStatus()
        .then(
          (result) => {
            if (!cancelled && alive.current && token === revision.current) setStatus(result);
          },
          (error: unknown) => {
            if (!cancelled && alive.current && token === revision.current) {
              setStatus((previous) => ({
                ...previous,
                state: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Stream status failed. Use Stop to end the session.',
              }));
            }
          },
        )
        .finally(() => {
          pending = false;
        });
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [api, running]);

  async function transact(action: 'start' | 'update' | 'stop') {
    if (action === 'stop' && locked.current) {
      stopRequested.current = true;
      setStopQueued(true);
      return;
    }
    if (locked.current || (action !== 'stop' && (!enabled || !ready))) return;
    locked.current = true;
    setBusy(true);
    const token = ++revision.current;
    const profile = {
      ...draft,
      colors: {
        ...draft.colors,
        ...(draft.mode === 'paint' && selected.length
          ? Object.fromEntries(selected.map((key) => [key, draft.color]))
          : {}),
      },
    };
    if (action !== 'stop') setDraft(profile);
    if (action !== 'update') {
      setStatus((previous) => ({
        ...previous,
        state: action === 'start' ? 'starting' : 'stopping',
        message: action === 'start' ? 'Starting temporary stream…' : 'Stopping temporary stream…',
      }));
    }
    try {
      const result = await (action === 'start'
        ? api.startStream(profile)
        : action === 'update'
          ? api.updateStream(profile)
          : api.stopStream());
      if (alive.current && token === revision.current) {
        setStatus(result);
        if (action !== 'stop' && (result.state === 'active' || result.state === 'starting')) {
          setSubmitted(profile);
        }
      }
    } catch (error) {
      if (alive.current && token === revision.current) {
        setStatus((previous) => ({
          ...previous,
          state: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Stream request failed. Use Stop before trying again.',
        }));
      }
    } finally {
      locked.current = false;
      if (alive.current && token === revision.current) {
        setBusy(false);
        if (stopRequested.current) {
          stopRequested.current = false;
          setStopQueued(false);
          void transact('stop');
        }
      }
    }
  }

  function paint(keys: readonly F75DirectKey[], color: string) {
    setDraft((previous) => ({
      ...previous,
      colors: { ...previous.colors, ...Object.fromEntries(keys.map((key) => [key, color])) },
    }));
  }

  const appearance: Record<string, KeyboardKeyAppearance> = {
    Knob: { disabled: true, description: 'No lighting control' },
  };
  for (const { key, column } of F75_DIRECT_KEYS) {
    const color =
      draft.mode === 'paint'
        ? draft.colors[key]
        : draft.mode === 'wave'
          ? waveColors[column % waveColors.length]
          : draft.color;
    const gain = draft.brightness / 100;
    const preview = `#${[1, 3, 5]
      .map((offset) =>
        Math.round(parseInt(color.slice(offset, offset + 2), 16) * gain)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
    appearance[key] = {
      color: preview,
      description: `${color}, ${selected.includes(key) ? 'selected' : 'not selected'}`,
    };
  }

  return (
    <section className="panel stream-panel" aria-labelledby={`${id}-title`}>
      <div className="section-header">
        <h2 id={`${id}-title`}>Temporary streaming</h2>
        <span className="small-tag">{status.state}</span>
      </div>
      <div className="stream-warning">
        <p>
          Close the official AULA app. Enable the option below to turn onboard lighting off from
          Studio before starting.
        </p>
        <p>
          This temporarily replaces the whole keyboard lighting, not an overlay. Updates are every
          800 ms, with a 30-minute session cap. Stop lets the onboard effect resume; it does not
          restore a saved color snapshot.
        </p>
      </div>
      <label htmlFor={`${id}-ready`}>
        <input
          id={`${id}-ready`}
          type="checkbox"
          checked={ready}
          disabled={!enabled || busy || running}
          onChange={(event) => {
            if (!event.target.checked) {
              setReady(false);
              return;
            }
            if (locked.current) return;
            locked.current = true;
            setBusy(true);
            setReady(false);
            void window.aula
              .setEffect(0)
              .then(async () => {
                await new Promise((resolve) => window.setTimeout(resolve, 500));
                if (alive.current) {
                  setReady(true);
                  setStatus({
                    state: 'off',
                    frames: 0,
                    message: 'Onboard lighting turned off and read back. Ready to start.',
                  });
                }
              })
              .catch((error: unknown) => {
                if (alive.current)
                  setStatus({
                    state: 'error',
                    frames: 0,
                    message: error instanceof Error ? error.message : 'Could not turn lighting off',
                  });
              })
              .finally(() => {
                locked.current = false;
                if (alive.current) setBusy(false);
                if (stopRequested.current) {
                  stopRequested.current = false;
                  setStopQueued(false);
                  void transact('stop');
                }
              });
          }}
        />
        Turn onboard lighting off · official app is closed
      </label>
      <div className="control-grid">
        <div className="control-group">
          <label htmlFor={`${id}-mode`}>Mode</label>
          <Select
            id={`${id}-mode`}
            value={draft.mode}
            options={modes}
            onChange={(mode) => setDraft((previous) => ({ ...previous, mode }))}
          />
        </div>
        <div className="control-group">
          <div className="range-heading">
            <label htmlFor={`${id}-brightness`}>Brightness</label>
            <output htmlFor={`${id}-brightness`}>{draft.brightness}%</output>
          </div>
          <input
            id={`${id}-brightness`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={draft.brightness}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, brightness: Number(event.target.value) }))
            }
          />
        </div>
        <div className="control-group">
          <label htmlFor={`${id}-color`}>
            {draft.mode === 'paint' ? 'Paint color' : 'Effect color'}
          </label>
          <div className="stream-color">
            <input
              id={`${id}-color`}
              type="color"
              value={draft.color}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, color: event.target.value }))
              }
            />
            <span className="supporting">{draft.color}</span>
          </div>
          {draft.mode === 'wave' && <p>Wave uses a rainbow palette, not the chosen color.</p>}
        </div>
      </div>
      <div className="stream-preview">
        <h3>Draft preview</h3>
        <p>
          Local design only, not read from hardware. Animated modes are shown as a static color
          guide; walking key lights one key at a time.
        </p>
        <Keyboard
          label="Select physical keys for the stream draft"
          selectedKeys={selected}
          keyAppearance={appearance}
          onKeySelect={({ id: key }) => {
            if (!physicalKeys.includes(key as F75DirectKey)) return;
            const physical = key as F75DirectKey;
            setSelected((previous) =>
              previous.includes(physical)
                ? previous.filter((value) => value !== physical)
                : [...previous, physical],
            );
          }}
        />
        <div className="action-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelected([...physicalKeys])}
          >
            Select all
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!selected.length}
            onClick={() => setSelected([])}
          >
            Clear selection
          </button>
          <span className="supporting">
            {selected.length} of {physicalKeys.length} keys selected
          </span>
        </div>
        <div className="action-row">
          <button
            type="button"
            className="secondary-button"
            disabled={!selected.length || draft.mode !== 'paint'}
            onClick={() => paint(selected, draft.color)}
          >
            Paint selection
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={draft.mode !== 'paint'}
            onClick={() => paint(physicalKeys, draft.color)}
          >
            Fill board
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={draft.mode !== 'paint'}
            onClick={() => paint(physicalKeys, '#000000')}
          >
            Clear board
          </button>
        </div>
        <div className="action-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setDraft((previous) => ({
                ...previous,
                mode: 'paint',
                colors: {
                  ...previous.colors,
                  Digit1: '#00ff00',
                  Digit2: '#8000ff',
                  Digit3: '#ff0000',
                  Digit4: '#0000ff',
                },
              }))
            }
          >
            Agent colors
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setDraft((previous) => ({
                ...previous,
                mode: 'paint',
                colors: Object.fromEntries(
                  physicalKeys.map((key) => [key, '#000000']),
                ) as StreamProfile['colors'],
              }))
            }
          >
            All off
          </button>
        </div>
        <p>
          Agent colors paints 1 green, 2 purple, 3 red and 4 blue, preserving the other draft
          colors. No agent integration. All painting and presets change the draft only.
        </p>
      </div>
      <p className="stream-draft-state">
        {submitted
          ? dirty
            ? 'Draft differs from the last submitted profile.'
            : 'Draft matches the last submitted profile.'
          : 'Draft has not been submitted.'}{' '}
        Start and Apply changes paint selected keys with the chosen color, then send the draft.
      </p>
      {!enabled && (
        <p>
          Streaming cannot start or apply right now. You can still edit the draft or request Stop.
        </p>
      )}
      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={!enabled || !ready || busy || running || status.state === 'error'}
          onClick={() => void transact('start')}
        >
          Start
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!enabled || !ready || busy || status.state !== 'active' || !dirty}
          onClick={() => void transact('update')}
        >
          Apply changes
        </button>
        <button type="button" className="secondary-button" onClick={() => void transact('stop')}>
          Stop
        </button>
      </div>
      <p role="status" aria-live="polite">
        {stopQueued ? 'Stop requested; waiting for the current request to finish. ' : ''}
        {status.message}{' '}
        {status.frames > 0 ? `${status.frames} frames sent (not LED readback).` : ''}
        {submitted?.mode === 'paint'
          ? ` ${Object.values(submitted.colors).filter((color) => color.toLowerCase() !== '#000000').length} colored keys in submitted frame.`
          : ''}
      </p>
    </section>
  );
}
