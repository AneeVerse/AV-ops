#!/bin/bash
sed -n '1560,1640p' /root/projects/cultura/deploy/backend/node_modules/@medusajs/admin-bundler/dist/index.js
echo "===== admin.ts ====="
sed -n '60,120p' /root/projects/cultura/deploy/backend/node_modules/@medusajs/medusa/src/loaders/admin.ts
echo "===== medusa-config admin ====="
grep -n -i admin /root/projects/cultura/deploy/backend/medusa-config.ts | head -30
