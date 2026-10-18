# F75 knob consumer-signal observation

Bounded30second Raw Input observation, exact F75 MI01 COL02 filtering, no ordinary keyboard registration, hooks, suppression, event injection or feature reports. Observer exited normally, overflowFalse, stderr empty. Original target-only event log: ../capture-tools/knob-observation.stdout.txt.

Observed3byte reports:
- ReportID02, consumer usageE9 LE16 (`02 E9 00`): Volume Increment;3events total at1530/2768/19767ms.
- ReportID02, usageEA (`02 EA 00`): Volume Decrement;3events at5298/6268/7791ms.
- ReportID02, usageE2 (`02 E2 00`): Mute;2events at10377/11281ms.
- Every nonzero report followed by `02 00 00`,16–21ms later, release/neutral.

Owner intended3clockwise then3counterclockwise then2presses. First two clockwise events appear before counterclockwise; third increment occurred late at19767ms. Do not claim exact detent/event timing correspondence for the intended sequence or infer loss. All8nonzero events have neutral counterparts. Input semantics corroborate existing owner volume/mute observations.

Device-specific observation is proven on this F75 collection; device-specific blocking is NOT. Raw Input registration kept original volume/mute behavior. Next investigation should determine whether these same events reach WH_KEYBOARD_LL and WM_APPCOMMAND, without suppressing anything initially. Global hook event VK_AF/AE/AD expected from Windows mapping but not observed here. Such hook lacks source device handle. Do not use timing correlation with Raw Input as a guaranteed device-specific suppression method.

A future pure semantic decoder should accept only reportID2 length3 and usagesE9/EA/E2/0; no arbitrary actions, no normal typing. Direction labels inferred from controlled input/order plus consumer usage meanings. Acceleration, rapid turns, held press, reconnect and other-device separation need separate tests before production.
