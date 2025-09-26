import { useParams } from 'react-router-dom'

export default function DeviceDetails() {
  const { deviceId } = useParams<{ deviceId: string }>()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Device Details</h1>
      <p className="text-gray-600 dark:text-gray-400">Device ID: {deviceId}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This page will show detailed device information and traffic analytics.</p>
    </div>
  )
} 