"""Copy a recorded trace into public/traces/ for AetherOS Replay, without the hostname."""
import json, sys
from pathlib import Path

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.parent.mkdir(parents=True, exist_ok=True)
with open(src, encoding="utf-8") as f, open(dst, "w", encoding="utf-8") as out:
    for i, line in enumerate(f):
        obj = json.loads(line)
        if i == 0 and obj.get("type") == "header":
            obj.get("machine", {}).pop("hostname", None)
            obj["note"] = "W1 spillstress (256 MB blocks every 2 s to 7 GB), RTX 3050 6 GB laptop, sysmem fallback ON"
        out.write(json.dumps(obj, separators=(",", ":")) + "\n")
print(f"wrote {dst} ({dst.stat().st_size // 1024} KB)")
