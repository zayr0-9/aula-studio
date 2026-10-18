import { useRef, useState } from 'react';
import { indicatorKeys } from '../../shared/indicators';
import type { IndicatorColors, IndicatorKey } from '../../shared/indicators';

const defaults = ['#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
export function IndicatorPanel({
  enabled,
  onIndicators,
}: {
  enabled: boolean;
  onIndicators: (colors: IndicatorColors) => void;
}) {
  const [optedIn, setOptedIn] = useState(false);
  const [drafts, setDrafts] = useState(defaults);
  const [observed, setObserved] = useState<IndicatorColors | null>(null);
  const [busy, setBusy] = useState(false);
  const [faulted, setFaulted] = useState(false);
  const [status, setStatus] = useState('No per-key reads or writes until requested.');
  const locked = useRef(false);

  async function transact(key?: IndicatorKey, index = 0) {
    if (!enabled || !optedIn || locked.current || faulted) return;
    locked.current = true;
    setBusy(true);
    try {
      const hex = drafts[index];
      const result = key
        ? await window.aula.setIndicator(key, {
            red: parseInt(hex.slice(1, 3), 16),
            green: parseInt(hex.slice(3, 5), 16),
            blue: parseInt(hex.slice(5, 7), 16),
          })
        : await window.aula.readIndicators();
      setObserved(result);
      onIndicators(result);
      setStatus(
        key
          ? `${key.replace('Digit', 'Key ')} applied and read back. Other colors preserved.`
          : 'Keys 1–4 read from keyboard.',
      );
    } catch (error) {
      setFaulted(true);
      setStatus(
        error instanceof Error
          ? error.message
          : 'Per-key operation failed. Restart Studio before trying again.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-labelledby="indicator-title">
      <h2 id="indicator-title">Per-key colors</h2>
      <p>
        Manual testing for keys 1–4. First select custom/per-key mode in the official AULA app, then
        close it. Each Apply is one static write, not an animation. Colors stay on the keyboard when
        Studio closes; no automatic restore.
      </p>
      <label>
        <input
          type="checkbox"
          checked={optedIn}
          disabled={busy || faulted || !enabled}
          onChange={(event) => setOptedIn(event.target.checked)}
        />
        Enable manual per-key testing
      </label>
      <div className="control-grid">
        {indicatorKeys.map((key, index) => {
          const color = observed?.[key];
          return (
            <div className="control-group" key={key}>
              <label htmlFor={`indicator-${key}`}>Key {index + 1}</label>
              <input
                id={`indicator-${key}`}
                type="color"
                value={drafts[index]}
                disabled={!optedIn || busy || faulted || !enabled}
                onChange={(event) =>
                  setDrafts((previous) =>
                    previous.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
              />
              <span className="supporting">
                {color ? `Read: RGB ${color.red}, ${color.green}, ${color.blue}` : 'Not read'}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={!optedIn || busy || faulted || !enabled}
                onClick={() => void transact(key, index)}
              >
                Apply key {index + 1}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={!optedIn || busy || faulted || !enabled}
        onClick={() => void transact()}
      >
        Read key colors
      </button>
      <p role="status">{busy ? 'Working…' : status}</p>
    </section>
  );
}
