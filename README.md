# YuuZone_public
Public source code for YuuZone web

## ⚙️ Requirements

### 🧠 Languages & Tools

- **Python 3.8+**
- **Node.js v16+**
- **npm v7+**
- Optional: **Gunicorn** (auto-installed by the script on supported platforms)

---

## 🌐 External Services (Required)

You need accounts or API keys for the following services to run YuuZone correctly:

| Service           | Purpose                                 |
|-------------------|-----------------------------------------|
| **Neon DB**       | PostgreSQL cloud database               |
| **Cloudinary**    | Image hosting and CDN                   |
| **SMTP**          | Sending email notifications             |
| **SEPay API**     | Payment gateway integration (if used)   |
| **Translate API** | Custom translation microservice         |

About Translate API, you can use the one Docker in Deploy_Translation. Edit that docker to fit with your usecase 

---


## 🔐 Required Environment Variables

These are set automatically by the script for local simulation, but must be provided securely in real deployment environments:

| Variable Name            | Description                                |
|--------------------------|--------------------------------------------|
| `DATABASE_URI`           | PostgreSQL connection string               |
| `SECRET_KEY`             | App secret key for Flask sessions          |
| `CLOUDINARY_NAME`        | Your Cloudinary cloud name                 |
| `CLOUDINARY_API_KEY`     | Your Cloudinary API key                    |
| `CLOUDINARY_API_SECRET`  | Your Cloudinary secret                     |
| `DEFAULT_AVATAR_URL`     | URL of default user avatar image           |
| `MAIL_USERNAME`          | Email used to send messages                |
| `MAIL_PASSWORD`          | Password or app token for email account    |
| `SEPAY_API_KEY`          | API key for payment gateway                |
| `TRANSLATE_URL`          | Endpoint for translation service           |
| `MESSAGE_ENCRYPTION_KEY` | Key for encrypting user messages           |
| `HOST`                   | Server host, typically `localhost`         |
| `PORT`                   | Port to bind the server (default: 5000)    |
| `FLASK_APP`              | Entry point of the Flask app (`wsgi.py`)   |

---
