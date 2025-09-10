import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

NewPostsNotification.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  newPostsCount: PropTypes.number.isRequired,
  onViewNewPosts: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired
};

export default function NewPostsNotification({ 
  isVisible, 
  newPostsCount, 
  onViewNewPosts, 
  onDismiss 
}) {
  const { t } = useTranslation();

  if (!isVisible || newPostsCount === 0) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="bg-theme-blue text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <svg 
                className="w-5 h-5 animate-pulse" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" 
                  clipRule="evenodd" 
                />
              </svg>
              <span className="font-medium">
                {newPostsCount === 1 
                  ? t('notifications.newPostFound') 
                  : t('notifications.newPostsFound', { count: newPostsCount })
                }
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={onViewNewPosts}
                className="bg-white text-theme-blue px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                {t('notifications.viewNewPosts')}
              </button>
              <button
                onClick={onDismiss}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path 
                    fillRule="evenodd" 
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 