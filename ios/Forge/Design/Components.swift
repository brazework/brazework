import SwiftUI

struct Avatar: View {
  var first: String
  var last: String
  var path: String? = nil
  var size: CGFloat = 40
  @Environment(\.palette) private var p

  var body: some View {
    let initials = "\(first.prefix(1))\(last.prefix(1))".uppercased()
    ZStack {
      Circle().fill(p.surface2)
      Text(initials.isEmpty ? "?" : initials).font(.system(size: size * 0.38, weight: .semibold)).foregroundStyle(p.text2)
      if let path, !path.isEmpty, let url = mediaURL(path) {
        AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.clear }
      }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
    .overlay(Circle().strokeBorder(p.border, lineWidth: 0.5))
    .accessibilityHidden(true)
  }
}

// The small kind label on a post ("Question", "Result", "Project").
struct KindLabel: View {
  var kind: String
  @Environment(\.palette) private var p
  var body: some View {
    if kind != "update" {
      HStack(spacing: 5) {
        Circle().fill(color).frame(width: 6, height: 6)
        Text(kind.capitalized).font(.caption.weight(.medium)).foregroundStyle(p.muted)
      }
    }
  }
  private var color: Color {
    switch kind {
    case "question": Color(hex: 0xF59E0B)
    case "result": Color(hex: 0x10B981)
    case "project": Color(hex: 0x6366F1)
    default: p.faint
    }
  }
}

struct Chip: View {
  var text: String
  var selected = false
  @Environment(\.palette) private var p
  var body: some View {
    Text(text)
      .font(.subheadline.weight(selected ? .semibold : .regular))
      .padding(.horizontal, 14).padding(.vertical, 7)
      .foregroundStyle(selected ? p.onAccent : p.text2)
      .background(selected ? AnyShapeStyle(p.accent) : AnyShapeStyle(p.surface2), in: Capsule())
  }
}

// The accent-filled main button.
struct PrimaryButtonStyle: ButtonStyle {
  @Environment(\.palette) private var p
  @Environment(\.isEnabled) private var enabled
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.body.weight(.semibold))
      .frame(maxWidth: .infinity, minHeight: 50)
      .foregroundStyle(p.onAccent)
      .background(p.accent, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .opacity(enabled ? (configuration.isPressed ? 0.8 : 1) : 0.4)
      .scaleEffect(configuration.isPressed ? 0.98 : 1)
      .animation(.snappy(duration: 0.15), value: configuration.isPressed)
  }
}

struct EmptyState: View {
  var icon: String
  var title: String
  var message: String
  @Environment(\.palette) private var p
  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: icon).font(.system(size: 34, weight: .light)).foregroundStyle(p.faint)
      Text(title).font(.headline).foregroundStyle(p.text)
      Text(message).font(.subheadline).foregroundStyle(p.muted).multilineTextAlignment(.center)
    }
    .padding(40)
    .frame(maxWidth: .infinity)
  }
}

struct Card<Content: View>: View {
  @ViewBuilder var content: Content
  @Environment(\.palette) private var p
  var body: some View {
    content
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }
}
