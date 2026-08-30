import { BrowserRouter, Routes, Route } from "react-router-dom";
import StudentPage from "./pages/StudentPage";
import AdminPage from "./pages/AdminPage";
import TicketViewPage from "./pages/TicketViewPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/ticket/:bookingId" element={<TicketViewPage />} />
      </Routes>
    </BrowserRouter>
  );
}
