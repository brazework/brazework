import SwiftUI

// The web app's skins (globals.css), light and dark, so Forge looks like Forge on both.
enum Skin: String, CaseIterable, Identifiable, Sendable {
  case forge, blueprint, fire, aurora, emerald
  var id: String { rawValue }
  var label: String { rawValue == "forge" ? "Graphite" : rawValue.capitalized }
}

struct Palette: Sendable {
  var bg, surface, surface2, raised, border, text, text2, muted, faint, accent, onAccent: Color
  var grad: [Color]
  var danger = Color(hex: 0xDC2626)

  var gradient: LinearGradient { LinearGradient(colors: grad, startPoint: .topLeading, endPoint: .bottomTrailing) }

  static func of(_ skin: Skin, dark: Bool) -> Palette {
    switch (skin, dark) {
    case (.forge, false): .init(bg: .init(hex: 0xFFFFFF), surface: .init(hex: 0xFAFAFA), surface2: .init(hex: 0xF4F4F5), raised: .init(hex: 0xECECEE), border: .init(hex: 0xE4E4E7), text: .init(hex: 0x09090B), text2: .init(hex: 0x27272A), muted: .init(hex: 0x52525B), faint: .init(hex: 0x71717A), accent: .init(hex: 0x09090B), onAccent: .white, grad: [.init(hex: 0x27272A), .init(hex: 0x09090B)])
    case (.forge, true): .init(bg: .init(hex: 0x09090B), surface: .init(hex: 0x101012), surface2: .init(hex: 0x161618), raised: .init(hex: 0x1F1F22), border: .init(hex: 0x232326), text: .init(hex: 0xFAFAFA), text2: .init(hex: 0xD4D4D8), muted: .init(hex: 0xA1A1AA), faint: .init(hex: 0x8B8B94), accent: .init(hex: 0xFAFAFA), onAccent: .init(hex: 0x09090B), grad: [.init(hex: 0xFFFFFF), .init(hex: 0xD4D4D8)], danger: .init(hex: 0xF87171))
    case (.blueprint, false): .init(bg: .init(hex: 0xF4F7FB), surface: .white, surface2: .init(hex: 0xEEF3FA), raised: .init(hex: 0xE2EAF6), border: .init(hex: 0xC9D7EA), text: .init(hex: 0x0E2A52), text2: .init(hex: 0x1E3D6B), muted: .init(hex: 0x3C5C8A), faint: .init(hex: 0x4B6A95), accent: .init(hex: 0x1F5FBF), onAccent: .white, grad: [.init(hex: 0x2563EB), .init(hex: 0x1F5FBF), .init(hex: 0x1E40AF)])
    case (.blueprint, true): .init(bg: .init(hex: 0x0A1C35), surface: .init(hex: 0x0E2645), surface2: .init(hex: 0x112D52), raised: .init(hex: 0x15365F), border: .init(hex: 0x23477A), text: .init(hex: 0xEAF2FF), text2: .init(hex: 0xC8DAF4), muted: .init(hex: 0x9DB9DF), faint: .init(hex: 0x8AA8D2), accent: .init(hex: 0x7CC4FF), onAccent: .init(hex: 0x0A1C35), grad: [.init(hex: 0xA5D8FF), .init(hex: 0x7CC4FF), .init(hex: 0x5B9DFF)], danger: .init(hex: 0xF87171))
    case (.fire, false): .init(bg: .init(hex: 0xFFF8F3), surface: .white, surface2: .init(hex: 0xFFF1E7), raised: .init(hex: 0xFFE6D5), border: .init(hex: 0xF3D6C2), text: .init(hex: 0x2A1208), text2: .init(hex: 0x4A2413), muted: .init(hex: 0x7A4528), faint: .init(hex: 0x8A5434), accent: .init(hex: 0xEA580C), onAccent: .init(hex: 0x2A1208), grad: [.init(hex: 0xFCD34D), .init(hex: 0xFB923C), .init(hex: 0xF87171)])
    case (.fire, true): .init(bg: .init(hex: 0x120A07), surface: .init(hex: 0x1A100B), surface2: .init(hex: 0x21150E), raised: .init(hex: 0x2B1B12), border: .init(hex: 0x3A2518), text: .init(hex: 0xFFF4EC), text2: .init(hex: 0xF3D9C6), muted: .init(hex: 0xD4AB8E), faint: .init(hex: 0xBD9172), accent: .init(hex: 0xFF7A2F), onAccent: .init(hex: 0x1A0B04), grad: [.init(hex: 0xFFD166), .init(hex: 0xFF8A3D), .init(hex: 0xFF4D4D)], danger: .init(hex: 0xF87171))
    case (.aurora, false): .init(bg: .init(hex: 0xF7F6FF), surface: .white, surface2: .init(hex: 0xF1EFFF), raised: .init(hex: 0xE7E3FF), border: .init(hex: 0xDCD6F7), text: .init(hex: 0x1B1442), text2: .init(hex: 0x2E2563), muted: .init(hex: 0x544A8A), faint: .init(hex: 0x665C9C), accent: .init(hex: 0x6D28D9), onAccent: .init(hex: 0x1B1442), grad: [.init(hex: 0x67E8F9), .init(hex: 0xA5B4FC), .init(hex: 0xF0ABFC)])
    case (.aurora, true): .init(bg: .init(hex: 0x0B0A1A), surface: .init(hex: 0x121029), surface2: .init(hex: 0x171433), raised: .init(hex: 0x1F1B42), border: .init(hex: 0x2C2757), text: .init(hex: 0xF1EFFF), text2: .init(hex: 0xD6D1FB), muted: .init(hex: 0xAAA3DF), faint: .init(hex: 0x968FCF), accent: .init(hex: 0xA78BFA), onAccent: .init(hex: 0x0B0A1A), grad: [.init(hex: 0x22D3EE), .init(hex: 0x818CF8), .init(hex: 0xE879F9)], danger: .init(hex: 0xF87171))
    case (.emerald, false): .init(bg: .init(hex: 0xF4FBF7), surface: .white, surface2: .init(hex: 0xECF8F1), raised: .init(hex: 0xDCF2E5), border: .init(hex: 0xC6E8D3), text: .init(hex: 0x06291C), text2: .init(hex: 0x0D3D2A), muted: .init(hex: 0x2F6650), faint: .init(hex: 0x3F735C), accent: .init(hex: 0x047857), onAccent: .init(hex: 0x06291C), grad: [.init(hex: 0xBEF264), .init(hex: 0x6EE7B7), .init(hex: 0x67E8F9)])
    case (.emerald, true): .init(bg: .init(hex: 0x06140F), surface: .init(hex: 0x0A1D16), surface2: .init(hex: 0x0E241B), raised: .init(hex: 0x132F24), border: .init(hex: 0x1D3D30), text: .init(hex: 0xECFFF6), text2: .init(hex: 0xC9F2DD), muted: .init(hex: 0x94CDB2), faint: .init(hex: 0x7FBCA0), accent: .init(hex: 0x34D399), onAccent: .init(hex: 0x06140F), grad: [.init(hex: 0xD9F99D), .init(hex: 0x34D399), .init(hex: 0x22D3EE)], danger: .init(hex: 0xF87171))
    }
  }

  // The brand gradient (the landing's "everyone in STEM"), same in every skin.
  static let brand = LinearGradient(colors: [Color(hex: 0x22D3EE), Color(hex: 0x818CF8), Color(hex: 0xE879F9)], startPoint: .leading, endPoint: .trailing)
}

extension Color {
  init(hex: UInt32) {
    self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
  }
}

private struct PaletteKey: EnvironmentKey { static let defaultValue = Palette.of(.forge, dark: false) }
extension EnvironmentValues {
  var palette: Palette {
    get { self[PaletteKey.self] }
    set { self[PaletteKey.self] = newValue }
  }
}

// Picks the palette for the chosen skin and the current light/dark mode.
struct Themed: ViewModifier {
  @AppStorage("forge-skin") private var skin = Skin.forge.rawValue
  @AppStorage("forge-appearance") private var appearance = "system"
  @Environment(\.colorScheme) private var scheme

  func body(content: Content) -> some View {
    let p = Palette.of(Skin(rawValue: skin) ?? .forge, dark: scheme == .dark)
    content
      .environment(\.palette, p)
      .tint(p.accent)
      .preferredColorScheme(appearance == "light" ? .light : appearance == "dark" ? .dark : nil)
  }
}
