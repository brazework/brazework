import SwiftUI

// The signed record on iPhone (ForgeKit/Record.swift): your proof by year with who stood behind
// each piece, adding a project, logging a milestone and asking your club to verify it, and the
// club's officers verifying. One colour per kind of proof, as on the web: green signed, blue backed
// by GitHub, dashed amber waiting.

// MARK: Record

struct RecordList: View {
  let items: [RecordItem]?
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("Signed work").font(.headline).foregroundStyle(p.text)
      if let items {
        let c = RecordLogic.counts(items), years = RecordLogic.byYear(items)
        HStack(spacing: 8) {
          tally(c.signed, "signed", p.ok, dashed: false)
          if c.backed > 0 { tally(c.backed, "backed", p.info, dashed: false) }
          tally(c.waiting, "waiting", p.wait, dashed: true)
        }
        if years.isEmpty {
          Text("Nothing signed yet. Log a result on a project and ask your club, or someone who saw it, to sign it.")
            .font(.subheadline).foregroundStyle(p.muted)
        }
        ForEach(years, id: \.year) { y in
          VStack(alignment: .leading, spacing: 10) {
            Text(String(y.year)).font(.caption.weight(.semibold)).foregroundStyle(p.faint).monospacedDigit()
            ForEach(y.items) { m in RecordRow(item: m) }
          }
        }
      } else {
        ProgressView()
      }
    }
    .padding(.vertical, 6)
  }

  private func tally(_ n: Int, _ label: String, _ tint: Color, dashed: Bool) -> some View {
    HStack(spacing: 6) {
      Text("\(n)").font(.subheadline.weight(.bold)).monospacedDigit()
      Text(label).font(.caption)
    }
    .foregroundStyle(n > 0 ? tint : p.faint)
    .padding(.horizontal, 10).padding(.vertical, 6)
    .background((n > 0 ? tint : p.faint).opacity(0.1), in: Capsule())
    .overlay(Capsule().strokeBorder(n > 0 && dashed ? tint.opacity(0.6) : .clear, style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
  }
}

/// One milestone: its proof mark, what was done, on which project, and who stood behind it.
struct RecordRow: View {
  let item: RecordItem
  var showProject = true
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL

  var body: some View {
    let tint = color(item.kind)
    HStack(alignment: .top, spacing: 10) {
      mark(item.kind, tint)
      VStack(alignment: .leading, spacing: 3) {
        Text(item.title).font(.subheadline.weight(.semibold)).foregroundStyle(p.text).fixedSize(horizontal: false, vertical: true)
        Text(item.by).font(.caption).foregroundStyle(tint)
        HStack(spacing: 6) {
          if showProject, let t = item.project?.title { Text(t).lineLimit(1) }
          Text(RecordLogic.shortDay(item.achievedOn))
          if item.private == true, item.kind == .signed { Label("Only you", icon: "lock").labelStyle(.titleAndIcon) }
        }
        .font(.caption).foregroundStyle(p.faint)
      }
      Spacer(minLength: 0)
      if let e = item.evidence, let url = URL(string: e), !e.isEmpty {
        Button { openURL(url) } label: { Icon("link").font(.footnote).foregroundStyle(p.muted).frame(width: 30, height: 30).background(p.surface2, in: Circle()) }
          .buttonStyle(.plain).accessibilityLabel("Open the evidence")
      }
    }
    .accessibilityElement(children: .combine)
  }

  private func color(_ k: ProofKind) -> Color {
    switch k { case .signed: p.ok; case .backed: p.info; case .waiting: p.wait; case .refused: p.danger; default: p.muted }
  }

  @ViewBuilder private func mark(_ k: ProofKind, _ tint: Color) -> some View {
    switch k {
    case .signed: Icon("checkmark.seal.fill").font(.body).foregroundStyle(tint)
    case .backed: Icon("arrow.triangle.pull").font(.body).foregroundStyle(tint)
    case .waiting: Circle().strokeBorder(tint, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5])).frame(width: 18, height: 18).padding(.top, 1)
    default: Circle().strokeBorder(tint, lineWidth: 1.5).frame(width: 18, height: 18).padding(.top, 1)
    }
  }
}

// MARK: Projects

