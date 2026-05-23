import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import PageLoader from '../components/PageLoader'

const Timetable = lazy(() => import('./admin/Timetable'))
const ManageFaculty = lazy(() => import('./admin/ManageFaculty'))
const ManageSubjects = lazy(() => import('./admin/ManageSubjects'))
const ManageRooms = lazy(() => import('./admin/ManageRooms'))
const ManageDepartments = lazy(() => import('./admin/ManageDepartments'))
const ManageHODs = lazy(() => import('./admin/ManageHODs'))
const ChangeRequests = lazy(() => import('./admin/ChangeRequests'))
const SemesterSchedule = lazy(() => import('./admin/SemesterSchedule'))

const adminNav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/timetable', label: 'Timetable' },
  { to: '/admin/schedule', label: 'Schedule' },
  { to: '/admin/faculty', label: 'Faculty' },
  { to: '/admin/subjects', label: 'Subjects' },
  { to: '/admin/rooms', label: 'Rooms' },
  { to: '/admin/departments', label: 'Departments' },
  { to: '/admin/hods', label: 'HODs' },
  { to: '/admin/requests', label: 'Change Requests' },
]

const Overview = () => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
    <p className="text-gray-600 mt-2">
      Manage timetables, faculty, and approve change requests across all
      departments.
    </p>
  </div>
)

const AdminDashboard = () => (
  <DashboardLayout title="Admin Panel" navItems={adminNav}>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="schedule" element={<SemesterSchedule />} />
        <Route path="faculty" element={<ManageFaculty />} />
        <Route path="subjects" element={<ManageSubjects />} />
        <Route path="rooms" element={<ManageRooms />} />
        <Route path="departments" element={<ManageDepartments />} />
        <Route path="hods" element={<ManageHODs />} />
        <Route path="requests" element={<ChangeRequests />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  </DashboardLayout>
)

export default AdminDashboard
