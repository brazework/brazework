import SwiftUI
import Supabase

struct MessagesView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var store = InboxStore()
  @State private var chats: [GroupChat] = []
  @State private var path = NavigationPath()

  var body: some View {
    NavigationStack(path: $path) {
      List {
        let requests = (store.items ?? []).filter(\.isRequestToMe)
        if !requests.isEmpty { Section("Requests") { ForEach(requests) { row($0) } } }
        if !chats.isEmpty { Section("Clubs & events") { ForEach(chats) { chatRow($0) } } }
        let direct = (store.items ?? []).filter { !$0.isRequestToMe }
        if !direct.isEmpty { Section(chats.isEmpty ? "" : "Direct") { ForEach(direct) { row($0) } } }
      }
      .listStyle(.plain)
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .overlay {
        if store.items == nil { ProgressView() }
        else if store.items?.isEmpty == true && chats.isEmpty { EmptyState(icon: "bubble.left.and.bubble.right", title: "No messages yet", message: "Message someone from their profile. People you don't know land in Requests.") }
      }
      .navigationTitle("Messages")
      .navigationDestination(for: InboxItem.self) { ThreadView(item: $0) }
      .navigationDestination(for: ChatRoute.self) { GroupThreadView(route: $0) }
      .navigationDestination(for: PersonRoute.self) { ProfileView(id: $0.id) }
      .refreshable { await reload() }
      .task {
        await reload()
        #if DEBUG
        // For screenshots: FORGE_TEST_CHAT=<club id> opens that club's chat.
        if let club = ProcessInfo.processInfo.environment["FORGE_TEST_CHAT"], path.isEmpty, let c = chats.first(where: { $0.kind == "club" && $0.communityId == club }) {
          path.append(ChatRoute(id: c.id, title: c.title, kind: c.kind, communityId: c.communityId))
        }
        #endif
      }
      // Fallback while open: Realtime handles it where it's set up.
      .task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(15)); await reload() } }
    }
  }

  private func reload() async {
    guard let me = session.userId else { return }
    async let dms: Void = store.load(me: me)
    chats = (try? await API.myChats()) ?? chats
    await dms
    await session.refreshBadges()
  }

  private func chatRow(_ c: GroupChat) -> some View {
    NavigationLink(value: ChatRoute(id: c.id, title: c.title, kind: c.kind, communityId: c.communityId)) {
      HStack(spacing: 12) {
        ZStack {
          RoundedRectangle(cornerRadius: 14, style: .continuous).fill(p.gradient)
          Image(systemName: c.kind == "event" ? "calendar" : c.kind == "team" ? "person.2.fill" : "person.3.fill").font(.system(size: 17, weight: .semibold)).foregroundStyle(p.onAccent)
        }
        .frame(width: 48, height: 48)
        .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 3) {
          HStack {
            Text(c.title).font(.body.weight(c.unread ? .bold : .semibold)).foregroundStyle(p.text).lineLimit(1)
            Spacer()
            if let at = c.lastAt { Text(timeAgo(at)).font(.caption).foregroundStyle(p.faint) }
          }
          Text(c.preview).font(.subheadline).foregroundStyle(c.unread ? p.text2 : p.muted).lineLimit(2)
        }
        if c.unread { Circle().fill(p.accent).frame(width: 9, height: 9).accessibilityLabel("Unread") }
      }
      .padding(.vertical, 4)
    }
    .listRowBackground(Color.clear)
  }

  private func row(_ i: InboxItem) -> some View {
    NavigationLink(value: i) {
      HStack(spacing: 12) {
        Avatar(first: i.name.components(separatedBy: " ").first ?? "", last: i.name.components(separatedBy: " ").dropFirst().first ?? "", size: 48)
        VStack(alignment: .leading, spacing: 3) {
          HStack {
            Text(i.name.isEmpty ? "Forge member" : i.name).font(.body.weight(i.unread ? .bold : .semibold)).foregroundStyle(p.text).lineLimit(1)
            Spacer()
            if let at = i.at { Text(timeAgo(at)).font(.caption).foregroundStyle(p.faint) }
          }
          Text(i.preview.isEmpty ? "No messages yet" : i.preview).font(.subheadline).foregroundStyle(i.unread ? p.text2 : p.muted).lineLimit(2)
        }
        if i.unread { Circle().fill(p.accent).frame(width: 9, height: 9).accessibilityLabel("Unread") }
      }
      .padding(.vertical, 4)
    }
    .listRowBackground(Color.clear)
  }
}

struct ThreadView: View {
  let item: InboxItem
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var messages: [Message]?
  @State private var status: String
  @State private var draft = ""
  @State private var error: String?
  @State private var sending = false

