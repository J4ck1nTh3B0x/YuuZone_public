import React from 'react';
import PropTypes from 'prop-types';
import { useProtectedButton, getButtonClasses } from '../utils/buttonProtection';

/**
 * ProtectedButton - A button component that prevents spamming and provides visual feedback
 * 
 * Features:
 * - Prevents multiple clicks during action execution
 * - Visual feedback with darker shade when clicked
 * - Loading state with spinner
 * - Cooldown period after action completion
 * - Toast notifications for spam prevention
 * - Dark mode support
 */
const ProtectedButton = ({
  buttonId,
  onClick,
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  cooldownMs = 2000,
  actionName = 'action',
  showToast = true,
  onStart,
  onComplete,
  onError,
  ...props
}) => {
  const { isActive, isLoading, onClick: protectedClick } = useProtectedButton(
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

  // Base classes for different variants
  const variantClasses = {
    primary: 'bg-theme-blue hover:bg-theme-blue-dark text-white',
    secondary: 'bg-theme-bg-secondary hover:bg-theme-bg-hover text-theme-text-primary dark:bg-theme-dark-bg dark:hover:bg-theme-dark-hover dark:text-theme-dark-text',
    danger: 'bg-theme-error hover:bg-red-700 text-white',
    success: 'bg-theme-success hover:bg-emerald-700 text-white',
    outline: 'bg-transparent border border-theme-border-medium hover:bg-theme-bg-secondary text-theme-text-primary dark:border-theme-dark-border dark:hover:bg-theme-dark-bg dark:text-theme-dark-text'
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };

  // State-specific classes
  const activeClasses = 'bg-theme-button-active cursor-not-allowed opacity-75';
  const loadingClasses = 'bg-theme-button-loading cursor-not-allowed opacity-75';
  const disabledClasses = 'bg-theme-button-disabled cursor-not-allowed opacity-50';

  // Combine all classes
  const baseClasses = `
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    font-medium rounded-lg transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-theme-blue focus:ring-opacity-50
    disabled:opacity-50 disabled:cursor-not-allowed
    ${className}
  `.trim();

  const finalClasses = getButtonClasses(
    { isActive, isLoading, disabled },
    baseClasses,
    activeClasses,
    loadingClasses,
    disabledClasses
  );

  return (
    <button
      {...props}
      className={finalClasses}
      onClick={protectedClick}
      disabled={disabled || isActive || isLoading}
    >
      {isLoading && (
        <div className="inline-flex items-center">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
          {children}
        </div>
      )}
      {!isLoading && children}
    </button>
  );
};

ProtectedButton.propTypes = {
  buttonId: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'outline']),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  disabled: PropTypes.bool,
  cooldownMs: PropTypes.number,
  actionName: PropTypes.string,
  showToast: PropTypes.bool,
  onStart: PropTypes.func,
  onComplete: PropTypes.func,
  onError: PropTypes.func
};

export default ProtectedButton; 