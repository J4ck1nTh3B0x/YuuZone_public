from flask import Blueprint, jsonify, request
from yuuzone import db
from yuuzone.reactions.models import Reactions
from flask_login import current_user, login_required
from yuuzone.users.models import UsersKarma
# Socket.IO will be handled in WSGI - use try/except for graceful fallback
try:
    from yuuzone.socketio_app import socketio
except ImportError:
    socketio = None

# Import rate limiting utilities
from yuuzone.utils.rate_limiter import rate_limit

reactions = Blueprint("reactions", __name__, url_prefix="/api")


@reactions.route("/reactions/post/<post_id>", methods=["PATCH"])
@login_required
@rate_limit("vote")
def update_reaction_post(post_id):
    # Check if user is banned from the subthread of this post
    from yuuzone.posts.models import Posts
    post = Posts.query.filter_by(id=post_id).first()
    if post:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

    if request.json:
        update_reaction = Reactions.query.filter_by(post_id=post_id, user_id=current_user.id).first()
        if update_reaction:
            old_vote = update_reaction.is_upvote
            new_vote = request.json.get("is_upvote")
            update_reaction.is_upvote = new_vote
            db.session.commit()

            # Emit real-time vote update
            if socketio and post:
                try:
                    socketio.emit('post_vote_updated', {
                        'post_id': post_id,
                        'user_id': current_user.id,
                        'is_upvote': new_vote,
                        'vote_type': 'update',
                        'old_vote': old_vote
                    }, room=f'{post.subthread_id}')
                    # Emit real-time karma update
                    user_karma = UsersKarma.query.filter_by(user_id=current_user.id).first()
                    if user_karma:
                        socketio.emit('karma_updated', {
                            'user_id': current_user.id,
                            'user_karma': user_karma.user_karma
                        }, room=f'user_{current_user.id}')
                except Exception as e:
                    import logging
                    logging.error(f"Failed to emit post vote update: {e}")

            return jsonify({"message": "Reaction updated"}), 200
    return jsonify({"message": "Invalid Reaction"}), 400