/// Add a project (the web's Projects → Start a project): what it is in a line, optionally the
/// write-up and a link, done or in progress, private or on your profile.
struct NewProjectView: View {
  var made: (String) -> Void
  @Environment(\.palette) private var p
  @Environment(\.dismiss) private var dismiss
  @State private var draft = ProjectDraft()
  @State private var saving = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name, like \"Wind tunnel rig\"", text: $draft.title)
          TextField("What it is, in a line", text: $draft.summary, axis: .vertical).lineLimit(2...4)
        } footer: { Text("Your club and the people who see your record read this first.") }
        Section("More, if you have it") {
          TextField("The write-up: what you built, how, what you learned", text: $draft.details, axis: .vertical).lineLimit(3...8)
          TextField("Link (GitHub, a doc, a video)", text: $draft.link).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
        }
        Section {
          Toggle("Finished", isOn: $draft.completed.animation())
          if draft.completed { TextField("Year", text: $draft.year).keyboardType(.numberPad) }
          Toggle("Private", isOn: $draft.isPrivate)
        } footer: { Text(draft.isPrivate ? "Members see its name and summary; the write-up and link are only yours." : "On your profile for members to see.") }
        if let error { Section { Label(error, icon: "exclamationmark.circle").foregroundStyle(p.danger) } }
      }
      .scrollContentBackground(.hidden).background(p.bg)
      .navigationTitle("New project").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) { Button("Add") { Task { await save() } }.disabled(saving).fontWeight(.semibold) }
      }
    }
  }

  private func save() async {
    if let problem = RecordLogic.problem(draft) { error = problem; return }
    saving = true; error = nil
    defer { saving = false }
    do { let id = try await API.createProject(draft); made(id); dismiss() } catch { self.error = friendly(error) }
  }
}

/// A project's milestones and the way to add the next one.
struct ProjectDetailView: View {
  let build: Build
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @State private var items: [RecordItem]?
  @State private var adding = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        VStack(alignment: .leading, spacing: 6) {
          Text(build.title).font(.title2.weight(.bold)).foregroundStyle(p.text)
          if !build.summary.isEmpty { Text(build.summary).font(.subheadline).foregroundStyle(p.text2) }
        }
        Button { adding = true } label: { Label("Add a milestone", icon: "checkmark.shield") }.buttonStyle(PrimaryButtonStyle())
        Card {
          VStack(alignment: .leading, spacing: 14) {
            Text("Milestones").font(.headline).foregroundStyle(p.text)
            if let items {
              if items.isEmpty {
                Text("Nothing logged yet. A milestone is one result with its evidence: \"Measured lift on 3 fin shapes\" and the video. Your club verifies it.")
                  .font(.subheadline).foregroundStyle(p.muted)
              }
              ForEach(items) { RecordRow(item: $0, showProject: false) }
            } else { ProgressView() }
          }
        }
        Button { openURL(Env.web("projects/\(build.id)")) } label: { Label("Open on the web", icon: "arrow.up.right") }
          .font(.footnote.weight(.medium)).foregroundStyle(p.muted)
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
    .refreshable { await load() }
    .sheet(isPresented: $adding, onDismiss: { Task { await load() } }) { AddMilestoneView(projects: [build], start: build.id) }
  }

  private func load() async { items = (try? await API.milestones(project: build.id)) ?? items ?? [] }
}

// MARK: Milestones

/// Log a result with its evidence and ask the club that saw it to verify it. A person who saw it
/// (a manager, a professor) signs on the web for now, where the private link is mailed to them.
struct AddMilestoneView: View {
  let projects: [Build]
  var start: String = ""
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @State private var draft = MilestoneDraft()
  @State private var clubs: [Club] = []
  @State private var person = false
  @State private var saving = false
  @State private var error: String?
  @State private var sent = false

  var body: some View {
    NavigationStack {
      Form {
        if projects.count > 1 {
          Picker("Project", selection: $draft.projectId) { ForEach(projects) { Text($0.title).tag($0.id) } }
        }
        Section {
          TextField("What you did, with a number: \"Static fire at 1.2 kN\"", text: $draft.title, axis: .vertical).lineLimit(1...3)
          TextField("Evidence link (commit, video, photo, doc)", text: $draft.evidence).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
          DatePicker("Day", selection: $draft.achievedOn, in: ...Date.now, displayedComponents: .date)
          TextField("Detail (optional)", text: $draft.detail, axis: .vertical).lineLimit(2...5)
        } footer: { Text("No evidence, no request: whoever signs looks at it first.") }
        Section("Who saw it") {
          Picker("Signs it", selection: Binding(get: { person ? "person" : draft.clubId }, set: { v in person = v == "person"; if !person { draft.clubId = v } })) {
            ForEach(clubs) { Text($0.name).tag($0.id) }
            Text("A person who saw it").tag("person")
          }
          .pickerStyle(.inline).labelsHidden()
        }
        Section { Toggle("Show on my profile once it's signed", isOn: $draft.showOnProfile) }
        if let error { Section { Label(error, icon: "exclamationmark.circle").foregroundStyle(p.danger) } }
      }
      .scrollContentBackground(.hidden).background(p.bg)
      .navigationTitle("Add a milestone").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button(person ? "Continue on the web" : "Ask to verify") { Task { await send() } }.disabled(saving).fontWeight(.semibold)
        }
      }
      .overlay { if sent { sentView } }
      .toolbar(sent ? .hidden : .visible, for: .navigationBar)
      .task {
        if draft.projectId.isEmpty { draft.projectId = start.isEmpty ? (projects.first?.id ?? "") : start }
        if let me = session.userId { clubs = (try? await API.myClubs(me: me)) ?? [] }
        if draft.clubId.isEmpty { if let first = clubs.first { draft.clubId = first.id } else { person = true } }
      }
    }
  }

  private var sentView: some View {
    VStack(spacing: 12) {
      Icon("checkmark.circle.fill").font(.system(size: 44)).foregroundStyle(p.ok)
      Text("Asked \(clubs.first { $0.id == draft.clubId }?.name ?? "your club")").font(.title3.weight(.semibold)).foregroundStyle(p.text)
      Text("Its officers see it now. It's on your record as waiting until one of them verifies it.").font(.subheadline).foregroundStyle(p.muted).multilineTextAlignment(.center)
      Button("Done") { dismiss() }.buttonStyle(PrimaryButtonStyle()).padding(.top, 6)
    }
    .padding(28).frame(maxWidth: .infinity, maxHeight: .infinity).background(p.bg)
    .transition(.opacity)
  }

  private func send() async {
    if person {
      // The web mails the signer a private link the member never holds, so this step is there.
      openURL(Env.web("projects/\(draft.projectId)"))
      dismiss()
      return
    }
    if let problem = RecordLogic.problem(draft) { error = problem; return }
    saving = true; error = nil
    defer { saving = false }
    do {
      try await API.askClub(draft)
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      withAnimation(.snappy) { sent = true }
    } catch { self.error = friendly(error) }
  }
}

