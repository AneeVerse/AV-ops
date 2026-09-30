from pathlib import Path
text = Path("/opt/av_ops/web/cultura/deploy/backend/.medusa/server/medusa-config.js").read_text()
for s in ["workflow", "redisUrl", "REDIS_URL", "cache-redis", "event-bus", "databaseUrl"]:
    print(s, text.count(s))
