import SwiftUI

struct SettingsView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @State private var settings = API.MessageSettings()
  @State private var loaded = false
  @State private var blocked: [Profile] = []
  @State private var changingPassword = false
  @State private var feedback = false
  @State private var saved = false
  @State private var error: String?
  @AppStorage("forge-video-sound") private var videoSound = true

  var body: some View {
    Form {
      Section {
        Toggle("Message requests", isOn: $settings.requestsOn)
        Picker("Who can message you", selection: $settings.whoCanMessage) {
          Text("Everyone").tag("everyone")
          Text("People in my clubs").tag("communities")
          Text("My connections").tag("connections")
        }
      } header: { Text("Messages") } footer: {
        Text(settings.requestsOn ? "People you don't know land in Requests. They won't know you've read it until you accept." : "Only people who can already message you get through; everyone else can't start a conversation.")
      }
      .listRowBackground(p.surface)
      .disabled(!loaded)

      Section {
        if blocked.isEmpty { Text("No one").foregroundStyle(p.muted) }
        ForEach(blocked) { u in
          HStack(spacing: 10) {
            Avatar(first: u.firstName, last: u.lastName, path: u.avatarPath, size: 32)
            Text(u.name).foregroundStyle(p.text)
            Spacer()
            Button("Unblock") { Task { await unblock(u) } }.font(.footnote.weight(.semibold))
          }
        }
      } header: { Text("Blocked") } footer: { Text("Blocked people can't message you, and their posts are hidden from your feed.") }
      .listRowBackground(p.surface)

      Section("Videos") {
        Toggle("Play with sound", isOn: $videoSound)
      }
      .listRowBackground(p.surface)

      Section("Account") {
        Button("Change password") { changingPassword = true }
        Button("Send feedback") { feedback = true }
        Button("Privacy and terms") { openURL(Env.web("privacy")) }
        Button("Help") { openURL(Env.web("help")) }
      }
      .listRowBackground(p.surface)

      if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }

      Section {
        Button("Sign out", role: .destructive) { Task { await session.signOut() } }
      }
      .listRowBackground(p.surface)
    }
    .scrollContentBackground(.hidden)
    .background(p.bg)
    .navigationTitle("Settings")
    .overlay(alignment: .bottom) {
      if saved {
        Label("Saved", systemImage: "checkmark.circle.fill").font(.footnote.weight(.semibold)).foregroundStyle(p.onAccent)
          .padding(.horizontal, 14).padding(.vertical, 8).background(p.accent, in: Capsule()).padding(.bottom, 90)
          .transition(.move(edge: .bottom).combined(with: .opacity))
      }
    }
    .task { await load() }
    .onChange(of: settings) { old, new in if loaded && old != new { Task { await save() } } }
    .sheet(isPresented: $changingPassword) { ChangePasswordView() }
    .sheet(isPresented: $feedback) { FeedbackView() }
  }

  private func load() async {
    guard let me = session.userId else { return }
    async let s = API.messageSettings(me: me)
    async let b = API.blocked(me: me)
    settings = await s
    blocked = await b
    loaded = true
  }

  private func save() async {
    error = nil
    do {
      try await API.saveMessageSettings(settings)
      withAnimation(.snappy) { saved = true }
      try? await Task.sleep(for: .seconds(1.4))
      withAnimation(.snappy) { saved = false }
    } catch { self.error = friendly(error) }
  }

  private func unblock(_ u: Profile) async {
    guard let me = session.userId else { return }
    do { try await API.unblock(u.id, me: me); withAnimation { blocked.removeAll { $0.id == u.id } } } catch { self.error = friendly(error) }
  }
}

struct ChangePasswordView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var password = ""
  @State private var confirm = ""
  @State private var busy = false
  @State private var error: String?
  var body: some View {
    NavigationStack {
      Form {
        Section {
          SecureField("New password", text: $password).textContentType(.newPassword)
          SecureField("Type it again", text: $confirm).textContentType(.newPassword)
        } footer: { Text("At least 8 characters.") }
        .listRowBackground(p.surface)
        if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .navigationTitle("Change password")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button { Task { await save() } } label: { if busy { ProgressView() } else { Text("Save").bold() } }.disabled(password.isEmpty || busy)
        }
      }
    }
  }
  private func save() async {
    busy = true; error = nil
    defer { busy = false }
    do { try await API.changePassword(password, confirm: confirm); dismiss() } catch { self.error = friendly(error) }
  }
}

