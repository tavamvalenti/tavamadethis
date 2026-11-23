# Models

Everything here is made with Higgsfield (image -> 3D, Meshy auto-rig) and optimised with glTF-Transform
(textures to WebP, base colour 1024 px and the other maps 512 px, quantized geometry). See `manifest.json`.

- `chars/` rigged, textured people (about 20k triangles, 1.1 to 1.6 MB each). They all share one auto-rig skeleton
  (Hips, Spine02/Spine01/Spine, neck, Head, Left/Right Arm/ForeArm/Hand, UpLeg/Leg/Foot), so any clip plays on any body.
  `outfits` decides who gets which model (`new Person({ outfit })`); `female` narrows it when the caller says so.
  No model for an outfit means the code-built body from people.js.
- `anims/` one clip per file, skeleton only. Made with Higgsfield "3d_rigging" + an animation id on the young man.
  Pose names map to clips in `js/characters.js` (POSE_CLIPS); hands up, aim, point and cower are bone overrides.
- `props/` static props. `"models"` in the manifest loads them as a library: `game.spawnModel('cash', { pos, rotY, size })`.
  `"cctv"` hangs that model under every store camera. `"props"` still replaces a store slot's code-built stand-in.

Adding a character: generate a full-body A-pose image on a plain grey background, run image_to_3d with
should_texture, enable_pbr, enable_rigging, pose_mode a-pose and target_polycount 20000, then optimise and list it.
