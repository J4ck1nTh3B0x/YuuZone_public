"""
Backend translation utilities for YuuZone
Provides translation support for error messages and user-facing text
"""

# Translation dictionaries for backend messages
TRANSLATIONS = {
    'en': {
        # Authentication messages
        'already_logged_in': 'Already logged in',
        'invalid_login_data': 'Invalid login data',
        'invalid_credentials': 'Invalid credentials',
        'invalid_request': 'Invalid request',
        'successfully_logged_out': 'Successfully logged out',
        'registration_successful': 'Registration successful! You are now logged in.',
        'registration_failed': 'Registration failed',
        'invalid_request_data': 'Invalid request data',
        
        # Password reset messages
        'reset_link_sent': 'If the email exists, a reset link has been sent.',
        'password_reset_successfully': 'Password reset successfully.',
        'invalid_token_or_user': 'Invalid token or user not found.',
        'reset_link_expired': 'Reset link expired or invalid.',
        
        # User management messages
        'successfully_deleted': 'Successfully deleted',
        'language_updated': 'Language preference updated successfully',
        'invalid_language': 'Invalid language code. Must be one of: en, ja, vi',
        'username_password_required': 'Username and current password are required',
        'current_password_incorrect': 'Current password is incorrect',
        'username_taken': 'Username already taken',
        'username_updated': 'Username updated successfully',
        'passwords_required': 'Both current and new passwords are required',
        'password_updated': 'Password updated successfully',
        'email_password_required': 'Email and current password are required',
        'email_in_use': 'Email already in use',
        'email_updated': 'Email updated successfully',
        
        # User search and blocking
        'user_not_found': 'User not found',
        'cannot_block_yourself': 'You cannot block yourself',
        'user_already_blocked': 'User already blocked',
        'user_blocked': 'User {username} has been blocked',
        'user_not_blocked': 'User is not blocked',
        'user_unblocked': 'User {username} has been unblocked',
        
        # Translation messages
        'invalid_target_language': 'Invalid target language',
        'post_not_found': 'Post not found',
        'comment_not_found': 'Comment not found',
        'translation_failed': 'Translation failed',

        # User authentication messages
        'already_logged_in': 'Already logged in',
        'invalid_registration_data': 'Invalid registration data',
        'registration_successful': 'Registration successful! You are now logged in.',
        'registration_failed': 'Registration failed',
        'invalid_request_data': 'Invalid request data',
        'reset_link_sent': 'If the email exists, a reset link has been sent.',
        'password_reset_successful': 'Password reset successfully.',
        'invalid_token_user': 'Invalid token or user not found.',
        'reset_link_expired': 'Reset link expired or invalid.',
        'successfully_deleted': 'Successfully deleted',

        # User settings messages
        'invalid_language_code': 'Invalid language code. Must be one of: en, ja, vi',
        'language_preference_updated': 'Language preference updated successfully',
        'username_password_required': 'Username and current password are required',
        'current_password_incorrect': 'Current password is incorrect',
        'username_already_taken': 'Username already taken',
        'both_passwords_required': 'Both current and new passwords are required',
        'password_updated_successfully': 'Password updated successfully',
        'email_password_required': 'Email and current password are required',
        'email_already_in_use': 'Email already in use',
        'user_not_found': 'User not found',

        # User blocking messages
        'cannot_block_yourself': 'You cannot block yourself',
        'user_already_blocked': 'User already blocked',
        'user_blocked': 'User {username} has been blocked',
        'user_not_blocked': 'User is not blocked',
        'user_unblocked': 'User {username} has been unblocked',

        # General error codes
        'ALREADY_LOGGED_IN': 'ALREADY_LOGGED_IN',
        'VALIDATION_ERROR': 'VALIDATION_ERROR',
        'INVALID_CREDENTIALS': 'INVALID_CREDENTIALS',
        'INVALID_REQUEST': 'INVALID_REQUEST',
        'REGISTRATION_ERROR': 'REGISTRATION_ERROR',
    },
    'ja': {
        # Authentication messages
        'already_logged_in': 'すでにログイン済みです',
        'invalid_login_data': '無効なログインデータです',
        'invalid_credentials': '認証情報が無効です',
        'invalid_request': '無効なリクエストです',
        'successfully_logged_out': 'ログアウトしました',
        'registration_successful': '登録が完了しました！ログインしています。',
        'registration_failed': '登録に失敗しました',
        'invalid_request_data': '無効なリクエストデータです',
        
        # Password reset messages
        'reset_link_sent': 'メールアドレスが存在する場合、リセットリンクが送信されました。',
        'password_reset_successfully': 'パスワードがリセットされました。',
        'invalid_token_or_user': '無効なトークンまたはユーザーが見つかりません。',
        'reset_link_expired': 'リセットリンクが期限切れまたは無効です。',
        
        # User management messages
        'successfully_deleted': '削除されました',
        'language_updated': '言語設定が更新されました',
        'invalid_language': '無効な言語コードです。en、ja、viのいずれかである必要があります',
        'username_password_required': 'ユーザー名と現在のパスワードが必要です',
        'current_password_incorrect': '現在のパスワードが間違っています',
        'username_taken': 'ユーザー名は既に使用されています',
        'username_updated': 'ユーザー名が更新されました',
        'passwords_required': '現在のパスワードと新しいパスワードの両方が必要です',
        'password_updated': 'パスワードが更新されました',
        'email_password_required': 'メールアドレスと現在のパスワードが必要です',
        'email_in_use': 'メールアドレスは既に使用されています',
        'email_updated': 'メールアドレスが更新されました',
        
        # User search and blocking
        'user_not_found': 'ユーザーが見つかりません',
        'cannot_block_yourself': '自分自身をブロックすることはできません',
        'user_already_blocked': 'ユーザーは既にブロックされています',
        'user_blocked': 'ユーザー{username}をブロックしました',
        'user_not_blocked': 'ユーザーはブロックされていません',
        'user_unblocked': 'ユーザー{username}のブロックを解除しました',
        
        # Translation messages
        'invalid_target_language': '無効な対象言語です',
        'post_not_found': '投稿が見つかりません',
        'comment_not_found': 'コメントが見つかりません',
        'translation_failed': '翻訳に失敗しました',

        # User authentication messages
        'already_logged_in': '既にログインしています',
        'invalid_registration_data': '無効な登録データです',
        'registration_successful': '登録が完了しました！ログインしています。',
        'registration_failed': '登録に失敗しました',
        'invalid_request_data': '無効なリクエストデータです',
        'reset_link_sent': 'メールアドレスが存在する場合、リセットリンクが送信されました。',
        'password_reset_successful': 'パスワードのリセットが完了しました。',
        'invalid_token_user': '無効なトークンまたはユーザーが見つかりません。',
        'reset_link_expired': 'リセットリンクが期限切れまたは無効です。',
        'successfully_deleted': '正常に削除されました',

        # User settings messages
        'invalid_language_code': '無効な言語コードです。en、ja、viのいずれかである必要があります',
        'language_preference_updated': '言語設定が正常に更新されました',
        'username_password_required': 'ユーザー名と現在のパスワードが必要です',
        'current_password_incorrect': '現在のパスワードが正しくありません',
        'username_already_taken': 'ユーザー名は既に使用されています',
        'both_passwords_required': '現在のパスワードと新しいパスワードの両方が必要です',
        'password_updated_successfully': 'パスワードが正常に更新されました',
        'email_password_required': 'メールアドレスと現在のパスワードが必要です',
        'email_already_in_use': 'メールアドレスは既に使用されています',
        'user_not_found': 'ユーザーが見つかりません',

        # User blocking messages
        'cannot_block_yourself': '自分自身をブロックすることはできません',
        'user_already_blocked': 'ユーザーは既にブロックされています',
        'user_blocked': 'ユーザー {username} をブロックしました',
        'user_not_blocked': 'ユーザーはブロックされていません',
        'user_unblocked': 'ユーザー {username} のブロックを解除しました',

        # General error codes
        'ALREADY_LOGGED_IN': 'ALREADY_LOGGED_IN',
        'VALIDATION_ERROR': 'VALIDATION_ERROR',
        'INVALID_CREDENTIALS': 'INVALID_CREDENTIALS',
        'INVALID_REQUEST': 'INVALID_REQUEST',
        'REGISTRATION_ERROR': 'REGISTRATION_ERROR',
    },
    'vi': {
        # Authentication messages
        'already_logged_in': 'Đã đăng nhập',
        'invalid_login_data': 'Dữ liệu đăng nhập không hợp lệ',
        'invalid_credentials': 'Thông tin xác thực không hợp lệ',
        'invalid_request': 'Yêu cầu không hợp lệ',
        'successfully_logged_out': 'Đăng xuất thành công',
        'registration_successful': 'Đăng ký thành công! Bạn đã đăng nhập.',
        'registration_failed': 'Đăng ký thất bại',
        'invalid_request_data': 'Dữ liệu yêu cầu không hợp lệ',
        
        # Password reset messages
        'reset_link_sent': 'Nếu email tồn tại, liên kết đặt lại đã được gửi.',
        'password_reset_successfully': 'Đặt lại mật khẩu thành công.',
        'invalid_token_or_user': 'Token không hợp lệ hoặc không tìm thấy người dùng.',
        'reset_link_expired': 'Liên kết đặt lại đã hết hạn hoặc không hợp lệ.',
        
        # User management messages
        'successfully_deleted': 'Xóa thành công',
        'language_updated': 'Cập nhật tùy chọn ngôn ngữ thành công',
        'invalid_language': 'Mã ngôn ngữ không hợp lệ. Phải là một trong: en, ja, vi',
        'username_password_required': 'Tên người dùng và mật khẩu hiện tại là bắt buộc',
        'current_password_incorrect': 'Mật khẩu hiện tại không đúng',
        'username_taken': 'Tên người dùng đã được sử dụng',
        'username_updated': 'Cập nhật tên người dùng thành công',
        'passwords_required': 'Cả mật khẩu hiện tại và mật khẩu mới đều bắt buộc',
        'password_updated': 'Cập nhật mật khẩu thành công',
        'email_password_required': 'Email và mật khẩu hiện tại là bắt buộc',
        'email_in_use': 'Email đã được sử dụng',
        'email_updated': 'Cập nhật email thành công',
        
        # User search and blocking
        'user_not_found': 'Không tìm thấy người dùng',
        'cannot_block_yourself': 'Bạn không thể chặn chính mình',
        'user_already_blocked': 'Người dùng đã bị chặn',
        'user_blocked': 'Đã chặn người dùng {username}',
        'user_not_blocked': 'Người dùng không bị chặn',
        'user_unblocked': 'Đã bỏ chặn người dùng {username}',
        
        # Translation messages
        'invalid_target_language': 'Ngôn ngữ đích không hợp lệ',
        'post_not_found': 'Không tìm thấy bài viết',
        'comment_not_found': 'Không tìm thấy bình luận',
        'translation_failed': 'Dịch thuật thất bại',

        # User authentication messages
        'already_logged_in': 'Đã đăng nhập',
        'invalid_registration_data': 'Dữ liệu đăng ký không hợp lệ',
        'registration_successful': 'Đăng ký thành công! Bạn đã được đăng nhập.',
        'registration_failed': 'Đăng ký thất bại',
        'invalid_request_data': 'Dữ liệu yêu cầu không hợp lệ',
        'reset_link_sent': 'Nếu email tồn tại, liên kết đặt lại đã được gửi.',
        'password_reset_successful': 'Đặt lại mật khẩu thành công.',
        'invalid_token_user': 'Token không hợp lệ hoặc không tìm thấy người dùng.',
        'reset_link_expired': 'Liên kết đặt lại đã hết hạn hoặc không hợp lệ.',
        'successfully_deleted': 'Đã xóa thành công',

        # User settings messages
        'invalid_language_code': 'Mã ngôn ngữ không hợp lệ. Phải là một trong: en, ja, vi',
        'language_preference_updated': 'Cập nhật tùy chọn ngôn ngữ thành công',
        'username_password_required': 'Tên người dùng và mật khẩu hiện tại là bắt buộc',
        'current_password_incorrect': 'Mật khẩu hiện tại không đúng',
        'username_already_taken': 'Tên người dùng đã được sử dụng',
        'both_passwords_required': 'Cả mật khẩu hiện tại và mật khẩu mới đều bắt buộc',
        'password_updated_successfully': 'Cập nhật mật khẩu thành công',
        'email_password_required': 'Email và mật khẩu hiện tại là bắt buộc',
        'email_already_in_use': 'Email đã được sử dụng',
        'user_not_found': 'Không tìm thấy người dùng',

        # User blocking messages
        'cannot_block_yourself': 'Bạn không thể chặn chính mình',
        'user_already_blocked': 'Người dùng đã bị chặn',
        'user_blocked': 'Đã chặn người dùng {username}',
        'user_not_blocked': 'Người dùng không bị chặn',
        'user_unblocked': 'Đã bỏ chặn người dùng {username}',

        # General error codes
        'ALREADY_LOGGED_IN': 'ALREADY_LOGGED_IN',
        'VALIDATION_ERROR': 'VALIDATION_ERROR',
        'INVALID_CREDENTIALS': 'INVALID_CREDENTIALS',
        'INVALID_REQUEST': 'INVALID_REQUEST',
        'REGISTRATION_ERROR': 'REGISTRATION_ERROR',
    }
}

