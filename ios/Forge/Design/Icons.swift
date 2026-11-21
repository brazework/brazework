import SwiftUI

// The web's icons on iPhone. The web draws every icon with Lucide (lucide-react, thin round
// strokes); the app used SF Symbols, so the two looked like different products. The Lucide icons
// are in Assets.xcassets/Lucide (generated from web/node_modules/lucide-react by
// scripts/lucide-icons.mjs, from the table below), and `Icon` shows the Lucide twin of an SF Symbol
// name wherever the app asks for one. It sizes itself like the symbol it replaces (it sits in that
// symbol's frame), so fonts, Dynamic Type and Labels lay out as before. A name with no twin falls
// back to the SF Symbol.
enum Lucide {
  /// SF Symbol → Lucide, matching the web's choice where the web shows the same thing
  /// (sidebar.tsx PLACE_ICON for the five places: House, FolderGit2, Users, BadgeCheck, Inbox).
  static let twin: [String: String] = [
    // The five places
    "house": "house", "house.fill": "house", "hammer": "folder-git-2", "person.3": "users", "person.3.fill": "users",
    "checkmark.seal": "badge-check", "checkmark.seal.fill": "badge-check", "tray": "inbox",
    // Home and posts
    "bell": "bell", "bell.badge": "bell-dot", "magnifyingglass": "search", "square.and.pencil": "square-pen",
    "photo.on.rectangle.angled": "images", "photo": "image", "questionmark.bubble": "message-circle-question-mark",
    "heart": "heart", "heart.fill": "heart.fill", "heart.slash": "heart-off",
    "bubble.left": "message-circle", "bubble.left.fill": "message-circle", "text.bubble": "message-square-text",
    "bubble.left.and.bubble.right": "messages-square", "bubble.left.and.bubble.right.fill": "messages-square",
    "bookmark": "bookmark", "bookmark.fill": "bookmark.fill", "bookmark.slash": "bookmark-x",
    "square.and.arrow.up": "share", "arrowshape.turn.up.left": "reply", "sparkles": "sparkles", "flame.fill": "flame",
    "megaphone": "megaphone", "megaphone.fill": "megaphone", "safari": "compass",
    // Actions
    "plus": "plus", "plus.circle": "circle-plus", "plus.circle.fill": "circle-plus", "xmark": "x", "xmark.circle.fill": "circle-x",
    "checkmark": "check", "checkmark.circle": "circle-check", "checkmark.circle.fill": "circle-check",
    "checkmark.shield": "shield-check", "checkmark.shield.fill": "shield-check",
    "arrow.up": "arrow-up", "arrow.right": "arrow-right", "arrow.up.right": "arrow-up-right", "arrow.up.circle": "circle-arrow-up",
    "arrow.uturn.backward": "undo-2", "arrow.up.left.and.arrow.down.right": "maximize-2", "arrow.triangle.turn.up.right.diamond.fill": "navigation",
    "ellipsis": "ellipsis", "ellipsis.circle": "circle-ellipsis", "chevron.down": "chevron-down", "chevron.right": "chevron-right",
    "pencil": "pencil", "trash": "trash-2", "doc.on.doc": "copy", "link": "link", "lock": "lock", "flag": "flag",
    "paperplane.fill": "send", "line.3.horizontal.decrease.circle": "list-filter", "gearshape": "settings",
    // People
    "person.fill": "user", "person.crop.circle": "circle-user", "person.2": "users-round", "person.2.fill": "users-round",
    "person.2.badge.plus": "user-plus", "hand.raised": "hand", "hand.raised.slash": "ban",
    "graduationcap.fill": "graduation-cap", "briefcase.fill": "briefcase", "face.smiling": "smile", "eye.slash": "eye-off",
    // Status and media
    "exclamationmark.circle": "circle-alert", "exclamationmark.triangle": "triangle-alert", "questionmark.circle": "circle-question-mark",
    "clock": "clock", "arrow.triangle.pull": "git-pull-request", "calendar": "calendar-days", "circle": "circle", "envelope.open": "mail-open", "envelope.badge": "mail", "mappin.and.ellipse": "map-pin",
    "video.fill": "video", "play.fill": "play.fill", "speaker.wave.2.fill": "volume-2", "speaker.slash.fill": "volume-x",
  ]

  /// The asset for an SF Symbol name, if it has a Lucide twin.
  static func asset(_ sf: String) -> String? { twin[sf].map { "lc.\($0)" } }
}

/// An icon by SF Symbol name, shown as its Lucide twin (see `Lucide`).
struct Icon: View {
  let name: String
  init(_ name: String) { self.name = name }

  var body: some View {
    if let asset = Lucide.asset(name) {
      // The symbol's own frame, so the icon is exactly as big as the SF Symbol was.
      Image(systemName: "square").hidden()
        .overlay { Image(asset).resizable().scaledToFit().scaleEffect(1.08) }
        .accessibilityHidden(true)
    } else {
      Image(systemName: name)
    }
  }
}

extension Label where Title == Text, Icon == Forge.Icon {
  init(_ title: LocalizedStringKey, icon: String) { self.init { Text(title) } icon: { Forge.Icon(icon) } }
  @_disfavoredOverload init<S: StringProtocol>(_ title: S, icon: String) { self.init { Text(title) } icon: { Forge.Icon(icon) } }
}

extension Button where Label == SwiftUI.Label<Text, Icon> {
  init(_ title: LocalizedStringKey, icon: String, role: ButtonRole? = nil, action: @escaping () -> Void) {
    self.init(role: role, action: action) { SwiftUI.Label(title, icon: icon) }
  }
  @_disfavoredOverload init<S: StringProtocol>(_ title: S, icon: String, role: ButtonRole? = nil, action: @escaping () -> Void) {
    self.init(role: role, action: action) { SwiftUI.Label(title, icon: icon) }
  }
}

extension Menu where Label == SwiftUI.Label<Text, Icon> {
  init(_ title: LocalizedStringKey, icon: String, @ViewBuilder content: () -> Content) {
    self.init(content: content) { SwiftUI.Label(title, icon: icon) }
  }
}
