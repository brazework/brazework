import SwiftUI

// Ember, Brazework's AI: the web's glowing glass orb with light moving inside it
// (web/src/components/ember/ember.tsx and its motion in globals.css), drawn the same way on a
// 64-point canvas, back to front: a two-tone glow, a deep base, soft plasma drifting inside, bands
// of energy circling, a white-hot core, then the glass (edge glow, light gathered low, a highlight
// and a fine rim). Its colours follow the theme as on the web: black glass with white light in
// Graphite, tinted in the others. Moods are light and motion, not a face.
struct EmberOrb: View {
  enum Mood { case idle, thinking }
  var size: CGFloat = 48
  var mood: Mood = .idle
  @Environment(\.palette) private var p
  @Environment(\.accessibilityReduceMotion) private var still

  var body: some View {
    TimelineView(.animation(minimumInterval: 1 / 30, paused: still)) { tl in
      Canvas { ctx, canvas in draw(&ctx, canvas, t: still ? 0 : tl.date.timeIntervalSinceReferenceDate) }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }

  // CSS keyframes as functions of time: 0 → 1 → 0 over a period (ease-in-out, like the web's 50% stops).
  private func wave(_ t: Double, _ period: Double, delay: Double = 0) -> Double { (1 - cos((t - delay) / period * 2 * .pi)) / 2 }
  private func spin(_ t: Double, _ period: Double) -> Angle { .radians((t / period).truncatingRemainder(dividingBy: 1) * 2 * .pi) }

  private func draw(_ ctx: inout GraphicsContext, _ canvas: CGSize, t: Double) {
    let k = canvas.width / 64
    ctx.scaleBy(x: k, y: k)
    let e = p.ember, small = size < 28, thinking = mood == .thinking
    let fast = thinking ? 0.3 : 1.0
    let c = CGPoint(x: 32, y: 32)
    func circle(_ r: CGFloat, at o: CGPoint = c) -> Path { Path(ellipseIn: CGRect(x: o.x - r, y: o.y - r, width: 2 * r, height: 2 * r)) }
    func radial(_ stops: [Gradient.Stop], center: CGPoint = c, r: CGFloat) -> GraphicsContext.Shading { .radialGradient(Gradient(stops: stops), center: center, startRadius: 0, endRadius: r) }
    func around(_ ctx: inout GraphicsContext, scale s: Double = 1, rotate a: Angle = .zero) {
      ctx.translateBy(x: 32, y: 32); ctx.rotate(by: a); ctx.scaleBy(x: s, y: s); ctx.translateBy(x: -32, y: -32)
    }

    // Two-tone glow, breathing out of step.
    if !small {
      var g = ctx
      let b = wave(t, 3.6 * (thinking ? 0.3 : 1), delay: 1.8)
      around(&g, scale: 1 + 0.08 * b); g.opacity = 1 - 0.3 * b
      g.fill(circle(32), with: radial([.init(color: e.c.opacity(0.3), location: 0.5), .init(color: e.b.opacity(0), location: 1)], r: 32))
      var h = ctx
      let a = wave(t, 3.6 * (thinking ? 0.3 : 1))
      around(&h, scale: 1 + 0.08 * a); h.opacity = 1 - 0.3 * a
      h.fill(circle(28), with: radial([.init(color: e.a.opacity(0.55), location: 0.6), .init(color: e.a.opacity(0), location: 1)], r: 28))
    }

    // The body bobs.
    var body = ctx
    body.translateBy(x: 0, y: -2 * wave(t, 3.6))
    body.fill(circle(22), with: radial([.init(color: e.b, location: 0), .init(color: e.b.mix(with: .black, by: 0.25), location: 0.7), .init(color: e.b.mix(with: .black, by: 0.55), location: 1)], center: CGPoint(x: 28.8, y: 28.8), r: 28.6))

    var inside = body
    inside.clip(to: circle(22))
    // Plasma drifting inside.
    inside.drawLayer { l in
      l.addFilter(.blur(radius: 4.2))
      l.opacity = e.plasma
      var s1 = l; around(&s1, rotate: spin(t, 9 * fast)); s1.opacity = 0.95
      s1.fill(Path(ellipseIn: CGRect(x: 22 - 13, y: 40 - 9, width: 26, height: 18)), with: .color(e.c))
      var s2 = l; around(&s2, rotate: -spin(t, 13 * fast))
      s2.fill(Path(ellipseIn: CGRect(x: 41 - 12, y: 24 - 8, width: 24, height: 16)), with: .color(e.a))
      var s3 = l; around(&s3, rotate: spin(t, 17 * fast)); s3.opacity = 0.9
      s3.fill(Path(ellipseIn: CGRect(x: 42 - 9, y: 42 - 6, width: 18, height: 12)), with: .color(e.c.mix(with: e.a, by: 0.5)))
    }
    // Bands of energy circling the core.
    if !small {
      inside.drawLayer { l in
        l.addFilter(.blur(radius: 0.7))
        let band = GraphicsContext.Shading.linearGradient(Gradient(stops: [.init(color: .white.opacity(0), location: 0), .init(color: .white.opacity(0.95), location: 0.5), .init(color: e.a.opacity(0), location: 1)]), startPoint: CGPoint(x: 15, y: 32), endPoint: CGPoint(x: 49, y: 32))
        var b1 = l; around(&b1, rotate: spin(t, 6 * fast) + .degrees(-28))
        b1.stroke(Path(ellipseIn: CGRect(x: 15, y: 25.5, width: 34, height: 13)), with: band, style: StrokeStyle(lineWidth: 1.3, lineCap: .round, dash: [34, 80]))
        var b2 = l; around(&b2, rotate: -spin(t, 8.5 * fast) + .degrees(38)); b2.opacity = 0.8
        b2.stroke(Path(ellipseIn: CGRect(x: 18, y: 27, width: 28, height: 10)), with: band, style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [22, 70]))
      }
    }
    // The white-hot core, pulsing.
    var core = inside
    let pulse = wave(t, 3.6 * (thinking ? 0.3 : 1))
    around(&core, scale: 1 - 0.1 * pulse); core.opacity = 1 - 0.45 * pulse
    let cc = CGPoint(x: 31.5, y: 33)
    core.fill(circle(10, at: cc), with: radial([.init(color: .white, location: 0), .init(color: e.a.mix(with: .white, by: 0.65).opacity(0.75), location: 0.35), .init(color: e.a.opacity(0), location: 1)], center: cc, r: 10))
    // Light gathered low in the glass.
    inside.drawLayer { l in
      l.addFilter(.blur(radius: 2.2)); l.opacity = 0.4
      l.fill(Path(ellipseIn: CGRect(x: 26, y: 43, width: 20, height: 8)), with: .color(.white))
    }

    // The glass: fresnel edge glow, a highlight up top, a fine rim.
    var glass = body
    glass.opacity = e.fresnel
    glass.fill(circle(22), with: radial([.init(color: .white.opacity(0), location: 0.72), .init(color: e.a.mix(with: .white, by: 0.6).opacity(0.45), location: 0.95), .init(color: .white.opacity(0.7), location: 1)], r: 22))
    var spec = body
    spec.translateBy(x: 25, y: 19.5); spec.rotate(by: .degrees(-28)); spec.opacity = 0.85
    spec.fill(Path(ellipseIn: CGRect(x: -9, y: -4.6, width: 18, height: 9.2)), with: radial([.init(color: .white.opacity(0.95), location: 0), .init(color: .white.opacity(0), location: 1)], center: CGPoint(x: 0, y: -0.9), r: 9.9))
    if !small {
      var low = body
      low.translateBy(x: 41.5, y: 46); low.rotate(by: .degrees(-35)); low.opacity = 0.35
      low.fill(Path(ellipseIn: CGRect(x: -3.2, y: -1.3, width: 6.4, height: 2.6)), with: .color(.white))
    }
    body.stroke(circle(21.7), with: .color(.white.opacity(0.3)), lineWidth: 0.6)
  }
}

/// Ember's colours per theme (globals.css --ember-a/b/c): its bright tone, deep tone and the accent
/// that swirls through it. Graphite is black glass with white light, at half plasma and fresnel.
struct EmberColors: Sendable {
  var a: Color, b: Color, c: Color, plasma: Double = 1, fresnel: Double = 1
  static func of(_ skin: Skin) -> EmberColors {
    switch skin {
    case .forge: .init(a: .white, b: Color(hex: 0x18181B), c: Color(hex: 0x71717A), plasma: 0.5, fresnel: 0.55)
    case .fire: .init(a: Color(hex: 0xFFD166), b: Color(hex: 0xFF4D4D), c: Color(hex: 0xFF3D7F))
    case .blueprint: .init(a: Color(hex: 0xA5D8FF), b: Color(hex: 0x2563EB), c: Color(hex: 0x8B5CF6))
    case .aurora: .init(a: Color(hex: 0x67E8F9), b: Color(hex: 0xC026D3), c: Color(hex: 0x818CF8))
    case .emerald: .init(a: Color(hex: 0xD9F99D), b: Color(hex: 0x10B981), c: Color(hex: 0x22D3EE))
    }
  }
}