def get_translation(key, language='en', **kwargs):
    """
    Get translated text for a given key and language
    
    Args:
        key (str): Translation key
        language (str): Language code (en, ja, vi)
        **kwargs: Variables for string formatting
    
    Returns:
        str: Translated text
    """
    if language not in TRANSLATIONS:
        language = 'en'  # Fallback to English
    
    translation = TRANSLATIONS[language].get(key, TRANSLATIONS['en'].get(key, key))
    
    # Format string with provided variables
    if kwargs:
        try:
            translation = translation.format(**kwargs)
        except (KeyError, ValueError):
            # If formatting fails, return the unformatted string
            pass
    
    return translation

def get_user_language(user=None):
    """
    Get user's preferred language for emails, defaulting to English.
    Checks:
      1. user.language_preference (if user is provided and has language_preference)
      2. 'yuuzone_language' in Flask request headers or cookies
      3. fallback to 'en'
    Args:
        user: User object with language preference (optional)
    Returns:
        str: Language code
    """
    # 1. Check user object
    if user and hasattr(user, 'language_preference') and user.language_preference:
        return user.language_preference
    # 2. Check Flask request (header or cookie)
    try:
        from flask import request
        # Prefer header, fallback to cookie
        lang = request.headers.get('X-YuuZone-Language')
        if not lang:
            lang = request.cookies.get('yuuzone_language')
        if lang in ('en', 'ja', 'vi'):
            return lang
    except Exception:
        pass
    # 3. Fallback
    return 'en'
