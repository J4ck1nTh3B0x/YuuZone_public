import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Svg from './Svg';
import PropTypes from 'prop-types';

const MessageActions = ({ 
  message, 
  currentUser, 
  onEdit, 
  onDelete, 
  isVisible, 
  onClose 
}) => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        onClose();
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, onClose]);

  // Only show actions for messages sent by current user
  if (!message || !currentUser || message.sender.username !== currentUser.username) {
    return null;
  }

  const handleEdit = () => {
    onEdit(message);
    setShowDropdown(false);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(t('messages.confirmDelete'))) {
      onDelete(message);
    }
    setShowDropdown(false);
    onClose();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Three dots button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-theme-dark-bg transition-colors ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transition: 'opacity 0.2s ease-in-out' }}
      >
        <Svg type="more" className="w-4 h-4 text-gray-500 dark:text-theme-dark-text" />
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-theme-dark-card rounded-md shadow-lg border border-gray-200 dark:border-theme-dark-border z-50">
          <button
            onClick={handleEdit}
            className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text hover:bg-gray-100 dark:hover:bg-theme-dark-bg"
          >
            {t('messages.editMessage')}
          </button>
          <button
            onClick={handleDelete}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-theme-dark-bg"
          >
            {t('messages.deleteMessage')}
          </button>
        </div>
      )}
    </div>
  );
};

MessageActions.propTypes = {
  message: PropTypes.object.isRequired,
  currentUser: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MessageActions;
