import React from 'react';
import Post from './Post';
import PropTypes from 'prop-types';

/**
 * SafePost - A wrapper component that validates post data before rendering
 * This prevents React hooks errors by ensuring data integrity
 */
function SafePost({ post, ...props }) {
  // Comprehensive validation to prevent hooks errors
  const isValidPost = (postData) => {
    if (!postData) return false;
    if (typeof postData !== 'object') return false;
    if (!postData.post_info) return false;
    if (typeof postData.post_info !== 'object') return false;
    if (!postData.post_info.id) return false;
    
    // Additional safety checks
    if (postData.post_info.id === null || postData.post_info.id === undefined) return false;
    
    return true;
  };

  // If post data is invalid, render a safe fallback
  if (!isValidPost(post)) {
    return (
      <div className="flex flex-col p-4 bg-theme-bg-tertiary dark:bg-theme-dark-card rounded-lg border-2 border-theme-border-medium dark:border-theme-dark-border my-2">
        <p className="text-theme-text-secondary dark:text-theme-dark-text text-sm">
          Post data is incomplete and cannot be displayed safely.
        </p>
      </div>
    );
  }

  // If data is valid, render the actual Post component
  return <Post post={post} {...props} />;
}

SafePost.propTypes = {
  post: PropTypes.object.isRequired,
};

export default SafePost;
