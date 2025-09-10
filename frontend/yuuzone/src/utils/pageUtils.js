// Utility functions for page-specific API disabling

/**
 * Check if current page should disable thread/subthread and blocked users APIs
 * @param {string} pathname - Current pathname from useLocation
 * @returns {boolean} - True if APIs should be disabled on this page
 */
export const shouldDisableThreadApis = (pathname) => {
  // Pages where thread/subthread and blocked users APIs should be disabled
  const disabledPages = [
    '/profile', // My profile
    '/subscription', // Subscription
    '/settings', // Settings
    '/login', // Login
    '/register', // Signup
    '/forgot-password', // Forgot password
    '/verify-email', // Email verification
    '/password-reset', // Password reset
    '/account-deletion', // Account deletion
    '/banned', // Banned pages
  ];
  
  // Check if current path matches any disabled page
  return disabledPages.some(page => pathname.startsWith(page));
};

/**
 * Check if current page should disable coin-related APIs
 * @param {string} pathname - Current pathname from useLocation
 * @returns {boolean} - True if coin APIs should be disabled on this page
 */
export const shouldDisableCoinApis = (pathname) => {
  // Pages where coin APIs should be disabled
  const disabledPages = [
    '/profile', // My profile
    '/subscription', // Subscription
    '/settings', // Settings
    '/login', // Login
    '/register', // Signup
    '/forgot-password', // Forgot password
    '/verify-email', // Email verification
    '/password-reset', // Password reset
    '/account-deletion', // Account deletion
    '/banned', // Banned pages
  ];
  
  // Check if current path matches any disabled page
  return disabledPages.some(page => pathname.startsWith(page));
};

/**
 * Check if current page needs fast coin updates
 * @param {string} pathname - Current pathname from useLocation
 * @returns {boolean} - True if page needs fast coin updates
 */
export const needsFastCoinUpdates = (pathname) => {
  // Pages that need fast and accurate coin updates
  const fastUpdatePages = [
    '/coin-shop', // Coin shop - needs real-time balance and package updates
  ];
  
  return fastUpdatePages.some(page => pathname.startsWith(page));
}; 