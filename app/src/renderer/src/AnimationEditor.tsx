import { useEffect, useId, useRef, useState } from 'react';
import type { AnimationSequence } from '../../shared/animation';
import { animationColors } from '../../shared/animation';
import { F75_DIRECT_KEYS } from '../../protocol/f75-direct';
import type { F75DirectKey } from '../../protocol/f75-direct';
import { Keyboard } from './components/Keyboard';
import type { KeyboardKeyAppearance } from './components/Keyboard';
import { readAnimationPresets, writeAnimationPresets } from './animation-presets';
import type { AnimationPreset } from './animation-presets';
import './animation.css';

const keys = F75_DIRECT_KEYS.map(({ key }) => key);
const statusKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const;
const statusDefaults = ['#00ff00', '#8000ff', '#ff0000', '#0000ff'];
const snap = (ms: number) => Math.max(800, Math.min(60000, Math.round(ms / 800) * 800));
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function AnimationEditor({
  value,
  onChange,
  color,
  brightness,
}: {
  value: AnimationSequence;
  onChange: (sequence: AnimationSequence) => void;
  color: string;
  brightness: number;
}) {
  const id = useId();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<F75DirectKey[]>([]);
  const [preview, setPreview] = useState<{ sequence: AnimationSequence; index: number } | null>(
    null,
  );
  const [saved] = useState(() => {
    try {
      return {
        library: readAnimationPresets(localStorage),
        message: 'Presets are saved locally in this app.',
      };
    } catch {
      return {
        library: [] as AnimationPreset[],
        message: 'Saved presets could not be read. Existing storage has not been changed.',
      };
    }
  });
  const [library, setLibrary] = useState<AnimationPreset[]>(saved.library);
  const [name, setName] = useState('My animation');
  const [presetName, setPresetName] = useState('');
  const [message, setMessage] = useState(saved.message);
  const drag = useRef<{ x: number; duration: number; index: number } | null>(null);
  const frameIndex = Math.min(index, value.frames.length - 1);
  const frame = value.frames[frameIndex];
  const showing = preview?.sequence ?? value;
  const showingIndex = preview?.index ?? frameIndex;
  const displayed = animationColors(showing, showingIndex);
  const total = value.frames.reduce((sum, item) => sum + item.durationMs, 0);

  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(() => {
      setPreview((current) => {
        if (!current) return null;
        const next = current.index + 1;
        if (next < current.sequence.frames.length) return { ...current, index: next };
        return current.sequence.loop ? { ...current, index: 0 } : null;
      });
    }, preview.sequence.frames[preview.index].durationMs);
    return () => window.clearTimeout(timer);
  }, [preview]);

  function change(next: AnimationSequence) {
    setPreview(null);
    onChange(next);
  }
  function editFrame(patch: Partial<AnimationSequence['frames'][number]>) {
    change({
      ...value,
      frames: value.frames.map((item, i) => (i === frameIndex ? { ...item, ...patch } : item)),
    });
  }
  function duration(at: number, ms: number) {
    change({
      ...value,
      frames: value.frames.map((item, i) => (i === at ? { ...item, durationMs: snap(ms) } : item)),
    });
  }
  function paint(targets: readonly F75DirectKey[], hex: string) {
    editFrame({
      colors: { ...frame.colors, ...Object.fromEntries(targets.map((key) => [key, hex])) },
    });
  }
  function duplicate(blank: boolean) {
    const frames = [...value.frames];
    const copy = structuredClone(frame);
    if (blank)
      copy.colors = Object.fromEntries(keys.map((key) => [key, '#000000'])) as typeof copy.colors;
    frames.splice(frameIndex + 1, 0, copy);
    change({ ...value, frames });
    setIndex(frameIndex + 1);
  }
  function move(offset: number) {
    const frames = [...value.frames];
    [frames[frameIndex], frames[frameIndex + offset]] = [
      frames[frameIndex + offset],
      frames[frameIndex],
    ];
    change({ ...value, frames });
    setIndex(frameIndex + offset);
  }
  function saveLibrary(next: AnimationPreset[]) {
    if (saved.message.startsWith('Saved presets could not')) {
      setMessage(
        'Preset storage is unreadable; saving is blocked to preserve the existing library.',
      );
      return false;
    }
    try {
      writeAnimationPresets(localStorage, next);
      setLibrary(next);
      setMessage('Preset library saved locally.');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save presets');
      return false;
    }
  }
  const appearance: Record<string, KeyboardKeyAppearance> = { Knob: { disabled: true } };
  for (const key of keys) {
    const hex = displayed[key];
    appearance[key] = {
      color: `#${[1, 3, 5]
        .map((offset) =>
          Math.round((parseInt(hex.slice(offset, offset + 2), 16) * brightness) / 100)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`,
      description: `${hex}${selected.includes(key) ? ', selected' : ''}`,
    };
  }

  return (
    <div className="animation-editor">
      <div className="section-header">
        <h3>Custom animation</h3>
        <span>
          {value.frames.length} frames · {seconds(total)}
        </span>
      </div>
      <p>
        Stepped frames, minimum 800 ms. Drag a frame’s right edge to change its hold time. Preview
        is local only; Start below plays on the keyboard. Edits stay draft until Apply changes.
      </p>
      <div className="action-row">
        <label>
          <input
            type="checkbox"
            checked={value.loop}
            onChange={(event) => change({ ...value, loop: event.target.checked })}
          />{' '}
          Loop
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setPreview({ sequence: structuredClone(value), index: 0 })}
        >
          Preview animation
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!preview}
          onClick={() => setPreview(null)}
        >
          Stop preview
        </button>
        <span role="status">
          {preview
            ? `Local preview · frame ${preview.index + 1}`
            : `Editing frame ${frameIndex + 1}`}
        </span>
      </div>
      <div className="animation-timeline-scroll" role="group" aria-label="Animation timeline">
        <div className="animation-timeline">
          {value.frames.map((item, i) => {
            const at = value.frames.slice(0, i).reduce((sum, frame) => sum + frame.durationMs, 0);
            const swatches = [...new Set(Object.values(item.colors))]
              .filter((hex) => hex !== '#000000')
              .slice(0, 6);
            return (
              <div
                key={i}
                className={`animation-frame${i === frameIndex ? ' is-selected' : ''}${preview?.index === i ? ' is-playing' : ''}`}
                style={{ width: `${item.durationMs / 10}px` }}
              >
                <button
                  type="button"
                  className="animation-frame-select"
                  aria-pressed={i === frameIndex}
                  aria-label={`Frame ${i + 1}, ${seconds(item.durationMs)}, starts ${seconds(at)}`}
                  onClick={() => {
                    setPreview(null);
                    setIndex(i);
                  }}
                >
                  <span className="animation-time">{seconds(at)}</span>
                  <strong>Frame {i + 1}</strong>
                  <span className="animation-swatches" aria-hidden="true">
                    {swatches.map((hex) => (
                      <i key={hex} style={{ background: hex }} />
                    ))}
                  </span>
                  <span>{seconds(item.durationMs)}</span>
                </button>
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label={`Frame ${i + 1} duration`}
                  aria-valuemin={800}
                  aria-valuemax={60000}
                  aria-valuenow={item.durationMs}
                  aria-valuetext={seconds(item.durationMs)}
                  className="animation-resize"
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                      event.preventDefault();
                      duration(
                        i,
                        event.key === 'Home'
                          ? 800
                          : event.key === 'End'
                            ? 60000
                            : item.durationMs + (event.key === 'ArrowRight' ? 800 : -800),
                      );
                    }
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = { x: event.clientX, duration: item.durationMs, index: i };
                    setIndex(i);
                  }}
                  onPointerMove={(event) => {
                    if (drag.current?.index === i)
                      duration(i, drag.current.duration + (event.clientX - drag.current.x) * 10);
                  }}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  onLostPointerCapture={() => {
                    drag.current = null;
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="control-group">
        <label htmlFor={`${id}-duration`}>
          Frame {frameIndex + 1} hold time · {seconds(frame.durationMs)}
        </label>
        <input
          id={`${id}-duration`}
          type="range"
          min={800}
          max={60000}
          step={800}
          value={frame.durationMs}
          onChange={(event) => editFrame({ durationMs: Number(event.target.value) })}
        />
      </div>
      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          disabled={value.frames.length >= 64}
          onClick={() => duplicate(true)}
        >
          Add blank frame
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={value.frames.length >= 64}
          onClick={() => duplicate(false)}
        >
          Duplicate frame
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={value.frames.length === 1}
          onClick={() => {
            change({ ...value, frames: value.frames.filter((_, i) => i !== frameIndex) });
            setIndex(Math.max(0, frameIndex - 1));
          }}
        >
          Delete frame
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={frameIndex === 0}
          onClick={() => move(-1)}
        >
          Move earlier
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={frameIndex === value.frames.length - 1}
          onClick={() => move(1)}
        >
          Move later
        </button>
      </div>
      <Keyboard
        label="Animation frame keyboard"
        selectedKeys={selected}
        keyAppearance={appearance}
        onKeySelect={({ id: key }) => {
          if (keys.includes(key as F75DirectKey))
            setSelected((previous) =>
              previous.includes(key as F75DirectKey)
                ? previous.filter((item) => item !== key)
                : [...previous, key as F75DirectKey],
            );
        }}
      />
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={() => setSelected([...keys])}>
          Select all keys
        </button>
        <button type="button" className="secondary-button" onClick={() => setSelected([])}>
          Deselect keys
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!selected.length}
          onClick={() => paint(selected, color)}
        >
          Paint selected keys
        </button>
        <button type="button" className="secondary-button" onClick={() => paint(keys, color)}>
          Fill frame
        </button>
        <button type="button" className="secondary-button" onClick={() => paint(keys, '#000000')}>
          Clear frame
        </button>
        <span>{selected.length} keys selected</span>
      </div>
      <details>
        <summary>Status-color overrides · keys 1–4</summary>
        <p>
          Optional manual colors take priority in every frame. No agent integration. Brightness
          applies to overrides too.
        </p>
        <div className="animation-overrides">
          {statusKeys.map((key, i) => (
            <div key={key}>
              <label>
                <input
                  type="checkbox"
                  checked={Object.hasOwn(value.overrides, key)}
                  onChange={(event) => {
                    const overrides = { ...value.overrides };
                    if (event.target.checked) overrides[key] = statusDefaults[i];
                    else delete overrides[key];
                    change({ ...value, overrides });
                  }}
                />
                Key {i + 1}
              </label>
              <input
                type="color"
                aria-label={`Key ${i + 1} override color`}
                disabled={!Object.hasOwn(value.overrides, key)}
                value={value.overrides[key] ?? statusDefaults[i]}
                onChange={(event) =>
                  change({ ...value, overrides: { ...value.overrides, [key]: event.target.value } })
                }
              />
            </div>
          ))}
        </div>
      </details>
      <div className="animation-presets">
        <h3>Saved animations</h3>
        <label htmlFor={`${id}-name`}>Preset name</label>
        <input
          id={`${id}-name`}
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) {
              setMessage('Enter a preset name');
              return;
            }
            const next = library.filter((item) => item.name !== trimmed);
            next.push({ name: trimmed, animation: structuredClone(value) });
            if (saveLibrary(next)) setPresetName(trimmed);
          }}
        >
          Save preset
        </button>
        <label htmlFor={`${id}-presets`}>Preset</label>
        <select
          id={`${id}-presets`}
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
        >
          <option value="">Choose a preset</option>
          {library.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-button"
          disabled={!presetName}
          onClick={() => {
            const preset = library.find((item) => item.name === presetName);
            if (preset) {
              change(structuredClone(preset.animation));
              setName(preset.name);
              setIndex(0);
              setMessage('Preset loaded into draft; no hardware changes.');
            }
          }}
        >
          Load preset
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!presetName}
          onClick={() => {
            if (saveLibrary(library.filter((item) => item.name !== presetName))) setPresetName('');
          }}
        >
          Delete preset
        </button>
        <p role="status">{message}</p>
      </div>
    </div>
  );
}
