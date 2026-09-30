from pathlib import Path
path = Path("/opt/av_ops/web/cultura/deploy/backend/medusa-config.ts")
text = path.read_text()
old = """    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },"""
new = """    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redis: {
          redisUrl: process.env.REDIS_URL,
        },
      },
    },"""
if old not in text:
    raise SystemExit("workflow block not found")
path.write_text(text.replace(old, new, 1))
print("WORKFLOW_OPTIONS_PATCHED")
