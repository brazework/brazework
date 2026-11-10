import SwiftUI

// Create an account in three short steps: who you are, your name and birthday, then email and
// password. Students use their university email (that's how Forge knows they're students).
struct SignUpView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var form = SignUpForm()
  @State private var step = 0
  @State private var busy = false
  @State private var error: String?
  @State private var confirmEmail: String?
  @FocusState private var focus: Field?
  enum Field { case first, last, email, password }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 22) {
          ProgressView(value: Double(step + 1), total: 3).tint(p.accent).animation(.snappy, value: step)
          Group {
            switch step {
            case 0: who
            case 1: nameAndBirthday
            default: credentials
            }
          }
          .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))
          if let error { Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(p.danger) }
          Button { Task { await next() } } label: { if busy { ProgressView().tint(p.onAccent) } else { Text(step < 2 ? "Continue" : "Create account") } }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(busy)
          Text("By creating an account you agree to Forge's terms and privacy policy. Members must be 18 or older.")
            .font(.caption).foregroundStyle(p.faint)
        }
        .padding(24)
      }
      .scrollDismissesKeyboard(.interactively)
      .background(p.bg)
      .navigationTitle("Join Forge")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(step == 0 ? "Cancel" : "Back") { if step == 0 { dismiss() } else { withAnimation(.snappy) { step -= 1; error = nil } } }
        }
      }
      .navigationDestination(item: $confirmEmail) { CheckEmailView(email: $0) { dismiss() } }
    }
  }

  private var who: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("Which describes you?").font(.title2.weight(.bold)).foregroundStyle(p.text)
      choice("student", "graduationcap.fill", "Student", "Verify with your university email. Join your clubs and show your work.")
      choice("professional", "briefcase.fill", "Professional", "Engineers, scientists, researchers and the people hiring them.")
    }
  }

  private func choice(_ value: String, _ icon: String, _ title: String, _ detail: String) -> some View {
    let on = form.accountType == value
    return Button { withAnimation(.snappy) { form.accountType = value } } label: {
      HStack(alignment: .top, spacing: 14) {
        Image(systemName: icon).font(.title2).foregroundStyle(on ? p.onAccent : p.text2).frame(width: 46, height: 46)
          .background(on ? AnyShapeStyle(p.accent) : AnyShapeStyle(p.surface2), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        VStack(alignment: .leading, spacing: 3) {
          Text(title).font(.headline).foregroundStyle(p.text)
          Text(detail).font(.subheadline).foregroundStyle(p.muted).multilineTextAlignment(.leading)
        }
        Spacer(minLength: 0)
        Image(systemName: on ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(on ? p.accent : p.faint)
      }
      .padding(16)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(on ? p.accent : p.border, lineWidth: on ? 1.5 : 0.5))
    }
    .buttonStyle(PressStyle())
    .accessibilityAddTraits(on ? .isSelected : [])
    .sensoryFeedback(.selection, trigger: on)
  }

  private var nameAndBirthday: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("What's your name?").font(.title2.weight(.bold)).foregroundStyle(p.text)
      field { TextField("First name", text: $form.firstName).textContentType(.givenName).focused($focus, equals: .first).submitLabel(.next).onSubmit { focus = .last } }
      field { TextField("Last name", text: $form.lastName).textContentType(.familyName).focused($focus, equals: .last).submitLabel(.done) }
      Text("Birthday").font(.subheadline.weight(.semibold)).foregroundStyle(p.text).padding(.top, 6)
      DatePicker("Birthday", selection: $form.birthday, in: ...Date.now, displayedComponents: .date).datePickerStyle(.compact).labelsHidden()
      Text("Not shown on your profile. Forge is for people 18 and over.").font(.caption).foregroundStyle(p.faint)
    }
    .onAppear { focus = .first }
  }

  private var credentials: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text(form.accountType == "student" ? "Your university email" : "Your email").font(.title2.weight(.bold)).foregroundStyle(p.text)
      field {
        TextField(form.accountType == "student" ? "you@university.edu" : "you@company.com", text: $form.email)
          .textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
          .focused($focus, equals: .email).submitLabel(.next).onSubmit { focus = .password }
      }
      field { SecureField("Password (8+ characters)", text: $form.password).textContentType(.newPassword).focused($focus, equals: .password).submitLabel(.go).onSubmit { Task { await next() } } }
      if form.accountType == "student" { Label("We'll send a link to confirm it's yours.", systemImage: "checkmark.shield").font(.caption).foregroundStyle(p.muted) }
    }
    .onAppear { focus = .email }
  }

  private func field<C: View>(@ViewBuilder _ c: () -> C) -> some View {
    c().padding(.horizontal, 16).frame(minHeight: 52)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(p.border, lineWidth: 1))
  }

  // Each step checks only its own fields; the last one creates the account.
  private func next() async {
    error = nil
    if step == 0 { withAnimation(.snappy) { step = 1 }; return }
    if step == 1 {
      var check = form; check.email = form.accountType == "student" ? "x@x.edu" : "x@x.com"; check.password = "12345678"
      if let p = check.problem { error = p; return }
      withAnimation(.snappy) { step = 2 }; return
    }
    busy = true
    defer { busy = false }
    do {
      switch try await API.signUp(form) {
      case .signedIn: dismiss() // The session takes it from here (onboarding next).
      case .confirmEmail(let email): confirmEmail = email
      }
    } catch { self.error = friendly(error) }
  }
}

