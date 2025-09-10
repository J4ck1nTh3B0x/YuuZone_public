/**
 * Date formatting utilities with internationalization support
 */

/**
 * Format date and time according to the current language
 * @param {Date} date - The date to format
 * @param {string} language - Language code (en, ja, vi)
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, language = 'en') {
  if (!date || !(date instanceof Date)) {
    return '';
  }

  const options = {
    en: {
      dateOptions: {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      timeOptions: {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      },
      locale: 'en-US'
    },
    ja: {
      dateOptions: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        weekday: 'short'
      },
      timeOptions: {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      },
      locale: 'ja-JP'
    },
    vi: {
      dateOptions: {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      timeOptions: {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      },
      locale: 'vi-VN'
    }
  };

  const config = options[language] || options.en;
  
  try {
    const dateStr = date.toLocaleDateString(config.locale, config.dateOptions);
    const timeStr = date.toLocaleTimeString(config.locale, config.timeOptions);
    
    return `${dateStr} ${timeStr}`;
  } catch {
    // Fallback to English format if locale is not supported
    const dateStr = date.toLocaleDateString('en-US', options.en.dateOptions);
    const timeStr = date.toLocaleTimeString('en-US', options.en.timeOptions);
    return `${dateStr} ${timeStr}`;
  }
}

/**
 * Format date only (without time) according to the current language
 * @param {Date} date - The date to format
 * @param {string} language - Language code (en, ja, vi)
 * @returns {string} Formatted date string
 */
export function formatDate(date, language = 'en') {
  if (!date || !(date instanceof Date)) {
    return '';
  }

  const options = {
    en: { locale: 'en-US', options: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' } },
    ja: { locale: 'ja-JP', options: { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' } },
    vi: { locale: 'vi-VN', options: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' } }
  };

  const config = options[language] || options.en;
  
  try {
    return date.toLocaleDateString(config.locale, config.options);
  } catch {
    // Fallback to English format
    return date.toLocaleDateString('en-US', options.en.options);
  }
}

/**
 * Format time only (without date) according to the current language
 * @param {Date} date - The date to format
 * @param {string} language - Language code (en, ja, vi)
 * @returns {string} Formatted time string
 */
export function formatTime(date, language = 'en') {
  if (!date || !(date instanceof Date)) {
    return '';
  }

  const options = {
    en: { locale: 'en-US', options: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true } },
    ja: { locale: 'ja-JP', options: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } },
    vi: { locale: 'vi-VN', options: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } }
  };

  const config = options[language] || options.en;
  
  try {
    return date.toLocaleTimeString(config.locale, config.options);
  } catch {
    // Fallback to English format
    return date.toLocaleTimeString('en-US', options.en.options);
  }
}
