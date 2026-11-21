import SwiftUI

// Home's one next step: this week's goal, the same rule and words as the web's Home
// (web/src/app/(app)/feed/next-step.tsx, ForgeKit/WeekGoal.swift). Others waiting on you first,
// then what makes your work verifiable, then keeping your streak. Done for the week: one quiet line
// instead of a card. Each button goes to the iPhone's own place for it when there is one (the
// composer, Clubs), and to the same page as the web's button otherwise (verifying and starting a
// project or a signature request happen on the web for now).
struct NextStepView: View {
  let goal: WeekGoal?
  var log: () -> Void
  @Environment(AppNav.self) private var nav
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL

  var body: some View {
    if let goal {
      if goal.done {
        Label { Text("\(goal.text). Next week starts Monday.") } icon: { Icon("checkmark.seal.fill").foregroundStyle(p.ok) }
          .font(.subheadline).foregroundStyle(p.text2)
          .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4).padding(.vertical, 2)
          .accessibilityElement(children: .combine).accessibilityLabel("Next step: \(goal.text). Next week starts Monday.")
      } else {
        card(goal)
      }
    } else {
      // Holds the slot while the goal loads (nothing to show until it's real).
      Color.clear.frame(height: 1)
    }
  }

  private func go(_ goal: WeekGoal) {
    switch goal.id {
    case "update", "share": log()
    case "join": nav.tab = .clubs
    default: if let url = URL(string: goal.href, relativeTo: Env.webURL)?.absoluteURL { openURL(url) }
    }
  }

  private func card(_ goal: WeekGoal) -> some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Label("Next step".uppercased(), icon: "safari").labelStyle(.titleAndIcon)
          .font(.caption2.weight(.semibold)).kerning(0.6).foregroundStyle(p.faint).lineLimit(1)
        Text(goal.text).font(.headline).foregroundStyle(p.text).fixedSize(horizontal: false, vertical: true)
      }
      Spacer(minLength: 0)
      Button { go(goal) } label: { Label(goal.action.isEmpty ? "Open" : goal.action, icon: "arrow.right").labelStyle(.titleAndIcon) }
        .buttonStyle(PrimaryButtonStyle()).frame(maxWidth: 132)
    }
    .padding(16)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
    .accessibilityElement(children: .contain).accessibilityLabel("Next step")
  }
}
