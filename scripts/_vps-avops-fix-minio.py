from pathlib import Path

path = Path("/opt/av_ops/docker/av_ops/compose.override.yml")
lines = path.read_text().splitlines()
out = []
for line in lines:
    out.append(line)
    if line.strip() == "minio:":
        out.append("    image: pgsty/minio:RELEASE.2026-06-18T00-00-00Z")
        out.append("    pull_policy: if_not_present")
text = "\n".join(out) + "\n"
if text.count("pgsty/minio") != 1:
    raise SystemExit(f"unexpected minio image count: {text.count('pgsty/minio')}")
path.write_text(text)
print("MINIO_OVERRIDE_OK")
