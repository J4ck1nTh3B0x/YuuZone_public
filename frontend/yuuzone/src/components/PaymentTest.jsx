import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthConsumer from './AuthContext';

const PaymentTest = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = AuthConsumer();
  const [testing, setTesting] = useState(false);

  const testPaymentCompletion = async (paymentType) => {
    if (!isAuthenticated) {
      toast.error('Please log in to test payment completion');
      return;
    }

    try {
      setTesting(true);
      const response = await axios.post('/api/subscriptions/test-payment-completion', {
        payment_type: paymentType,
        amount: paymentType === 'coin' ? 500 : 100000
      });

      if (response.data.success) {
        toast.success(`Test ${paymentType} payment completion event sent!`);
      } else {
        toast.error(response.data.error || 'Test failed');
      }
    } catch (error) {
      console.error('Test payment completion error:', error);
      toast.error(error.response?.data?.error || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-theme-dark-card p-4 rounded-lg shadow-lg border border-gray-200 dark:border-theme-dark-border">
        <h3 className="text-sm font-semibold text-theme-text-primary dark:text-theme-dark-text mb-2">
          Payment Test
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => testPaymentCompletion('coin')}
            disabled={testing}
            className="w-full px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Coin Payment'}
          </button>
          <button
            onClick={() => testPaymentCompletion('subscription')}
            disabled={testing}
            className="w-full px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Subscription'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentTest; 