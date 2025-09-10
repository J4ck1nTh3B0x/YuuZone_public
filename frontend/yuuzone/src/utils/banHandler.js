/**
 * Utility function to handle ban responses from API calls
 * @param {Error} error - The error object from axios
 * @param {Function} navigate - React Router navigate function
 * @returns {boolean} - Returns true if it was a ban error and handled, false otherwise
 */
export function handleBanError(error, navigate) {
  if (error.response?.status === 403 && error.response?.data?.banned) {
    const redirectPath = error.response.data.redirect;
    if (redirectPath) {
      navigate(redirectPath);
      return true;
    }
  }
  return false;
}

/**
 * Axios interceptor to automatically handle ban responses
 * @param {Function} navigate - React Router navigate function
 * @returns {Function} - Axios response interceptor
 */
export function createBanInterceptor(navigate) {
  return (error) => {
    if (handleBanError(error, navigate)) {
      // Return a resolved promise to prevent further error handling
      return Promise.resolve({ data: { banned: true } });
    }
    return Promise.reject(error);
  };
}