@reactions.route("/reactions/post/<post_id>", methods=["PUT"])
@login_required
@rate_limit("vote")
def add_reaction_post(post_id):
    # Check if user is banned from the subthread of this post
    from yuuzone.posts.models import Posts
    post = Posts.query.filter_by(id=post_id).first()
    if post:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

    if request.json:
        has_upvoted = request.json.get("is_upvote")
        
        # Check if reaction already exists
        existing_reaction = Reactions.query.filter_by(post_id=post_id, user_id=current_user.id).first()
        vote_type = 'update' if existing_reaction else 'new'
        old_vote = existing_reaction.is_upvote if existing_reaction else None
        
        # Add or update reaction
        Reactions.add(user_id=current_user.id, is_upvote=has_upvoted, post_id=post_id)

        # Emit real-time vote addition/update
        if socketio and post:
            try:
                socketio.emit('post_vote_updated', {
                    'post_id': post_id,
                    'user_id': current_user.id,
                    'is_upvote': has_upvoted,
                    'vote_type': vote_type,
                    'old_vote': old_vote
                }, room=f'{post.subthread_id}')
                # Emit real-time karma update
                user_karma = UsersKarma.query.filter_by(user_id=current_user.id).first()
                if user_karma:
                    socketio.emit('karma_updated', {
                        'user_id': current_user.id,
                        'user_karma': user_karma.user_karma
                    }, room=f'user_{current_user.id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit post vote addition: {e}")

        return jsonify({"message": "Reaction added"}), 200
    return jsonify({"message": "Invalid Reaction"}), 400


@reactions.route("/reactions/post/<post_id>", methods=["DELETE"])
@login_required
def delete_reaction_post(post_id):
    # Check if user is banned from the subthread of this post
    from yuuzone.posts.models import Posts
    post = Posts.query.filter_by(id=post_id).first()
    if post:
        from yuuzone.subthreads.models import SubthreadBan
        banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
        if banned:
            return jsonify({
                "message": "You are banned from this subthread",
                "banned": True,
                "redirect": f"/banned/{post.subthread_id}"
            }), 403

    reaction = Reactions.query.filter_by(post_id=post_id, user_id=current_user.id).first()
    if reaction:
        old_vote = reaction.is_upvote
        Reactions.query.filter_by(post_id=post_id, user_id=current_user.id).delete()
        db.session.commit()

        # Emit real-time vote removal
        if socketio and post:
            try:
                socketio.emit('post_vote_updated', {
                    'post_id': post_id,
                    'user_id': current_user.id,
                    'is_upvote': None,
                    'vote_type': 'remove',
                    'old_vote': old_vote
                }, room=f'{post.subthread_id}')
                # Emit real-time karma update
                user_karma = UsersKarma.query.filter_by(user_id=current_user.id).first()
                if user_karma:
                    socketio.emit('karma_updated', {
                        'user_id': current_user.id,
                        'user_karma': user_karma.user_karma
                    }, room=f'user_{current_user.id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit post vote removal: {e}")

        return jsonify({"message": "Reaction deleted"}), 200
    return jsonify({"message": "Invalid Reaction"}), 400


@reactions.route("/reactions/comment/<comment_id>", methods=["PATCH"])
@login_required
@rate_limit("vote")
def update_reaction_comment(comment_id):
    # Check if user is banned from the subthread of this comment's post
    from yuuzone.comments.models import Comments
    from yuuzone.posts.models import Posts
    comment = Comments.query.filter_by(id=comment_id).first()
    if comment:
        post = Posts.query.filter_by(id=comment.post_id).first()
        if post:
            from yuuzone.subthreads.models import SubthreadBan
            banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
            if banned:
                return jsonify({
                    "message": "You are banned from this subthread",
                    "banned": True,
                    "redirect": f"/banned/{post.subthread_id}"
                }), 403

    if request.json:
        has_upvoted = request.json.get("is_upvote")
        reaction = Reactions.query.filter_by(comment_id=comment_id, user_id=current_user.id).first()
        if reaction:
            old_vote = reaction.is_upvote
            reaction.patch(has_upvoted)

            # Emit real-time comment vote update
            if socketio and comment:
                try:
                    socketio.emit('comment_vote_updated', {
                        'comment_id': comment_id,
                        'post_id': comment.post_id,
                        'user_id': current_user.id,
                        'is_upvote': has_upvoted,
                        'vote_type': 'update',
                        'old_vote': old_vote
                    }, room=f'{comment.post_id}')
                    # Emit real-time karma update
                    user_karma = UsersKarma.query.filter_by(user_id=current_user.id).first()
                    if user_karma:
                        socketio.emit('karma_updated', {
                            'user_id': current_user.id,
                            'user_karma': user_karma.user_karma
                        }, room=f'user_{current_user.id}')
                except Exception as e:
                    import logging
                    logging.error(f"Failed to emit comment vote update: {e}")

            return jsonify({"message": "Reaction updated"}), 200
    return jsonify({"message": "Invalid Reaction"}), 400


@reactions.route("/reactions/comment/<comment_id>", methods=["PUT"])
@login_required
@rate_limit("vote")
def add_reaction_comment(comment_id):
    # Check if user is banned from the subthread of this comment's post
    from yuuzone.comments.models import Comments
    from yuuzone.posts.models import Posts
    comment = Comments.query.filter_by(id=comment_id).first()
    if comment:
        post = Posts.query.filter_by(id=comment.post_id).first()
        if post:
            from yuuzone.subthreads.models import SubthreadBan
            banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
            if banned:
                return jsonify({
                    "message": "You are banned from this subthread",
                    "banned": True,
                    "redirect": f"/banned/{post.subthread_id}"
                }), 403

    if request.json:
        has_upvoted = request.json.get("is_upvote")
        Reactions.add(user_id=current_user.id, is_upvote=has_upvoted, comment_id=comment_id)

        # Emit real-time comment vote addition
        if socketio and comment:
            try:
                socketio.emit('comment_vote_updated', {
                    'comment_id': comment_id,
                    'post_id': comment.post_id,
                    'user_id': current_user.id,
                    'is_upvote': has_upvoted,
                    'vote_type': 'new'
                }, room=f'{comment.post_id}')
                # Emit real-time karma update
                user_karma = UsersKarma.query.filter_by(user_id=current_user.id).first()
                if user_karma:
                    socketio.emit('karma_updated', {
                        'user_id': current_user.id,
                        'user_karma': user_karma.user_karma
                    }, room=f'user_{current_user.id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit comment vote addition: {e}")

        return jsonify({"message": "Reaction added"}), 200
    return jsonify({"message": "Invalid Reaction"}), 400


@reactions.route("/reactions/comment/<comment_id>", methods=["DELETE"])
@login_required
def delete_reaction_comment(comment_id):
    # Check if user is banned from the subthread of this comment's post
    from yuuzone.comments.models import Comments
    from yuuzone.posts.models import Posts
    comment = Comments.query.filter_by(id=comment_id).first()
    if comment:
        post = Posts.query.filter_by(id=comment.post_id).first()
        if post:
            from yuuzone.subthreads.models import SubthreadBan
            banned = SubthreadBan.query.filter_by(user_id=current_user.id, subthread_id=post.subthread_id).first()
            if banned:
                return jsonify({
                    "message": "You are banned from this subthread",
                    "banned": True,
                    "redirect": f"/banned/{post.subthread_id}"
                }), 403

    reaction = Reactions.query.filter_by(comment_id=comment_id, user_id=current_user.id).first()
    if reaction:
        old_vote = reaction.is_upvote
        Reactions.query.filter_by(comment_id=comment_id, user_id=current_user.id).delete()
        db.session.commit()

        # Emit real-time comment vote removal
        if socketio and comment:
            try:
                socketio.emit('comment_vote_updated', {
                    'comment_id': comment_id,
                    'post_id': comment.post_id,
                    'user_id': current_user.id,
                    'is_upvote': None,
                    'vote_type': 'remove',
                    'old_vote': old_vote
                }, room=f'{comment.post_id}')
                # Emit real-time karma update
                user_karma = UsersKarma.query.filter_by(user_id=current_user.id).first()
                if user_karma:
                    socketio.emit('karma_updated', {
                        'user_id': current_user.id,
                        'user_karma': user_karma.user_karma
                    }, room=f'user_{current_user.id}')
            except Exception as e:
                import logging
                logging.error(f"Failed to emit comment vote removal: {e}")

        return jsonify({"message": "Reaction deleted"}), 200
    return jsonify({"message": "Invalid Reaction"}), 400
