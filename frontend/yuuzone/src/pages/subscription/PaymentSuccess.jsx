import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Loader from '../../components/Loader';

const PaymentSuccess = () => {
    const { paymentReference } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [paymentData, setPaymentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const checkPaymentStatus = async () => {
            try {
                setLoading(true);
            
                const response = await axios.get(`/api/subscriptions/payment/status/${paymentReference}`);
                
                console.log('🔍 DEBUG: Payment success page received payment data:', response.data);
                console.log('🔍 DEBUG: Payment object:', response.data.payment);
                console.log('🔍 DEBUG: Tier information:', {
                    tier_name: response.data.payment?.tier_name,
                    tier_slug: response.data.payment?.tier_slug,
                    tier_object: response.data.payment?.tier
                });

                setPaymentData(response.data);
            } catch (err) {
                // If payment not found, it might be still processing
                if (err.response?.status === 404) {
                    setError('Payment is being processed. Please wait a moment and refresh the page.');
                } else if (err.response?.status === 403) {
                    setError('Access denied. Please make sure you are logged in.');
                } else {
                    setError(err.response?.data?.error || 'Failed to check payment status');
                }
            } finally {
                setLoading(false);
            }
        };

        if (paymentReference) {
            // Add a small delay to ensure the app is fully loaded
            const initialTimer = setTimeout(() => {
                checkPaymentStatus();
            }, 500);
            
            // If payment data is not immediately available, retry after a short delay
            const retryTimer = setTimeout(() => {
                if (!paymentData) {
                    checkPaymentStatus();
                }
            }, 3000); // Retry after 3 seconds

            return () => {
                clearTimeout(initialTimer);
                clearTimeout(retryTimer);
            };
        }
    }, [paymentReference]);

    const handleContinue = () => {
        // Redirect based on payment type
        if (paymentData?.payment_type === 'coin') {
            navigate('/coin-shop');
        } else {
            navigate('/subscriptions');
        }
    };

    const handleGoHome = () => {
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg flex items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg flex items-center justify-center">
                <div className="bg-theme-less-white dark:bg-theme-dark-card p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="text-red-500 text-6xl mb-4">❌</div>
                        <h1 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4">
                            {t('payment.error.title', 'Payment Error')}
                        </h1>
                        <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mb-6">
                            {error}
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-theme-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                            >
                                {t('payment.retry', 'Retry')}
                            </button>
                            <button
                                onClick={handleGoHome}
                                className="w-full bg-theme-gray hover:bg-theme-light-gray text-theme-text-primary dark:text-theme-dark-text dark:bg-theme-dark-border dark:hover:bg-theme-dark-hover font-bold py-2 px-4 rounded transition-colors"
                            >
                                {t('common.goHome', 'Go Home')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isCompleted = paymentData?.status === 'completed';
    const isExpired = paymentData?.is_expired;
    const isCoinPayment = paymentData?.payment_type === 'coin';

    // Extract payment information based on type
    const getPaymentInfo = () => {
        if (isCoinPayment) {
            const payment = paymentData?.payment;
            return {
                title: t('payment.success.coins.title', 'Coins Purchased Successfully!'),
                message: t('payment.success.coins.message', 'Your coins have been added to your wallet.'),
                itemName: payment?.package?.name || 'Coin Package',
                amount: payment?.coin_amount || 0,
                currency: 'coins',
                expiresAt: null, // Coins don't expire
                benefits: [
                    t('payment.success.coins.benefits.wallet', 'Coins added to wallet'),
                    t('payment.success.coins.benefits.immediate', 'Available immediately'),
                    t('payment.success.coins.benefits.use', 'Ready to use for purchases')
                ]
            };
        } else {
            const payment = paymentData?.payment;
            // Get tier information from payment data
            const tierName = payment?.tier_name || payment?.tier?.name || 'Unknown Tier';
            const tierSlug = payment?.tier_slug || payment?.tier?.slug;
            
            console.log('🔍 DEBUG: Extracting tier information:', {
                payment_tier_name: payment?.tier_name,
                payment_tier_slug: payment?.tier_slug,
                payment_tier_object: payment?.tier,
                payment_tier_object_name: payment?.tier?.name,
                final_tier_name: tierName,
                final_tier_slug: tierSlug
            });
            
            return {
                title: t('payment.success.tier.title', 'Tier Subscription Activated!'),
                message: t('payment.success.tier.message', 'Your tier subscription has been activated successfully.'),
                itemName: tierName,
                tierSlug: tierSlug,
                amount: payment?.amount || 0,
                currency: payment?.currency || 'VND',
                expiresAt: paymentData?.expires_at ? new Date(paymentData.expires_at) : null,
                benefits: [
                    t('payment.success.tier.benefits.unlocked', 'Tier benefits unlocked'),
                    t('payment.success.tier.benefits.immediate', 'Benefits available immediately'),
                    t('payment.success.tier.benefits.realTime', 'Real-time updates applied')
                ]
            };
        }
    };

    const paymentInfo = getPaymentInfo();

    // Format date in DD/MM/YYYY format
    const formatDate = (date) => {
        if (!date) return '';
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Format time in HH:MM:SS format
    const formatTime = (date) => {
        if (!date) return '';
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    return (
        <div className="min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg flex items-center justify-center p-4">
            <div className="bg-theme-less-white dark:bg-theme-dark-card p-8 rounded-lg shadow-lg max-w-md w-full">
                <div className="text-center">
                    {isCompleted && !isExpired ? (
                        <>
                            <div className="text-green-500 text-6xl mb-4">✅</div>
                            <h1 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4">
                                {paymentInfo.title}
                            </h1>
                            <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mb-6">
                                {paymentInfo.message}
                            </p>
                            
                            <div className="bg-theme-light-gray2 dark:bg-theme-dark-bg p-4 rounded-lg mb-6 border border-theme-border-light dark:border-theme-dark-border">
                                <h2 className="text-lg font-semibold text-theme-text-primary dark:text-theme-dark-text mb-2">
                                    {isCoinPayment 
                                        ? t('payment.success.coinInfo', 'Coin Information')
                                        : t('payment.success.tierInfo', 'Tier Information')
                                    }
                                </h2>
                                <p className="text-theme-blue font-medium mb-2">{paymentInfo.itemName}</p>
                                {isCoinPayment && paymentInfo.amount > 0 && (
                                    <p className="text-yellow-500 dark:text-yellow-400 font-medium mb-2">
                                        {paymentInfo.amount} {paymentInfo.currency}
                                    </p>
                                )}
                                {paymentInfo.expiresAt && (
                                    <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary text-sm">
                                        {t('payment.success.expiresAt', 'Expires at')}: {formatDate(paymentInfo.expiresAt)} {formatTime(paymentInfo.expiresAt)}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-3 mb-6">
                                {paymentInfo.benefits.map((benefit, index) => (
                                    <div key={index} className="flex items-center text-green-500">
                                        <span className="mr-2">✓</span>
                                        <span className="text-theme-text-secondary dark:text-theme-dark-text-secondary">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
                            <h1 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4">
                                {t('payment.expired.title', 'Payment Expired')}
                            </h1>
                            <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mb-6">
                                {t('payment.expired.message', 'This payment has expired. Please try again.')}
                            </p>
                        </>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={handleContinue}
                            className="w-full bg-theme-blue hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
                        >
                            {isCoinPayment 
                                ? t('payment.success.continueToCoins', 'Continue to Coin Shop')
                                : t('payment.success.continueToSubscriptions', 'Continue to Subscriptions')
                            }
                        </button>
                        <button
                            onClick={handleGoHome}
                            className="w-full bg-theme-gray hover:bg-theme-light-gray text-theme-text-primary dark:text-theme-dark-text dark:bg-theme-dark-border dark:hover:bg-theme-dark-hover font-bold py-3 px-4 rounded transition-colors"
                        >
                            {t('common.goHome', 'Go Home')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccess; 