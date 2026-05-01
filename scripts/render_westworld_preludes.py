#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import textwrap
import urllib.request
from pathlib import Path


PRELUDES = {
    "I": [
        (
            "01_android_piano",
            "CLEARLY SHOW one female android seated alone at a piano in a black void, white synthetic face, calm emotionless expression, cold light, no hat, no cowboy hat, no extra people, non-sexual scene, no nudity, premium cinematic realism, dark contrast, no text, no watermark",
            "01 仿生人钢琴",
        ),
        (
            "02_robotic_horse",
            "CLEARLY SHOW one robotic horse running alone through a vast dark space, hard spotlight on the metallic skeleton, no rider, no extra human, full horse body visible, premium cinematic realism, dark contrast, no text, no watermark",
            "02 机械马奔跑",
        ),
        (
            "03_android_assembly",
            "CLEARLY SHOW one male android in a clinical industrial assembly bay, robotic assembly arms attaching white armored shell panels over a metallic humanoid frame, industrial manufacturing process, non-sexual industrial scene, no exposed flesh, no nudity, no gore, premium cinematic realism, dark contrast, no text, no watermark",
            "03 仿生人组装",
        ),
        (
            "04_female_android_closeup",
            "CLEARLY SHOW one female android close-up portrait, white synthetic face, calm expression, cold light across the face, black background, no hat, no cowboy hat, no extra people, non-sexual scene, no nudity, premium cinematic realism, dark contrast, no text, no watermark",
            "04 女性仿生人特写",
        ),
    ],
    "II": [
        (
            "01_corridor_walk",
            "CLEARLY SHOW one female android walking alone through a sterile underground corridor, glossy white synthetic skin, soft cold light, reflective floor, no hat, no extra people, premium cinematic realism, dark contrast, no text, no watermark",
            "01 地下走廊行进",
        ),
        (
            "02_host_chamber",
            "CLEARLY SHOW rows of dormant android bodies suspended in a circular chamber, one female android in the foreground observing them, cold laboratory light, premium cinematic realism, dark contrast, no text, no watermark",
            "02 沉睡宿主体舱",
        ),
        (
            "03_player_piano_hall",
            "CLEARLY SHOW an automatic player piano in an empty western saloon set inside a sterile lab, mechanical keys moving on their own, dramatic spotlight, premium cinematic realism, dark contrast, no text, no watermark",
            "03 自动钢琴厅",
        ),
        (
            "04_eye_reflection",
            "CLEARLY SHOW an extreme close-up of a female android eye reflecting a western town under construction, cold clinical light, no hat, no extra people, premium cinematic realism, dark contrast, no text, no watermark",
            "04 眼中倒影",
        ),
    ],
    "III": [
        (
            "01_desert_street",
            "CLEARLY SHOW one male android standing alone in a dusty western street at dawn, white synthetic skin under black coat, empty town, no hat, no extra people, premium cinematic realism, golden dawn light, no text, no watermark",
            "01 黎明街道",
        ),
        (
            "02_lab_horse_bay",
            "CLEARLY SHOW a robotic horse frame inside an industrial maintenance bay, sparks and articulated tools around it, no rider, no extra human, premium cinematic realism, dark contrast, no text, no watermark",
            "02 马体维护舱",
        ),
        (
            "03_female_profile",
            "CLEARLY SHOW one female android side profile in warm dusk light, desert horizon behind her, composed expression, no hat, premium cinematic realism, no text, no watermark",
            "03 女性侧影",
        ),
        (
            "04_city_model",
            "CLEARLY SHOW a miniature western city model inside a dark laboratory, mechanical arms moving above it like gods, premium cinematic realism, no extra people, no text, no watermark",
            "04 城镇模型",
        ),
    ],
    "IV": [
        (
            "01_dual_worlds",
            "CLEARLY SHOW one female android standing between a western street and a sterile laboratory wall, split-world composition, cold and warm light meeting, no hat, no extra people, premium cinematic realism, no text, no watermark",
            "01 双重世界",
        ),
        (
            "02_male_android_turn",
            "CLEARLY SHOW one male android turning back over his shoulder in a dark western saloon set, strong window light, no hat, no extra people, premium cinematic realism, no text, no watermark",
            "02 男性仿生人回望",
        ),
        (
            "03_mechanical_hands",
            "CLEARLY SHOW large robotic hands reaching toward a piano keyboard in darkness, precise industrial detail, dramatic spotlight, premium cinematic realism, no text, no watermark",
            "03 机械手与琴键",
        ),
        (
            "04_void_horses",
            "CLEARLY SHOW multiple robotic horses moving through a black void in synchronized formation, metallic anatomy under narrow beams of light, no riders, premium cinematic realism, no text, no watermark",
            "04 虚空马群",
        ),
    ],
    "V": [
        (
            "01_female_center_stage",
            "CLEARLY SHOW one female android seated at the center of a circular lab stage, suspended lights above, black void around, no hat, no extra people, premium cinematic realism, no text, no watermark",
            "01 中央舞台",
        ),
        (
            "02_burning_set",
            "CLEARLY SHOW a western street set partially burning inside a vast indoor soundstage, one male android walking through smoke, no hat, premium cinematic realism, no gore, no text, no watermark",
            "02 燃烧布景街",
        ),
        (
            "03_control_room",
            "CLEARLY SHOW a dark observation control room overlooking a synthetic world, holographic maps and pale light, no extra people, premium cinematic realism, no text, no watermark",
            "03 观测控制室",
        ),
        (
            "04_face_to_face",
            "CLEARLY SHOW one female android and one male android standing face to face in a sterile corridor, emotional tension, cold overhead light, no hats, premium cinematic realism, no text, no watermark",
            "04 正面对峙",
        ),
    ],
    "VI": [
        (
            "01_final_walk",
            "CLEARLY SHOW one female android walking forward out of darkness toward warm dawn light, long shadow, determined calm expression, no hat, no extra people, premium cinematic realism, no text, no watermark",
            "01 最终前行",
        ),
        (
            "02_horse_silhouette",
            "CLEARLY SHOW one robotic horse in silhouette against a bright circular light, metallic frame visible at the edges, no rider, premium cinematic realism, no text, no watermark",
            "02 马体剪影",
        ),
        (
            "03_assembly_cathedral",
            "CLEARLY SHOW a vast cathedral-like assembly hall filled with suspended android forms and moving robotic arms, sacred industrial atmosphere, premium cinematic realism, no text, no watermark",
            "03 装配圣殿",
        ),
        (
            "04_final_closeup",
            "CLEARLY SHOW one female android close-up with a single tear-like highlight in her eye, black background, cold light, calm but awakened expression, no hat, no extra people, premium cinematic realism, no text, no watermark",
            "04 终曲特写",
        ),
    ],
}


