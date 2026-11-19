import SwiftUI

// Projects: what you're making (the web's Projects place). Each project (a Build here) is a card with where it stands on the
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
                Label("Start a new project", systemImage: "plus")
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
      .navigationTitle("Projects")
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
      stat("\(builds.count)", builds.count == 1 ? "project" : "projects", p.text)
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
  @Environment(AppNav.self) private var nav
  @Environment(\.palette) private var p

  var body: some View {
    let step = BuildLogic.next(build.counts), path = BuildLogic.path(build.counts)
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

        // Where it stands: logged, asked, signed (the same three steps as the web's card).
        HStack(spacing: 6) {
          ForEach(path) { s in StageChip(label: s.label, note: s.note, done: s.done, signed: s.id == .signed) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Where this project stands: " + path.map { "\($0.label), \($0.done ? "done" : "not yet"), \($0.note)" }.joined(separator: "; "))

        // The one next step, and why.
        VStack(alignment: .leading, spacing: 8) {
          (Text("Next: \(step.label). ").fontWeight(.semibold).foregroundStyle(p.text2) + Text(step.hint).foregroundStyle(p.muted)).font(.footnote)
          HStack(spacing: 8) {
            // The same buttons as the web's card: one primary, from the next step.
            if step.kind == .verify {
              Button("Get it signed", systemImage: "checkmark.shield", action: open).buttonStyle(PrimaryButtonStyle())
              Button("Log update", systemImage: "plus", action: log).buttonStyle(QuietButtonStyle())
            } else {
              Button("Log update", systemImage: "plus", action: log).buttonStyle(PrimaryButtonStyle())
              Button(build.counts.verified > 0 ? "Milestones" : "Add a milestone", systemImage: "checkmark.shield", action: open).buttonStyle(QuietButtonStyle())
            }
          }
          if build.counts.verified > 0 {
            Button { nav.tab = .me } label: { Label("On your record", systemImage: "checkmark.seal").font(.footnote.weight(.medium)).foregroundStyle(p.text2) }
              .buttonStyle(.plain)
          }
        }
      }
    }
  }
}

private struct StageChip: View {
  let label: String, note: String, done: Bool
  var signed = false
  @Environment(\.palette) private var p
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Label(label, systemImage: done ? "checkmark" : "circle").font(.caption.weight(.semibold)).foregroundStyle(done ? (signed ? Color.green : p.text) : p.muted)
      Text(note).font(.caption2).monospacedDigit().foregroundStyle(p.faint).lineLimit(1).minimumScaleFactor(0.85)
    }
    .padding(.horizontal, 10).padding(.vertical, 8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(done ? (signed ? Color.green.opacity(0.12) : p.surface2) : Color.clear, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
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
        Text("Start your first project").font(.title3.weight(.bold)).foregroundStyle(p.text)
        Text("A project is anything you're building: a robot, a rocket, a model, an experiment, an app. Post updates as you go, and your club verifies the milestones.").font(.subheadline).foregroundStyle(p.muted)
        Button("Start a project", systemImage: "arrow.up.right", action: start).buttonStyle(PrimaryButtonStyle()).padding(.top, 4)
      }
    }
  }
}

// The record: the results someone signed, newest first. The first thing on the Record tab.
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
          Text("Nothing signed yet. Log a result on a project and ask someone who saw it to sign it.").font(.subheadline).foregroundStyle(p.muted)
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
