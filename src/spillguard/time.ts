export const formatReplayTime = (seconds: number, relative: boolean): string =>
  relative ? `+${seconds.toFixed(3)} s (relative)` : new Date(seconds * 1000).toLocaleTimeString([], { hour12: false });
