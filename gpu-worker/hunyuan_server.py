#!/usr/bin/env python3
"""cssOS GPU 3D worker — Hunyuan3D-2 image->textured-3D HTTP service (:7898).

Mirrors the atelier TripoSR service contract so the node side (imageToUsdzBytes)
can swap engines by host/port only.

  POST /img2usdz  {"image_url": "..."}  -> image/vnd.usdz+zip  (textured USDZ)
  POST /img2glb   {"image_url": "..."}  -> model/gltf-binary   (textured GLB)
  GET  /                                -> "ok"  (health)

Model stays resident (loaded once). V100 16GB: shape + texture fit.
If the paint/texture modules failed to build, falls back to shape-only (white).
"""
import io, os, sys, subprocess, tempfile, traceback, urllib.request
from flask import Flask, request, send_file, jsonify

UA = "Mozilla/5.0 (cssOS-gpu-worker)"   # cdn.cssstudio.app blocks default urllib UA (403)
app = Flask(__name__)

_shape = None
_paint = None
_paint_ok = False

def _load():
    global _shape, _paint, _paint_ok
    if _shape is not None:
        return
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    _shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2')
    try:
        from hy3dgen.texgen import Hunyuan3DPaintPipeline
        _paint = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2')
        _paint_ok = True
        print("[hunyuan] shape+paint loaded", flush=True)
    except Exception as e:
        _paint_ok = False
        print("[hunyuan] paint unavailable -> shape-only:", e, flush=True)

def _download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
        f.write(r.read())

def _gen_glb(image_url, out_glb):
    from PIL import Image
    _load()
    with tempfile.TemporaryDirectory() as d:
        img_path = os.path.join(d, 'in.png')
        _download(image_url, img_path)
        image = Image.open(img_path).convert("RGB")
        mesh = _shape(image=image)[0]            # trimesh / Hunyuan mesh
        if _paint_ok:
            try:
                mesh = _paint(mesh, image=image)  # bake texture from the portrait
            except Exception as e:
                print("[hunyuan] paint failed, shape-only:", e, flush=True)
        mesh.export(out_glb)

def _glb_to_usdz(glb_path, usdz_path):
    # reuse local Blender (same logic as atelier glb2usdz.py)
    script = (
        "import bpy,sys\n"
        "bpy.ops.wm.read_factory_settings(use_empty=True)\n"
        "bpy.ops.import_scene.gltf(filepath=sys.argv[-2])\n"
        "bpy.ops.wm.usd_export(filepath=sys.argv[-1], export_textures=True)\n"
    )
    sp = '/srv/ifilm/_glb2usdz_inline.py'
    open(sp, 'w').write(script)
    subprocess.run(['blender', '-b', '-P', sp, '--', glb_path, usdz_path],
                   check=True, capture_output=True)

@app.get('/')
def health():
    return "ok"

@app.post('/img2glb')
def img2glb():
    try:
        url = request.get_json(force=True)['image_url']
        with tempfile.TemporaryDirectory() as d:
            glb = os.path.join(d, 'm.glb')
            _gen_glb(url, glb)
            return send_file(glb, mimetype='model/gltf-binary',
                             as_attachment=True, download_name='model.glb')
    except Exception:
        traceback.print_exc()
        return jsonify(error=traceback.format_exc()), 500

@app.post('/img2usdz')
def img2usdz():
    try:
        url = request.get_json(force=True)['image_url']
        with tempfile.TemporaryDirectory() as d:
            glb = os.path.join(d, 'm.glb')
            usdz = os.path.join(d, 'm.usdz')
            _gen_glb(url, glb)
            _glb_to_usdz(glb, usdz)
            return send_file(usdz, mimetype='model/vnd.usdz+zip',
                             as_attachment=True, download_name='model.usdz')
    except Exception:
        traceback.print_exc()
        return jsonify(error=traceback.format_exc()), 500

if __name__ == '__main__':
    _load()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '7898')), threaded=False)
