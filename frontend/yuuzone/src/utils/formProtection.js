import { toast } from 'react-toastify';

// Store for tracking form submission states
const formSubmissionStates = new Map();

/**
 * Debounce function to prevent rapid successive calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Prevent duplicate form submissions
 * @param {string} formId - Unique identifier for the form
 * @param {Function} submitFunction - The actual submit function
 * @param {number} cooldownMs - Cooldown period in milliseconds (default: 2000)
 * @returns {Function} Protected submit function
 */
export function preventDuplicateSubmission(formId, submitFunction, cooldownMs = 2000) {
  return async (...args) => {
    const now = Date.now();
    const lastSubmission = formSubmissionStates.get(formId);
    
    if (lastSubmission && (now - lastSubmission) < cooldownMs) {
      const remainingTime = Math.ceil((cooldownMs - (now - lastSubmission)) / 1000);
      toast.error(`Please wait ${remainingTime} second${remainingTime !== 1 ? 's' : ''} before submitting again.`);
      return;
    }
    
    formSubmissionStates.set(formId, now);
    
    try {
      await submitFunction(...args);
    } catch (error) {
      // Remove the submission state on error so user can retry
      formSubmissionStates.delete(formId);
      throw error;
    }
  };
}

/**
 * Handle rate limiting errors from API responses
 * @param {Error} error - The error object from API call
 * @param {string} action - The action being performed (e.g., 'login', 'post')
 */
export function handleRateLimitError(error, action) {
  if (error.response?.status === 429) {
    const data = error.response.data;
    const remainingTime = data.remaining_time || 0;
    const minutes = Math.floor(remainingTime / 60);
    const seconds = Math.ceil(remainingTime % 60);
    
    let timeMessage = '';
    if (minutes > 0) {
      timeMessage = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      if (seconds > 0) {
        timeMessage += ` and ${seconds} second${seconds !== 1 ? 's' : ''}`;
      }
    } else {
      timeMessage = `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    
    toast.error(`Too many ${action} attempts. Please try again in ${timeMessage}.`);
    return true;
  }
  
  if (error.response?.status === 409 && error.response.data?.error === 'duplicate_submission') {
    toast.error('This appears to be a duplicate submission. Please wait before trying again.');
    return true;
  }
  
  return false;
}

/**
 * Create a protected form submission handler
 * @param {string} formId - Unique identifier for the form
 * @param {Function} submitFunction - The actual submit function
 * @param {string} action - The action being performed (for error messages)
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {Function} Protected submit function with error handling
 */
export function createProtectedSubmitHandler(formId, submitFunction, action, cooldownMs = 2000) {
  const protectedSubmit = preventDuplicateSubmission(formId, submitFunction, cooldownMs);
  
  return async (...args) => {
    try {
      await protectedSubmit(...args);
    } catch (error) {
      // Handle rate limiting and duplicate submission errors
      if (!handleRateLimitError(error, action)) {
        // Re-throw other errors for normal error handling
        throw error;
      }
    }
  };
}

/**
 * Disable form elements during submission
 * @param {HTMLFormElement} form - The form element
 * @param {boolean} disabled - Whether to disable or enable the form
 */
export function setFormDisabled(form, disabled) {
  const inputs = form.querySelectorAll('input, textarea, select, button');
  inputs.forEach(input => {
    if (input.type !== 'hidden') {
      input.disabled = disabled;
    }
  });
}

/**
 * Create a loading state manager for forms
 * @param {string} formId - Unique identifier for the form
 * @returns {Object} Loading state manager
 */
export function createFormLoadingManager(formId) {
  let isLoading = false;
  
  return {
    start: () => {
      isLoading = true;
      const form = document.querySelector(`[data-form-id="${formId}"]`);
      if (form) {
        setFormDisabled(form, true);
      }
    },
    stop: () => {
      isLoading = false;
      const form = document.querySelector(`[data-form-id="${formId}"]`);
      if (form) {
        setFormDisabled(form, false);
      }
    },
    get isLoading() {
      return isLoading;
    }
  };
}

/**
 * Clear form submission state
 * @param {string} formId - Unique identifier for the form
 */
export function clearFormSubmissionState(formId) {
  formSubmissionStates.delete(formId);
}

/**
 * Get remaining cooldown time for a form
 * @param {string} formId - Unique identifier for the form
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {number} Remaining time in milliseconds
 */
export function getRemainingCooldown(formId, cooldownMs = 2000) {
  const lastSubmission = formSubmissionStates.get(formId);
  if (!lastSubmission) return 0;
  
  const now = Date.now();
  const elapsed = now - lastSubmission;
  return Math.max(0, cooldownMs - elapsed);
}

/**
 * Check if a form is in cooldown period
 * @param {string} formId - Unique identifier for the form
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {boolean} True if form is in cooldown
 */
export function isFormInCooldown(formId, cooldownMs = 2000) {
  return getRemainingCooldown(formId, cooldownMs) > 0;
} 