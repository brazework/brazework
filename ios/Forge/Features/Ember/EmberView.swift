import SwiftUI

// Ember on iPhone: the web's /copilot as one chat, with the web's orb (Design/EmberOrb.swift). Say what you did or what you need; Ember looks
// it up on Brazework and prepares each step as a card you approve (ForgeKit/Ember.swift talks to the
// same route the web does). Cards the iPhone can do itself (post, join, follow, RSVP, message) run
// here; the rest open the page on the web that finishes them.
struct EmberView: View {
  var initial = ""
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @State private var turns: [Turn] = []
  @State private var input = ""
  @State private var busy = false
  @State private var left: Int?
  @State private var done: [String: String] = [:]
  @State private var working: String?
  @FocusState private var focused: Bool

  struct Turn: Identifiable, Equatable {
    let id = UUID()
    let user: Bool
    var raw: String
    var failed = false
    var parsed: (text: String, tools: [String], cards: [EmberCard]) { user ? (raw, [], []) : EmberLogic.parse(raw) }
    static func == (a: Turn, b: Turn) -> Bool { a.id == b.id && a.raw == b.raw && a.failed == b.failed }
  }

  private var student: Bool { session.profile?.accountType != "professional" }

  var body: some View {
    NavigationStack {
      ScrollViewReader { proxy in
        ScrollView {
          VStack(alignment: .leading, spacing: 18) {
            if turns.isEmpty { hero } else { ForEach(turns) { turn in row(turn) } }
            Color.clear.frame(height: 1).id("end")
          }
          .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .onChange(of: turns) { withAnimation(.snappy) { proxy.scrollTo("end", anchor: .bottom) } }
      }
      .background(p.bg)
      .safeAreaInset(edge: .bottom) { composer }
      .navigationTitle("Ember").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) { Button("Close", icon: "xmark") { dismiss() } }
        if !turns.isEmpty {
          ToolbarItem(placement: .topBarTrailing) {
            Button("New chat", icon: "square.and.pencil") { withAnimation(.snappy) { turns = []; done = [:] } }.disabled(busy)
          }
        }
      }
    }
    .task {
      if !initial.isEmpty, turns.isEmpty { input = initial; await send() }
    }
  }

  // MARK: Empty chat: who Ember is and what it does in one tap.

  private var hero: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 12) {
        EmberMark(size: 72, thinking: busy)
        Text(EmberLogic.greeting(session.profile?.firstName ?? "")).font(.title2.weight(.semibold)).foregroundStyle(p.text)
          .fixedSize(horizontal: false, vertical: true)
        Text("Say what you did or what you need. Ember looks it up on Brazework and prepares each step as a card you approve.")
          .font(.subheadline).foregroundStyle(p.muted).fixedSize(horizontal: false, vertical: true)
      }
      .padding(.top, 24)
      VStack(alignment: .leading, spacing: 8) {
        Text("Things Ember does").font(.caption.weight(.semibold)).foregroundStyle(p.faint).textCase(.uppercase).kerning(0.5)
        FlowLayout(spacing: 8) {
          ForEach(EmberLogic.actions(field: session.profile?.field ?? "", student: student)) { a in
            Button { tap(a) } label: {
              Text(a.label).font(.subheadline.weight(.medium)).foregroundStyle(p.text)
                .padding(.horizontal, 14).padding(.vertical, 9)
                .background(p.surface, in: Capsule())
                .overlay(Capsule().strokeBorder(p.border, lineWidth: 0.5))
            }
            .buttonStyle(PressStyle())
          }
        }
      }
    }
  }

  private func tap(_ a: EmberAction) {
    input = a.text
    if a.finish == nil { Task { await send() } } else { focused = true }
  }

  // MARK: The chat

  @ViewBuilder private func row(_ turn: Turn) -> some View {
    if turn.user {
      HStack {
        Spacer(minLength: 48)
        Text(turn.raw).font(.body).foregroundStyle(p.text)
          .padding(.horizontal, 14).padding(.vertical, 10)
          .background(p.surface2, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      }
    } else {
      let r = turn.parsed
      HStack(alignment: .top, spacing: 10) {
        EmberMark(size: 28, thinking: busy && turn.id == turns.last?.id && r.text.isEmpty)
        VStack(alignment: .leading, spacing: 10) {
          if !r.tools.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
              ForEach(Array(r.tools.enumerated()), id: \.offset) { i, tool in
                let current = busy && turn.id == turns.last?.id && i == r.tools.count - 1 && r.text.isEmpty
                Label(EmberLogic.doing(tool) + (current ? "…" : ""), icon: current ? "magnifyingglass" : "checkmark")
                  .font(.caption).foregroundStyle(p.faint)
              }
            }
          }
          if !r.text.isEmpty {
            Text(r.text.trimmingCharacters(in: .whitespacesAndNewlines)).font(.body).foregroundStyle(turn.failed ? p.danger : p.text)
              .textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
          } else if busy && turn.id == turns.last?.id && r.tools.isEmpty {
            Text("Thinking…").font(.subheadline).foregroundStyle(p.faint)
          }
          ForEach(r.cards) { card in cardView(card) }
        }
        Spacer(minLength: 0)
      }
    }
  }

  private func cardView(_ card: EmberCard) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(card.title).font(.subheadline.weight(.semibold)).foregroundStyle(p.text)
      if !card.detail.isEmpty {
        Text(card.detail).font(.subheadline).foregroundStyle(p.text2).fixedSize(horizontal: false, vertical: true).lineLimit(8)
      }
      if let state = done[card.id] {
        Label(state, icon: state == "Not now" ? "xmark" : "checkmark.circle.fill")
          .font(.footnote.weight(.semibold)).foregroundStyle(state == "Not now" ? p.faint : p.ok)
      } else {
        HStack(spacing: 8) {
          Button { Task { await confirm(card) } } label: {
            HStack(spacing: 6) {
              if working == card.id { ProgressView().controlSize(.small).tint(p.onAccent) }
              Text(card.confirmLabel)
              if !card.native { Icon("arrow.up.right") }
            }
          }
          .buttonStyle(PrimaryButtonStyle()).fixedSize().disabled(working != nil)
          Button("Not now") { done[card.id] = "Not now" }.font(.subheadline).foregroundStyle(p.muted).padding(.horizontal, 8)
        }
        if !card.native {
          Text("This one finishes on the web for now.").font(.caption).foregroundStyle(p.faint)
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }

  private func confirm(_ card: EmberCard) async {
    guard card.native, let me = session.userId else {
      if let url = URL(string: card.webPath, relativeTo: Env.webURL)?.absoluteURL { openURL(url) }
      return
    }
    working = card.id
    defer { working = nil }
    do {
      switch card.kind {
      case "post":
        try await API.createPost(body: card["body"], kind: card["postKind"].isEmpty ? "update" : card["postKind"])
        done[card.id] = "Posted"
      case "join":
        try await API.joinClub(id: card["club_id"], privacy: card["privacy"], me: me)
        done[card.id] = card["privacy"] == "public" ? "You're in" : "Asked to join"
      case "follow":
        guard let id = UUID(uuidString: card["person_id"]) else { return }
        try await API.setFollow(id, true, me: me)
        done[card.id] = "Following"
      case "rsvp":
        let going = card["cancel"] != "true"
        try await API.setGoing(card["event_id"], going, me: me)
        done[card.id] = going ? "You're going" : "RSVP cancelled"
      case "message":
        guard let id = UUID(uuidString: card["person_id"]) else { return }
        let convo = try await API.startConversation(with: id)
        try await API.send(convo, body: card["body"])
        done[card.id] = "Sent"
      default: break
      }
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
    } catch {
      done[card.id] = nil
      turns.append(Turn(user: false, raw: friendly(error), failed: true))
    }
  }

  // MARK: Composer

  private var composer: some View {
    VStack(spacing: 6) {
      HStack(alignment: .bottom, spacing: 10) {
        TextField("Ask Ember, or tell it what you did…", text: $input, axis: .vertical)
          .lineLimit(1...6).focused($focused)
          .padding(.horizontal, 16).padding(.vertical, 12)
          .background(p.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
          .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
          .submitLabel(.send).onSubmit { Task { await send() } }
        Button { Task { await send() } } label: {
          Icon(busy ? "ellipsis" : "arrow.up").font(.body.weight(.semibold)).foregroundStyle(p.onAccent)
            .frame(width: 44, height: 44).background(p.accent, in: Circle())
        }
        .disabled(busy || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        .accessibilityLabel("Send")
      }
      Text(left.map { "Ember prepares, you approve. \($0) Ember requests left today." } ?? "Ember prepares, you approve. It never posts or signs on its own.")
        .font(.caption2).foregroundStyle(p.faint)
    }
    .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 8)
    .background(p.bg.opacity(0.96))
  }

  private func send() async {
    let q = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !q.isEmpty, !busy else { return }
    let history = EmberLogic.history(turns.filter { !$0.failed }.map { (user: $0.user, text: $0.parsed.text) })
    input = ""
    busy = true
    turns.append(Turn(user: true, raw: q))
    turns.append(Turn(user: false, raw: ""))
    let i = turns.count - 1
    do {
      left = try await API.askEmber(q, history: history) { raw in
        await MainActor.run { if turns.indices.contains(i) { turns[i].raw = raw } }
      } ?? left
    } catch {
      turns[i].raw = (error as? EmberError)?.errorDescription ?? friendly(error)
      turns[i].failed = true
    }
    busy = false
  }
}

/// Ember's mark: the web's orb, swirling faster while it thinks.
struct EmberMark: View {
  var size: CGFloat = 28
  var thinking = false
  var body: some View { EmberOrb(size: size, mood: thinking ? .thinking : .idle) }
}

/// Home's "Ask Ember" bar, as at the top of Home on the web.
struct AskEmberBar: View {
  var open: () -> Void
  @Environment(\.palette) private var p

  var body: some View {
    Button(action: open) {
      HStack(spacing: 10) {
        EmberMark(size: 26)
        Text("Ask Ember, or tell it what you did…").font(.subheadline).foregroundStyle(p.faint)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 10).padding(.vertical, 9)
      .background(p.surface, in: Capsule())
      .overlay(Capsule().strokeBorder(p.border, lineWidth: 0.5))
    }
    .buttonStyle(PressStyle())
    .accessibilityLabel("Ask Ember")
  }
}
