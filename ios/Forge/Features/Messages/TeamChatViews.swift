import SwiftUI

// Start a team chat in a club: a name and the clubmates you want in it.
struct NewTeamChatView: View {
  let club: Club
  var onCreated: (ChatRoute) -> Void
  @Environment(Session.self) private var session
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var name = ""
  @State private var members: [ClubMember]?
  @State private var picked: Set<UUID> = []
  @State private var query = ""
  @State private var busy = false
  @State private var error: String?

  private var others: [ClubMember] {
    let q = query.trimmingCharacters(in: .whitespaces).lowercased()
    return (members ?? []).filter { $0.uid != session.userId && (q.isEmpty || $0.name.lowercased().contains(q)) }
  }

  var body: some View {
    NavigationStack {
      List {
        Section {
          TextField("Name, like \"Avionics\" or \"Launch crew\"", text: $name).textInputAutocapitalization(.words)
        } footer: { Text("Only the people you add can see it. Anyone in it can add more people from \(club.name).") }
        .listRowBackground(p.surface)
        Section("Add people · \(picked.count) picked") {
          if members == nil { ProgressView() }
          ForEach(others) { m in
            Button { if picked.contains(m.uid) { picked.remove(m.uid) } else { picked.insert(m.uid) } } label: {
              HStack(spacing: 12) {
                Avatar(first: m.firstName, last: m.lastName, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                  Text(m.name).foregroundStyle(p.text)
                  if !m.headline.isEmpty { Text(m.headline).font(.caption).foregroundStyle(p.muted).lineLimit(1) }
                }
                Spacer()
                Image(systemName: picked.contains(m.uid) ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(picked.contains(m.uid) ? p.accent : p.faint)
              }
            }
            .accessibilityAddTraits(picked.contains(m.uid) ? .isSelected : [])
          }
        }
        .listRowBackground(p.surface)
        if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .searchable(text: $query, prompt: "Search \(club.name)")
      .navigationTitle("New team chat")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button { Task { await create() } } label: { if busy { ProgressView() } else { Text("Create").bold() } }
            .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
        }
      }
      .task { members = (try? await API.clubMembers(club.id)) ?? [] }
    }
  }

  private func create() async {
    busy = true; error = nil
    defer { busy = false }
    do {
      let n = name.trimmingCharacters(in: .whitespaces)
      let id = try await API.createTeamChat(clubId: club.id, name: n, members: Array(picked))
      dismiss()
      onCreated(ChatRoute(id: id, title: n, kind: "team", communityId: club.id))
    } catch { self.error = friendly(error) }
  }
}

// Who's in a team chat; add clubmates; leave.
struct TeamMembersView: View {
  let route: ChatRoute
  var onLeft: () -> Void
  @Environment(Session.self) private var session
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var club: [ClubMember] = []
  @State private var inChat: Set<UUID> = []
  @State private var confirmLeave = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      List {
        Section("In this chat · \(inChat.count)") {
          ForEach(club.filter { inChat.contains($0.uid) }) { m in row(m, trailing: m.uid == session.userId ? "You" : nil) }
        }
        .listRowBackground(p.surface)
        let rest = club.filter { !inChat.contains($0.uid) }
        if !rest.isEmpty {
          Section("Add from the club") {
            ForEach(rest) { m in
              Button { Task { await add(m) } } label: { row(m, trailing: nil, adding: true) }
            }
          }
          .listRowBackground(p.surface)
        }
        if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }
        Section { Button("Leave chat", role: .destructive) { confirmLeave = true } }.listRowBackground(p.surface)
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .navigationTitle(route.title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
      .confirmationDialog("Leave \(route.title)?", isPresented: $confirmLeave, titleVisibility: .visible) {
        Button("Leave", role: .destructive) { Task { await leave() } }
      } message: { Text("You'll stop seeing it. Someone in it can add you back.") }
      .task { await load() }
    }
  }

  private func row(_ m: ClubMember, trailing: String?, adding: Bool = false) -> some View {
    HStack(spacing: 12) {
      Avatar(first: m.firstName, last: m.lastName, size: 34)
      Text(m.name).foregroundStyle(p.text)
      Spacer()
      if let trailing { Text(trailing).font(.caption).foregroundStyle(p.faint) }
      if adding { Image(systemName: "plus.circle.fill").font(.title3).foregroundStyle(p.accent) }
    }
  }

  private func load() async {
    guard let c = route.communityId else { return }
    async let members = (try? await API.clubMembers(c)) ?? []
    async let ids = (try? await API.chatMemberIds(route.id)) ?? []
    club = await members
    inChat = Set(await ids)
  }

  private func add(_ m: ClubMember) async {
    error = nil
    do { try await API.addChatMember(route.id, m.uid); withAnimation(.snappy) { _ = inChat.insert(m.uid) } } catch { self.error = friendly(error) }
  }

  private func leave() async {
    do { try await API.leaveChat(route.id); dismiss(); onLeft() } catch { self.error = friendly(error) }
  }
}
