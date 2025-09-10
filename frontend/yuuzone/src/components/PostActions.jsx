import { memo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { toast } from 'react-toastify';
import Svg from "./Svg";
import PostMoreOptions from "./PostMoreOptions";
import Vote from "./Vote";

const PostActions = memo(({ 
  isExpanded, 
  post, 
  postId, 
  isAuthenticated, 
  setCommentMode, 
  handleShare, 
  handleTranslationComplete, 
  translationData, 
  t 
}) => {
  const onReplyClick = () => {
    if (isAuthenticated) {
      setCommentMode((data) => !data);
    } else {
      toast.error(t('alerts.youMustBeLoggedInToReply'));
    }
  };

  if (isExpanded) {
    return (
      <div className="flex flex-col md:flex-row items-center justify-around w-full md:w-fit md:justify-evenly gap-4 md:gap-6">
        <div className="flex items-center gap-2">
          <Svg type="comment" className="w-5 h-5" onClick={onReplyClick} />
          <p className="text-sm md:cursor-pointer md:text-base text-theme-text-primary dark:text-theme-dark-text">
            Reply
          </p>
        </div>
                      <div className="flex items-center gap-2" onClick={handleShare}>
                <Svg type="share" className="w-5 h-5" />
                <p className="text-sm md:text-base text-theme-text-primary dark:text-theme-dark-text">
                  {t('posts.share')}
                </p>
              </div>
        <div className="flex items-center gap-2 relative">
          <PostMoreOptions
            creatorInfo={post?.user_info}
            threadInfo={post?.thread_info}
            postInfo={{
              ...post?.post_info,
              is_boosted: post?.is_boosted || false
            }}
            currentUser={post?.current_user}
            onTranslationComplete={handleTranslationComplete}
            translationData={translationData}
          />
        </div>
        <div className="flex items-center space-x-3 md:hidden">
          <Vote
            intitalVote={post?.current_user?.has_upvoted}
            initialCount={post?.post_info?.post_karma || 0}
            url="/api/reactions/post"
            contentID={postId}
            type="mobile"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center h-full ml-[-8px] mr-8">
      <div className="flex flex-col items-center gap-3">
        <Link to={`/post/${postId}`} className="flex flex-row items-center w-full">
          <span className="inline-flex w-7 flex-shrink-0 items-center justify-start">
            <Svg type="comment" className="w-5 h-5" />
          </span>
          <span className="flex-1 text-base text-left text-theme-text-primary dark:text-theme-dark-text">
            {t('posts.comments')}
          </span>
        </Link>
        <button onClick={handleShare} className="flex flex-row items-center w-full">
          <span className="inline-flex w-7 flex-shrink-0 items-center justify-start">
            <Svg type="share" className="w-5 h-5" />
          </span>
          <span className="flex-1 text-base text-left text-theme-text-primary dark:text-theme-dark-text">
            {t('posts.share')}
          </span>
        </button>
        <div className="flex flex-row items-center w-full relative">
            <PostMoreOptions
              creatorInfo={post?.user_info}
              threadInfo={post?.thread_info}
              postInfo={{
                ...post?.post_info,
                is_boosted: post?.is_boosted || false
              }}
              currentUser={post?.current_user}
              onTranslationComplete={handleTranslationComplete}
              translationData={translationData}
            />
        </div>
      </div>
    </div>
  );
});

PostActions.propTypes = {
  isExpanded: PropTypes.bool,
  post: PropTypes.object.isRequired,
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  isAuthenticated: PropTypes.bool,
  setCommentMode: PropTypes.func.isRequired,
  handleShare: PropTypes.func.isRequired,
  handleTranslationComplete: PropTypes.func.isRequired,
  translationData: PropTypes.object,
  t: PropTypes.func.isRequired,
};

PostActions.displayName = 'PostActions';

export default PostActions; 