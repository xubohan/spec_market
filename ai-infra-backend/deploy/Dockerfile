FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 系统依赖（支持 bcrypt 编译）
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libffi-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && pip install --no-cache-dir gunicorn

# 拷贝源码
COPY . .

# 环境变量（与 config.py 对应）
ENV PORT=8000 \
    MONGODB_URI=mongodb://mongo:27017/specdb \
    MONGODB_DB=specdb \
    CACHE_BACKEND=simple \
    CORS_ORIGINS=* \
    ADMIN_TOKEN=devtoken123

EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/healthz" || exit 1

# 启动 Gunicorn
CMD ["gunicorn", "-w", "2", "-k", "gthread", "-t", "60", "-b", "0.0.0.0:8000", "app:app"]
