import React from 'react';
import SupportBadge from './SupportBadge';
import VIPBadge from './VIPBadge';

const UserBadge = ({ subscriptionTypes = [], className = "px-2 py-0.5 text-xs font-bold rounded-lg" }) => {
  if (!subscriptionTypes || !Array.isArray(subscriptionTypes) || subscriptionTypes.length === 0) {
    return null;
  }

  // Show VIP badge if user has VIP, otherwise show Support badge
  const hasVIP = subscriptionTypes.includes('vip');
  const hasSupport = subscriptionTypes.includes('support');

  return (
    <div className="">
      {hasVIP ? (
        <VIPBadge className={className} />
      ) : hasSupport ? (
        <SupportBadge className={className} />
      ) : null}
    </div>
  );
};

export default UserBadge; 