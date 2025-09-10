import { memo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import Markdown from "markdown-to-jsx";

const PostContent = memo(({ post, isExpanded, translationData, isTranslated, toggleTranslation, t }) => {
  const getTranslatedTitle = () => {
    if (isTranslated && translationData?.translations && Object.keys(translationData.translations)[0]) {
      const langKey = Object.keys(translationData.translations)[0];
      const translation = translationData.translations[langKey];
      return translation?.translated_title || post?.post_info.title;
    }
    return post?.post_info.title;
  };

  const getTranslatedContent = () => {
    if (isTranslated && translationData?.translations && Object.keys(translationData.translations)[0]) {
      const langKey = Object.keys(translationData.translations)[0];
      return translationData.translations[langKey]?.translated_content || post?.post_info.content;
    }
    return post?.post_info.content;
  };

  const renderTranslationButton = (size = "text-sm") => (
    <button 
      className={`${size} text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium`}
      onClick={toggleTranslation}
    >
      {isTranslated ? t('translation.seeOriginal') : t('translation.seeTranslated')}
    </button>
  );

  if (isExpanded) {
    return (
      <div className="flex flex-col space-y-1 w-full h-full">
        <div className={`w-full font-semibold text-ellipsis ${post.post_info.content && "border-b-2 border-transparent pb-2"}`}>
          {getTranslatedTitle()}
        </div>
        {post.post_info.content && (
          <div className="max-w-full text-black dark:text-theme-dark-text prose prose-sm md:prose-base prose-blue dark:prose-invert">
            <Markdown className="[&>*:first-child]:mt-0">
              {getTranslatedContent()}
            </Markdown>
          </div>
        )}
        {/* Translation Toggle Button */}
        {translationData && (
          <div className="mt-2">
            {renderTranslationButton()}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link to={`/post/${post?.post_info.id}`} className="flex flex-col space-y-1 w-full h-full">
      <div className="w-full font-semibold text-ellipsis">
        {getTranslatedTitle()}
      </div>
      {/* Show truncated content preview in non-expanded view */}
      {post.post_info.content && (
        <div className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary overflow-hidden">
          <div className="max-h-12 overflow-hidden">
            {getTranslatedContent().length > 150 
              ? getTranslatedContent().substring(0, 150) + '...'
              : getTranslatedContent()
            }
          </div>
        </div>
      )}
      {/* Translation Toggle Button for non-expanded view */}
      {translationData && (
        <div className="mt-1">
          <button 
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            onClick={(e) => {
              e.preventDefault();
              toggleTranslation();
            }}
          >
            {isTranslated ? t('translation.seeOriginal') : t('translation.seeTranslated')}
          </button>
        </div>
      )}
    </Link>
  );
});

PostContent.propTypes = {
  post: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  translationData: PropTypes.object,
  isTranslated: PropTypes.bool,
  toggleTranslation: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

PostContent.displayName = 'PostContent';

export default PostContent; 