import { LogIn, UserPlus } from 'lucide-react'
import { useNavigate, Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function DatabaseCylinder() {
  const W = 300
  const H = 500
  const rx = W / 2
  const ry = 28
  const bodyH = H - ry * 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ height: '72vh', maxHeight: '650px', width: 'auto' }}>
      <defs>
        <filter id="neon" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur3" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur8" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur18" />
          <feMerge>
            <feMergeNode in="blur18" />
            <feMergeNode in="blur8" />
            <feMergeNode in="blur3" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#010a1c" />
          <stop offset="25%" stopColor="#050e28" />
          <stop offset="75%" stopColor="#050e28" />
          <stop offset="100%" stopColor="#010a1c" />
        </linearGradient>
        <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e2060" />
          <stop offset="100%" stopColor="#060f2c" />
        </linearGradient>
        <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0050ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#001aff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Body */}
      <rect x="0" y={ry} width={W} height={bodyH} fill="url(#bodyGrad)" />
      <rect x="0" y={ry} width={W} height={bodyH} fill="url(#innerGlow)" />

      {/* Left / right edge glow lines */}
      <rect
        x="0"
        y={ry}
        width="2"
        height={bodyH}
        fill="#00a8ff"
        filter="url(#neon)"
        opacity="0.9"
      />
      <rect
        x={W - 2}
        y={ry}
        width="2"
        height={bodyH}
        fill="#00a8ff"
        filter="url(#neon)"
        opacity="0.9"
      />

      {/* Bottom ellipse */}
      <ellipse
        cx={rx}
        cy={H - ry}
        rx={rx}
        ry={ry}
        fill="#030c1e"
        stroke="#00a8ff"
        strokeWidth=".5"
        filter="url(#neon)"
      />

      {/* Disk divider 1 */}
      <ellipse
        cx={rx}
        cy={ry + bodyH / 3}
        rx={rx}
        ry={ry}
        fill="url(#bodyGrad)"
        stroke="#00a8ff"
        strokeWidth="1.5"
        filter="url(#neon)"
        opacity="0.8"
      />

      {/* Disk divider 2 */}
      <ellipse
        cx={rx}
        cy={ry + (2 * bodyH) / 3}
        rx={rx}
        ry={ry}
        fill="url(#bodyGrad)"
        stroke="#00a8ff"
        strokeWidth="1.5"
        filter="url(#neon)"
        opacity="0.8"
      />

      {/* Top ellipse – rendered last so it sits on top */}
      <ellipse
        cx={rx}
        cy={ry}
        rx={rx}
        ry={ry}
        fill="url(#topGrad)"
        stroke="#00a8ff"
        strokeWidth=".5"
        filter="url(#neon)"
      />
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  const handleLaunch = () => {
    navigate({ to: '/dashboard' })
  }

  return (
    <div
      className="relative w-screen h-screen bg-black overflow-hidden cursor-pointer select-none"
      onClick={handleLaunch}
    >
      <div className="absolute top-5 right-6 flex gap-2 z-20" onClick={(e) => e.stopPropagation()}>
        <Link
          to="/login"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'text-gray-400 hover:text-white border border-gray-800 hover:border-blue-500 transition-colors',
          )}
        >
          <LogIn className="h-3.5 w-3.5 mr-1.5" />
          Log In
        </Link>
        <Link
          to="/signup"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'text-gray-400 hover:text-white border border-gray-800 hover:border-blue-500 transition-colors',
          )}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Sign Up
        </Link>
      </div>

      {/* Brand title – top center */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20">
        <h1
          style={{ fontFamily: 'Roboto, sans-serif', letterSpacing: '-0.03em' }}
          className="text-5xl font-semibold tracking-widest text-white"
        >
          KRepo
        </h1>
      </div>

      {/* Background neon radial glow – behind cylinder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          style={{
            width: '75vw',
            height: '75vw',
            background:
              'radial-gradient(ellipse at center, rgba(0,130,255,0.26) 0%, rgba(0,70,210,0.12) 38%, transparent 68%)',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Animated pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pulse-ring" />
        <div className="pulse-ring absolute" style={{ animationDelay: '1.1s' }} />
        <div className="pulse-ring absolute" style={{ animationDelay: '2.2s' }} />
      </div>

      {/* Cylinder – centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <DatabaseCylinder />
      </div>

      {/* Click hint – bottom */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-blue-400/45 text-xs tracking-[0.3em] animate-pulse"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      ></div>
    </div>
  )
}
