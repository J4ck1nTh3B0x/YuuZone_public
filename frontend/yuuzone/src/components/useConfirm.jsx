import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

const ConfirmContext = createContext();

const NamedConfirmProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolveRef, setResolveRef] = useState(null);
  const [message, setMessage] = useState('');
  const { t } = useTranslation();

  const confirm = useCallback((msg) => {
    setMessage(msg);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolveRef) {
      resolveRef(true);
      setResolveRef(null);
    }
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolveRef) {
      resolveRef(false);
      setResolveRef(null);
    }
  }, [resolveRef]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <p className="text-gray-900 dark:text-white mb-4">{message}</p>
            <div className="flex space-x-3">
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('common.confirm')}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export function useConfirmContext() {
  return useContext(ConfirmContext);
} 

NamedConfirmProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { NamedConfirmProvider as ConfirmProvider }; 