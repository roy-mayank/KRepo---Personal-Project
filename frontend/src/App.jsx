import { useState } from 'react'
import LandingPage from '@/components/LandingPage'
import MainApp from '@/components/MainApp'

function App() {
  const [phase, setPhase] = useState('landing') // 'landing' | 'animating' | 'app'

  const handleLaunch = () => {
    setPhase('animating')
    setTimeout(() => setPhase('app'), 820)
  }

  return (
    <div className="h-screen overflow-hidden bg-black">
      {/* Main app is always mounted underneath */}
      <div className="dark h-full">
        <MainApp />
      </div>

      {/* Landing page overlays as a fixed layer, slides up on click */}
      {phase !== 'app' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            transform: phase === 'animating' ? 'translateY(-100vh)' : 'translateY(0)',
            transition: 'transform 0.82s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <LandingPage onLaunch={handleLaunch} />
        </div>
      )}
    </div>
  )
}

export default App
