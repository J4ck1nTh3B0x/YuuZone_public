import React from 'react';

const SupportBadge = ({ className = "px-2 py-0.5 text-xs font-bold rounded-lg" }) => {
  return (
    <span 
      className={`text-xs font-bold rounded-lg bg-theme-support-primary text-theme-support-text relative overflow-hidden inline-block`}
      style={{
        backgroundColor: 'rgb(147 51 234)', // Purple background
        color: 'rgb(233 213 255)', // Light purple text
        background: 'linear-gradient(135deg, rgb(147 51 234) 0%, rgb(168 85 247) 50%, rgb(147 51 234) 100%)',
        boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        contain: 'layout style paint', // CSS containment to prevent overflow
        isolation: 'isolate', // Create stacking context
        overflow: 'hidden', // Ensure no content overflows
        position: 'relative', // Ensure proper positioning context
        padding: '4px 8px', // Balanced padding around content
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <span 
        className="absolute opacity-30"
        style={{
          top: '2px',
          left: '2px',
          right: '2px',
          bottom: '2px',
          background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
          animation: 'shimmer-contained 2s infinite',
          contain: 'layout style paint', // Contain the shimmer effect
          transformOrigin: 'center', // Ensure animation stays centered
          borderRadius: 'inherit',
          pointerEvents: 'none'
        }}
      />
      <span className="relative z-10">SUPPORT</span>
    </span>
  );
};

export default SupportBadge; 