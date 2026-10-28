import { expect, it } from 'vitest';
import { formatReplayTime } from './time';

it('labels sanitized timestamps as elapsed seconds rather than local wall time', () => {
  expect(formatReplayTime(0, true)).toBe('+0.000 s (relative)');
  expect(formatReplayTime(1.2345, true)).toBe('+1.234 s (relative)');
  expect(formatReplayTime(1792170000, false)).not.toContain('relative');
});