HTML_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  <style>
    body {{ margin: 0; font-family: Georgia, serif; background: #05070b; color: #f5efe3; }}
    main {{ max-width: 1100px; margin: 0 auto; padding: 32px 20px 60px; }}
    h1 {{ font-size: 32px; margin: 0 0 16px; }}
    p {{ color: #c8c1b4; line-height: 1.6; }}
    video {{ width: 100%; border-radius: 18px; background: #000; box-shadow: 0 20px 50px rgba(0,0,0,.35); }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 16px; margin-top: 24px; }}
    img {{ width: 100%; display: block; border-radius: 14px; }}
    .card {{ background: rgba(255,255,255,0.04); padding: 12px; border-radius: 16px; }}
    .label {{ margin-top: 8px; font-size: 14px; color: #d8cfbe; }}
  </style>
</head>
<body>
  <main>
    <h1>{title}</h1>
    <p>{description}</p>
    <video controls playsinline poster="/probes/{slug}/poster.jpg">
      <source src="/probes/{slug}/video.mp4" type="video/mp4" />
    </video>
    <div class="grid">
      {cards}
    </div>
  </main>
</body>
</html>
"""


def generate_image(api_key: str, model: str, prompt: str, output_path: Path) -> None:
    payload = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "size": "1536x1024",
            "quality": "medium",
            "output_format": "png",
            "background": "opaque",
        }
    ).encode()
    req = urllib.request.Request(
        os.environ.get("CSS_OPENAI_IMAGE_URL", "https://api.openai.com/v1/images/generations"),
        data=payload,
        method="POST",
    )
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=240) as resp:
        data = json.loads(resp.read().decode())
    image_b64 = data["data"][0]["b64_json"]
    output_path.write_bytes(base64.b64decode(image_b64))


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def load_env_file_if_present(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip('"').strip("'")


def compose_video(work_dir: Path, output_video: Path, poster_path: Path) -> None:
    concat_path = work_dir / "concat.txt"
    if concat_path.exists():
        concat_path.unlink()
    segs = []
    for png in sorted(work_dir.glob("*.png")):
        seg = work_dir / f"seg_{png.stem}.mp4"
        run(
            [
                "ffmpeg",
                "-y",
                "-loop",
                "1",
                "-i",
                str(png),
                "-t",
                "4",
                "-vf",
                "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24,format=yuv420p",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(seg),
            ]
        )
        segs.append(seg)
    concat_path.write_text("".join(f"file '{seg}'\n" for seg in segs), encoding="utf-8")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_path), "-c", "copy", str(output_video)])
    run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-show_streams", str(output_video)])
    run(["ffmpeg", "-y", "-i", str(output_video), "-ss", "00:00:02", "-frames:v", "1", str(poster_path)])


def ensure_scene_png(
    *,
    api_key: str | None,
    model: str,
    prompt: str,
    work_png: Path,
    asset_png: Path,
    refresh_images: bool,
) -> None:
    if not refresh_images:
        if asset_png.exists():
            work_png.write_bytes(asset_png.read_bytes())
            return
        if work_png.exists():
            return

    if not api_key:
        raise RuntimeError(
            f"missing OPENAI_API_KEY and no reusable scene image found for {work_png.name}"
        )

    generate_image(api_key, model, prompt, work_png)
    asset_png.write_bytes(work_png.read_bytes())


def render_prelude(
    name: str,
    repo_root: Path,
    shared_root: Path,
    public_probes_root: Path,
    *,
    refresh_images: bool,
) -> None:
    scenes = PRELUDES[name]
    slug = f"westworld-prelude-{name.lower()}"
    title = f"西部世界歌剧MV·前奏曲 {name}"
    description = "当前版本为基于脚本约束与 OpenAI 图像生成的前奏短片验收版，重点检查人物、场景、动作与风格。"
    work_dir = repo_root / "tmp" / slug
    asset_dir = shared_root / slug
    public_dir = public_probes_root / slug
    work_dir.mkdir(parents=True, exist_ok=True)
    asset_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_IMAGE_MODEL") or os.environ.get("CSS_OPENAI_IMAGE_MODEL") or "gpt-image-1"

    cards = []
    for slug_part, prompt, label in scenes:
        png_path = work_dir / f"{slug_part}.png"
        target_png = asset_dir / png_path.name
        ensure_scene_png(
            api_key=api_key,
            model=model,
            prompt=prompt,
            work_png=png_path,
            asset_png=target_png,
            refresh_images=refresh_images,
        )
        cards.append(
            f'<div class="card"><img src="https://cssstudio.app/api/shared-assets/blob?path={slug}%2F{png_path.name}" alt="{slug_part}"><div class="label">{label}</div></div>'
        )

    video_path = work_dir / "video.mp4"
    poster_path = work_dir / "poster.jpg"
    compose_video(work_dir, video_path, poster_path)
    (asset_dir / "video.mp4").write_bytes(video_path.read_bytes())
    (public_dir / "video.mp4").write_bytes(video_path.read_bytes())
    (public_dir / "poster.jpg").write_bytes(poster_path.read_bytes())
    (public_dir / "index.html").write_text(
        HTML_TEMPLATE.format(
            title=title,
            description=description,
            slug=slug,
            cards="\n      ".join(cards),
        ),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Render Westworld prelude probe videos.")
    parser.add_argument("preludes", nargs="+", choices=sorted(PRELUDES.keys()))
    parser.add_argument("--repo-root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--shared-root", default="/srv/cssos/shared/assets")
    parser.add_argument("--public-probes-root", default="/srv/cssos/current/public/probes")
    parser.add_argument(
        "--refresh-images",
        action="store_true",
        help="Regenerate scene PNGs with OpenAI instead of reusing existing assets when available.",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo_root)
    load_env_file_if_present(repo_root / ".env.local")
    load_env_file_if_present(Path("/etc/cssos.env"))
    shared_root = Path(args.shared_root)
    public_root = Path(args.public_probes_root)
    for prelude in args.preludes:
        print(f"rendering prelude {prelude}", flush=True)
        render_prelude(
            prelude,
            repo_root,
            shared_root,
            public_root,
            refresh_images=args.refresh_images,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
