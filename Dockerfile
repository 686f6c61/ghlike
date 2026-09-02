# ghlike site — estático (patrón Devops-Contabo: nginx + Dockerfile en raíz de rama)
FROM nginx:alpine
COPY site/index.html site/og-image.png /usr/share/nginx/html/
# el widget vive en ../widget/src/gh-like.js respecto al index; se sirve en /widget/
COPY widget/src/gh-like.js /usr/share/nginx/html/widget/src/gh-like.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
