# Use official Python base image
FROM python:3.10-slim

# Install Node.js (LTS), npm, and curl for health checks
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend ./backend

# Explicitly build backend by byte-compiling Python files
RUN python -m compileall backend

# Copy frontend source code
COPY frontend ./frontend

# Install frontend dependencies and build frontend
WORKDIR /app/frontend/yuuzone
RUN rm -rf node_modules package-lock.json
RUN npm install
RUN npm audit fix || true
RUN chmod +x node_modules/.bin/vite
RUN npm run build

# Copy built frontend files to Flask static folder
RUN mkdir -p /app/backend/yuuzone/static
RUN cp -r dist/* /app/backend/yuuzone/static/
RUN ls -la /app/backend/yuuzone/static/

# Set working directory back to backend
WORKDIR /app/backend

# Expose backend port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=wsgi.py
ENV PORT=5000

# Run backend server with Gunicorn
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "wsgi:application"]
