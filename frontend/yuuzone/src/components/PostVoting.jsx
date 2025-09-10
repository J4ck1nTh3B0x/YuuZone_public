import { memo } from "react";
import PropTypes from "prop-types";
import Vote from "./Vote";

const PostVoting = memo(({ isExpanded, hasUpvoted, postKarma, postId }) => {
  return (
    <div
      className={`hidden justify-around items-center my-2 space-y-1 md:flex border-theme-gray-blue ${
        isExpanded ? "flex-row space-x-10" : "flex-col px-5 border-l"
      }`}
    >
      <Vote
        intitalVote={hasUpvoted}
        initialCount={postKarma}
        url="/api/reactions/post"
        contentID={postId}
        type="full"
      />
    </div>
  );
});

PostVoting.propTypes = {
  isExpanded: PropTypes.bool,
  hasUpvoted: PropTypes.bool,
  postKarma: PropTypes.number,
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

PostVoting.displayName = 'PostVoting';

export default PostVoting; 