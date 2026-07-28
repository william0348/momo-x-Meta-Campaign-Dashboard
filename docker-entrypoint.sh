#!/bin/sh
# Write runtime env vars to config.js so the frontend can read them
cat > /usr/share/nginx/html/config.js << EOF
window.__ENV__ = {
  FACEBOOK_ACCESS_TOKEN: "${FACEBOOK_ACCESS_TOKEN}",
  FACEBOOK_AD_ACCOUNT_ID: "${FACEBOOK_AD_ACCOUNT_ID}",
};
EOF

# Fix nginx port for Cloud Run
sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
