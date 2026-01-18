import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState, useEffect } from "react";
import useAuthContext from "./AuthContext";
import Svg from "./Svg";
import PropTypes from "prop-types";
import useSocket from "../hooks/useSocket";
import { useTranslation } from "react-i18next";
import { toast } from 'react-toastify';

Vote.propTypes = {
  url: PropTypes.string,
  initialCount: PropTypes.number,
  intitalVote: PropTypes.bool,
  contentID: PropTypes.number,
  type: PropTypes.string,
};

export default function Vote({ url, intitalVote, initialCount, contentID, type }) {
  const { t } = useTranslation();
  const [vote, setVote] = useState(intitalVote);
  const [voteCount, setVoteCount] = useState(initialCount);
  const { isAuthenticated } = useAuthContext();
  const { connected, socket } = useSocket("votes");

  const { mutate } = useMutation({
    mutationFn: async ({ vote, method, contentID }) => {
      switch (method) {
        case "put":
          return axios.put(`${url}/${contentID}`, { is_upvote: vote }).then((res) => res.data);
        case "patch":
          return axios.patch(`${url}/${contentID}`, { is_upvote: vote }).then((res) => res.data);
        case "delete":
          return axios.delete(`${url}/${contentID}`).then((res) => res.data);
        default:
          break;
      }
    },
    onError: (error) => {
      console.error('Vote mutation error:', error);
      toast.error(t('alerts.voteError') || 'Failed to vote. Please try again.');
    }
  });

  useEffect(() => {
    if (!connected) return;

    const handleVoteUpdate = (data) => {
      if (data.post_id === contentID) {
        // Update vote count based on the vote change
        const voteChange = data.vote_type === 'new' ? (data.is_upvote ? 1 : -1) :
                          data.vote_type === 'update' ? (data.is_upvote ? 2 : -2) :
                          data.vote_type === 'remove' ? (data.old_vote ? -1 : 1) : 0;
        
        setVoteCount(prev => prev + voteChange);
        setVote(data.is_upvote);
      }
    };

    socket.on("post_vote_updated", handleVoteUpdate);
    socket.on("comment_vote_updated", handleVoteUpdate);

    return () => {
      socket.off("post_vote_updated", handleVoteUpdate);
      socket.off("comment_vote_updated", handleVoteUpdate);
    };
  }, [connected, socket, contentID]);

  function handleVote(newVote) {
    if (!isAuthenticated) {
      toast.error(t('alerts.mustBeLoggedInToVote') || 'You must be logged in to vote');
      return; // CRITICAL: Return early to prevent voting when not authenticated
    }

    // Calculate vote count change based on current vote and new vote
    let voteCountChange = 0;
    
    if (vote === null) {
      // No previous vote - adding new vote
      voteCountChange = newVote ? 1 : -1;
      mutate({ vote: newVote, method: "put", contentID });
    } else if (newVote === null) {
      // Removing existing vote
      voteCountChange = vote ? -1 : 1;
      mutate({ vote: newVote, method: "delete", contentID });
    } else if (vote !== newVote) {
      // Changing vote (upvote to downvote or vice versa)
      voteCountChange = newVote ? 2 : -2;
      mutate({ vote: newVote, method: "patch", contentID });
    } else {
      // Same vote clicked again - do nothing
      return;
    }

    // Update local state immediately for responsive UI
    setVoteCount(prev => prev + voteCountChange);
    setVote(newVote);
  }

  return type === "mobile" ? (
    <>
      <Svg
        type="mobileVote"
        className="w-5 h-5 md:w-6 md:h-6"
        defaultStyle={true}
        active={vote === true}
        onClick={() => handleVote(vote === true ? null : true)}
      />
      <p className={vote === true ? "text-theme-blue-coral" : vote === false ? "text-sky-600" : ""}>{voteCount}</p>
      <Svg
        type="mobileVote"
        className="w-5 h-5 rotate-180 md:w-6 md:h-6"
        defaultStyle={false}
        active={vote === false}
        onClick={() => handleVote(vote === false ? null : false)}
      />
    </>
  ) : (
    <>
      <div>
        <Svg
          type="down-arrow"
          defaultStyle={true}
          className="w-10 h-10 rotate-180"
          onClick={() => handleVote(vote === true ? null : true)}
          active={vote === true}
        />
      </div>
      <p className="text-lg font-semibold">
        <span className={vote === true ? "text-theme-blue-coral" : vote === false ? "text-sky-600" : ""}>
          {voteCount}
        </span>
      </p>
      <div>
        <Svg
          type="down-arrow"
          className="w-10 h-10"
          defaultStyle={false}
          onClick={() => handleVote(vote === false ? null : false)}
          active={vote === false}
        />
      </div>
    </>
  );
}
