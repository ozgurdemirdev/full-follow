import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Route, Switch } from "wouter";
import { api, onAuthRequired } from "../api/client";
import { PageSkeleton } from "../components/ui";
import { requestChatOpen } from "../lib/chatStore";
import { Fab } from "./Fab";
import { Login } from "./Login";
import { pages, PATHS, preload } from "./routes";
import { Sidebar } from "./Sidebar";

// Formlar ve bildirimler (Motion dahil) ilk boyamadan sonra ayrı parçalar halinde yüklenir
const QuickAdd = lazy(() => import("../forms/QuickAdd"));
const Toasts = lazy(() => import("../components/Toasts"));
const ChatWidget = lazy(() => import("./ChatWidget"));
const Mascot = lazy(() => import("../mascot/Mascot"));

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
    // Safari has no requestIdleCallback: a bare `requestIdleCallback?.()` throws a ReferenceError there
    const id = window.requestIdleCallback?.(() => (["pipeline", "drafts", "people"] as const).forEach(preload));
    return () => (id ? window.cancelIdleCallback(id) : undefined);
  }, [auth]);

  if (auth === "checking") return null;
  if (auth === "out") return <Login onDone={() => setAuth("in")} />;
  return (
    <>
      <div className="ff-shell">
        <Sidebar />
        <Boundary>
          <Suspense fallback={<Fallback />}>
            <Switch>
              <Route path={PATHS.today} component={pages.today} />
              <Route path={PATHS.calendar} component={pages.calendar} />
              <Route path={`${PATHS.pipeline}/:id?`} component={pages.pipeline} />
              <Route path={`${PATHS.opportunity}/:id`} component={pages.opportunity} />
              <Route path={`${PATHS.people}/:id?`} component={pages.people} />
              <Route path={`${PATHS.companies}/:id?`} component={pages.companies} />
              <Route path={PATHS.referrals} component={pages.referrals} />
              <Route path={`${PATHS.projects}/:id?`} component={pages.projects} />
              <Route path={`${PATHS.timeline}/:type?/:id?`} component={pages.timeline} />
              <Route path={PATHS.report} component={pages.report} />
              <Route path={PATHS.review} component={pages.review} />
              <Route path={`${PATHS.drafts}/:id?`} component={pages.drafts} />
              <Route path={`${PATHS.comments}/:id?`} component={pages.comments} />
              <Route path={`${PATHS.posts}/:id?`} component={pages.posts} />
              <Route path={`${PATHS.ideas}/:id?`} component={pages.ideas} />
              <Route path={`${PATHS.ownProjects}/:id?`} component={pages.ownProjects} />
              <Route path={`${PATHS.templates}/:id?`} component={pages.templates} />
              <Route path={`${PATHS.settings}/:kategori?`} component={pages.settings} />
              <Route component={pages.today} />
            </Switch>
          </Suspense>
        </Boundary>
      </div>
      <Suspense fallback={null}>
        <ChatWidget />
        <Mascot onActivate={requestChatOpen} />
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
          <h1 className="page-title">Bir şeyler ters gitti</h1>
          <p className="m-0 text-base text-text-secondary">{this.state.error.message}</p>
          <button type="button" className="btn btn-pri" onClick={() => location.reload()}>Sayfayı yenile</button>
        </div>
      </main>
    );
  }
}
