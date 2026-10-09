import { Navigate, Route, Routes } from "react-router-dom";
import ConsolePage from "./pages/ConsolePage";
import Install from "./pages/Install";
import InstallComplete from "./pages/InstallComplete";
import InstallSlack from "./pages/InstallSlack";
import InstallSlackComplete from "./pages/InstallSlackComplete";
import InstallConnectorComplete from "./pages/InstallConnectorComplete";
import OnboardingRepos from "./pages/OnboardingRepos";
import ConfigureRepo from "./pages/ConfigureRepo";
import NotFound from "./pages/NotFound";

const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/console" replace />} />
    <Route path="/login" element={<Navigate to="/console" replace />} />
    <Route path="/console" element={<ConsolePage />} />
    <Route path="/console/:stepId/*" element={<ConsolePage />} />
    <Route path="/install/github" element={<Install />} />
    <Route path="/install/github/complete" element={<InstallComplete />} />
    <Route path="/install/slack" element={<InstallSlack />} />
    <Route path="/install/slack/complete" element={<InstallSlackComplete />} />
    <Route path="/install/connectors/:connectorId/complete" element={<InstallConnectorComplete />} />
    <Route path="/onboarding/repos" element={<OnboardingRepos />} />
    <Route path="/onboarding/configure/:owner/:repo" element={<ConfigureRepo />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default App;
