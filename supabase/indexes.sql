-- Indexes for every foreign key that had none (found by maintenance/health-check.sql, block 3).
-- Joins, cascading deletes and the rate-limit triggers (which count comments and messages per
-- member) stay fast as data grows. Idempotent (if not exists), so it's safe to run again.
-- Run after email-digest.sql. Additive.

create index if not exists admin_queue_community_id_fk_idx on public.admin_queue (community_id);
create index if not exists billing_requests_challenge_id_fk_idx on public.billing_requests (challenge_id);
create index if not exists billing_requests_requested_by_fk_idx on public.billing_requests (requested_by);
create index if not exists challenge_entries_project_id_fk_idx on public.challenge_entries (project_id);
create index if not exists challenges_created_by_fk_idx on public.challenges (created_by);
create index if not exists chat_members_added_by_fk_idx on public.chat_members (added_by);
create index if not exists chat_message_reactions_user_id_fk_idx on public.chat_message_reactions (user_id);
create index if not exists chat_messages_reply_to_fk_idx on public.chat_messages (reply_to);
create index if not exists chat_messages_sender_id_fk_idx on public.chat_messages (sender_id);
create index if not exists chat_reads_uid_fk_idx on public.chat_reads (uid);
create index if not exists chats_created_by_fk_idx on public.chats (created_by);
create index if not exists club_handoffs_from_uid_fk_idx on public.club_handoffs (from_uid);
create index if not exists club_handoffs_to_uid_fk_idx on public.club_handoffs (to_uid);
create index if not exists club_integrations_updated_by_fk_idx on public.club_integrations (updated_by);
create index if not exists club_report_links_created_by_fk_idx on public.club_report_links (created_by);
create index if not exists comments_author_id_fk_idx on public.comments (author_id);
create index if not exists communities_owner_id_fk_idx on public.communities (owner_id);
create index if not exists community_bans_uid_fk_idx on public.community_bans (uid);
create index if not exists community_invites_created_by_fk_idx on public.community_invites (created_by);
create index if not exists community_requests_uid_fk_idx on public.community_requests (uid);
create index if not exists content_reports_reported_fk_idx on public.content_reports (reported);
create index if not exists content_reports_resolved_by_fk_idx on public.content_reports (resolved_by);
create index if not exists conversations_started_by_fk_idx on public.conversations (started_by);
create index if not exists copilot_ratings_user_id_fk_idx on public.copilot_ratings (user_id);
create index if not exists event_saves_event_id_fk_idx on public.event_saves (event_id);
create index if not exists events_created_by_fk_idx on public.events (created_by);
create index if not exists likes_user_id_fk_idx on public.likes (user_id);
create index if not exists message_reactions_user_id_fk_idx on public.message_reactions (user_id);
create index if not exists messages_reply_to_fk_idx on public.messages (reply_to);
create index if not exists messages_sender_id_fk_idx on public.messages (sender_id);
create index if not exists milestones_reviewer_id_fk_idx on public.milestones (reviewer_id);
create index if not exists notifications_comment_id_fk_idx on public.notifications (comment_id);
create index if not exists notifications_community_id_fk_idx on public.notifications (community_id);
create index if not exists notifications_post_id_fk_idx on public.notifications (post_id);
create index if not exists organizations_created_by_fk_idx on public.organizations (created_by);
create index if not exists profile_views_viewer_fk_idx on public.profile_views (viewer);
create index if not exists project_members_uid_fk_idx on public.project_members (uid);
create index if not exists saved_post_id_fk_idx on public.saved (post_id);
