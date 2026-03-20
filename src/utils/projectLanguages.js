function toUniqueLanguages(languages) {
  return Array.from(new Set((languages ?? []).filter(Boolean)))
}

export function getLanguageList(value) {
  if (Array.isArray(value)) {
    return toUniqueLanguages(value)
  }

  if (value && typeof value === 'object') {
    return toUniqueLanguages(Object.keys(value))
  }

  return []
}

export function getProjectLanguages(project) {
  const languagesFromProject = toUniqueLanguages([
    ...getLanguageList(project?.languagesList),
    ...getLanguageList(project?.languages),
  ])

  if (languagesFromProject.length) {
    return languagesFromProject
  }

  if (project?.primaryLanguage) {
    return [project.primaryLanguage]
  }

  return []
}

export function getPrimaryProjectLanguage(project) {
  return (
    getProjectLanguages(project).find((language) => language !== 'Other') ??
    project?.primaryLanguage ??
    'Other'
  )
}
