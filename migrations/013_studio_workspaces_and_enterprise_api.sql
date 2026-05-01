CREATE TABLE IF NOT EXISTS studio_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NULL,
  tier_snapshot TEXT NOT NULL DEFAULT 'studio',
  queue_lane TEXT NOT NULL DEFAULT 'studio',
  is_enterprise BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id)
);

CREATE TABLE IF NOT EXISTS studio_workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES studio_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES studio_workspaces(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  queue_lane TEXT NOT NULL DEFAULT 'studio',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_workspaces_owner_idx
  ON studio_workspaces(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS studio_workspace_members_workspace_idx
  ON studio_workspace_members(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS studio_workspace_members_user_idx
  ON studio_workspace_members(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS studio_projects_workspace_idx
  ON studio_projects(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS studio_projects_owner_idx
  ON studio_projects(owner_user_id, updated_at DESC);
