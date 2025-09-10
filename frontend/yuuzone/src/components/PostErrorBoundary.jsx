import React from 'react';
import { withTranslation } from 'react-i18next';
import errorImage from '../assets/error.png';
import PropTypes from 'prop-types';

class PostErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to console for debugging
    console.error('Post Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    const { t } = this.props;
    
    if (this.state.hasError) {
      return (
        <div className="flex flex-col p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-3 mb-3">
            <img src={errorImage} alt="Error" className="w-6 h-6" />
            <h3 className="text-red-800 dark:text-red-200 font-medium">
              {t('errors.somethingWentWrong')}
            </h3>
          </div>
          <p className="text-red-700 dark:text-red-300 text-sm">
            {t('errors.postLoadError')}
            </p>
              <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-2 text-red-600 dark:text-red-400 text-sm hover:underline"
              >
            {t('errors.tryAgain')}
              </button>
        </div>
      );
    }

    return this.props.children;
  }
}

PostErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  t: PropTypes.func.isRequired,
};

const TranslatedPostErrorBoundary = withTranslation()(PostErrorBoundary);

export default TranslatedPostErrorBoundary;
