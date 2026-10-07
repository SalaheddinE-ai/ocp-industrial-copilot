import * as React from "react";
import {
  Search,
  Settings,
  Sun,
  Moon,
  User,
  LogOut,
  Check,
  X,
  Pencil,
  Menu,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useTheme } from "@/lib/theme";
import { useProfile, initials, type Profile } from "@/lib/profile";
import { NotificationsMenu } from "@/components/copilot/NotificationsMenu";
import { useMobileNav } from "@/lib/nav-ui";
import { FalconLogo } from "@/components/brand/FalconLogo";

export function TopBar() {
  const { theme, toggle } = useTheme();
  const { toggle: toggleNav } = useMobileNav();

  return (
    <header className="h-[60px] sm:h-[70px] shrink-0 border-b border-border bg-surface-1 flex items-center gap-2 sm:gap-4 px-3 sm:px-5">
      {/* Mobile navigation */}
      <button
        onClick={toggleNav}
        aria-label="Open navigation"
        className="md:hidden h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Left: Falcon logo + product */}
      <Link
        to="/"
        className="flex items-center gap-3 sm:min-w-[240px] lg:min-w-[280px]"
      >
        <FalconLogo
          size={38}
          withWordmark={true}
          tagline="Industrial Copilot"
        />
      </Link>

      {/* Center: Search */}
      <div className="flex-1 max-w-2xl mx-auto hidden md:block">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />

          <input
            type="text"
            placeholder="Search equipment, manuals, procedures…"
            className="w-full h-10 pl-10 pr-16 rounded-lg bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-border bg-surface-3 text-muted-foreground">
              ⌘
            </kbd>

            <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-border bg-surface-3 text-muted-foreground">
              K
            </kbd>
          </div>
        </div>
      </div>

      {/* Mobile spacer */}
      <div className="flex-1 md:hidden" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={
            theme === "dark"
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          aria-label="Toggle theme"
          className="relative h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
        >
          {theme === "dark" ? (
            <Sun
              className="h-4 w-4"
              strokeWidth={1.5}
            />
          ) : (
            <Moon
              className="h-4 w-4"
              strokeWidth={1.5}
            />
          )}
        </button>

        {/* Notifications */}
        <NotificationsMenu />

        {/* Settings */}
        <Link
          to="/settings"
          title="Settings"
          className="relative h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
        >
          <Settings
            className="h-4 w-4"
            strokeWidth={1.5}
          />
        </Link>

        {/* Separator */}
        <div className="h-6 w-px bg-border mx-1" />

        {/* Profile */}
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const { profile, save, reset } = useProfile();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Profile>(profile);

  const ref = React.useRef<HTMLDivElement>(null);

  // Synchronize draft with profile
  React.useEffect(() => {
    setDraft(profile);
  }, [profile]);

  // Close menu when clicking outside or pressing Escape
  React.useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setEditing(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setEditing(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Save profile
  const commit = () => {
    if (!draft.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    save({
      name: draft.name.trim(),
      role: draft.role.trim(),
      email: draft.email.trim(),
      site: draft.site.trim(),
    });

    setEditing(false);

    toast.success("Profile updated");
  };

  return (
    <div
      className="relative"
      ref={ref}
    >
      {/* Profile trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md transition-colors ${
          open
            ? "bg-accent"
            : "hover:bg-accent"
        }`}
      >
        {/* Avatar */}
        <div className="h-7 w-7 rounded-full bg-surface-3 border border-border flex items-center justify-center text-[10px] font-semibold tracking-tight">
          {initials(profile.name)}
        </div>

        {/* User information */}
        <div className="text-left leading-tight hidden xl:block">
          <div className="text-[12px] font-medium">
            {profile.name}
          </div>

          <div className="text-[10px] text-muted-foreground">
            {profile.role}
          </div>
        </div>
      </button>

      {/* Profile dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[290px] rounded-lg border border-border bg-surface-1 shadow-xl overflow-hidden">
          {/* Profile header */}
          <div className="p-3.5 flex items-start gap-3 border-b border-border">
            <div className="h-10 w-10 rounded-full bg-surface-3 border border-border flex items-center justify-center text-xs font-semibold shrink-0">
              {initials(profile.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">
                {profile.name}
              </div>

              <div className="text-[11px] text-muted-foreground truncate">
                {profile.role}
              </div>

              <div className="text-[11px] text-muted-foreground font-mono truncate">
                {profile.email}
              </div>

              <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                {profile.site || "No site"}
              </div>
            </div>
          </div>

          {/* Edit profile */}
          {editing ? (
            <div className="p-3 space-y-2">
              <Field
                label="Full name"
                value={draft.name}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    name: v,
                  })
                }
              />

              <Field
                label="Role"
                value={draft.role}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    role: v,
                  })
                }
              />

              <Field
                label="Email"
                value={draft.email}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    email: v,
                  })
                }
              />

              <Field
                label="Site"
                value={draft.site}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    site: v,
                  })
                }
              />

              {/* Edit actions */}
              <div className="flex gap-2 pt-1">
                {/* Save */}
                <button
                  onClick={commit}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <Check
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                  />
                  Save
                </button>

                {/* Cancel */}
                <button
                  onClick={() => {
                    setDraft(profile);
                    setEditing(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                  />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Profile menu items */
            <div className="p-1.5">
              <MenuItem
                icon={Pencil}
                label="Edit profile"
                onClick={() => setEditing(true)}
              />

              <MenuItem
                icon={Settings}
                label="Workspace settings"
                to="/settings"
                onClick={() => setOpen(false)}
              />

              <div className="my-1.5 h-px bg-border" />

              <MenuItem
                icon={LogOut}
                label="Reset profile"
                danger
                onClick={() => {
                  reset();
                  setOpen(false);
                  toast.success(
                    "Profile reset to default"
                  );
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="mt-0.5 w-full h-8 px-2 rounded-md bg-surface-2 border border-border text-xs focus:outline-none focus:border-border-strong transition-colors"
      />
    </label>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  to,
  danger,
}: {
  icon: typeof User;
  label: string;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}) {
  const cls = `w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-xs transition-colors ${
    danger
      ? "text-muted-foreground hover:text-critical hover:bg-accent"
      : "text-foreground hover:bg-accent"
  }`;

  const inner = (
    <>
      <Icon
        className="h-3.5 w-3.5"
        strokeWidth={1.5}
      />
      {label}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={cls}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cls}
    >
      {inner}
    </button>
  );
}
