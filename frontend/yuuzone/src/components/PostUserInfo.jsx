import { memo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import Svg from "./Svg";
import UserBadge from "./UserBadge";


const PostUserInfo = memo(({ userInfo, avatar }) => {
  if (!userInfo?.user_name) {
    return (
      <div className="flex flex-col items-center space-y-1 md:w-24 md:flex-shrink-0">
        <div className="w-12 h-12 rounded-md bg-theme-gray dark:bg-theme-border-dark flex items-center justify-center" />
        <span className="text-xs font-medium text-theme-text-muted dark:text-theme-text-secondary block">
          u/[deleted]
        </span>
        <div className="mt-1 flex flex-col items-center">
          <span 
            className="px-3 py-1 rounded-lg text-xs font-bold bg-theme-warning dark:bg-theme-warning text-theme-bg-primary dark:text-theme-dark-text border-2 border-theme-border-dark dark:border-theme-border-light" 
            style={{
              background: 'repeating-linear-gradient(135deg, #d97706, #d97706 10px, #374151 10px, #374151 20px)', 
              letterSpacing: '2px'
            }}
          >
            GONE
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-1 md:w-24 md:flex-shrink-0">
      <img
        src={userInfo.user_avatar || avatar}
        alt=""
        className="object-cover w-12 h-12 rounded-md"
        loading="lazy"
      />
      <Link to={`/u/${userInfo.user_name}`} className="text-center">
        <span className="text-xs font-medium text-theme-link hover:underline block">
          u/{userInfo.user_name}
        </span>
      </Link>
      {/* User tier badge */}
      <UserBadge 
        subscriptionTypes={userInfo?.subscription_types || []} 
        className="px-2 py-0.5 text-xs font-bold rounded-lg"
      />
      {/* Role icons for post author */}
      <div className="flex items-center space-x-1">
        {userInfo.roles?.includes("admin") && (
          <Svg type="crown-admin" external={true} className="w-6 h-6 text-theme-yellow-crown" />
        )}
        {userInfo.roles?.includes("mod") && !userInfo.roles?.includes("admin") && (
          <Svg type="wrench-mod" external={true} className="w-4 h-4 text-theme-wine-wrench" />
        )}
      </div>
    </div>
  );
});

PostUserInfo.propTypes = {
  userInfo: PropTypes.object,
  avatar: PropTypes.string.isRequired,
};

PostUserInfo.displayName = 'PostUserInfo';

export default PostUserInfo; 