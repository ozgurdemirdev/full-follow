import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Route, Switch } from "wouter";
import { api, onAuthRequired } from "../api/client";
import { PageSkeleton } from "../components/ui";
import { Fab } from "./Fab";
import { Login } from "./Login";
import { pages, PATHS, preload } from "./routes";
import { Sidebar } from "./Sidebar";

// Formlar ve bildirimler (Motion dahil) ilk boyamadan sonra ayrı parçalar halinde yüklenir
const QuickAdd = lazy(() => import("../forms/QuickAdd"));
const Toasts = lazy(() => import("../components/Toasts"));

type Auth = "checking" | "in" | "out";

export function App() {
  const [auth, setAuth] = useState<Auth>("checking");

  useEffect(() => {
    api
      .get<{ auth: boolean; loggedIn: boolean }>("/me")
      .then((r) => setAuth(r.loggedIn ? "in" : "out"))
      .catch(() => setAuth("in"));
    return onAuthRequired(() => setAuth("out"));
  }, []);

  useEffect(() => {
    if (auth !== "in") return;
    // boşta kalınca sık kullanılan sayfaları önceden indir
    const id = requestIdleCallback?.(() => (["pipeline", "drafts", "people"] as const).forEach(preload));
    return () => (id ? cancelIdleCallback(id) : undefined);
  }, [auth]);

  return (
    <>
        {auth === "checking" ? null : auth === "out" ? (
          <Login onDone={() => setAuth("in")} />
        ) : (
          <div className="flex min-h-dvh">
            <Sidebar />
            <Boundary>
              <Suspense fallback={<Fallback />}>
                <Switch>
                  <Route path={PATHS.today} component={pages.today} />
                  <Route path={PATHS.calendar} component={pages.calendar} />
                  <Route path={PATHS.pipeline} component={pages.pipeline} />
                  <Route path={`${PATHS.people}/:id?`} component={pages.people} />
                  <Route path={`${PATHS.companies}/:id?`} component={pages.companies} />
                  <Route path={PATHS.referrals} component={pages.referrals} />
                  <Route path={PATHS.projects} component={pages.projects} />
                  <Route path={`${PATHS.timeline}/:type?/:id?`} component={pages.timeline} />
                  <Route path={PATHS.report} component={pages.report} />
                  <Route path={PATHS.drafts} component={pages.drafts} />
                  <Route path={PATHS.comments} component={pages.comments} />
                  <Route path={`${PATHS.posts}/:id?`} component={pages.posts} />
                  <Route path={`${PATHS.ideas}/:id?`} component={pages.ideas} />
                  <Route path={`${PATHS.ownProjects}/:id?`} component={pages.ownProjects} />
                  <Route path={PATHS.templates} component={pages.templates} />
                  <Route path={PATHS.settings} component={pages.settings} />
                  <Route component={pages.today} />
                </Switch>
              </Suspense>
            </Boundary>
            <Fab />
            <Suspense fallback={null}>
              <QuickAdd />
              <Toasts />
            </Suspense>
          </div>
        )}
    </>
  );
}

function Fallback() {
  return (
    <main className="flex-1 px-page-padding-x-mobile pt-12 desk:px-page-padding-x">
      <PageSkeleton />
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
      <main className="flex flex-1 flex-col items-start gap-5 px-page-padding-x-mobile pt-12 desk:px-page-padding-x">
        <h1 className="page-title">Bir şeyler ters gitti</h1>
        <p className="m-0 text-base text-text-secondary">{this.state.error.message}</p>
        <button type="button" className="btn btn-pri" onClick={() => location.reload()}>Sayfayı yenile</button>
      </main>
    );
  }
}
