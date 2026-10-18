import { useEffect, useState } from 'react';
import { Select } from './components/Select';
import { knobProfiles } from '../../shared/knob';
import type { KnobStatus, KnobProfile } from '../../shared/knob';

export function KnobPanel({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<KnobStatus | null>(null);
  const [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<KnobProfile>('media');
  const selectedProfile = knobProfiles.find((item) => item.id === profile)!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running =
    status?.state === 'starting' || status?.state === 'active' || status?.state === 'stopping';
  useEffect(() => {
    if (!running || !enabled) return;
    let active = true;
    const timer = setInterval(() => {
      void window.aula
        .getKnobStatus()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch(() => {
          if (active) {
            setError(
              'Session connection lost. Knob interception will stop when the safety timer expires.',
            );
            setStatus(null);
          }
        });
    }, 500);
    return () => {
      active = false;
      clearInterval(timer);
      void window.aula.disableKnob().catch(() => undefined);
    };
  }, [running, enabled]);

  async function changeProfile(value: KnobProfile) {
    if (busy || !enabled) return;
    if (!running) {
      setProfile(value);
      return;
    }
    if (status?.state !== 'active') return;
    setBusy(true);
    setError('');
    try {
      const result = await window.aula.setKnobProfile(value);
      setStatus(result);
      setProfile(value);
    } catch {
      setError('Profile switch failed. Interception may be stopping; disable before trying again.');
    } finally {
      setBusy(false);
    }
  }

  async function change(start: boolean) {
    if (!enabled || busy || (start && !consent)) return;
    setBusy(true);
    setError('');
    try {
      setStatus(await (start ? window.aula.enableKnob(profile) : window.aula.disableKnob()));
    } catch {
      setError(
        'Unable to change knob session. Close Studio to release interception. If a shortcut key remains held after an input failure, press and release Ctrl and Shift.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-labelledby="knob-title">
      <h2 id="knob-title">Knob control</h2>
      <p>
        Off by default. While enabled, volume and mute keys from every device are blocked
        system-wide. Only this F75’s knob triggers the selected controls. Shortcuts act on the
        focused app; scrolling and middle click use the pointer location. Support varies by app.
      </p>
      <p>
        Turns off after 15 minutes, when Studio reloads or closes, or if the session connection is
        lost. You can also use Disable in the separate emergency window.
      </p>
      <label htmlFor="knob-profile">Control profile</label>
      <Select
        id="knob-profile"
        value={profile}
        disabled={!enabled || status?.state === 'starting' || status?.state === 'stopping' || busy}
        onChange={(value) => {
          void changeProfile(value);
        }}
        options={knobProfiles.map((item) => ({ value: item.id, label: item.label }))}
      />
      <p>
        Clockwise: {selectedProfile.clockwise} · Counterclockwise:{' '}
        {selectedProfile.counterclockwise} · Press: {selectedProfile.press}
      </p>
      <p>
        Switch profiles while enabled. Actions are skipped while Ctrl, Shift, Alt or Win is held.
        Fast turns are rate-limited. Elevated apps may reject shortcuts.
      </p>
      <label>
        <input
          type="checkbox"
          checked={consent}
          disabled={running || busy}
          onChange={(event) => setConsent(event.target.checked)}
        />{' '}
        I understand other devices’ volume/mute keys will also be blocked.
      </label>
      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={!enabled || !consent || running || busy}
          onClick={() => {
            void change(true);
          }}
        >
          Enable interception
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!enabled || busy}
          onClick={() => {
            void change(false);
          }}
        >
          Disable interception
        </button>
      </div>
      <p role="status">{error || status?.message || 'Interception off'}</p>
      <p>
        Clockwise: {status?.clockwise ?? 0} · Counterclockwise: {status?.counterclockwise ?? 0} ·
        Press: {status?.press ?? 0}
      </p>
    </section>
  );
}
