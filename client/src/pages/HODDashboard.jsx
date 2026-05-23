import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import PageLoader from '../components/PageLoader'

const MyTimetable = lazy(() => import('./hod/MyTimetable'))
const FacultyWorkload = lazy(() => import('./hod/FacultyWorkload'))
const RequestChange = lazy(() => import('./hod/RequestChange'))
const MyRequests = lazy(() => import('./hod/MyRequests'))
const AssignFaculty = lazy(() => import('./hod/AssignFaculty'))

const hodNav = [
  { to: '/hod', label: 'Overview', end: true },
  { to: '/hod/timetable', label: 'My Timetable' },
  { to: '/hod/assign-faculty', label: 'Assign Faculty' },
  { to: '/hod/workload', label: 'Faculty Workload' },
  { to: '/hod/request-change', label: 'Request Change' },
  { to: '/hod/my-requests', label: 'My Requests' },
]

const Overview = () => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">HOD Dashboard</h1>
    <p className="text-gray-600 mt-2">
      View your department timetable, monitor faculty workload, and submit change
      requests.
    </p>
  </div>
)

const HODDashboard = () => (
  <DashboardLayout title="HOD Panel" navItems={hodNav}>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="timetable" element={<MyTimetable />} />
        <Route path="assign-faculty" element={<AssignFaculty />} />
        <Route path="workload" element={<FacultyWorkload />} />
        <Route path="request-change" element={<RequestChange />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="requests" element={<Navigate to="/hod/my-requests" replace />} />
        <Route path="*" element={<Navigate to="/hod" replace />} />
      </Routes>
    </Suspense>
  </DashboardLayout>
)

export default HODDashboard
