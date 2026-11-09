// Draws the app icon: the Forge mark (same paths as web/src/app/app-icon) on near-black, 1024 px.
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
// The mark: 56% of the icon, viewBox 28.
let mark = size * 0.56, s = mark / 28, ox = (size - mark) / 2, oy = (size - mark) / 2
func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: size - (oy + y * s)) }
ctx.setStrokeColor(CGColor(red: 0xfa/255, green: 0xfa/255, blue: 0xfa/255, alpha: 1))
ctx.setLineWidth(2.2 * s); ctx.setLineJoin(.round)
ctx.move(to: p(4, 22)); ctx.addLine(to: p(14, 4)); ctx.addLine(to: p(24, 22)); ctx.closePath(); ctx.strokePath()
ctx.move(to: p(9, 22)); ctx.addLine(to: p(14, 13)); ctx.addLine(to: p(19, 22)); ctx.strokePath()
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote \(out)")
