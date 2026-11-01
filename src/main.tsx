import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "./styles.css";
import { requestPersistence } from "./db/db";
import { TabBar, Toaster } from "./components/ui";
import Today from "./screens/Today";
import IntentionEditor from "./screens/IntentionEditor";
import Reflect from "./screens/Reflect";
import Skills from "./screens/Skills";
import SkillDetail from "./screens/SkillDetail";
import Programs from "./screens/Programs";
import ProgramEditor from "./screens/ProgramEditor";
import ProgramDay from "./screens/ProgramDay";
import GamePlan from "./screens/GamePlan";
import Progress from "./screens/Progress";

// Full-screen flows hide the tab bar so their own Save button is the only way forward.
const NO_TABS = ["/intention", "/reflect"];

function Shell() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/intention" element={<IntentionEditor />} />
        <Route path="/reflect" element={<Reflect />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/skills/:id" element={<SkillDetail />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:id" element={<ProgramEditor />} />
        <Route path="/programs/:id/day/:index" element={<ProgramDay />} />
        <Route path="/gameplan" element={<GamePlan />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="*" element={<Today />} />
      </Routes>
      {!NO_TABS.includes(pathname) && <TabBar />}
      <Toaster />
    </>
  );
}

requestPersistence();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Shell />
    </HashRouter>
  </React.StrictMode>,
);
