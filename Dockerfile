# ghlike site — estático (patrón Devops-Contabo: nginx + Dockerfile en raíz de rama)
FROM nginx:1.27-alpine
COPY site/index.html site/app.js site/og-image.png /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
