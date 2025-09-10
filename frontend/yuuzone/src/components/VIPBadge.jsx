import React from 'react';

const VIPBadge = ({ className = "px-2 py-0.5 text-xs font-bold rounded-lg" }) => {
  return (
    <span 
      className={`text-xs font-bold rounded-lg bg-theme-vip-primary text-theme-vip-text relative overflow-hidden inline-block`}
      style={{
        backgroundColor: 'rgb(234 179 8)', // Golden yellow background
        color: 'rgb(254 249 195)', // Light yellow text
        background: 'linear-gradient(135deg, rgb(234 179, 8) 0%, rgb(245 158 11) 50%, rgb(234 179 8) 100%)',
        boxShadow: '0 3px 12px rgba(234, 179, 8, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
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
      {/* Animated glow effect - contained within badge content */}
      <span 
        className="absolute"
        style={{
          top: '2px',
          left: '2px',
          right: '2px',
          bottom: '2px',
          background: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, transparent 100%)',
          animation: 'vip-glow-opacity 2s ease-in-out infinite alternate',
          contain: 'layout style paint',
          borderRadius: 'inherit',
          pointerEvents: 'none'
        }}
      />
      
      {/* Shimmer effect - contained within badge content */}
      <span 
        className="absolute opacity-30"
        style={{
          top: '2px',
          left: '2px',
          right: '2px',
          bottom: '2px',
          background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%)',
          animation: 'vip-shimmer 3s infinite',
          contain: 'layout style paint',
          transformOrigin: 'center',
          borderRadius: 'inherit',
          pointerEvents: 'none'
        }}
      />
      
      <span className="relative z-10">VIP</span>
    </span>
  );
};

export default VIPBadge; 