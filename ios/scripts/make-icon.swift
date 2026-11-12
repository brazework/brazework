// Draws the app icon: the Brazework mark (same shapes as web/src/components/brand-mark.tsx) on near-black, 1024 px.
// Run: swift scripts/make-icon.swift Forge/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size: CGFloat = 1024
let out = CommandLine.arguments.dropFirst().first ?? "AppIcon.png"
let space = CGColorSpace(name: CGColorSpace.sRGB)!
// Opaque (no alpha channel): the App Store rejects icons with one.
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
// radial-gradient(circle at 30% 20%, #27272a, #09090b 70%); flipped y for CoreGraphics.
let grad = CGGradient(colorsSpace: space, colors: [CGColor(red: 0x27/255, green: 0x27/255, blue: 0x2a/255, alpha: 1), CGColor(red: 0x09/255, green: 0x09/255, blue: 0x0b/255, alpha: 1)] as CFArray, locations: [0, 1])!
ctx.setFillColor(CGColor(red: 0x09/255, green: 0x09/255, blue: 0x0b/255, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
let center = CGPoint(x: size * 0.3, y: size * 0.8)
ctx.drawRadialGradient(grad, startCenter: center, startRadius: 0, endCenter: center, endRadius: size * 0.7 * 1.2, options: [.drawsAfterEndLocation])
// The mark: 56% of the icon, viewBox 32. A peak in two halves, filled and stroked with round joins.
let mark = size * 0.56, s = mark / 32, ox = (size - mark) / 2, oy = (size - mark) / 2
func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: size - (oy + y * s)) }
let white = CGColor(red: 0xfa/255, green: 0xfa/255, blue: 0xfa/255, alpha: 1)
ctx.setFillColor(white); ctx.setStrokeColor(white)
ctx.setLineWidth(1.6 * s); ctx.setLineJoin(.round)
for half in [[p(14.2, 6), p(14.2, 26.5), p(4.5, 26.5)], [p(17.8, 6), p(27.5, 26.5), p(17.8, 26.5)]] {
  ctx.addLines(between: half); ctx.closePath()
}
ctx.drawPath(using: .fillStroke)
// The seam between them: brass, #f28c28 at the foot to #ffd479 at the tip.
let brass = CGGradient(colorsSpace: space, colors: [CGColor(red: 0xf2/255, green: 0x8c/255, blue: 0x28/255, alpha: 1), CGColor(red: 0xff/255, green: 0xd4/255, blue: 0x79/255, alpha: 1)] as CFArray, locations: [0, 1])!
let tip = p(15.1, 4.6), foot = p(16.9, 27.3)
ctx.saveGState()
ctx.clip(to: CGRect(x: tip.x, y: foot.y, width: foot.x - tip.x, height: tip.y - foot.y))
ctx.drawLinearGradient(brass, start: CGPoint(x: tip.x, y: foot.y), end: tip, options: [])
ctx.restoreGState()
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out)")
