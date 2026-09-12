server {
    server_name bots.aneeverse.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }


    location = /jwel-gemini-browser {
        return 301 /jwel-gemini-browser/;
    }

    location = /jwel-gemini-browser/ {
        auth_basic "jwel Gemini browser";
        auth_basic_user_file /etc/nginx/.htpasswd-jwel-gemini-browser;
        return 302 /jwel-gemini-browser/vnc.html?host=$host&port=443&encrypt=1&path=jwel-gemini-browser/websockify&autoconnect=1&resize=scale;
    }

    location /jwel-gemini-browser/websockify {
        auth_basic "jwel Gemini browser";
        auth_basic_user_file /etc/nginx/.htpasswd-jwel-gemini-browser;
        proxy_pass http://127.0.0.1:6084/websockify;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    location /jwel-gemini-browser/ {
        auth_basic "jwel Gemini browser";
        auth_basic_user_file /etc/nginx/.htpasswd-jwel-gemini-browser;
        proxy_pass http://127.0.0.1:6084/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    location /jwel-img-gen/ {
        proxy_pass http://127.0.0.1:3024;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
        proxy_buffering off;
        client_max_body_size 20M;
    }

    location = /jwel-img-gen {
        return 301 /jwel-img-gen/;
    }

    location / {
        proxy_pass http://148.230.67.132:9119;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/bots.aneeverse.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/bots.aneeverse.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

}
server {
    if ($host = bots.aneeverse.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;
    server_name bots.aneeverse.com;
    return 404; # managed by Certbot


}