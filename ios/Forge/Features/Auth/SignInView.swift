import SwiftUI

struct SignInView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @State private var email = ""
  @State private var password = ""
  @State private var busy = false
  @State private var error: String?
  @State private var glow = false
  @FocusState private var field: Field?
  enum Field { case email, password }

  var body: some View {
    ZStack {
      p.bg.ignoresSafeArea()
      Circle().fill(Palette.brand).frame(width: 420, height: 420).blur(radius: 120).opacity(glow ? 0.35 : 0.2)
        .offset(y: -260).ignoresSafeArea().accessibilityHidden(true)
      ScrollView {
        VStack(alignment: .leading, spacing: 28) {
          Spacer(minLength: 60)
          VStack(alignment: .leading, spacing: 10) {
            Text("FORGE").font(.footnote.weight(.bold)).tracking(4).foregroundStyle(p.muted)
            (Text("Where\n") + Text("everyone in STEM").foregroundStyle(Palette.brand) + Text("\ngets found."))
              .font(.system(size: 42, weight: .bold, design: .default))
              .foregroundStyle(p.text)
              .lineSpacing(-2)
            Text("Post what you build, get it verified by your club, and get noticed by the people who care about that work.")
              .font(.callout).foregroundStyle(p.muted)
          }
          VStack(spacing: 12) {
            TextField("University or work email", text: $email)
              .textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
              .focused($field, equals: .email).submitLabel(.next).onSubmit { field = .password }
              .modifier(InputStyle())
            SecureField("Password", text: $password)
              .textContentType(.password).focused($field, equals: .password).submitLabel(.go).onSubmit { Task { await submit() } }
              .modifier(InputStyle())
            if let error { Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(p.danger).frame(maxWidth: .infinity, alignment: .leading) }
            Button { Task { await submit() } } label: { if busy { ProgressView().tint(p.onAccent) } else { Text("Log in") } }
              .buttonStyle(PrimaryButtonStyle())
              .disabled(email.isEmpty || password.isEmpty || busy)
            Button("Forgot password?") { openURL(Env.web("forgot")) }.font(.footnote).foregroundStyle(p.muted)
          }
          HStack(spacing: 4) {
            Text("New to Forge?").foregroundStyle(p.muted)
            Button("Create an account") { openURL(Env.web("signup")) }.fontWeight(.semibold)
          }
          .font(.subheadline)
          .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 24)
      }
      .scrollDismissesKeyboard(.interactively)
    }
    .onAppear { withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) { glow = true } }
  }

  private func submit() async {
    busy = true; error = nil
    defer { busy = false }
    do { try await session.signIn(email: email, password: password) } catch { self.error = friendly(error) }
  }
}

private struct InputStyle: ViewModifier {
  @Environment(\.palette) private var p
  func body(content: Content) -> some View {
    content
      .padding(.horizontal, 16).frame(minHeight: 52)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(p.border, lineWidth: 1))
  }
}