extension String: @retroactive Identifiable { public var id: String { self } }

struct CheckEmailView: View {
  let email: String
  var onDone: () -> Void
  @Environment(\.palette) private var p
  @State private var note: String?
  var body: some View {
    VStack(spacing: 18) {
      Image(systemName: "envelope.badge").font(.system(size: 52)).foregroundStyle(p.accent).padding(.top, 40)
      Text("Check your email").font(.title.weight(.bold)).foregroundStyle(p.text)
      Text("We sent a link to \(email). Open it to confirm your account, then come back and log in.").font(.body).foregroundStyle(p.muted).multilineTextAlignment(.center)
      Button("I've confirmed it — log in", action: onDone).buttonStyle(PrimaryButtonStyle())
      Button("Send it again") { Task { do { try await API.resendConfirmation(email); note = "Sent. Check your inbox (and spam)." } catch { note = friendly(error) } } }
        .font(.subheadline.weight(.semibold))
      if let note { Text(note).font(.footnote).foregroundStyle(p.muted) }
      Spacer()
    }
    .padding(24)
    .background(p.bg)
    .navigationBarBackButtonHidden()
  }
}

struct ForgotPasswordView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var email = ""
  @State private var sent = false
  @State private var error: String?
  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 16) {
        if sent {
          Label("If there's an account for \(email), a reset link is on its way.", systemImage: "envelope.open").foregroundStyle(p.text)
        } else {
          Text("Enter your email and we'll send a link to choose a new password.").foregroundStyle(p.muted)
          TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
            .padding(.horizontal, 16).frame(minHeight: 52)
            .background(p.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
          if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
          Button("Send link") { Task { do { try await API.requestPasswordReset(email); withAnimation { sent = true } } catch { self.error = friendly(error) } } }
            .buttonStyle(PrimaryButtonStyle()).disabled(email.isEmpty)
        }
        Spacer()
      }
      .padding(24)
      .background(p.bg)
      .navigationTitle("Reset password")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button(sent ? "Done" : "Cancel") { dismiss() } } }
    }
    .presentationDetents([.medium])
  }
}

// Right after sign-up: what you study or do, your field and at least 3 interests.
struct OnboardingView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var form = OnboardingForm()
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 22) {
          VStack(alignment: .leading, spacing: 6) {
            Text("Welcome, \(session.profile?.firstName ?? "")").font(.largeTitle.weight(.bold)).foregroundStyle(p.text)
            Text("Three quick things so Forge can show you the right people, clubs and work.").foregroundStyle(p.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text(session.profile?.accountType == "student" ? "Your major" : "What you do").font(.headline).foregroundStyle(p.text)
            TextField(session.profile?.accountType == "student" ? "e.g. Mechanical Engineering, class of 2028" : "e.g. Propulsion engineer at Relativity", text: $form.headline)
              .padding(.horizontal, 16).frame(minHeight: 52)
              .background(p.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
          }
          VStack(alignment: .leading, spacing: 10) {
            Text("Your field").font(.headline).foregroundStyle(p.text)
            FlowLayout(spacing: 8) {
              ForEach(Topics.fields, id: \.self) { f in
                Button { withAnimation(.snappy) { form.field = f } } label: { Chip(text: f, selected: form.field == f) }.buttonStyle(.plain)
              }
            }
          }
          VStack(alignment: .leading, spacing: 10) {
            HStack {
              Text("Your interests").font(.headline).foregroundStyle(p.text)
              Spacer()
              Text("\(form.interests.count) picked · 3+").font(.caption.weight(.semibold)).foregroundStyle(form.interests.count >= 3 ? Color(hex: 0x10B981) : p.faint)
            }
            // Your field's topics first.
            ForEach(Topics.all.sorted { a, _ in a.field == form.field }, id: \.field) { group in
              VStack(alignment: .leading, spacing: 6) {
                Text(group.field).font(.caption.weight(.semibold)).foregroundStyle(p.muted)
                FlowLayout(spacing: 6) {
                  ForEach(group.topics, id: \.self) { t in
                    let on = form.interests.contains(t)
                    Button { withAnimation(.snappy) { if on { form.interests.removeAll { $0 == t } } else { form.interests.append(t) } } } label: { Chip(text: t, selected: on) }
                      .buttonStyle(.plain)
                  }
                }
              }
            }
          }
          if let error { Text(error).font(.footnote).foregroundStyle(p.danger) }
          Button { Task { await finish() } } label: { if busy { ProgressView().tint(p.onAccent) } else { Text("Get started") } }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(form.problem != nil || busy)
          Button("Sign out", role: .destructive) { Task { await session.signOut() } }.font(.footnote).frame(maxWidth: .infinity)
        }
        .padding(24)
      }
      .background(p.bg)
    }
  }

  private func finish() async {
    guard let me = session.userId else { return }
    busy = true; error = nil
    defer { busy = false }
    do { try await API.completeOnboarding(form, me: me); await session.loadProfile() } catch { self.error = friendly(error) }
  }
}