// MARK: Verifying (club officers)

/// What's waiting for a club's officers: each result with its evidence, verified or declined here.
/// The database refuses an officer's own team's work and caps approvals per week.
struct VerifyQueueView: View {
  let club: Club
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @State private var items: [QueueItem]?
  @State private var working: String?
  @State private var done: [String: String] = [:]
  @State private var declining: QueueItem?
  @State private var note = ""
  @State private var error: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Text("Look at the evidence, then verify what you saw happen. Every decision is logged and can be revoked with a reason.")
          .font(.subheadline).foregroundStyle(p.muted)
        if let error { Label(error, icon: "exclamationmark.circle").font(.footnote).foregroundStyle(p.danger) }
        if let items {
          if items.isEmpty { EmptyState(icon: "checkmark.seal", title: "Nothing waiting", message: "When a member asks \(club.name) to verify a result, it shows up here.") }
          ForEach(items) { item in row(item) }
        } else { ProgressView().frame(maxWidth: .infinity) }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationTitle("To verify").navigationBarTitleDisplayMode(.inline)
    .task { await load() }
    .refreshable { await load() }
    .alert("Decline this result?", isPresented: Binding(get: { declining != nil }, set: { if !$0 { declining = nil } })) {
      TextField("Why (they'll see this)", text: $note)
      Button("Decline", role: .destructive) { if let d = declining { Task { await review(d, verify: false) } } }
      Button("Cancel", role: .cancel) {}
    } message: { Text("Say what's missing so they can fix it and ask again.") }
  }

  private func row(_ item: QueueItem) -> some View {
    Card {
      VStack(alignment: .leading, spacing: 10) {
        VStack(alignment: .leading, spacing: 3) {
          Text(item.title).font(.headline).foregroundStyle(p.text)
          Text("\(item.ownerName)\(item.project.map { " · \($0.title)" } ?? "") · \(RecordLogic.shortDay(item.achievedOn))").font(.caption).foregroundStyle(p.muted)
        }
        if let d = item.detail, !d.isEmpty { Text(d).font(.subheadline).foregroundStyle(p.text2) }
        if let e = item.evidence, let url = URL(string: e) {
          Button { openURL(url) } label: { Label(url.host() ?? "Evidence", icon: "link").font(.footnote.weight(.medium)) }.buttonStyle(QuietButtonStyle())
        }
        if let result = done[item.id] {
          Label(result, icon: result == "Declined" ? "xmark" : "checkmark.circle.fill").font(.footnote.weight(.semibold)).foregroundStyle(result == "Declined" ? p.muted : p.ok)
        } else {
          HStack(spacing: 8) {
            Button { Task { await review(item, verify: true) } } label: {
              HStack(spacing: 6) { if working == item.id { ProgressView().controlSize(.small).tint(p.onAccent) }; Text("Verify") }
            }
            .buttonStyle(PrimaryButtonStyle())
            Button("Decline") { note = ""; declining = item }.buttonStyle(QuietButtonStyle())
          }
          .disabled(working != nil)
        }
      }
    }
  }

  private func load() async { items = (try? await API.verifyQueue(club: club.id)) ?? items ?? [] }

  private func review(_ item: QueueItem, verify: Bool) async {
    working = item.id; error = nil
    defer { working = nil }
    do {
      let result = try await API.review(item.id, verify: verify, note: verify ? "" : note)
      done[item.id] = result == "verified" ? "Verified" : result == "pending" ? "Approved: one more officer to go" : "Declined"
      UINotificationFeedbackGenerator().notificationOccurred(.success)
    } catch { self.error = friendly(error) }
  }
}
