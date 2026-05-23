import {
  buildDivisionsFromDepartment,
  batchCodesFromDepartment,
  divisionToCode,
} from './departmentConfig'

export const SINGLE_CLASS_CODE = 'Class'
export const CLASS_MODE_SINGLE = 'single'
export const CLASS_MODE_MULTI = 'multi'

export const resolveDepartment = (department, schedule) =>
  department ||
  schedule?.departmentConfig ||
  schedule?.department ||
  null

export const isSingleClassMode = (schedule) => {
  if (!schedule) return true
  if (schedule.classMode === CLASS_MODE_MULTI) return false
  if (schedule.classMode === CLASS_MODE_SINGLE) return true
  const divs = schedule.divisions || []
  if (divs.length > 1) return false
  if (divs.length === 1 && divs[0].code === SINGLE_CLASS_CODE) return true
  return false
}

export const getDivisions = (schedule, department) => {
  const dept = resolveDepartment(department, schedule)
  if (schedule?.divisions?.length) return schedule.divisions
  if (dept) {
    return buildDivisionsFromDepartment(
      dept,
      schedule?.classMode || CLASS_MODE_MULTI
    )
  }
  return []
}

export const getActiveDivisionCode = (schedule, department) => {
  const divs = getDivisions(schedule, department)
  if (isSingleClassMode(schedule)) {
    const single = divs.find((d) => d.code === SINGLE_CLASS_CODE) || divs[0]
    return single?.code || SINGLE_CLASS_CODE
  }
  return divs[0]?.code || ''
}

export const getBatchesForDivision = (schedule, divisionCode, department) => {
  const dept = resolveDepartment(department, schedule)
  const div = getDivisions(schedule, department).find(
    (d) => d.code === divisionCode
  )
  if (div?.batches?.length) return div.batches
  if (dept) return batchCodesFromDepartment(dept)
  return []
}

export const prepareScheduleFromApi = (sched, department) => {
  if (!sched) return sched
  const dept = resolveDepartment(department, sched)
  const copy = { ...sched }

  if (!copy.divisions?.length && dept) {
    copy.divisions = buildDivisionsFromDepartment(
      dept,
      copy.classMode || CLASS_MODE_MULTI
    )
  }

  if (!copy.classMode) {
    copy.classMode =
      copy.divisions.length > 1 ? CLASS_MODE_MULTI : CLASS_MODE_SINGLE
  }

  if (copy.classMode === CLASS_MODE_SINGLE) {
    const batches =
      copy.divisions[0]?.batches?.length > 0
        ? copy.divisions[0].batches
        : batchCodesFromDepartment(dept)
    copy.divisions = [{ code: SINGLE_CLASS_CODE, label: '', batches }]
  }

  return copy
}

export { divisionToCode }
