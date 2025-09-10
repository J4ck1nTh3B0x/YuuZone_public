// ...existing code...
async function createComment(req, res) {
    const { user_id, post_id, content, parent_id } = req.body;

    // Validate parent_id (if provided)
    if (parent_id) {
        const parentComment = await db.query('SELECT id FROM comments WHERE id = $1', [parent_id]);
        if (parentComment.rowCount === 0) {
            return res.status(400).json({ error: 'Invalid parent_id' });
        }
    }

    const result = await db.query(
        `INSERT INTO comments (user_id, post_id, content, parent_id, has_parent) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user_id, post_id, content, parent_id || null, !!parent_id]
    );

    res.status(201).json(result.rows[0]);
}

async function getComments(req, res) {
    const { post_id } = req.params;

    const comments = await db.query(`
        WITH RECURSIVE nested_comments AS (
            SELECT *, 0 AS depth
            FROM comments
            WHERE post_id = $1 AND parent_id IS NULL
            UNION ALL
            SELECT c.*, nc.depth + 1
            FROM comments c
            INNER JOIN nested_comments nc ON c.parent_id = nc.id
        )
        SELECT * FROM nested_comments ORDER BY depth, created_at;
    `, [post_id]);

    res.status(200).json(comments.rows);
}
// ...existing code...
