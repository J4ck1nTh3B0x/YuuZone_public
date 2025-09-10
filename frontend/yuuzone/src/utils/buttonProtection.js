import { toast } from 'react-toastify';

// Store for tracking button click states
const buttonClickStates = new Map();

/**
 * Button protection utility to prevent spamming and provide visual feedback
 * @param {string} buttonId - Unique identifier for the button
 * @param {Function} onClickFunction - The actual click function
 * @param {Object} options - Configuration options
 * @param {number} options.cooldownMs - Cooldown period in milliseconds (default: 2000)
 * @param {string} options.actionName - Name of the action for error messages (default: 'action')
 * @param {boolean} options.showToast - Whether to show toast messages (default: true)
 * @param {Function} options.onStart - Callback when button action starts
 * @param {Function} options.onComplete - Callback when button action completes
 * @param {Function} options.onError - Callback when button action errors
 * @returns {Function} Protected click function
 */
export function createProtectedButton(
  buttonId, 
  onClickFunction, 
  options = {}
) {
  const {
    cooldownMs = 2000,
    actionName = 'action',
    showToast = true,
    onStart,
    onComplete,
    onError
  } = options;

  return async (...args) => {
    const now = Date.now();
    const buttonState = buttonClickStates.get(buttonId);
    
    // Check if button is in cooldown
    if (buttonState && buttonState.isActive) {
      if (showToast) {
        const remainingTime = Math.ceil((cooldownMs - (now - buttonState.startTime)) / 1000);
        toast.error(`Please wait ${remainingTime} second${remainingTime !== 1 ? 's' : ''} before ${actionName} again.`);
      }
      return;
    }

    // Set button as active
    buttonClickStates.set(buttonId, {
      isActive: true,
      startTime: now
    });

    // Call onStart callback
    if (onStart) {
      onStart();
    }

    try {
      // Execute the actual function
      const result = await onClickFunction(...args);
      
      // Call onComplete callback
      if (onComplete) {
        onComplete(result);
      }
      
      return result;
    } catch (error) {
      // Call onError callback
      if (onError) {
        onError(error);
      }
      
      // Remove button state on error so user can retry
      buttonClickStates.delete(buttonId);
      throw error;
    } finally {
      // Set cooldown timer
      setTimeout(() => {
        buttonClickStates.delete(buttonId);
      }, cooldownMs);
    }
  };
}

/**
 * React hook for button protection with visual feedback
 * @param {string} buttonId - Unique identifier for the button
 * @param {Function} onClickFunction - The actual click function
 * @param {Object} options - Configuration options
 * @returns {Object} Button state and protected click function
 */
export function useProtectedButton(buttonId, onClickFunction, options = {}) {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const protectedClick = createProtectedButton(buttonId, onClickFunction, {
    ...options,
    onStart: () => {
      setIsActive(true);
      setIsLoading(true);
      if (options.onStart) options.onStart();
    },
    onComplete: (result) => {
      setIsLoading(false);
      if (options.onComplete) options.onComplete(result);
    },
    onError: (error) => {
      setIsActive(false);
      setIsLoading(false);
      if (options.onError) options.onError(error);
    }
  });

  // Reset active state after cooldown
  useEffect(() => {
    if (isActive && !isLoading) {
      const timer = setTimeout(() => {
        setIsActive(false);
      }, options.cooldownMs || 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isActive, isLoading, options.cooldownMs]);

  return {
    isActive,
    isLoading,
    onClick: protectedClick
  };
}

/**
 * Get button CSS classes based on state
 * @param {Object} state - Button state object
 * @param {string} baseClasses - Base CSS classes
 * @param {string} activeClasses - CSS classes when button is active/clicked
 * @param {string} loadingClasses - CSS classes when button is loading
 * @param {string} disabledClasses - CSS classes when button is disabled
 * @returns {string} Combined CSS classes
 */
export function getButtonClasses(state, baseClasses, activeClasses = '', loadingClasses = '', disabledClasses = '') {
  let classes = baseClasses;
  
  if (state.isLoading) {
    classes += ` ${loadingClasses}`;
  } else if (state.isActive) {
    classes += ` ${activeClasses}`;
  } else if (state.disabled) {
    classes += ` ${disabledClasses}`;
  }
  
  return classes.trim();
}

/**
 * Clear button state (useful for cleanup)
 * @param {string} buttonId - Unique identifier for the button
 */
export function clearButtonState(buttonId) {
  buttonClickStates.delete(buttonId);
}

/**
 * Get remaining cooldown time for a button
 * @param {string} buttonId - Unique identifier for the button
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {number} Remaining time in milliseconds
 */
export function getButtonRemainingCooldown(buttonId, cooldownMs = 2000) {
  const buttonState = buttonClickStates.get(buttonId);
  if (!buttonState || !buttonState.isActive) return 0;
  
  const now = Date.now();
  const elapsed = now - buttonState.startTime;
  return Math.max(0, cooldownMs - elapsed);
}

/**
 * Check if a button is in cooldown period
 * @param {string} buttonId - Unique identifier for the button
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {boolean} True if button is in cooldown
 */
export function isButtonInCooldown(buttonId, cooldownMs = 2000) {
  return getButtonRemainingCooldown(buttonId, cooldownMs) > 0;
}

// Import React hooks for the hook version
import { useState, useEffect } from 'react'; 