def create_comment_tree(comments, cur_user=None):
    try:
        if not comments:
            return []
        
        # Filter out None comments and comments without required attributes
        valid_comments = []
        for comment in comments:
            try:
                if (comment is not None and 
                    hasattr(comment, 'created_at') and 
                    hasattr(comment, 'comment_id') and
                    hasattr(comment, 'as_dict')):
                    valid_comments.append(comment)
            except Exception as e:
                # Log and skip malformed comments
                import logging
                logging.warning(f"Skipping malformed comment in filtering: {e}")
                continue
        
        if not valid_comments:
            return []
        
        # Sort comments by creation time to ensure parents come before children
        try:
            sorted_comments = sorted(valid_comments, key=lambda x: x.created_at if x.created_at else 0)
        except Exception as e:
            # If sorting fails, return comments as-is
            import logging
            logging.warning(f"Failed to sort comments, returning unsorted: {e}")
            sorted_comments = valid_comments
    
        comment_dict = {}
        root_comments = []

        # First pass: create all comment data structures
        for comment in sorted_comments:
            try:
                # Additional safety check for comment object integrity
                if not hasattr(comment, 'comment_id') or not hasattr(comment, 'as_dict'):
                    continue  # Skip malformed comment objects
                    
                comment_data = {"comment": comment.as_dict(cur_user), "children": []}
                comment_dict[comment.comment_id] = comment_data
            except Exception as e:
                # Log the error and skip this comment
                import logging
                logging.warning(f"Skipping malformed comment: {e}")
                continue

        # Second pass: build the tree structure
        for comment in sorted_comments:
            try:
                # Safety check for comment object integrity
                if not hasattr(comment, 'comment_id') or not hasattr(comment, 'has_parent') or not hasattr(comment, 'parent_id'):
                    continue  # Skip malformed comment objects
                    
                comment_data = comment_dict.get(comment.comment_id)
                if not comment_data:
                    continue  # Skip if comment data wasn't created in first pass
                
                # Check if this comment has a parent
                if comment.has_parent and comment.parent_id:
                    # This is a reply - find its parent and add it as a child
                    if comment.parent_id in comment_dict:
                        comment_dict[comment.parent_id]["children"].append(comment_data)
                    else:
                        # Parent not found, treat as root comment
                        root_comments.append(comment_data)
                else:
                    # This is a root comment
                    root_comments.append(comment_data)
            except Exception as e:
                # Log the error and skip this comment
                import logging
                logging.warning(f"Error processing comment in tree building: {e}")
                continue
        
        return root_comments
        
    except Exception as e:
        # If anything goes wrong, return empty list and log the error
        import logging
        logging.error(f"Error in create_comment_tree: {e}")
        return []
