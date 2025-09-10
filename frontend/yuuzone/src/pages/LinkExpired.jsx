import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLogo } from '../components/Navbar.jsx';
import Svg from '../components/Svg.jsx';

export default function LinkExpired() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkType = searchParams.get('type') || 'generic';
  
  const getLinkTypeInfo = () => {
    switch (linkType) {
      case 'email':
        return {
          title: t('auth.emailVerificationExpiredTitle', 'Email Verification Expired'),
          message: t('auth.emailVerificationExpiredMessage', 'Your email verification link has expired.'),
          primaryAction: t('auth.createNewAccount', 'Create New Account'),
          primaryRoute: '/register',
          secondaryAction: t('auth.backToLogin', 'Back to Login'),
          secondaryRoute: '/login'
        };
      case 'password':
        return {
          title: t('auth.passwordResetExpiredTitle', 'Password Reset Expired'),
          message: t('auth.passwordResetExpiredMessage', 'Your password reset link has expired.'),
          primaryAction: t('auth.requestNewReset', 'Request New Reset Link'),
          primaryRoute: '/forgot-password',
          secondaryAction: t('auth.backToLogin', 'Back to Login'),
          secondaryRoute: '/login'
        };
      default:
        return {
          title: t('auth.linkExpiredTitle', 'Link Expired'),
          message: t('auth.linkExpiredMessage', 'This link has expired or is no longer valid.'),
          primaryAction: t('auth.goHome', 'Go Home'),
          primaryRoute: '/',
          secondaryAction: t('auth.backToLogin', 'Back to Login'),
          secondaryRoute: '/login'
        };
    }
  };
  
  const linkInfo = getLinkTypeInfo();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <AppLogo />
      <div className="bg-theme-less-white dark:bg-theme-dark-card p-8 rounded-md shadow-md flex flex-col items-center max-w-md w-full mx-4">
        {/* Error Icon */}
        <div className="w-16 h-16 bg-theme-error-light dark:bg-theme-dark-bg rounded-full flex items-center justify-center mb-4">
          <Svg type="alert" className="w-8 h-8 text-theme-error" />
        </div>
        
        <h1 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4 text-center">
          {linkInfo.title}
        </h1>
        
        <div className="text-center space-y-4 mb-6">
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            {linkInfo.message}
          </p>
          
          <div className="bg-theme-bg-tertiary dark:bg-theme-dark-bg p-4 rounded-md">
            <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
              {t('auth.linkExpiredHelp', 'Links typically expire for security reasons. If you need to complete an action, please try again.')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col space-y-3 w-full">
          <button
            onClick={() => navigate(linkInfo.primaryRoute)}
            className="w-full px-6 py-3 bg-theme-blue text-white rounded-md hover:bg-theme-blue-dark transition-colors font-semibold"
          >
            {linkInfo.primaryAction}
          </button>
          
          <button
            onClick={() => navigate(linkInfo.secondaryRoute)}
            className="w-full px-6 py-3 bg-theme-bg-secondary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text rounded-md hover:bg-theme-bg-hover dark:hover:bg-theme-dark-hover transition-colors font-semibold border border-theme-border-light dark:border-theme-dark-border"
          >
            {linkInfo.secondaryAction}
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-theme-text-muted dark:text-theme-dark-text-secondary">
            {t('auth.needHelp', 'Need help?')} 
            <button 
              onClick={() => navigate('/contact')}
              className="text-theme-blue hover:underline ml-1"
            >
              {t('auth.contactSupport', 'Contact Support')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
} 