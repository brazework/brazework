import SwiftUI

// Build: what you're making (the web's Build place). Each build is a card with where it stands on the
// way from built to signed and the one thing worth doing next (ForgeKit/Builds.swift, the same rule
// as the web). Logging an update opens the composer; asking for a signature opens the build on the
// web for now, where the evidence and the club are picked.
struct BuildView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  @State private var builds: [Build]?
  @State private var compose = false

  var body: some View {
    NavigationStack {
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 14) {
          if let builds {
            if builds.isEmpty {
              EmptyBuilds { openURL(Env.web("projects")) }
            } else {
              BuildRecord(builds: builds)
              ForEach(builds) { b in
                BuildCard(build: b, log: { compose = true }, open: { openURL(Env.web("projects/\(b.id)")) })
              }
              Button { openURL(Env.web("projects")) } label: {
                Label("Start a new build", systemImage: "plus")
                  .font(.subheadline.weight(.medium)).foregroundStyle(p.muted)
                  .frame(maxWidth: .infinity, minHeight: 48)
                  .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(p.border, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
              }
              .buttonStyle(.plain)
            }
          } else {
            ForEach(0..<2, id: \.self) { _ in RoundedRectangle(cornerRadius: 24, style: .continuous).fill(p.surface).frame(height: 190) }
          }
        }
        .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
      }
      .background(p.bg)
      .navigationTitle("Build")
      .toolbarTitleDisplayMode(.inlineLarge)
      .refreshable { await load() }
      .task { await load() }
      .sheet(isPresented: $compose, onDismiss: { Task { await load() } }) { ComposerView(initialKind: "update") { } }
    }
  }

  private func load() async {
    guard let me = session.userId else { return }
    builds = (try? await API.myBuilds(me: me)) ?? builds ?? []
  }
}

// The record at a glance: how much of your work someone has signed.
private struct BuildRecord: View {
  let builds: [Build]
  @Environment(\.palette) private var p
  var body: some View {
    let signed = builds.reduce(0) { $0 + $1.counts.verified }, waiting = builds.reduce(0) { $0 + $1.counts.waiting }
    HStack(spacing: 10) {
      stat("\(builds.count)", builds.count == 1 ? "build" : "builds", p.text)
      stat("\(signed)", signed == 1 ? "signed result" : "signed results", signed > 0 ? .green : p.text)
      if waiting > 0 { stat("\(waiting)", "waiting", p.text) }
    }
  }
  private func stat(_ n: String, _ label: String, _ tint: Color) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(n).font(.title2.weight(.bold)).monospacedDigit().foregroundStyle(tint)
      Text(label).font(.caption).foregroundStyle(p.muted)
    }
    .padding(.horizontal, 14).padding(.vertical, 10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
  }
}

struct BuildCard: View {
  let build: Build
  var log: () -> Void
  var open: () -> Void
  @Environment(\.palette) private var p

  var body: some View {
    let step = BuildLogic.next(build.counts), stage = BuildLogic.stage(build.counts)
    Card {
      VStack(alignment: .leading, spacing: 12) {
        HStack(alignment: .top, spacing: 10) {
          VStack(alignment: .leading, spacing: 4) {
            Text(build.title).font(.headline).foregroundStyle(p.text).lineLimit(2)
            HStack(spacing: 6) {
              Circle().fill(build.completed ? Color.green : Color.orange).frame(width: 6, height: 6)
              Text(build.completed ? "Completed" : "In progress")
              Text("· updated \(timeAgo(build.updatedAt))")
              if build.isPrivate { Label("Private", systemImage: "lock").labelStyle(.titleAndIcon) }
            }
            .font(.caption).foregroundStyle(p.muted)
          }
          Spacer(minLength: 0)
          Button(action: open) { Image(systemName: "arrow.up.right").font(.footnote.weight(.semibold)).foregroundStyle(p.muted).frame(width: 32, height: 32).background(p.surface2, in: Circle()) }
            .buttonStyle(.plain).accessibilityLabel("Open \(build.title)")
        }
        if !build.summary.isEmpty { Text(build.summary).font(.subheadline).foregroundStyle(p.text2).lineLimit(2) }

        // Where it stands: built, then signed.
        HStack(spacing: 8) {
          StageChip(label: "Built", note: "\(build.counts.updates) update\(build.counts.updates == 1 ? "" : "s")", done: stage >= 1)
          StageChip(label: "Signed", note: build.counts.waiting > 0 ? "\(build.counts.verified) signed · \(build.counts.waiting) waiting" : "\(build.counts.verified) signed", done: stage >= 2)
        }
        .accessibilityElement(children: .combine)

        // The one next step, and why.
        VStack(alignment: .leading, spacing: 8) {
          (Text("Next: \(step.label). ").fontWeight(.semibold).foregroundStyle(p.text2) + Text(step.hint).foregroundStyle(p.muted)).font(.footnote)
          HStack(spacing: 8) {
            if step.kind == .verify {
              Button("Get it verified", systemImage: "checkmark.shield", action: open).buttonStyle(PrimaryButtonStyle())
              Button("Log update", systemImage: "plus", action: log).buttonStyle(QuietButtonStyle())
            } else {
              Button("Log update", systemImage: "plus", action: log).buttonStyle(PrimaryButtonStyle())
              Button(build.counts.verified + build.counts.waiting > 0 ? "Milestones" : "Ask to verify", systemImage: "checkmark.shield", action: open).buttonStyle(QuietButtonStyle())
            }
          }
        }
      }
    }
  }
}

