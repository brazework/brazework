import Supabase
import SwiftUI

// What a thread needs to open: from the inbox, a club page or an event page.
struct ChatRoute: Hashable { let id: String; let title: String; let kind: String; let communityId: String? }

// A club, event or team chat. Officers can post announcements in their club's chat; Ember's
// answers (asked for on the web) show as Ember's.
struct GroupThreadView: View {
  let route: ChatRoute
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var messages: [ChatMessage]?
  @State private var draft = ""
  @State private var announce = false
  @State private var officer = false
  @State private var sending = false
  @State private var error: String?
  @State private var reactions = ReactionsModel(kind: "group")
  @State private var replying: ChatMessage?
  @State private var reporting: ReportTarget?

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(spacing: 4) {
          if messages == nil { ProgressView().padding(.top, 40) }
          if messages?.isEmpty == true {
            EmptyState(icon: route.kind == "event" ? "calendar" : "person.3", title: "Start the conversation",
                       message: route.kind == "club" ? "Everyone in the club can read and post here." : "Everyone going can read and post here.")
          }
          ForEach(Array((messages ?? []).enumerated()), id: \.element.id) { i, m in
            row(m, first: i == 0 || messages?[i - 1].senderId != m.senderId || messages?[i - 1].announcement == true || m.announcement).id(m.id)
          }
        }
        .padding(.horizontal, 12).padding(.vertical, 12)
      }
      .defaultScrollAnchor(.bottom)
      .onChange(of: messages?.last?.id) { _, id in if let id { withAnimation(.snappy) { proxy.scrollTo(id, anchor: .bottom) } } }
    }
    .background(p.bg)
    .navigationTitle(route.title)
    .navigationBarTitleDisplayMode(.inline)
    .safeAreaInset(edge: .bottom) { composer }
    .task { await load(); await API.markChatRead(route.id); await session.refreshBadges() }
    .task { await listen() }
    .sheet(item: $reporting) { ReportSheet(kind: $0.kind, targetId: $0.id, title: $0.title) }
    .task {
      if route.kind == "club", let c = route.communityId, let me = session.userId { officer = API.isOfficer(await API.role(in: c, me: me)) }
    }
  }

  @ViewBuilder private func row(_ m: ChatMessage, first: Bool) -> some View {
    let mine = m.senderId == session.userId && !m.ember
    if m.announcement {
      VStack(alignment: .leading, spacing: 6) {
        Label("Announcement · \(m.senderName)", systemImage: "megaphone.fill").font(.caption.weight(.semibold)).foregroundStyle(p.accent)
        Text(m.body).font(.body).foregroundStyle(p.text)
        Text(timeAgo(m.createdAt)).font(.caption2).foregroundStyle(p.faint)
      }
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(p.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(p.accent.opacity(0.5), lineWidth: 1))
      .padding(.vertical, 6)
    } else {
      HStack(alignment: .bottom, spacing: 8) {
        if mine { Spacer(minLength: 48) }
        if !mine {
          if first {
            if m.ember { Image(systemName: "sparkles").font(.caption).foregroundStyle(p.onAccent).frame(width: 28, height: 28).background(Palette.brand, in: Circle()) }
            else { NavigationLink(value: PersonRoute(id: m.senderId)) { Avatar(first: m.senderFirst, last: m.senderLast, size: 28) } }
          } else { Color.clear.frame(width: 28, height: 1) }
        }
        VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
          if first && !mine { Text(m.ember ? "Ember" : m.senderFirst).font(.caption2.weight(.semibold)).foregroundStyle(p.muted).padding(.leading, 4) }
          VStack(alignment: .leading, spacing: 6) {
            if let r = m.replyTo {
              let target = messages?.first { $0.id == r }
              ReplyQuote(name: target.map { $0.ember ? "Ember" : $0.senderFirst }, text: target?.body, mine: mine)
            }
            Text(m.body).font(.body)
          }
          .foregroundStyle(mine ? p.onAccent : p.text)
          .padding(.horizontal, 14).padding(.vertical, 9)
          .background(mine ? AnyShapeStyle(p.accent) : AnyShapeStyle(p.surface2), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
          .opacity(m.id.hasPrefix("pending-") ? 0.6 : 1)
          .contextMenu {
            if !m.id.hasPrefix("pending-") {
              MessageMenu(text: m.body, onReact: { e in Task { await react(m, e) } }, onReply: { replying = m },
                          removeLabel: mine ? "Delete" : nil, onRemove: mine ? { Task { await delete(m) } } : nil,
                          onReport: mine || m.ember ? nil : { reporting = ReportTarget(kind: .chatMessage, id: m.id, title: "Report message") })
            }
          }
          ReactionChips(list: reactions.on(m.id), me: session.userId, mine: mine) { e in Task { await react(m, e) } }
        }
        if !mine { Spacer(minLength: 48) }
      }
      .padding(.top, first ? 8 : 0)
    }
  }

  private var composer: some View {
    VStack(spacing: 8) {
      if let error { Text(error).font(.caption).foregroundStyle(p.danger) }
      if let r = replying { ReplyBar(name: r.ember ? "Ember" : r.senderFirst, text: r.body) { replying = nil } }
      if officer && replying == nil {
        Toggle(isOn: $announce) { Label("Post as an announcement", systemImage: "megaphone") }
          .font(.footnote).toggleStyle(.switch).tint(p.accent)
      }
      HStack(alignment: .bottom, spacing: 8) {
        TextField(announce ? "Announce to the club" : "Message \(route.title)", text: $draft, axis: .vertical)
          .lineLimit(1...6)
          .padding(.horizontal, 14).padding(.vertical, 10)
          .background(p.surface2, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        Button { Task { await send() } } label: {
          Image(systemName: announce ? "megaphone.fill" : "arrow.up").font(.body.weight(.bold)).foregroundStyle(p.onAccent).frame(width: 40, height: 40).background(p.accent, in: Circle())
        }
        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
        .accessibilityLabel(announce ? "Announce" : "Send")
      }
    }
    .padding(.horizontal, 12).padding(.vertical, 8)
    .background(.bar)
  }

  private func load() async {
    do {
      messages = try await API.chatMessages(route.id)
      await reactions.load(messages?.map(\.id) ?? [])
    } catch { if messages == nil { messages = [] }; self.error = friendly(error) }
  }

  // Live where Realtime is set up, with a short poll as the fallback.
  private func listen() async {
    let channel = supabase.channel("chat-\(route.id)-\(UUID().uuidString.prefix(6))")
    let inserts = channel.postgresChange(InsertAction.self, schema: "public", table: "chat_messages", filter: .eq("chat_id", value: route.id))
    try? await channel.subscribeWithError()
    await withTaskGroup(of: Void.self) { group in
      group.addTask { for await _ in inserts { await self.load(); await API.markChatRead(self.route.id) } }
      group.addTask { while !Task.isCancelled { try? await Task.sleep(for: .seconds(6)); await self.load() } }
    }
    await supabase.removeChannel(channel)
  }

  private func send() async {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty, let me = session.userId else { return }
    guard text.count <= 2000 else { error = "Messages can be up to 2,000 characters."; return }
    let asAnnouncement = announce && replying == nil
    let replyTo = replying?.id
    sending = true; error = nil; draft = ""; replying = nil
    let first = session.profile?.firstName ?? "", last = session.profile?.lastName ?? ""
    messages = (messages ?? []) + [ChatMessage(id: "pending-\(UUID())", chatId: route.id, senderId: me, senderFirst: first, senderLast: last, body: text, announcement: asAnnouncement, ember: false, createdAt: .now, replyTo: replyTo)]
    defer { sending = false }
    do {
      try await API.sendChat(route.id, body: text, announcement: asAnnouncement, replyTo: replyTo)
      announce = false
      await load(); await API.markChatRead(route.id)
    } catch {
      self.error = "\(error)".contains("Only club officers") ? "Only club officers can post announcements." : friendly(error)
      draft = text
      messages?.removeAll { $0.id.hasPrefix("pending-") }
    }
  }

  private func react(_ m: ChatMessage, _ emoji: String) async {
    guard let me = session.userId else { return }
    await reactions.toggle(m.id, emoji: emoji, me: me)
    if let e = reactions.error { error = e; reactions.error = nil }
  }

  private func delete(_ m: ChatMessage) async {
    messages?.removeAll { $0.id == m.id }
    do { try await API.deleteChatMessage(m.id) } catch { self.error = friendly(error); await load() }
  }
}
