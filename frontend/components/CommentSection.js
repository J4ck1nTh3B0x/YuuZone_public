// ...existing code...
function renderComments(comments, parentId = null) {
    return comments
        .filter(comment => comment.parent_id === parentId)
        .map(comment => (
            <div key={comment.id} style={{ marginLeft: comment.depth * 20 }}>
                <p>{comment.content}</p>
                <button onClick={() => setReplyTo(comment.id)}>Reply</button>
                {renderComments(comments, comment.id)}
            </div>
        ));
}

function CommentSection({ postId }) {
    const [comments, setComments] = useState([]);
    const [replyTo, setReplyTo] = useState(null);

    useEffect(() => {
        fetch(`/api/comments/${postId}`)
            .then(res => res.json())
            .then(data => setComments(data));
    }, [postId]);

    return (
        <div>
            {renderComments(comments)}
            <CommentForm postId={postId} replyTo={replyTo} />
        </div>
    );
}
// ...existing code...
