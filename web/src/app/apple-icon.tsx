import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

// The icon iOS uses when Brazework is added to the Home Screen. A file convention, like icon.svg (the
// browser tab's logo), so Next links both with a content hash: setting metadata.icons by hand in the
// layout replaced the tab icon entirely, and browsers showed a blank globe instead.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={size.width} />, size);
}
