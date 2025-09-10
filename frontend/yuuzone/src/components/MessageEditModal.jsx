import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Svg from './Svg';
import PropTypes from 'prop-types';
import { useProtectedButton } from '../utils/buttonProtection';

const MessageEditModal = ({ message, isOpen, onClose, onSave }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');

  useEffect(() => {
    if (message && isOpen) {
      setContent(message.content || '');
    }
  }, [message, isOpen]);

  const handleSave = async () => {
    if (!content.trim()) {
      return;
    }

    try {
      await onSave(message.message_id, content.trim());
      onClose();
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  // Use protected button hook for save functionality
  const { isActive: isSaving, isLoading, onClick: protectedSave } = useProtectedButton(
    `save-message-${message?.message_id || 'new'}`,
    handleSave,
    {
      cooldownMs: 2000,
      actionName: 'saving',
      showToast: true,
      onError: (error) => {
        console.error('Save failed:', error);
      }
    }
  );

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      protectedSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !message) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-less-white dark:bg-theme-dark-bg rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-border-light dark:border-theme-dark-border">
          <h3 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text">
            {t('messages.editMessage')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-theme-bg-tertiary dark:hover:bg-theme-dark-bg transition-colors"
          >
            <Svg type="close" className="w-5 h-5 text-theme-text-secondary dark:text-theme-dark-text" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t('messages.editPlaceholder')}
                            className="w-full p-3 border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80 focus:outline-none focus:ring-2 focus:ring-theme-blue resize-none"
            rows={4}
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-theme-border-light dark:border-theme-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-theme-text-secondary dark:text-theme-dark-text bg-theme-bg-tertiary dark:bg-theme-dark-bg hover:bg-theme-bg-secondary dark:hover:bg-theme-dark-bg rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={protectedSave}
            disabled={!content.trim() || isSaving || isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 ease-in-out flex items-center space-x-2 ${
              isSaving || isLoading 
                ? 'bg-theme-button-active cursor-not-allowed opacity-75' 
                : 'bg-theme-blue hover:bg-theme-blue-dark'
            } ${!content.trim() ? 'bg-theme-button-disabled cursor-not-allowed opacity-50' : ''}`}
          >
            {(isLoading || isSaving) && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{t('common.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

MessageEditModal.propTypes = {
  message: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default MessageEditModal;
