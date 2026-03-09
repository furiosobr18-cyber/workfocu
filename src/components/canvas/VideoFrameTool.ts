import { BaseBoxShapeTool } from "tldraw";

export class VideoFrameTool extends BaseBoxShapeTool {
  static override id = "video-frame" as const;
  static override initial = "idle";
  override shapeType = "canvas-video" as const;
}
