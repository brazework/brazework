# 3D: one good viewer, in the product and on the landing page

Date: 2026-11-16 · Status: **approved by Josh in conversation ("Yes, build it")** · Linear FIX-98 · Follows the landing redesign (FIX-117, PR #73)

## Why

Josh asked for the landing page's "project 3D" to be higher quality, and for it to be better and useful in the actual product. Today there are two unrelated things:

- **Landing page and Build cards:** a line drawing on a 2D canvas (`components/landing/model-3d.tsx`). It shows one of seven stock shapes chosen by the member's field, not their project.
- **Project page:** a real three.js viewer for uploaded STL, OBJ, GLB and 3MF (`components/projects/model-viewer.tsx`). Basic lights, a fixed navy background that ignores light and dark, and no tools. It redraws 60 times a second even when nothing moves.

The landing redesign (PR #73) removed the old Projects section, so the landing page currently shows no 3D at all.

## What changes

1. **One viewer.** The project-page viewer is upgraded and used everywhere 3D appears:
   - studio lighting (an environment map), a soft ground shadow, filmic tone mapping;
   - a background and a default material that follow the theme;
   - draws only while something is moving (turning, dragging, a camera move), then stops;
   - on phones, a sideways drag turns the model and an up-down drag scrolls the page; full screen gives the full controls.
2. **Tools for checking work.** View buttons (front, side, top, angled); a see-through toggle that shows the edges; a size readout taken from the file, with its unit when the format has one; an "explode" control when the model has more than one part; full screen.
3. **Build cards show the member's own model.** A project with an uploaded 3D file gets a "View in 3D" button on its Build card. The file is downloaded only when it's pressed (FIX-75: models are large). Projects without one keep the line drawing.
4. **Landing page.** A "Show the build" section with the same viewer and example models built in code (labelled as examples). three.js loads only when the viewer nears the screen. The app tour's Build place links to it.
5. **Added while building, at Josh's request ("it has to show different examples of what you can post based on what you do and have a blueprint mode"):**
   - **Examples by field.** A picker above the viewer: Robotics (a line-following robot), Aerospace (a rocket), Mechanical (a gearbox), Electronics (a battery management board), Civil (a balsa truss bridge), Biology (a DNA model). Each shows the build, the kind of milestone that goes with it, and who would sign it.
   - **Blueprint mode.** A third way of drawing any model, beside solid and see-through: white line work on blue drawing paper with hidden lines removed, and the model's width, depth and height drawn in as dimension lines with their lengths. It works on members' uploaded files too.

## Approaches considered

- **Upgrade the real viewer and reuse it (picked).** One code path, so the landing page can't drift from the product, and every improvement lands for real members.
- **Polish the line drawings.** Cheaper, but they can't show surfaces or a member's real file, so it doesn't meet "higher quality" or "useful".
- **A hosted viewer or `<model-viewer>` web component.** Good defaults, but a new dependency beside three.js (already shipped), less control over tools like explode and size, and it wants GLB.

## Not in this change

- AI tools creating or editing models ("3D modeling MCP" in FIX-98).
- Saving a picture of the model as the project's cover, comments pinned to the model, measuring between points.
- STEP, IGES and native CAD files (they still download).
- Any database step.

## What would make this a failure

- Models download for people who never open them (egress, FIX-75).
- The landing page loses its Lighthouse budgets, or loads three.js before the viewer is near the screen.
- The viewer traps scrolling on a phone.
- A model that opens today stops opening.

## Calls made by Claude

- Which tools (views, see-through, size, explode, full screen).
- Size is shown in the file's own numbers. glTF is metres by its spec and 3MF millimetres by default; STL and OBJ carry no unit, so those say "file units".
- "View in 3D" on Build cards is a press, not automatic.
- The sample is a line-following robot, to match the landing page's example project.
