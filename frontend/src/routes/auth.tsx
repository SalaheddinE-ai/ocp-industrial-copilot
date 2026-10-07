import * as React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { FalconLogo } from "@/components/brand/FalconLogo";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Falcon Industrial Copilot" },
      { name: "description", content: "Sign in or create your Falcon account to access the industrial copilot: 3D digital twin, AI maintenance guidance, manuals and spare parts." },
      { property: "og:title", content: "Sign in · Falcon Industrial Copilot" },
      { property: "og:description", content: "Create an account with Google or email to access the Falcon industrial maintenance copilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  name: z.string().trim().max(80).optional(),
});

function AuthPage() {
  const { mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const isRegister = mode === "register";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState(false);

  React.useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password, name: isRegister ? name : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.name || parsed.data.email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentEmail(true);
          toast.success("Check your inbox to confirm your account");
        } else {
          toast.success("Account created");
          navigate({ to: "/dashboard", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  const forgot = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* Brand side */}
      <aside className="lg:w-[46%] border-b lg:border-b-0 lg:border-r border-border bg-surface-1 px-6 sm:px-10 py-8 lg:py-14 flex flex-col justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
        <div className="my-8 lg:my-0 max-w-md">
          <FalconLogo size={56} tagline="Industrial Copilot" />
          <h2 className="mt-7 text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            Precision maintenance,<br className="hidden sm:block" /> at falcon speed.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            One account unlocks the 3D digital twin, AI-guided procedures, manuals,
            spare parts and every intervention logged on your assets.
          </p>
          <ul className="mt-6 space-y-2 text-[12.5px] text-muted-foreground">
            {["Interactive 3D digital twin", "AI copilot grounded on asset data", "Manuals, parts and intervention history"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-muted-foreground">Falcon · Industrial Copilot v2.4</p>
      </aside>

      {/* Form side */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isRegister ? "Create your account" : "Sign in to Falcon"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isRegister ? "Start with Google or your work email." : "Welcome back. Continue where you left off."}
          </p>

          <button
            onClick={google}
            disabled={busy}
            className="mt-6 w-full h-11 rounded-lg border border-border bg-surface-1 hover:border-border-strong transition-colors flex items-center justify-center gap-2.5 text-sm font-medium disabled:opacity-60"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          {sentEmail ? (
            <div className="rounded-lg border border-border bg-surface-1 p-4 text-sm">
              <p className="font-medium">Confirm your email</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                We sent a confirmation link to <span className="font-mono">{email}</span>. Click it to activate your Falcon account.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {isRegister && (
                <FieldInput icon={UserIcon} label="Full name" value={name} onChange={setName} placeholder="A. El Fassi" />
              )}
              <FieldInput icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
              <FieldInput icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isRegister ? "Create account" : "Sign in"}
              </button>

              {!isRegister && (
                <button type="button" onClick={forgot} className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Forgot your password?
                </button>
              )}
            </form>
          )}

          <p className="mt-6 text-[12.5px] text-muted-foreground text-center">
            {isRegister ? "Already have an account?" : "No account yet?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isRegister ? "login" : "register" }}
              className="text-foreground font-medium hover:underline"
            >
              {isRegister ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function FieldInput({
  icon: Icon, label, value, onChange, type = "text", placeholder,
}: {
  icon: typeof Mail; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-1 relative block">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 pl-10 pr-3 rounded-lg bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
        />
      </span>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.86Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}
