import { useAuth } from '../context/AuthContext'

export const useHodDepartment = () => {
  const { user } = useAuth()
  const departmentId = user?.department?._id || user?.department || null
  const departmentName = user?.department?.name || null
  const departmentCode = user?.department?.code || null

  return { departmentId, departmentName, departmentCode, user }
}

export const NoDepartmentMessage = () => (
  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
    No department assigned to your account. Please contact an administrator.
  </div>
)
