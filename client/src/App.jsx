import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import AmbientBackground from './components/AmbientBackground';
import Header from './components/Header';
import Footer from './components/Footer';
import LandingView from './components/LandingView';
import PasscodeGate from './components/PasscodeGate';
import ChatRoom from './components/ChatRoom';
import { useMobileKeyboard } from './hooks/useMobileKeyboard';
import { getOrCreateAlias, getOrCreateSessionId } from './utils/alias';

function RoomRoute({
  activeSession,
  sessionId,
  initialAlias,
  onRoomReady,
  onLeave,
  onComposerFocus,
  onComposerBlur,
}) {
  const { publicId } = useParams();
  const navigate = useNavigate();

  if (activeSession && activeSession.room.publicId === publicId) {
    return (
      <ChatRoom
        session={activeSession}
        sessionId={sessionId}
        onLeave={onLeave}
        onComposerFocus={onComposerFocus}
        onComposerBlur={onComposerBlur}
      />
    );
  }

  return (
    <PasscodeGate
      publicId={publicId}
      initialAlias={initialAlias}
      onRoomReady={onRoomReady}
      onBackHome={() => navigate('/')}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('sairo_theme') || 'dark');
  const [activeSession, setActiveSession] = useState(null);

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const initialAlias = useMemo(() => getOrCreateAlias(), []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('sairo_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleRoomReady = (sessionData) => {
    setActiveSession(sessionData);
    navigate(`/room/${sessionData.room.publicId}`);
  };

  const handleLeaveRoom = () => {
    setActiveSession(null);
    navigate('/');
  };

  const inActiveChat = Boolean(activeSession);
  const { keyboardOpen, onComposerFocus, onComposerBlur } = useMobileKeyboard(inActiveChat);

  return (
    <div
      className={`relative flex flex-col ${
        inActiveChat ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
      }`}
    >
      <AmbientBackground />
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogoClick={handleLeaveRoom}
      />

      <Routes>
        <Route
          path="/"
          element={
            <LandingView
              initialAlias={initialAlias}
              onRoomReady={handleRoomReady}
            />
          }
        />
        <Route
          path="/room/:publicId"
          element={
            <RoomRoute
              activeSession={activeSession}
              sessionId={sessionId}
              initialAlias={initialAlias}
              onRoomReady={handleRoomReady}
              onLeave={handleLeaveRoom}
              onComposerFocus={onComposerFocus}
              onComposerBlur={onComposerBlur}
            />
          }
        />
        <Route
          path="*"
          element={
            <LandingView
              initialAlias={initialAlias}
              onRoomReady={handleRoomReady}
            />
          }
        />
      </Routes>

      {!(inActiveChat && keyboardOpen) && <Footer compact={inActiveChat} />}
    </div>
  );
}
