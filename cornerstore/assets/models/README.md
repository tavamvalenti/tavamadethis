# Models

Drop a `.glb` in this folder and list it in `manifest.json` to replace a code-built stand-in:

```json
{ "props": { "register": { "file": "register.glb", "rotY": 180 } } }
```

Slots today: `register`, `stash`. The model is scaled and centred on the stand-in automatically;
`scale`, `rotY` (degrees) and `y` (metres) fine-tune it.

Pipeline: Higgsfield image, then Higgsfield image-to-3D (textured, about 20k triangles), then a
clean-up pass in Blender (origin at the base, apply transforms, 1024 px textures), then export GLB.
Keep each file under about 3 MB.
