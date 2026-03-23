import { useState } from 'react'
import { Github, Eye, EyeOff, Mail } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const googleProvider = new GoogleAuthProvider()
const githubProvider = new GithubAuthProvider()

export default function SignupPage() {
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSuccess = () => {
    navigate({ to: '/onboard' })
  }

  const handleOAuth = async (provider) => {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, provider)
      handleSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password)
      handleSuccess()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists')
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-black overflow-y-auto">
      <div className="w-full max-w-sm px-6 py-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <span
            style={{ fontFamily: 'Roboto, sans-serif', letterSpacing: '-0.03em' }}
            className="text-3xl font-black text-white"
          >
            KRepo
          </span>
          <p className="text-gray-500 text-sm mt-2">Create your account</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* OAuth providers */}
        <div className="flex flex-col gap-2 mb-4">
          <Button
            variant="outline"
            className="w-full border-gray-700 text-gray-300 hover:text-white hover:border-gray-600"
            onClick={() => handleOAuth(googleProvider)}
            disabled={loading}
          >
            <Mail className="h-4 w-4 mr-2" />
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full border-gray-700 text-gray-300 hover:text-white hover:border-gray-600"
            onClick={() => handleOAuth(githubProvider)}
            disabled={loading}
          >
            <Github className="h-4 w-4 mr-2" />
            Continue with GitHub
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSignup} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full mt-1 bg-blue-600 hover:bg-blue-500 text-white border-0"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-xs text-gray-700 text-center mt-4 leading-relaxed">
          By signing up you agree to our{' '}
          <button className="text-gray-500 hover:text-gray-400">Terms</button> and{' '}
          <button className="text-gray-500 hover:text-gray-400">Privacy Policy</button>.
        </p>

        <p className="text-center text-xs text-gray-600 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-500 hover:text-blue-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
