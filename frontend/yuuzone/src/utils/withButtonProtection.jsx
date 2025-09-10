import React from 'react';
import { createProtectedButton } from './buttonProtection';

/**
 * Higher-Order Component to add button protection to existing button components
 * 
 * @param {React.Component} WrappedComponent - The button component to wrap
 * @param {Object} defaultOptions - Default options for button protection
 * @returns {React.Component} Wrapped component with button protection
 */
export function withButtonProtection(WrappedComponent, defaultOptions = {}) {
  return function WithButtonProtectionComponent({
    buttonId,
    onClick,
    cooldownMs = 2000,
    actionName = 'action',
    showToast = true,
    onStart,
    onComplete,
    onError,
    className = '',
    disabled = false,
    ...props
  }) {
    // Create protected click handler
    const protectedClick = createProtectedButton(
      buttonId,
      onClick,
      {
        cooldownMs,
        actionName,
        showToast,
        onStart,
        onComplete,
        onError
      }
    );

    // Add visual feedback classes for different states
    const getEnhancedClassName = (baseClassName) => {
      const baseClasses = baseClassName || className;
      
      // Add transition classes for smooth state changes
      const transitionClasses = 'transition-all duration-200 ease-in-out';
      
      // Add focus ring for accessibility
      const focusClasses = 'focus:outline-none focus:ring-2 focus:ring-theme-blue focus:ring-opacity-50';
      
      return `${baseClasses} ${transitionClasses} ${focusClasses}`.trim();
    };

    return (
      <WrappedComponent
        {...props}
        className={getEnhancedClassName(className)}
        onClick={protectedClick}
        disabled={disabled}
      />
    );
  };
}

/**
 * Hook to add button protection to any click handler
 * 
 * @param {string} buttonId - Unique identifier for the button
 * @param {Function} onClick - Original click handler
 * @param {Object} options - Protection options
 * @returns {Function} Protected click handler
 */
export function useButtonProtection(buttonId, onClick, options = {}) {
  return createProtectedButton(buttonId, onClick, options);
}

/**
 * Utility to enhance button classes with state-based styling
 * 
 * @param {string} baseClasses - Base CSS classes
 * @param {boolean} isActive - Whether button is in active state
 * @param {boolean} isLoading - Whether button is loading
 * @param {boolean} disabled - Whether button is disabled
 * @returns {string} Enhanced CSS classes
 */
export function enhanceButtonClasses(baseClasses, isActive = false, isLoading = false, disabled = false) {
  let classes = baseClasses;
  
  if (isLoading) {
    classes += ' bg-theme-button-loading cursor-not-allowed opacity-75';
  } else if (isActive) {
    classes += ' bg-theme-button-active cursor-not-allowed opacity-75';
  } else if (disabled) {
    classes += ' bg-theme-button-disabled cursor-not-allowed opacity-50';
  }
  
  return classes.trim();
} 