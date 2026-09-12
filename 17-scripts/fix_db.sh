#!/bin/bash
cd /root/deploy/backend
sed -i 's|STORE_CORS=.*|STORE_CORS=https://culturajewels.com,http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,https://docs.medusajs.com|' .env
sed -i 's|ADMIN_CORS=.*|ADMIN_CORS=https://culturajewels.com,http://localhost:5173,http://localhost:9000,https://docs.medusajs.com|' .env
sed -i 's|AUTH_CORS=.*|AUTH_CORS=https://culturajewels.com,http://localhost:5173,http://localhost:9000,https://docs.medusajs.com|' .env
cp .env .medusa/server/.env

pm2 restart backend
echo "Backend CORS updated and restarted."
