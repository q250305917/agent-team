import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import OverviewPage from './pages/OverviewPage';
import TeamDetailPage from './pages/TeamDetailPage';
import MessagesPage from './pages/MessagesPage';
import TasksPage from './pages/TasksPage';
import MessageFlowPage from './pages/MessageFlowPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/teams/:name" element={<TeamDetailPage />} />
          <Route path="/teams/:name/flow" element={<MessageFlowPage />} />
          <Route path="/flow" element={<MessageFlowPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
