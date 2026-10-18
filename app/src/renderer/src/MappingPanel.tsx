import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Keyboard } from './components/Keyboard';
import { f75Layout } from './components/keyboard-layout';
import { mappingSources, mappingTargets, shortcutTarget, mappingLabel } from '../../shared/mapping';
import type { KeyAssignment } from '../../shared/mapping';
import './mapping.css';

const sourceIds = new Set(mappingSources.map((key) => key.id));
const labelFor = mappingLabel;

export function MappingPanel({ enabled }: { enabled: boolean }) {
  const [assignments, setAssignments] = useState<KeyAssignment[] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ctrl, setCtrl] = useState(false);
  const [shift, setShift] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState(
    'Read assignments before applying changes. Close the official AULA app first.',
  );
  const current = assignments?.find((item) => item.source === source)?.target;
  const sourceKey = mappingSources.find((key) => key.id === source);
  const canEdit = enabled && !busy && !blocked && assignments !== null && current != null;
  const keyAppearance = Object.fromEntries(
    f75Layout.keys.map((key) => {
      const assignment = assignments?.find((item) => item.source === key.id);
      return [
        key.id,
        {
          disabled: !sourceIds.has(key.id) || busy,
          description: !sourceIds.has(key.id)
            ? 'Not available for remapping'
            : assignment
              ? `Assigned to ${labelFor(assignment.target)}`
              : 'Select to remap',
        },
      ];
    }),
  );
  const filteredTargets = mappingTargets.filter((key) =>
    `${key.label} ${key.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function selectSource(id: string) {
    if (busy || !sourceIds.has(id)) return;
    setSource(id);
    setTarget(assignments?.find((item) => item.source === id)?.target ?? null);
    setQuery('');
    setCtrl(false);
    setShift(false);
  }

  async function transact(write: boolean) {
    if (!enabled || busy || blocked || (write && (!canEdit || !source || !target))) return;
    setBusy(true);
    try {
      const result = write
        ? await window.aula.setMapping(source!, target!)
        : await window.aula.readMappings();
      setAssignments(result);
      setTarget(result.find((item) => item.source === source)?.target ?? null);
      setMessage(
        write
          ? `${sourceKey?.label} → ${labelFor(target)} applied. All 512 layer bytes verified.`
          : 'Assignments read from the keyboard. Nothing was changed.',
      );
    } catch {
      setAssignments(null);
      setTarget(null);
      setBlocked(true);
      setMessage(
        'Operation failed; device state may be uncertain. No retry or restoration. Close the official app and restart Studio before reading again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const startupReadStarted = useRef(false);
  const readOnStartup = useEffectEvent(() => {
    void transact(false);
  });
  useEffect(() => {
    if (!enabled || startupReadStarted.current) return;
    startupReadStarted.current = true;
    readOnStartup();
  }, [enabled]);

  return (
    <section className="panel" aria-labelledby="mapping-title" aria-busy={busy}>
      <div className="section-header">
        <h2 id="mapping-title">Key assignments</h2>
        <button
          className="secondary-button"
          type="button"
          disabled={!enabled || busy || blocked}
          onClick={() => {
            void transact(false);
          }}
        >
          {busy ? 'Working…' : assignments ? 'Refresh assignments' : 'Read assignments'}
        </button>
      </div>
      <Keyboard
        label="Select a physical F75 key to remap"
        selectedKeys={source ? [source] : []}
        keyAppearance={keyAppearance}
        onKeySelect={(key) => selectSource(key.id)}
      />
      <p className="supporting">
        Base layer · ordinary keys and standalone Ctrl, Shift, left Win and left Alt. Only left
        Ctrl/Shift shortcuts are available. Fn, the knob and macros are not changed.
      </p>
      {!source && <p className="mapping-empty">Choose a key on the keyboard above.</p>}
      <div
        className="mapping-chooser t-panel-slide"
        data-open={source !== null}
        inert={source === null}
        aria-hidden={source === null}
      >
        <div className="section-header">
          <div>
            <h3>Remap {sourceKey?.label ?? 'key'}</h3>
            <p>Current: {assignments === null ? 'not read' : labelFor(current)}</p>
          </div>
          <span className="mapping-route" aria-live="polite">
            {sourceKey?.label ?? '—'} <span aria-hidden="true">→</span>{' '}
            {target ? labelFor(target) : 'Choose a key'}
          </span>
        </div>
        <label className="mapping-search-label" htmlFor="mapping-search">
          Find a target key
        </label>
        <input
          id="mapping-search"
          className="mapping-search"
          type="search"
          placeholder="Search letters, F-keys, navigation…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="action-row mapping-modifiers" role="group" aria-label="Shortcut modifiers">
          <button
            type="button"
            className="secondary-button"
            aria-pressed={ctrl}
            disabled={!canEdit}
            onClick={() => setCtrl(!ctrl)}
          >
            Ctrl
          </button>
          <button
            type="button"
            className="secondary-button"
            aria-pressed={shift}
            disabled={!canEdit}
            onClick={() => setShift(!shift)}
          >
            Shift
          </button>
          <p>Select modifiers, then choose a target key below.</p>
        </div>
        <div className="mapping-targets" role="group" aria-label="Target keys" tabIndex={0}>
          {filteredTargets.map((key) => (
            <button
              type="button"
              className="mapping-tile"
              key={key.id}
              aria-pressed={
                target === (key.usage === 0 ? key.id : shortcutTarget(key.id, ctrl, shift))
              }
              disabled={!canEdit}
              onClick={() =>
                setTarget(key.usage === 0 ? key.id : shortcutTarget(key.id, ctrl, shift))
              }
            >
              <span>
                {key.usage === 0 ? key.label : labelFor(shortcutTarget(key.id, ctrl, shift))}
              </span>
              {target === (key.usage === 0 ? key.id : shortcutTarget(key.id, ctrl, shift)) && (
                <span className="mapping-tick" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
          {filteredTargets.length === 0 && <p className="mapping-no-results">No matching keys.</p>}
        </div>
        <div className="action-row">
          <button
            type="button"
            className="secondary-button"
            disabled={!canEdit || source === target}
            onClick={() => setTarget(source)}
          >
            Choose original key
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!canEdit || !target || target === current}
            onClick={() => {
              void transact(true);
            }}
          >
            Apply assignment
          </button>
        </div>
        {assignments !== null && current === null && (
          <p>This key has a special or unsupported assignment. It will not be overwritten.</p>
        )}
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