struct FeedbackView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var kind = "idea"
  @State private var area = "general"
  @State private var text = ""
  @State private var busy = false
  @State private var sent = false
  @State private var error: String?
  private let kinds = [("idea", "Idea"), ("problem", "Problem"), ("improvement", "Improvement"), ("praise", "Praise")]
  private let areas = ["general", "feed", "search", "profiles", "communities", "messages", "events", "network", "notifications", "other"]

  var body: some View {
    NavigationStack {
      Form {
        if sent {
          Section { Label("Thanks. The team reads every one.", systemImage: "heart.fill").foregroundStyle(p.text) }.listRowBackground(p.surface)
        } else {
          Section {
            Picker("Kind", selection: $kind) { ForEach(kinds, id: \.0) { Text($0.1).tag($0.0) } }.pickerStyle(.segmented)
            Picker("About", selection: $area) { ForEach(areas, id: \.self) { Text($0 == "communities" ? "Clubs" : $0.capitalized).tag($0) } }
          }
          .listRowBackground(p.surface)
          Section {
            TextField("What's on your mind?", text: $text, axis: .vertical).lineLimit(4...10)
          } footer: { Text("\(1000 - text.count) left") }
          .listRowBackground(p.surface)
          if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }
        }
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .navigationTitle("Feedback")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button(sent ? "Done" : "Cancel") { dismiss() } }
        if !sent {
          ToolbarItem(placement: .confirmationAction) {
            Button { Task { await send() } } label: { if busy { ProgressView() } else { Text("Send").bold() } }.disabled(text.trimmingCharacters(in: .whitespaces).isEmpty || busy)
          }
        }
      }
    }
  }
  private func send() async {
    busy = true; error = nil
    defer { busy = false }
    do { try await API.sendFeedback(kind: kind, area: area, body: text); withAnimation { sent = true } } catch { self.error = friendly(error) }
  }
}

// Report something to the Forge team: pick a reason, add detail if you like.
struct ReportSheet: View {
  let kind: API.ReportKind
  let targetId: String
  let title: String
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var reason: String?
  @State private var detail = ""
  @State private var busy = false
  @State private var sent = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        if sent {
          Section {
            VStack(alignment: .leading, spacing: 6) {
              Label("Thanks for telling us", systemImage: "checkmark.shield.fill").font(.headline).foregroundStyle(p.text)
              Text("The Forge team reviews every report. You can also block them so you don't see them again.").font(.subheadline).foregroundStyle(p.muted)
            }
            .padding(.vertical, 4)
          }
          .listRowBackground(p.surface)
        } else {
          Section("Why are you reporting this?") {
            ForEach(API.reportReasons, id: \.id) { r in
              Button { reason = r.id } label: {
                HStack { Text(r.label).foregroundStyle(p.text); Spacer(); if reason == r.id { Image(systemName: "checkmark").foregroundStyle(p.accent) } }
              }
            }
          }
          .listRowBackground(p.surface)
          Section {
            TextField("Anything else we should know? (optional)", text: $detail, axis: .vertical).lineLimit(2...6)
          }
          .listRowBackground(p.surface)
          if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }
        }
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button(sent ? "Done" : "Cancel") { dismiss() } }
        if !sent {
          ToolbarItem(placement: .confirmationAction) {
            Button { Task { await send() } } label: { if busy { ProgressView() } else { Text("Report").bold() } }.disabled(reason == nil || busy)
          }
        }
      }
    }
    .presentationDetents([.medium, .large])
  }

  private func send() async {
    guard let reason else { return }
    busy = true; error = nil
    defer { busy = false }
    do { try await API.report(kind, id: targetId, reason: reason, detail: detail); withAnimation { sent = true } } catch { self.error = friendly(error) }
  }
}

struct ReportTarget: Identifiable { let kind: API.ReportKind; let id: String; let title: String }
