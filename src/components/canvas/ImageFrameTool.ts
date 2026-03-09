import { BaseBoxShapeTool } from "tldraw";

export class ImageFrameTool extends BaseBoxShapeTool {
  static override id = "image-frame" as const;
  static override initial = "idle";
  override shapeType = "canvas-image" as const;
}
