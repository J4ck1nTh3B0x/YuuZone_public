# from dotenv import dotenv_values

# DATABASE_URI = dotenv_values()["DATABASE_URI"]
# SECRET_KEY = dotenv_values()["SECRET_KEY"]
# CLOUDINARY_NAME = dotenv_values()["DATABASE_URI"]
# CLOUDINARY_API_KEY = dotenv_values()["CLOUDINARY_API_KEY"]
# CLOUDINARY_API_SECRET = dotenv_values()["CLOUDINARY_API_SECRET"]



##FOR RENDER WEB
import os

DATABASE_URI = os.environ.get("DATABASE_URI")
SECRET_KEY = os.environ.get("SECRET_KEY")
CLOUDINARY_NAME = os.environ.get("CLOUDINARY_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
DEFAULT_AVATAR_URL = os.environ.get("DEFAULT_AVATAR_URL")
TRANSLATE_URL = os.environ.get("TRANSLATE_URL")
SEPAY_API_KEY = os.environ.get("SEPAY_API_KEY")

# Boost system configuration
MAX_BOOSTS_PER_USER = int(os.environ.get("MAX_BOOSTS_PER_USER", "3"))  # Maximum boosts per user
BOOST_DURATION_DAYS = int(os.environ.get("BOOST_DURATION_DAYS", "7"))  # How long boosts last
DAILY_BOOST_LIMIT = int(os.environ.get("DAILY_BOOST_LIMIT", "5"))  # Maximum boosts per day per user
