from pathlib import Path

root = Path("/opt/av_ops/docker/av_ops")
env_path = root / ".env"
conf_path = root / "huly_v7.conf"
override = root / "compose.override.yml"

conf = {}
for line in conf_path.read_text().splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    conf[key] = value

out = []
for line in env_path.read_text().splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        if key.endswith("_IMAGE") and key in conf:
            line = f"{key}={conf[key]}"
    out.append(line)
env_path.write_text("\n".join(out) + "\n")
env_path.chmod(0o600)

lines = override.read_text().splitlines()
fixed = []
needles = {
    "image: ${ACCOUNT_IMAGE}",
    "image: ${FRONT_IMAGE}",
    "image: ${CALENDAR_IMAGE}",
}
for i, line in enumerate(lines):
    fixed.append(line)
    stripped = line.strip()
    if stripped in needles:
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if not nxt.startswith("pull_policy:"):
            indent = line[: len(line) - len(line.lstrip())]
            fixed.append(f"{indent}pull_policy: if_not_present")
override.write_text("\n".join(fixed) + "\n")
print("PATCH_OK")
