/**
 * Calculate time ago with internationalization support
 * @param {Date} date - The date to calculate from
 * @param {Function} t - Translation function from useTranslation hook
 * @returns {string} Localized time ago string
 */
export function timeAgo(date, t = null) {
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) {
    return t ? t('time.yearsAgo', { count: interval }) : interval + " years ago";
  }
  if (interval === 1) {
    return t ? t('time.yearAgo') : "1 year ago";
  }

  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return t ? t('time.monthsAgo', { count: interval }) : interval + " months ago";
  }
  if (interval === 1) {
    return t ? t('time.monthAgo') : "1 month ago";
  }

  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return t ? t('time.daysAgo', { count: interval }) : interval + " days ago";
  }
  if (interval === 1) {
    return t ? t('time.dayAgo') : "1 day ago";
  }

  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return t ? t('time.hoursAgo', { count: interval }) : interval + " hours ago";
  }
  if (interval === 1) {
    return t ? t('time.hourAgo') : "1 hour ago";
  }

  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return t ? t('time.minutesAgo', { count: interval }) : interval + " minutes ago";
  }
  if (interval === 1) {
    return t ? t('time.minuteAgo') : "1 minute ago";
  }

  if (seconds < 10) return t ? t('time.now') : "just now";

  return t ? t('time.secondsAgo', { count: Math.floor(seconds) }) : Math.floor(seconds) + " seconds ago";
}
