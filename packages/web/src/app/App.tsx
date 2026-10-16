import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { SETUP_REQUIRED_CODE } from "../../../core/src/constants";
import { api, ApiError, HTTP_UNAUTHORIZED, onAuthRequired } from "../api/client";
import { loadModules } from "../api/modules";
import type { Me, PriceFloor } from "../api/types";
import { PageSkeleton } from "../components/ui";
import { requestChatOpen } from "../lib/chatStore";
import { setOwnerName, useOwner } from "../lib/owner";
import { shell } from "../messages.shell";
import { Fab } from "./Fab";
import { Login } from "./Login";
import { lazyOf, preloadRoute, useRegistry } from "./modules/registry";
import { Slot } from "./modules/Slot";
import { PATHS } from "./routes";
import { Setup } from "./Setup";
import { Sidebar } from "./Sidebar";

// Formlar ve bildirimler (Motion dahil) ilk boyamadan sonra ayrı parçalar halinde yüklenir
const QuickAdd = lazy(() => import("../forms/QuickAdd"));
const Toasts = lazy(() => import("../components/Toasts"));

/** "setup": the install has no password yet (first run), the setup asks for the name and the password */
type Auth = "checking" | "in" | "out" | "setup";

export function App() {
  const [auth, setAuth] = useState<Auth>("checking");
  const [modulesKnown, setModulesKnown] = useState(false);
  const { routes } = useRegistry();
  const { needsSetup } = useOwner();

  useEffect(() => {
    const stop = onAuthRequired((code) => setAuth(code === SETUP_REQUIRED_CODE ? "setup" : "out"));
    api
      .get<Me>("/me")
      .then((r) => setAuth(r.loggedIn ? "in" : "out"))
      // a 401 was already handled by the listener (setup or login); an unreachable server shows the app with its own errors
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === HTTP_UNAUTHORIZED)) setAuth("in");
      });
    return stop;
  }, []);

  // the installed modules and the owner's name are known before anything draws, so no screen asks for an endpoint that is not there
  useEffect(() => {
    if (auth !== "in") return;
    const settings = api.get<PriceFloor>("/settings").catch(() => null);
    void Promise.all([loadModules(settings), settings.then((s) => setOwnerName(s?.owner_name))]).then(() => setModulesKnown(true));
  }, [auth]);

  useEffect(() => {
    if (auth !== "in") return;
    // boşta kalınca sık kullanılan sayfaları önceden indir
    // Safari has no requestIdleCallback: a bare `requestIdleCallback?.()` throws a ReferenceError there
    const id = window.requestIdleCallback?.(() => (["pipeline", "drafts", "people"] as const).forEach((page) => preloadRoute({ page })));
    return () => (id ? window.cancelIdleCallback(id) : undefined);
  }, [auth]);

  if (auth === "checking" || (auth === "in" && !modulesKnown)) return null;
  if (auth === "out") return <Login onDone={() => setAuth("in")} />;
  if (auth === "setup") return <Setup withPassword onDone={() => setAuth("in")} />;
  if (needsSetup) return <Setup />;
  return (
    <>
      <div className="ff-shell">
        <Sidebar />
        <Boundary>
          <Suspense fallback={<Fallback />}>
            <Switch>
              {routes.map((r) => <Route key={r.page} path={r.path + (r.params ?? "")} component={lazyOf(r.load)} />)}
              {/* the route of a module that is gone or hidden leads nowhere: back to the dashboard */}
              <Route><Redirect to={PATHS.today} replace /></Route>
            </Switch>
          </Suspense>
        </Boundary>
      </div>
      <Suspense fallback={null}>
        <Slot name="app.overlay" props={{ onActivate: requestChatOpen }} />
      </Suspense>
      <Fab />
      <Suspense fallback={null}>
        <QuickAdd />
        <Toasts />
      </Suspense>
    </>
  );
}

function Fallback() {
  return (
    <main className="ff-main">
      <div className="ff-wrap">
        <PageSkeleton />
      </div>
    </main>
  );
}

/** Sayfa çökerse tüm uygulama değil sadece içerik alanı hata gösterir */
class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="ff-main">
        <div className="ff-wrap items-start">
          <h1 className="page-title">{shell.errorTitle}</h1>
          <p className="m-0 text-base text-text-secondary">{this.state.error.message}</p>
          <button type="button" className="btn btn-pri" onClick={() => location.reload()}>{shell.errorReload}</button>
        </div>
      </main>
    );
  }
}
