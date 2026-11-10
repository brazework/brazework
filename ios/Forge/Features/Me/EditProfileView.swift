import PhotosUI
import SwiftUI

struct EditProfileView: View {
  @Environment(Session.self) private var session
  @Environment(\.dismiss) private var dismiss
  @Environment(\.palette) private var p
  @State private var edit: ProfileEdit
  private let original: ProfileEdit
  private let dropped: [String]
  @State private var photoItem: PhotosPickerItem?
  @State private var newPhoto: UIImage?
  @State private var saving = false
  @State private var error: String?

  init(profile: Profile) {
    let e = ProfileEdit(profile)
    _edit = State(initialValue: e)
    original = e
    // Interests from before the current topic list (the web asks to replace them too).
    dropped = profile.interests.filter { !Topics.topics.contains($0) }
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          HStack(spacing: 16) {
            ZStack {
              if let newPhoto { Image(uiImage: newPhoto).resizable().scaledToFill().frame(width: 72, height: 72).clipShape(Circle()) }
              else { Avatar(first: edit.firstName, last: edit.lastName, path: session.profile?.avatarPath, size: 72) }
            }
            let photoLabel = session.profile?.avatarPath?.isEmpty == false || newPhoto != nil ? "Change photo" : "Add a photo"
            PhotosPicker(selection: $photoItem, matching: .images) { Text(photoLabel).font(.subheadline.weight(.semibold)) }
          }
          .listRowBackground(p.surface)
        }
        Section("Name") {
          TextField("First name", text: $edit.firstName).textContentType(.givenName)
          TextField("Last name", text: $edit.lastName).textContentType(.familyName)
        }
        .listRowBackground(p.surface)
        Section {
          TextField("e.g. Avionics lead, Rocketry Club", text: $edit.headline, axis: .vertical).lineLimit(1...3)
        } header: { Text("Headline") } footer: { Text("\(200 - edit.headline.count) left") }
        .listRowBackground(p.surface)
        Section("Field") {
          Picker("Field", selection: $edit.field) {
            if !Topics.fields.contains(edit.field) { Text("Pick your field").tag(edit.field) }
            ForEach(Topics.fields, id: \.self) { Text($0).tag($0) }
          }
          .pickerStyle(.navigationLink)
        }
        .listRowBackground(p.surface)
        Section("About") {
          TextField("What you're working on, what you're looking for", text: $edit.bio, axis: .vertical).lineLimit(3...10)
        }
        .listRowBackground(p.surface)
        Section {
          ForEach(Topics.all, id: \.field) { group in
            VStack(alignment: .leading, spacing: 8) {
              Text(group.field).font(.caption.weight(.semibold)).foregroundStyle(p.muted)
              FlowLayout(spacing: 6) {
                ForEach(group.topics, id: \.self) { t in
                  let on = edit.interests.contains(t)
                  Button { if on { edit.interests.removeAll { $0 == t } } else { edit.interests.append(t) } } label: { Chip(text: t, selected: on) }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
              }
            }
            .padding(.vertical, 4)
          }
        } header: {
          Text("Interests · \(edit.interests.count) picked")
        } footer: {
          Text(dropped.isEmpty ? "Pick at least 3. They shape your feed and who finds you." : "Pick at least 3. \(dropped.joined(separator: ", ")) \(dropped.count == 1 ? "isn't" : "aren't") on the topic list anymore and will be replaced.")
        }
        .listRowBackground(p.surface)
        if let error { Section { Text(error).foregroundStyle(p.danger) }.listRowBackground(p.surface) }
      }
      .scrollContentBackground(.hidden)
      .background(p.bg)
      .navigationTitle("Edit profile")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button { Task { await save() } } label: { if saving { ProgressView() } else { Text("Save").bold() } }
            .disabled(saving || (edit == original && newPhoto == nil && dropped.isEmpty))
        }
      }
      .onChange(of: photoItem) {
        Task { if let data = try? await photoItem?.loadTransferable(type: Data.self), let img = UIImage(data: data) { newPhoto = img } }
      }
    }
  }

  private func save() async {
    guard let me = session.userId else { return }
    if let problem = edit.problem { error = problem; return }
    saving = true; error = nil
    defer { saving = false }
    do {
      if let newPhoto {
        guard let jpg = MediaPrep.photo(newPhoto, maxSide: 800) else { throw MediaError.unreadable }
        _ = try await API.setAvatar(jpg.data, me: me, old: session.profile?.avatarPath)
      }
      if edit != original || !dropped.isEmpty { try await API.saveProfile(edit, me: me) }
      await session.loadProfile()
      dismiss()
    } catch { self.error = friendly(error) }
  }
}

struct SavedPostsView: View {
  @Environment(Session.self) private var session
  @Environment(\.palette) private var p
  @State private var feed = FeedStore()
  @State private var loaded = false

  var body: some View {
    ScrollView {
      LazyVStack(spacing: 12) {
        if !loaded { ProgressView().padding(.top, 60) }
        if loaded && feed.items.isEmpty { EmptyState(icon: "bookmark", title: "Nothing saved yet", message: "Tap the bookmark on a post to keep it here.") }
        ForEach(feed.items) { PostCard(item: $0, store: feed) }
      }
      .padding(16)
    }
    .background(p.bg)
    .navigationTitle("Saved")
    .navigationDestination(for: Post.self) { PostDetailView(post: $0, feed: feed) }
    .refreshable { await load() }
    .task { await load() }
  }

  private func load() async {
    guard let me = session.userId else { return }
    if let posts = try? await API.savedPosts(me: me) { await feed.show(posts, me: me) }
    loaded = true
  }
}
