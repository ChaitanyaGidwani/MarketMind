from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

from shared.output_store import OUTPUT_ROOT


def create_campaign_zip(campaign_id: str) -> str | None:
    campaign_dir = OUTPUT_ROOT / campaign_id
    if not campaign_dir.exists():
        return None

    temp_file = tempfile.NamedTemporaryFile(prefix=f"{campaign_id}-", suffix=".zip", delete=False)
    temp_file.close()

    with zipfile.ZipFile(temp_file.name, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(campaign_dir.rglob("*")):
            if path.is_file():
                zf.write(path, arcname=str(path.relative_to(campaign_dir)))

    return temp_file.name
