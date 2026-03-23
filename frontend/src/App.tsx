import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ChatLayout from './components/ChatLayout'
import Home from './pages/Home'
import Chat from './pages/Chat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ChatLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/chat/:id" element={<Chat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
