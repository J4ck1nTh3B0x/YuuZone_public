import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProtectedButton from './ProtectedButton';
import { useProtectedButton, createProtectedButton } from '../utils/buttonProtection';
import { withButtonProtection } from '../utils/withButtonProtection';

/**
 * Example component demonstrating different ways to implement button protection
 * This shows how to prevent spamming and provide visual feedback with darker shades
 */
const ButtonProtectionExample = () => {
  const { t } = useTranslation();
  const [result, setResult] = useState('');

  // Example 1: Using the ProtectedButton component
  const handleProtectedButtonClick = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setResult('ProtectedButton clicked successfully!');
  };

  // Example 2: Using the useProtectedButton hook
  const { isActive: isHookActive, isLoading: isHookLoading, onClick: protectedHookClick } = useProtectedButton(
    'hook-example',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setResult('useProtectedButton hook clicked successfully!');
    },
    {
      cooldownMs: 3000,
      actionName: 'hook action',
      showToast: true
    }
  );

  // Example 3: Using createProtectedButton utility
  const handleUtilityClick = createProtectedButton(
    'utility-example',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setResult('createProtectedButton utility clicked successfully!');
    },
    {
      cooldownMs: 2500,
      actionName: 'utility action',
      showToast: true
    }
  );

  // Example 4: Manual implementation with state
  const [isManualActive, setIsManualActive] = useState(false);
  const [isManualLoading, setIsManualLoading] = useState(false);

  const handleManualClick = async () => {
    if (isManualActive || isManualLoading) {
      return;
    }

    setIsManualActive(true);
    setIsManualLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1800));
      setResult('Manual implementation clicked successfully!');
    } catch (error) {
      console.error('Manual click failed:', error);
    } finally {
      setIsManualLoading(false);
      // Reset active state after cooldown
      setTimeout(() => setIsManualActive(false), 2000);
    }
  };

  // Example 5: Wrapped button component
  const WrappedButton = withButtonProtection('button', {
    cooldownMs: 1500,
    actionName: 'wrapped action'
  });

  const handleWrappedClick = async () => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    setResult('Wrapped button clicked successfully!');
  };

  return (
    <div className="p-6 bg-theme-less-white dark:bg-theme-dark-bg rounded-lg">
      <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-6">
        Button Protection Examples
      </h2>
      
      <div className="space-y-6">
        {/* Example 1: ProtectedButton Component */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
            1. ProtectedButton Component
          </h3>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            Complete button component with built-in protection and visual feedback
          </p>
          <ProtectedButton
            buttonId="protected-button-example"
            onClick={handleProtectedButtonClick}
            variant="primary"
            size="md"
            cooldownMs={2000}
            actionName="protected button action"
          >
            Protected Button
          </ProtectedButton>
        </div>

        {/* Example 2: useProtectedButton Hook */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
            2. useProtectedButton Hook
          </h3>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            Hook-based approach for custom button implementations
          </p>
          <button
            onClick={protectedHookClick}
            disabled={isHookActive || isHookLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 ease-in-out ${
              isHookActive || isHookLoading 
                ? 'bg-theme-button-active cursor-not-allowed opacity-75' 
                : 'bg-theme-blue hover:bg-theme-blue-dark'
            }`}
          >
            {isHookLoading && (
              <div className="inline-flex items-center">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading...
              </div>
            )}
            {!isHookLoading && 'Hook Button'}
          </button>
        </div>

        {/* Example 3: createProtectedButton Utility */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
            3. createProtectedButton Utility
          </h3>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            Utility function for simple click protection
          </p>
          <button
            onClick={handleUtilityClick}
            className="px-4 py-2 text-sm font-medium text-white bg-theme-blue hover:bg-theme-blue-dark rounded-lg transition-all duration-200 ease-in-out"
          >
            Utility Button
          </button>
        </div>

        {/* Example 4: Manual Implementation */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
            4. Manual Implementation
          </h3>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            Manual state management with visual feedback
          </p>
          <button
            onClick={handleManualClick}
            disabled={isManualActive || isManualLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 ease-in-out ${
              isManualActive || isManualLoading 
                ? 'bg-theme-button-active cursor-not-allowed opacity-75' 
                : 'bg-theme-blue hover:bg-theme-blue-dark'
            }`}
          >
            {isManualLoading && (
              <div className="inline-flex items-center">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </div>
            )}
            {!isManualLoading && 'Manual Button'}
          </button>
        </div>

        {/* Example 5: Wrapped Button */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
            5. Wrapped Button Component
          </h3>
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            Higher-order component wrapping existing buttons
          </p>
          <WrappedButton
            buttonId="wrapped-example"
            onClick={handleWrappedClick}
            className="px-4 py-2 text-sm font-medium text-white bg-theme-blue hover:bg-theme-blue-dark rounded-lg"
          >
            Wrapped Button
          </WrappedButton>
        </div>

        {/* Result Display */}
        {result && (
          <div className="mt-6 p-4 bg-theme-success-light border border-theme-success-border rounded-lg">
            <p className="text-theme-success font-medium">{result}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-theme-bg-secondary dark:bg-theme-dark-bg-secondary rounded-lg border border-theme-border-light dark:border-theme-dark-border">
          <h4 className="font-semibold text-theme-text-primary dark:text-theme-dark-text mb-2">
            How it works:
          </h4>
          <ul className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary space-y-1">
            <li>• Click any button to see the visual feedback (darker shade)</li>
            <li>• Try clicking multiple times quickly - you'll see spam prevention</li>
            <li>• Each button has a different cooldown period</li>
            <li>• Toast notifications appear when trying to spam</li>
            <li>• Dark mode support is included</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ButtonProtectionExample; 