private struct StageChip: View {
  let label: String, note: String, done: Bool
  @Environment(\.palette) private var p
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Label(label, systemImage: done ? "checkmark" : "circle").font(.caption.weight(.semibold)).foregroundStyle(done ? Color.green : p.muted)
      Text(note).font(.caption2).monospacedDigit().foregroundStyle(p.faint)
    }
    .padding(.horizontal, 12).padding(.vertical, 8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(done ? Color.green.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(done ? Color.clear : p.border, lineWidth: 1))
  }
}

struct QuietButtonStyle: ButtonStyle {
  @Environment(\.palette) private var p
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.subheadline.weight(.medium)).foregroundStyle(p.text)
      .padding(.horizontal, 14).frame(minHeight: 40)
      .overlay(Capsule().strokeBorder(p.border, lineWidth: 1))
      .opacity(configuration.isPressed ? 0.6 : 1)
  }
}

private struct EmptyBuilds: View {
  var start: () -> Void
  @Environment(\.palette) private var p
  var body: some View {
    Card {
      VStack(alignment: .leading, spacing: 10) {
        Image(systemName: "hammer").font(.title2).foregroundStyle(p.text)
        Text("What are you building?").font(.title3.weight(.bold)).foregroundStyle(p.text)
        Text("A robot, a rig, a model, an app. Start it once, then log what you build and get results signed by someone who saw them.").font(.subheadline).foregroundStyle(p.muted)
        Button("Start your first build", systemImage: "arrow.up.right", action: start).buttonStyle(PrimaryButtonStyle()).padding(.top, 4)
      }
    }
  }
}

// Today's first card: the one thing most worth doing, from your newest build.
struct NextStepCard: View {
  @Environment(Session.self) private var session
  @Environment(AppNav.self) private var nav
  @Environment(\.palette) private var p
  @Environment(\.openURL) private var openURL
  var log: () -> Void
  @State private var builds: [Build]?

  var body: some View {
    Group {
      if let builds {
        if let b = builds.first {
          let step = BuildLogic.next(b.counts)
          card(eyebrow: "Next step · \(b.title)", text: step.label, button: step.kind == .verify ? "Verify" : step.kind == .waiting ? "Open" : "Log") {
            switch step.kind {
            case .log: log()
            case .verify: openURL(Env.web("projects/\(b.id)"))
            case .waiting: nav.tab = .build
            }
          }
        } else {
          card(eyebrow: "Next step", text: "Add what you're building", button: "Start") { openURL(Env.web("projects")) }
        }
      } else {
        // Something to hang the load on while the builds arrive (an empty group never appears, so
        // its task would never run).
        Color.clear.frame(height: 1)
      }
    }
    .task { if let me = session.userId { builds = (try? await API.myBuilds(me: me)) ?? [] } }
  }

  private func card(eyebrow: String, text: String, button: String, action: @escaping () -> Void) -> some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Text(eyebrow.uppercased()).font(.caption2.weight(.semibold)).kerning(0.6).foregroundStyle(p.faint).lineLimit(1)
        Text(text).font(.headline).foregroundStyle(p.text)
      }
      Spacer(minLength: 0)
      Button(action: action) { Label(button, systemImage: "arrow.right").labelStyle(.titleAndIcon) }.buttonStyle(PrimaryButtonStyle()).frame(maxWidth: 132)
    }
    .padding(16)
    .background(p.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(p.border, lineWidth: 0.5))
    .accessibilityElement(children: .contain).accessibilityLabel("Next step")
  }
}

// Proof: the results someone signed, newest first. The first thing on the Proof tab.
struct ProofList: View {
  let items: [ProofItem]?
  @Environment(\.palette) private var p
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text("Signed work").font(.headline).foregroundStyle(p.text)
        Spacer()
        if let items, !items.isEmpty { Text("\(items.count) signed result\(items.count == 1 ? "" : "s")").font(.caption.weight(.semibold)).foregroundStyle(.green) }
      }
      if let items {
        if items.isEmpty {
          Text("Nothing signed yet. Log a result on a build and ask someone who saw it to sign it.").font(.subheadline).foregroundStyle(p.muted)
        } else {
          ForEach(items) { m in
            HStack(alignment: .top, spacing: 10) {
              Image(systemName: "checkmark.seal.fill").foregroundStyle(.green).font(.body)
              VStack(alignment: .leading, spacing: 2) {
                Text(m.title).font(.subheadline.weight(.semibold)).foregroundStyle(p.text)
                Text(m.signedBy).font(.caption).foregroundStyle(.green)
                if let t = m.project?.title { Text(t).font(.caption).foregroundStyle(p.faint) }
              }
            }
          }
        }
      } else {
        ProgressView()
      }
    }
    .padding(.vertical, 6)
  }
}
