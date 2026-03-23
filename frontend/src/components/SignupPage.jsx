import { useState } from 'react'
import { Github, Eye, EyeOff } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SignupPage() {
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    // dummy – no real auth
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

        {/* OAuth */}
        <Button
          variant="outline"
          className="w-full border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 mb-4"
          onClick={() => {}}
        >
          <Github className="h-4 w-4 mr-2" />
          Continue with GitHub
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full Name</label>
            <Input
              type="text"
              placeholder="Jane Smith"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="name"
            />
          </div>

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
          >
            Create Account
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
