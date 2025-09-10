import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import SupportBadge from './SupportBadge';
import VIPBadge from './VIPBadge';

const SubscriptionCard = ({ 
  type, 
  name, 
  price, 
  description, 
  benefits = [], 
  isOwned, 
  expiresIn, 
  onBuyClick,
  image,
  isCurrentTier
}) => {
  const { t } = useTranslation();

  // Validate and sanitize props
  const validatedType = typeof type === 'string' ? type : 'free';
  const validatedName = typeof name === 'string' ? name : 'Unknown';
  const validatedPrice = typeof price === 'string' ? price : '0 VND/month';
  const validatedDescription = typeof description === 'string' ? description : '';
  const validatedBenefits = Array.isArray(benefits) ? benefits : [];
  const validatedIsOwned = typeof isOwned === 'boolean' ? isOwned : false;
  const validatedExpiresIn = typeof expiresIn === 'number' ? expiresIn : null;
  const validatedIsCurrentTier = typeof isCurrentTier === 'boolean' ? isCurrentTier : false;
  const validatedOnBuyClick = onBuyClick && typeof onBuyClick === 'function' ? onBuyClick : null;

  const formatFileSize = (bytes) => {
    if (bytes === -1) return t('subscription.unlimited');
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    }
    return `${(bytes / 1024).toFixed(0)}KB`;
  };

  const formatLimit = (limit) => {
    if (limit === -1) return t('subscription.unlimited');
    return `${limit}/month`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-theme-bg-primary dark:bg-theme-dark-card rounded-2xl shadow-lg p-6 flex flex-col items-center text-center max-w-sm mx-auto"
    >
      {/* Badge */}
      <div className="mb-4 flex items-center justify-center">
        {validatedType === 'support' ? (
          <SupportBadge className="px-6 py-2 text-lg font-bold rounded-lg" />
        ) : validatedType === 'vip' ? (
          <VIPBadge className="px-6 py-2 text-lg font-bold rounded-lg" />
        ) : null}
      </div>

      {/* Name */}
      <h3 className="text-xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-2">{validatedName}</h3>

      {/* Description */}
      <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary text-sm mb-4 leading-relaxed">
        {validatedType === 'free' ? t('subscription.freeDescription') :
         validatedType === 'support' ? t('subscription.supportDescription') :
         validatedType === 'vip' ? t('subscription.vipDescription') : validatedDescription}
      </p>

      {/* Benefits List */}
      <div className="w-full mb-6">
        <ul className="text-left space-y-2">
          {(() => {
            let benefitsList;
            try {
              if (validatedType === 'free') {
                benefitsList = t('subscription.freeBenefits', { returnObjects: true });
              } else if (validatedType === 'support') {
                benefitsList = t('subscription.supportBenefits', { returnObjects: true });
              } else if (validatedType === 'vip') {
                benefitsList = t('subscription.vipBenefits', { returnObjects: true });
              } else {
                benefitsList = validatedBenefits;
              }
              
              // Ensure benefitsList is an array
              if (!Array.isArray(benefitsList)) {
                benefitsList = [];
              }
              
              return benefitsList.map((benefit, index) => (
                <li key={index} className="flex items-start text-sm text-theme-text-primary dark:text-theme-dark-text">
                  <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {benefit}
                </li>
              ));
            } catch (error) {
              return (
                <li className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                  {t('subscription.benefitsError')}
                </li>
              );
            }
          })()}
        </ul>
      </div>

      {/* Price */}
      <div className="text-2xl font-bold text-theme-blue mb-4">
        {validatedPrice}
      </div>

      {/* Status or Buy Button */}
      {validatedIsCurrentTier ? (
        <div className="w-full">
          <div className="bg-theme-bg-tertiary dark:bg-theme-dark-bg-secondary text-theme-text-secondary dark:text-theme-dark-text-secondary px-4 py-2 rounded-lg text-sm font-medium">
            {t('subscription.youAreHere')}
          </div>
        </div>
      ) : validatedIsOwned ? (
        <div className="w-full">
          <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {t('subscription.alreadyOwned')}
          </div>
          {validatedExpiresIn !== null && (
            <div className="text-xs text-theme-text-muted dark:text-theme-dark-text-secondary mt-2 text-center">
              {validatedExpiresIn > 0 ? (
                <span className="text-green-600 dark:text-green-400">
                  {t('subscription.expiresIn', { days: validatedExpiresIn })}
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  {t('subscription.expired')}
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-theme-text-muted dark:text-theme-dark-text-secondary mt-1 text-center">
            {t('subscription.noNeedToBuyAgain')}
          </div>
        </div>
      ) : (
        <button
          onClick={() => validatedOnBuyClick ? validatedOnBuyClick(validatedType) : null}
          className={`w-full font-medium py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105 ${
            validatedOnBuyClick 
              ? 'bg-theme-button-primary hover:bg-theme-button-primary-hover text-white' 
              : 'bg-gray-400 text-gray-600 cursor-not-allowed'
          }`}
          disabled={!validatedOnBuyClick}
        >
          {validatedOnBuyClick ? t('subscription.buyNow') : 'Buy Now (Disabled)'}
        </button>
      )}
    </motion.div>
  );
};

export default SubscriptionCard; 