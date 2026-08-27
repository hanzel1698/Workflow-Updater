/**
 * Maps a two-digit design-status code ("01".."09") to a semantic tone used for badges and KPI
 * chips. Ported from android/.../ui/common/StatusColors.kt; the colours themselves live in
 * styles.css as `[data-tone]` rules.
 */
export function statusTone(code) {
  switch (code) {
    case '01':
    case '04':
      return 'info';
    case '02':
    case '05':
      return 'warning';
    case '03':
    case '06':
      return 'success';
    case '08':
    case '09':
      return 'danger';
    default:
      return 'neutral';
  }
}
