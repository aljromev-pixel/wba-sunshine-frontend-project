export const apiErrorMessage = (exception) => {
  if (exception?.uncertain) return `${exception.message} The change may have saved. Keep the same details when retrying an inventory movement or count, or refresh to verify before submitting another change.`
  const errors = exception?.data?.errors

  if (errors) {
    return Object.values(errors).flat().join(' ')
  }

  if (exception?.status === 403) {
    return 'You do not have permission to perform this action.'
  }

  if (exception?.status === 404) {
    return 'The requested record is no longer available.'
  }

  return exception?.message || 'Something went wrong. Please try again.'
}
