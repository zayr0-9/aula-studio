/** Corrected model1 KB.ini + Text/en/text.xml. Metadata only, NOT a write allowlist.
 * Label comes from LedOpt row's tc_kb_ledN, not tuple's second numeric field.
 * Mask visibility is inferred from screenshot correspondence, not loader tracing.
 */
export const EFFECT_CATALOG = [
  { id: 1, name: 'Fixed_on', captured: true, hidden: false },
  { id: 2, name: 'Respire', captured: false, hidden: false },
  { id: 3, name: 'Rainbow', captured: false, hidden: false },
  { id: 4, name: 'Flash_away', captured: false, hidden: false },
  { id: 5, name: 'Raindrops', captured: false, hidden: false },
  { id: 6, name: 'Rainbow_wheel', captured: false, hidden: true },
  { id: 7, name: 'Ripples_shining', captured: false, hidden: false },
  { id: 8, name: 'Stars_twinkle', captured: false, hidden: false },
  { id: 9, name: 'Shadow_disappear', captured: false, hidden: true },
  { id: 10, name: 'Retro_snake', captured: false, hidden: false },
  { id: 11, name: 'Neon_stream', captured: true, hidden: false },
  { id: 12, name: 'Reaction', captured: false, hidden: false },
  { id: 13, name: 'Sine_wave', captured: false, hidden: false },
  { id: 14, name: 'Retinue scanning', captured: false, hidden: true },
  { id: 15, name: 'Rotating windmill', captured: false, hidden: false },
  { id: 16, name: 'Colorful waterfall', captured: false, hidden: false },
  { id: 17, name: 'Blossoming', captured: true, hidden: false },
  { id: 18, name: 'Rotating storm', captured: false, hidden: true },
] as const;
// Self-define row19 has hardware selector21; OFF row20 has selector0.
// Both intentionally excluded from ordinary-animation expansion.
