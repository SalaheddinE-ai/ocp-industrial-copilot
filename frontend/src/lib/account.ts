import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Account = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  site: string;
  avatar_url: string | null;
};

export function initials(name: string) {
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useAccount() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [account, setAccount] = React.useState<Account | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (s: Session | null) => {
    if (!s) {
      setAccount(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, site, avatar_url")
      .eq("id", s.user.id)
      .maybeSingle();
    setAccount({
      id: s.user.id,
      email: s.user.email ?? "",
      full_name: data?.full_name || (s.user.email ?? "").split("@")[0],
      role: data?.role || "Maintenance Eng.",
      site: data?.site || "Jorf Lasfar",
      avatar_url: data?.avatar_url ?? null,
    });
    setLoading(false);
  }, []);

  React.useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      void load(s);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void load(data.session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const save = React.useCallback(
    async (patch: Partial<Pick<Account, "full_name" | "role" | "site">>) => {
      if (!account) return { error: "Not signed in" };
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: account.id, ...patch }, { onConflict: "id" });
      if (error) return { error: error.message };
      setAccount({ ...account, ...patch });
      return {};
    },
    [account],
  );

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    setAccount(null);
    setSession(null);
  }, []);

  return { session, account, loading, save, signOut };
}
