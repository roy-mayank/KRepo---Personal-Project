import { Settings } from 'lucide-react'

export default function SettingsPage(): React.JSX.Element {
  return (
    <div className="h-full flex items-center justify-center bg-black">
      <div className="text-center">
        <Settings className="h-10 w-10 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 text-sm font-medium">Settings</p>
        <p className="text-gray-700 text-xs mt-1">Coming soon</p>
      </div>
    </div>
  )
}
