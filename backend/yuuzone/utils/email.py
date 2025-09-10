"""
YuuZone Email Utility
Centralized email sending with multi-language support and template management
"""

import os
from flask import render_template_string, request
from flask_mail import Message, Mail
from yuuzone.utils.translations import get_user_language
from yuuzone import app

# Initialize Flask-Mail
mail = Mail()

def init_mail(app_instance):
    """Initialize Flask-Mail with the app"""
    app_instance.config.update(
        MAIL_SERVER='smtp.zoho.com',
        MAIL_PORT=587,
        MAIL_USE_TLS=True,
        MAIL_USE_SSL=False,
        MAIL_USERNAME=os.environ.get('MAIL_USERNAME', 'your-email@zoho.com'),
        MAIL_PASSWORD=os.environ.get('MAIL_PASSWORD', 'your-password'),
        MAIL_DEFAULT_SENDER=('YuuZone', os.environ.get('MAIL_USERNAME', 'your-email@zoho.com'))
    )
    mail.init_app(app_instance)

def get_email_template(template_name, language='en'):
    """
    Get email template content for a specific template and language
    """
    templates = {
        'verification': {
            'en': {
                'subject': 'Verify Your YuuZone Account',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Welcome to YuuZone!</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Thank you for creating your YuuZone account. To complete your registration, please verify your email address by clicking the button below:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ verification_url }}" style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">This verification link will expire in 10 minutes. If you didn't create this account, you can safely ignore this email.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'YuuZoneアカウントの確認',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">YuuZoneへようこそ！</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">YuuZoneアカウントを作成していただき、ありがとうございます。登録を完了するには、下のボタンをクリックしてメールアドレスを確認してください：</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ verification_url }}" style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">メールアドレスを確認</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">この確認リンクは10分後に期限切れになります。このアカウントを作成していない場合は、このメールを無視してかまいません。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Xác nhận tài khoản YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Chào mừng đến với YuuZone!</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Cảm ơn bạn đã tạo tài khoản YuuZone. Để hoàn tất đăng ký, vui lòng xác nhận địa chỉ email của bạn bằng cách nhấp vào nút bên dưới:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ verification_url }}" style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Xác nhận địa chỉ email</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Liên kết xác nhận này sẽ hết hạn sau 10 phút. Nếu bạn không tạo tài khoản này, bạn có thể bỏ qua email này.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'welcome': {
            'en': {
                'subject': 'Welcome to YuuZone!',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Welcome to YuuZone!</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Your YuuZone account has been successfully verified! You're now ready to explore communities, share your thoughts, and connect with others.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Start your journey by:</p>
                    <ul style="color: #666; line-height: 1.6;">
                        <li>Exploring popular communities</li>
                        <li>Creating your first post</li>
                        <li>Joining discussions that interest you</li>
                    </ul>
                    
                    <p style="color: #666; line-height: 1.6;">Welcome to the community!</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'YuuZoneへようこそ！',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">YuuZoneへようこそ！</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">YuuZoneアカウントが正常に確認されました！コミュニティを探索し、考えを共有し、他の人とつながる準備ができました。</p>
                    
                    <p style="color: #666; line-height: 1.6;">以下のことから始めてください：</p>
                    <ul style="color: #666; line-height: 1.6;">
                        <li>人気のコミュニティを探索する</li>
                        <li>最初の投稿を作成する</li>
                        <li>興味のあるディスカッションに参加する</li>
                    </ul>
                    
                    <p style="color: #666; line-height: 1.6;">コミュニティへようこそ！</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Chào mừng đến với YuuZone!',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Chào mừng đến với YuuZone!</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Tài khoản YuuZone của bạn đã được xác nhận thành công! Bây giờ bạn đã sẵn sàng khám phá các cộng đồng, chia sẻ suy nghĩ và kết nối với những người khác.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Bắt đầu hành trình của bạn bằng cách:</p>
                    <ul style="color: #666; line-height: 1.6;">
                        <li>Khám phá các cộng đồng phổ biến</li>
                        <li>Tạo bài đăng đầu tiên</li>
                        <li>Tham gia các cuộc thảo luận mà bạn quan tâm</li>
                    </ul>
                    
                    <p style="color: #666; line-height: 1.6;">Chào mừng đến với cộng đồng!</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'login_alert': {
            'en': {
                'subject': 'New Login to Your YuuZone Account',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">New Login Detected</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">We detected a new login to your YuuZone account. Here are the details:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Device:</strong> {{ device }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Location:</strong> {{ location }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>IP Address:</strong> {{ ip_address }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Time:</strong> {{ login_time }}</p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">If this was you, you can safely ignore this email. If you don't recognize this login, please change your password immediately.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'YuuZoneアカウントへの新しいログイン',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">新しいログインが検出されました</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">YuuZoneアカウントへの新しいログインを検出しました。詳細は以下の通りです：</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>デバイス:</strong> {{ device }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>場所:</strong> {{ location }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>IPアドレス:</strong> {{ ip_address }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>時間:</strong> {{ login_time }}</p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">これがあなたの場合は、このメールを無視してかまいません。このログインを認識しない場合は、すぐにパスワードを変更してください。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Đăng nhập mới vào tài khoản YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Phát hiện đăng nhập mới</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Chúng tôi đã phát hiện một lần đăng nhập mới vào tài khoản YuuZone của bạn. Dưới đây là chi tiết:</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Thiết bị:</strong> {{ device }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Vị trí:</strong> {{ location }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Địa chỉ IP:</strong> {{ ip_address }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Thời gian:</strong> {{ login_time }}</p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Nếu đây là bạn, bạn có thể bỏ qua email này. Nếu bạn không nhận ra lần đăng nhập này, vui lòng thay đổi mật khẩu ngay lập tức.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'password_reset': {
            'en': {
                'subject': 'Reset Your YuuZone Password',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">We received a request to reset your YuuZone password. Click the button below to create a new password:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ reset_url }}" style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">This link will expire in 15 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'YuuZoneパスワードのリセット',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">パスワードをリセット</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">YuuZoneパスワードのリセット要求を受け取りました。下のボタンをクリックして新しいパスワードを作成してください：</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ reset_url }}" style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">パスワードをリセット</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">このリンクは15分後に期限切れになります。パスワードリセットを要求していない場合は、このメールを無視してかまいません。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Đặt lại mật khẩu YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Đặt lại mật khẩu</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu YuuZone của bạn. Nhấp vào nút bên dưới để tạo mật khẩu mới:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ reset_url }}" style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Đặt lại mật khẩu</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Liên kết này sẽ hết hạn sau 15 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'change_confirmation': {
            'en': {
                'subject': 'Your YuuZone Account Has Been Updated',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Account Updated Successfully</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Your YuuZone account has been successfully updated. The changes you requested have been applied.</p>
                    
                    <p style="color: #666; line-height: 1.6;">If you didn't make this change, please contact our support team immediately.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'YuuZoneアカウントが更新されました',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">アカウントが正常に更新されました</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">YuuZoneアカウントが正常に更新されました。要求された変更が適用されました。</p>
                    
                    <p style="color: #666; line-height: 1.6;">この変更を行っていない場合は、すぐにサポートチームにお問い合わせください。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Tài khoản YuuZone đã được cập nhật',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Cập nhật tài khoản thành công</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Tài khoản YuuZone của bạn đã được cập nhật thành công. Những thay đổi bạn yêu cầu đã được áp dụng.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ ngay với nhóm hỗ trợ của chúng tôi.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'account_deletion': {
            'en': {
                'subject': 'YuuZone Account Deleted',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Account Deletion Confirmed</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Your YuuZone account has been successfully deleted as requested. All your data has been permanently removed from our systems.</p>
                    
                    <p style="color: #666; line-height: 1.6;">We're sorry to see you go. If you change your mind, you can always create a new account.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Thank you for being part of our community.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'YuuZoneアカウントが削除されました',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">アカウント削除確認</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">要求に応じてYuuZoneアカウントが正常に削除されました。すべてのデータがシステムから永続的に削除されました。</p>
                    
                    <p style="color: #666; line-height: 1.6;">お別れするのは残念です。気が変わった場合は、いつでも新しいアカウントを作成できます。</p>
                    
                    <p style="color: #666; line-height: 1.6;">コミュニティの一員となっていただき、ありがとうございました。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Tài khoản YuuZone đã được xóa',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Xác nhận xóa tài khoản</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Tài khoản YuuZone của bạn đã được xóa thành công theo yêu cầu. Tất cả dữ liệu của bạn đã được xóa vĩnh viễn khỏi hệ thống của chúng tôi.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Chúng tôi rất tiếc khi thấy bạn rời đi. Nếu bạn thay đổi ý định, bạn luôn có thể tạo tài khoản mới.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Cảm ơn bạn đã là một phần của cộng đồng chúng tôi.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'account_deletion_verification': {
            'en': {
                'subject': 'Verify Account Deletion - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Verify Account Deletion</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">You have requested to delete your YuuZone account. To confirm this action, please click the button below:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ verification_url }}" style="background-color: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm Account Deletion</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;"><strong>Warning:</strong> This action cannot be undone. All your data, posts, comments, and account information will be permanently deleted.</p>
                    
                    <p style="color: #666; line-height: 1.6;">This verification link will expire in 10 minutes. If you didn't request this deletion, you can safely ignore this email.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'アカウント削除の確認 - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">アカウント削除の確認</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">YuuZoneアカウントの削除を要求されました。この操作を確認するには、下のボタンをクリックしてください：</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ verification_url }}" style="background-color: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">アカウント削除を確認</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;"><strong>警告：</strong>この操作は元に戻せません。すべてのデータ、投稿、コメント、アカウント情報が永続的に削除されます。</p>
                    
                    <p style="color: #666; line-height: 1.6;">この確認リンクは10分後に期限切れになります。この削除を要求していない場合は、このメールを無視してかまいません。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Xác nhận xóa tài khoản - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">Xác nhận xóa tài khoản</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Bạn đã yêu cầu xóa tài khoản YuuZone của mình. Để xác nhận hành động này, vui lòng nhấp vào nút bên dưới:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{ verification_url }}" style="background-color: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Xác nhận xóa tài khoản</a>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;"><strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu, bài viết, bình luận và thông tin tài khoản của bạn sẽ bị xóa vĩnh viễn.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Liên kết xác nhận này sẽ hết hạn sau 10 phút. Nếu bạn không yêu cầu xóa này, bạn có thể an toàn bỏ qua email này.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'coin_purchase': {
            'en': {
                'subject': 'Coin Purchase Confirmation - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">🎉 Coin Purchase Successful!</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Thank you for your coin purchase! Your transaction has been completed successfully.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="color: #333; margin-top: 0;">Purchase Details</h3>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Package:</strong> {{ package_name }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Coins Received:</strong> <span style="color: #28a745; font-weight: bold;">{{ coin_amount }} coins</span></p>
                        {% if bonus_amount %}
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>First Purchase Bonus:</strong> <span style="color: #ffc107; font-weight: bold;">+{{ bonus_amount }} coins</span></p>
                        {% endif %}
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Total Coins:</strong> <span style="color: #28a745; font-weight: bold;">{{ total_coins }} coins</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>New Balance:</strong> <span style="color: #007bff; font-weight: bold;">{{ new_balance }} coins</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Transaction ID:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{{ transaction_id }}</code></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Purchase Date:</strong> {{ purchase_date }}</p>
                    </div>
                    
                    <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="color: #28a745; margin-top: 0;">What you can do with your coins:</h4>
                        <ul style="color: #666; line-height: 1.6; margin: 5px 0;">
                            <li>Purchase premium subscriptions</li>
                            <li>Buy exclusive avatars and themes</li>
                            <li>Support content creators</li>
                            <li>Access premium features</li>
                        </ul>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Your coins are now available in your wallet and ready to use. Enjoy exploring all the premium features YuuZone has to offer!</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'コイン購入確認 - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">🎉 コイン購入完了！</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">コインのご購入ありがとうございます！お取引が正常に完了しました。</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="color: #333; margin-top: 0;">購入詳細</h3>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>パッケージ:</strong> {{ package_name }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>受け取ったコイン:</strong> <span style="color: #28a745; font-weight: bold;">{{ coin_amount }} コイン</span></p>
                        {% if bonus_amount %}
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>初回購入ボーナス:</strong> <span style="color: #ffc107; font-weight: bold;">+{{ bonus_amount }} コイン</span></p>
                        {% endif %}
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>総コイン数:</strong> <span style="color: #28a745; font-weight: bold;">{{ total_coins }} コイン</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>新しい残高:</strong> <span style="color: #007bff; font-weight: bold;">{{ new_balance }} コイン</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>取引ID:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{{ transaction_id }}</code></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>購入日:</strong> {{ purchase_date }}</p>
                    </div>
                    
                    <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="color: #28a745; margin-top: 0;">コインでできること:</h4>
                        <ul style="color: #666; line-height: 1.6; margin: 5px 0;">
                            <li>プレミアムサブスクリプションの購入</li>
                            <li>限定アバターとテーマの購入</li>
                            <li>コンテンツクリエイターのサポート</li>
                            <li>プレミアム機能へのアクセス</li>
                        </ul>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">コインはウォレットで利用可能になり、すぐに使用できます。YuuZoneが提供するすべてのプレミアム機能をお楽しみください！</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Xác nhận mua xu - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">🎉 Mua xu thành công!</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Cảm ơn bạn đã mua xu! Giao dịch của bạn đã được hoàn tất thành công.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="color: #333; margin-top: 0;">Chi tiết mua hàng</h3>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Gói:</strong> {{ package_name }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Xu nhận được:</strong> <span style="color: #28a745; font-weight: bold;">{{ coin_amount }} xu</span></p>
                        {% if bonus_amount %}
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Thưởng mua lần đầu:</strong> <span style="color: #ffc107; font-weight: bold;">+{{ bonus_amount }} xu</span></p>
                        {% endif %}
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Tổng xu:</strong> <span style="color: #28a745; font-weight: bold;">{{ total_coins }} xu</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Số dư mới:</strong> <span style="color: #007bff; font-weight: bold;">{{ new_balance }} xu</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Mã giao dịch:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{{ transaction_id }}</code></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Ngày mua:</strong> {{ purchase_date }}</p>
                    </div>
                    
                    <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="color: #28a745; margin-top: 0;">Bạn có thể làm gì với xu:</h4>
                        <ul style="color: #666; line-height: 1.6; margin: 5px 0;">
                            <li>Mua gói đăng ký cao cấp</li>
                            <li>Mua avatar và theme độc quyền</li>
                            <li>Hỗ trợ người tạo nội dung</li>
                            <li>Truy cập tính năng cao cấp</li>
                        </ul>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Xu của bạn hiện có sẵn trong ví và sẵn sàng sử dụng. Hãy tận hưởng tất cả các tính năng cao cấp mà YuuZone cung cấp!</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        },
        'subscription_purchase': {
            'en': {
                'subject': 'Subscription Activation Confirmation - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">🎉 Subscription Activated Successfully!</h2>
                    <p style="color: #666; line-height: 1.6;">Hi {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Congratulations! Your subscription has been activated successfully. You now have access to exclusive premium features.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                        <h3 style="color: #333; margin-top: 0;">Subscription Details</h3>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Plan:</strong> <span style="color: #007bff; font-weight: bold;">{{ tier_name }}</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Amount Paid:</strong> <span style="color: #28a745; font-weight: bold;">{{ amount }} {{ currency }}</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Activation Date:</strong> {{ activation_date }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Expiration Date:</strong> {{ expiration_date }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Transaction ID:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{{ transaction_id }}</code></p>
                    </div>
                    
                    <div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="color: #007bff; margin-top: 0;">Your Premium Benefits:</h4>
                        <ul style="color: #666; line-height: 1.6; margin: 5px 0;">
                            {% for benefit in benefits %}
                            <li>{{ benefit }}</li>
                            {% endfor %}
                        </ul>
                    </div>
                    
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h4 style="color: #856404; margin-top: 0;">Important Information:</h4>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;">Your subscription will automatically expire on {{ expiration_date }}. You can renew your subscription anytime before the expiration date to maintain uninterrupted access to premium features.</p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Thank you for choosing YuuZone! Enjoy your premium experience.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Best regards,<br>The YuuZone Team</p>
                </div>
                '''
            },
            'ja': {
                'subject': 'サブスクリプション有効化確認 - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">🎉 サブスクリプション有効化完了！</h2>
                    <p style="color: #666; line-height: 1.6;">{{ username }}さん、</p>
                    <p style="color: #666; line-height: 1.6;">おめでとうございます！サブスクリプションが正常に有効化されました。これで限定プレミアム機能にアクセスできます。</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                        <h3 style="color: #333; margin-top: 0;">サブスクリプション詳細</h3>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>プラン:</strong> <span style="color: #007bff; font-weight: bold;">{{ tier_name }}</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>支払い金額:</strong> <span style="color: #28a745; font-weight: bold;">{{ amount }} {{ currency }}</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>有効化日:</strong> {{ activation_date }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>有効期限:</strong> {{ expiration_date }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>取引ID:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{{ transaction_id }}</code></p>
                    </div>
                    
                    <div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="color: #007bff; margin-top: 0;">プレミアム特典:</h4>
                        <ul style="color: #666; line-height: 1.6; margin: 5px 0;">
                            {% for benefit in benefits %}
                            <li>{{ benefit }}</li>
                            {% endfor %}
                        </ul>
                    </div>
                    
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h4 style="color: #856404; margin-top: 0;">重要な情報:</h4>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;">サブスクリプションは{{ expiration_date }}に自動的に期限切れになります。プレミアム機能への継続的なアクセスを維持するために、有効期限前にいつでもサブスクリプションを更新できます。</p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">YuuZoneをお選びいただき、ありがとうございます！プレミアム体験をお楽しみください。</p>
                    
                    <p style="color: #666; line-height: 1.6;">よろしくお願いします、<br>YuuZoneチーム</p>
                </div>
                '''
            },
            'vi': {
                'subject': 'Xác nhận kích hoạt gói đăng ký - YuuZone',
                'template': '''
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
                    </div>
                    
                    <div style="margin-bottom: 20px;"></div>
                    <div style="margin-bottom: 20px;"></div>
                    
                    <h2 style="color: #333; text-align: center;">🎉 Kích hoạt gói đăng ký thành công!</h2>
                    <p style="color: #666; line-height: 1.6;">Xin chào {{ username }},</p>
                    <p style="color: #666; line-height: 1.6;">Chúc mừng! Gói đăng ký của bạn đã được kích hoạt thành công. Bây giờ bạn có quyền truy cập vào các tính năng cao cấp độc quyền.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                        <h3 style="color: #333; margin-top: 0;">Chi tiết gói đăng ký</h3>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Gói:</strong> <span style="color: #007bff; font-weight: bold;">{{ tier_name }}</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Số tiền đã thanh toán:</strong> <span style="color: #28a745; font-weight: bold;">{{ amount }} {{ currency }}</span></p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Ngày kích hoạt:</strong> {{ activation_date }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Ngày hết hạn:</strong> {{ expiration_date }}</p>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;"><strong>Mã giao dịch:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">{{ transaction_id }}</code></p>
                    </div>
                    
                    <div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <h4 style="color: #007bff; margin-top: 0;">Quyền lợi cao cấp của bạn:</h4>
                        <ul style="color: #666; line-height: 1.6; margin: 5px 0;">
                            {% for benefit in benefits %}
                            <li>{{ benefit }}</li>
                            {% endfor %}
                        </ul>
                    </div>
                    
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h4 style="color: #856404; margin-top: 0;">Thông tin quan trọng:</h4>
                        <p style="color: #666; line-height: 1.6; margin: 5px 0;">Gói đăng ký của bạn sẽ tự động hết hạn vào {{ expiration_date }}. Bạn có thể gia hạn gói đăng ký bất cứ lúc nào trước ngày hết hạn để duy trì quyền truy cập không gián đoạn vào các tính năng cao cấp.</p>
                    </div>
                    
                    <p style="color: #666; line-height: 1.6;">Cảm ơn bạn đã chọn YuuZone! Hãy tận hưởng trải nghiệm cao cấp của bạn.</p>
                    
                    <p style="color: #666; line-height: 1.6;">Trân trọng,<br>Đội ngũ YuuZone</p>
                </div>
                '''
            }
        }
    }
    
    return templates.get(template_name, {}).get(language, templates.get(template_name, {}).get('en', {}))

def send_user_email(email_type, recipient_email, user=None, **kwargs):
    """
    Send email to user with proper language selection and template
    
    Args:
        email_type (str): Type of email (verification, welcome, login_alert, password_reset, change_confirmation, account_deletion)
        recipient_email (str): Email address to send to
        user: User object (optional, for authenticated users)
        **kwargs: Template variables
    """
    try:
        # Determine language
        language = get_user_language(user)
        
        # Get template
        template_data = get_email_template(email_type, language)
        if not template_data:
            raise ValueError(f"Template not found for {email_type} in {language}")
        
        # Render template with variables
        html_content = render_template_string(template_data['template'], **kwargs)
        
        # Create message
        msg = Message(
            subject=template_data['subject'],
            recipients=[recipient_email],
            html=html_content
        )
        
        # Send email
        mail.send(msg)
        
        return True
    except Exception as e:
        print(f"Failed to send {email_type} email to {recipient_email}: {str(e)}")
        return False

def send_verification_email(user_email, username, verification_url, user=None):
    """Send email verification email"""
    return send_user_email('verification', user_email, user, username=username, verification_url=verification_url)

def send_welcome_email(user_email, username, user=None):
    """Send welcome email after successful verification"""
    return send_user_email('welcome', user_email, user, username=username)

def send_login_alert_email(user_email, username, device, location, ip_address, login_time, user=None):
    """Send login alert email"""
    return send_user_email('login_alert', user_email, user, 
                          username=username, device=device, location=location, 
                          ip_address=ip_address, login_time=login_time)

def send_password_reset_email(user_email, username, reset_url, user=None):
    """Send password reset email"""
    return send_user_email('password_reset', user_email, user, username=username, reset_url=reset_url)

def send_change_confirmation_email(user_email, username, user=None):
    """Send confirmation email for account changes"""
    return send_user_email('change_confirmation', user_email, user, username=username)

def send_account_deletion_email(user_email, username, user=None):
    """Send account deletion confirmation email"""
    return send_user_email('account_deletion', user_email, user, username=username)

def send_account_deletion_verification_email(user_email, username, verification_url, user=None):
    """Send account deletion verification email"""
    return send_user_email('account_deletion_verification', user_email, user, username=username, verification_url=verification_url)

def send_coin_purchase_email(user_email, username, package_name, coin_amount, total_coins, new_balance, transaction_id, purchase_date, bonus_amount=None, user=None):
    """Send coin purchase confirmation email"""
    return send_user_email('coin_purchase', user_email, user, 
                          username=username, package_name=package_name, coin_amount=coin_amount,
                          total_coins=total_coins, new_balance=new_balance, transaction_id=transaction_id,
                          purchase_date=purchase_date, bonus_amount=bonus_amount)

def send_subscription_purchase_email(user_email, username, tier_name, amount, currency, activation_date, expiration_date, transaction_id, benefits, user=None):
    """Send subscription purchase confirmation email"""
    return send_user_email('subscription_purchase', user_email, user,
                          username=username, tier_name=tier_name, amount=amount, currency=currency,
                          activation_date=activation_date, expiration_date=expiration_date,
                          transaction_id=transaction_id, benefits=benefits)

def send_email(recipient_email, subject, message, user=None):
    """
    Send a simple text email (for backward compatibility and simple notifications)
    
    Args:
        recipient_email (str): Email address to send to
        subject (str): Email subject
        message (str): Email message content
        user: User object (optional, for language selection)
    """
    try:
        # Create a simple HTML template for the message
        html_template = f"""
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://res.cloudinary.com/djk5nr64f/image/upload/v1753439416/logo_aclws7.png" alt="YuuZone Logo" style="width: 260px; height: auto;">
            </div>
            
            <div style="margin-bottom: 20px;"></div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                <p style="color: #666; line-height: 1.6; white-space: pre-line;">{message}</p>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-top: 20px;">Best regards,<br>The YuuZone Team</p>
        </div>
        """
        
        # Create message
        msg = Message(
            subject=subject,
            recipients=[recipient_email],
            html=html_template
        )
        
        # Send email
        mail.send(msg)
        
        return True
    except Exception as e:
        print(f"Failed to send email to {recipient_email}: {str(e)}")
        return False 