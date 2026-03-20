import os
import subprocess
from pathlib import Path

lang = os.environ["CSS_LANG"]
video_mp4 = Path(os.environ["CSS_VIDEO_MP4"])
mix_wav = Path(os.environ["CSS_MIX_WAV"])
sub_ass = Path(os.environ["CSS_SUB_ASS"])
out_mp4 = Path(os.environ["CSS_OUT_MP4"])

_ = (lang, sub_ass)
out_mp4.parent.mkdir(parents=True, exist_ok=True)

subprocess.run(
    [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(video_mp4),
        "-i",
        str(mix_wav),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(out_mp4),
    ],
    check=True,
)