  init(item: InboxItem) { self.item = item; _status = State(initialValue: item.status) }

  private var canSend: Bool { status == "active" || item.startedByMe }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(spacing: 6) {
          if messages == nil { ProgressView().padding(.top, 40) }
          ForEach(messages ?? []) { m in bubble(m).id(m.id) }
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
      }
      .defaultScrollAnchor(.bottom)
      .onChange(of: messages?.last?.id) { _, id in if let id { withAnimation(.snappy) { proxy.scrollTo(id, anchor: .bottom) } } }
    }
    .background(p.bg)
    .navigationTitle(item.name.isEmpty ? "Message" : item.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        NavigationLink(value: PersonRoute(id: item.otherId)) { Image(systemName: "person.crop.circle") }.accessibilityLabel("View profile")
      }
    }
    .safeAreaInset(edge: .bottom) { footer }
    .task { await load(); await markRead() }
    .task { await listen() }
  }

  private func bubble(_ m: Message) -> some View {
    let mine = m.senderId == session.userId
    return HStack {
      if mine { Spacer(minLength: 48) }
      Text(m.body)
        .font(.body)
        .foregroundStyle(mine ? p.onAccent : p.text)
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background(mine ? AnyShapeStyle(p.accent) : AnyShapeStyle(p.surface2), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .opacity(m.id.hasPrefix("pending-") ? 0.6 : 1)
        .contextMenu { Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = m.body } }
      if !mine { Spacer(minLength: 48) }
    }
  }

  @ViewBuilder private var footer: some View {
    VStack(spacing: 8) {
      if let error { Text(error).font(.caption).foregroundStyle(p.danger) }
      if status == "request" && !item.startedByMe {
        Text("\(item.name.components(separatedBy: " ").first ?? "They") wants to message you. They won't know you've read it until you accept.")
          .font(.footnote).foregroundStyle(p.muted).multilineTextAlignment(.center)
        HStack {
          Button("Decline", role: .destructive) { Task { await decline() } }.buttonStyle(.bordered).frame(maxWidth: .infinity)
          Button("Accept") { Task { await accept() } }.buttonStyle(PrimaryButtonStyle())
        }
      } else if canSend {
        HStack(alignment: .bottom, spacing: 8) {
          TextField("Message", text: $draft, axis: .vertical)
            .lineLimit(1...6)
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(p.surface2, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
          Button { Task { await send() } } label: {
            Image(systemName: "arrow.up").font(.body.weight(.bold)).foregroundStyle(p.onAccent).frame(width: 40, height: 40).background(p.accent, in: Circle())
          }
          .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
          .accessibilityLabel("Send")
        }
      }
    }
    .padding(.horizontal, 12).padding(.vertical, 8)
    .background(.bar)
  }

  private func load() async {
    do {
      messages = try await API.messages(item.id)
    } catch { if messages == nil { messages = [] }; self.error = friendly(error) }
  }

  private func markRead() async {
    guard !(status == "request" && !item.startedByMe) else { return }
    await API.markRead(item.id)
    await session.refreshBadges()
  }

  // New messages arrive live (Realtime), with a short poll as the fallback.
  private func listen() async {
    let channel = supabase.channel("thread-\(item.id)-\(UUID().uuidString.prefix(6))")
    let inserts = channel.postgresChange(InsertAction.self, schema: "public", table: "messages", filter: .eq("conversation_id", value: item.id))
    try? await channel.subscribeWithError()
    await withTaskGroup(of: Void.self) { group in
      group.addTask { for await _ in inserts { await self.load(); await self.markRead() } }
      group.addTask { while !Task.isCancelled { try? await Task.sleep(for: .seconds(6)); await self.load() } }
    }
    await supabase.removeChannel(channel)
  }

  private func send() async {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty, let me = session.userId else { return }
    guard text.count <= 2000 else { error = "Messages can be up to 2,000 characters."; return }
    sending = true; error = nil; draft = ""
    messages = (messages ?? []) + [Message(id: "pending-\(UUID())", conversationId: item.id, senderId: me, body: text, createdAt: .now)]
    defer { sending = false }
    do {
      try await API.send(item.id, body: text)
      await load()
    } catch {
      self.error = friendly(error); draft = text
      messages?.removeAll { $0.id.hasPrefix("pending-") }
    }
  }

  private func accept() async {
    do { try await API.accept(item.id); status = "active"; await markRead() }
    catch { self.error = friendly(error) }
  }

  @Environment(\.dismiss) private var dismiss
  private func decline() async {
    do { try await API.decline(item.id); dismiss() }
    catch { self.error = friendly(error) }
  }
}
