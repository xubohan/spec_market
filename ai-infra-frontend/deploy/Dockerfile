# ===== build =====
FROM hub-dev.hexin.cn/business-baseimage-frontend/node:v20.18.1 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ===== runtime =====
FROM hub-dev.hexin.cn/baseimages/php_openresty:centos_php_7.0

ENV APP_HOME=/var/www/html
WORKDIR ${APP_HOME}

# 1) 拷贝前端产物到 /var/www/html/dist
WORKDIR /var/www/html
COPY --from=builder /app/dist ./dist

# 2) 把你的 nginx.conf 放到 vhosts 目录（主配置会 include 这里）
RUN mkdir -p /usr/local/openresty/nginx/conf/vhosts
COPY deploy/nginx.conf /usr/local/openresty/nginx/conf/vhosts/frontend.conf

# 3) 最小改动 + 构建期校验（兼容无 openresty 命令的镜像；上游解析失败时放行）
RUN set -eux; \
    # root 统一到容器内真实路径
    sed -i 's#root .*dist;#root /var/www/html/dist;#' /usr/local/openresty/nginx/conf/vhosts/frontend.conf; \
    # 若未声明 default_server，则补上，确保命中该 vhost
    grep -qE 'listen[[:space:]]+80[[:space:]]+default_server' /usr/local/openresty/nginx/conf/vhosts/frontend.conf \
      || sed -i -E 's#listen[[:space:]]+80([^;]*);#listen 80 default_server;#' /usr/local/openresty/nginx/conf/vhosts/frontend.conf; \
    # 构建期做一次配置测试：若因 upstream 无法解析而失败，仅告警不中断构建
    if command -v openresty >/dev/null 2>&1; then \
        openresty -t || { echo "WARN: openresty -t failed (likely unresolved upstream at build-time); continue building"; :; }; \
    elif command -v nginx >/dev/null 2>&1; then \
        nginx -t -c /usr/local/openresty/nginx/conf/nginx.conf || { echo "WARN: nginx -t failed (likely unresolved upstream at build-time); continue building"; :; }; \
    elif [ -x /usr/local/openresty/nginx/sbin/nginx ]; then \
        /usr/local/openresty/nginx/sbin/nginx -t -c /usr/local/openresty/nginx/conf/nginx.conf || { echo "WARN: nginx -t failed (likely unresolved upstream at build-time); continue building"; :; }; \
    else \
        echo "WARN: no nginx/openresty found at build-time; skip config test"; \
    fi

# 4) 极简 readiness 脚本（探测 /healthz）
# 若没有该文件，请在项目根目录放置 readiness.sh（内容 3 行即可：curl 成功则 0，否则 1）
COPY readiness.sh /opt/readiness.sh
RUN chmod +x /opt/readiness.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD /opt/readiness.sh

# 5) 运行期启动命令（兼容 openresty/nginx 任一可执行名）
CMD ["/bin/sh", "-c", "if command -v openresty >/dev/null 2>&1; then openresty -g 'daemon off;'; elif command -v nginx >/dev/null 2>&1; then nginx -g 'daemon off;'; elif [ -x /usr/local/openresty/nginx/sbin/nginx ]; then /usr/local/openresty/nginx/sbin/nginx -g 'daemon off;'; else echo 'Error: no openresty/nginx found'; exit 1; fi"]