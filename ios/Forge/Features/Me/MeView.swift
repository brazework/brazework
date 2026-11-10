import SwiftUI

struct MeView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @AppStorage("forge-skin") private var skin = Skin.forge.rawValue
  @AppStorage("forge-appearance") private var appearance = "system"
  @State private var editing = false

  var body: some View {
    NavigationStack {
      List {
        if let me = session.profile {
          Section {
            VStack(alignment: .leading, spacing: 12) {
              Avatar(first: me.firstName, last: me.lastName, path: me.avatarPath, size: 72)
              VStack(alignment: .leading, spacing: 3) {
                Text(me.name).font(.title2.weight(.bold)).foregroundStyle(p.text)
                if !me.headline.isEmpty { Text(me.headline).font(.subheadline).foregroundStyle(p.text2) }
                if !me.field.isEmpty { Text(me.field).font(.footnote).foregroundStyle(p.muted) }
              }
              if !me.interests.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                  HStack(spacing: 6) { ForEach(me.interests.prefix(12), id: \.self) { Chip(text: $0) } }
                }
              }
              NavigationLink("View your profile", value: PersonRoute(id: me.id))
                .font(.subheadline.weight(.semibold))
            }
            .padding(.vertical, 6)
            .listRowBackground(p.surface)
          }
        }
        Section("Look") {
          Picker("Appearance", selection: $appearance) {
            Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark")
          }
          .pickerStyle(.segmented)
          .listRowBackground(p.surface)
          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
              ForEach(Skin.allCases) { s in
                let sp = Palette.of(s, dark: false)
                Button { withAnimation(.snappy) { skin = s.rawValue } } label: {
                  VStack(spacing: 6) {
                    Circle().fill(sp.gradient).frame(width: 40, height: 40)
                      .overlay(Circle().strokeBorder(skin == s.rawValue ? p.accent : .clear, lineWidth: 2.5).padding(-4))
                    Text(s.label).font(.caption).foregroundStyle(skin == s.rawValue ? p.text : p.muted)
                  }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(s.label) theme")
                .accessibilityAddTraits(skin == s.rawValue ? .isSelected : [])
              }
            }
            .padding(.vertical, 8).padding(.horizontal, 4)
          }
          .listRowBackground(p.surface)
        }
        Section {
          Button { editing = true } label: { Label("Edit profile", systemImage: "person.crop.circle").foregroundStyle(p.text) }
          NavigationLink { SavedPostsView() } label: { Label("Saved", systemImage: "bookmark").foregroundStyle(p.text) }
          link("Settings", "gearshape", "settings")
          link("Ask Ember", "sparkles", "copilot")
        }
        .listRowBackground(p.surface)
        Section {
          Button("Sign out", role: .destructive) { Task { await session.signOut() } }
        }
        .listRowBackground(p.surface)
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .navigationTitle("You")
      .sheet(isPresented: $editing) { if let me = session.profile { EditProfileView(profile: me) } }
      #if DEBUG
      .task { if ProcessInfo.processInfo.environment["FORGE_TEST_EDIT_PROFILE"] != nil { editing = true } }
      #endif
      .navigationDestination(for: PersonRoute.self) { ProfileView(id: $0.id) }
      .navigationDestination(for: Post.self) { PostLoader(id: $0.id) }
      .navigationDestination(for: InboxItem.self) { ThreadView(item: $0) }
    }
  }

  private func link(_ title: String, _ icon: String, _ path: String) -> some View {
    Button { openURL(Env.web(path)) } label: {
      HStack { Label(title, systemImage: icon).foregroundStyle(p.text); Spacer(); Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(p.faint) }
    }
  }
}
