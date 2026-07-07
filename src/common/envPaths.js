// Join minimale cross-env (senza Node `path`, valido sia in main sia in renderer): il separatore
// segue quello già presente nella prima parte, così restano coerenti col path passato dal chiamante.
const joinPath = (...parts) => {
  const sep = parts[0] && parts[0].includes('\\') ? '\\' : '/'
  return parts.join(sep)
}

class EnvPaths {
  /**
   * @param {string} userDataPath The user data path.
   * @returns
   */
  constructor(userDataPath) {
    const currentDate = new Date()
    if (!userDataPath) {
      throw new Error('"userDataPath" is not set.')
    }

    this._electronUserDataPath = userDataPath // path.join(userDataPath, 'electronUserData')
    this._userDataPath = userDataPath
    this._logPath = joinPath(
      this._userDataPath,
      'logs',
      `${currentDate.getFullYear()}${currentDate.getMonth() + 1}`
    )
    this._preferencesPath = userDataPath // path.join(this._userDataPath, 'preferences')

    this._dataCenterPath = userDataPath

    this._preferencesFilePath = joinPath(this._preferencesPath, 'preference.json')

    // TODO(sessions): enable this...
    // this._globalStorage = path.join(this._userDataPath, 'globalStorage')
    // this._preferencesPath = path.join(this._userDataPath, 'preferences')
    // this._sessionsPath = path.join(this._userDataPath, 'sessions')
  }

  get electronUserDataPath() {
    // This path is identical to app.getPath('userData') but userDataPath must not necessarily be the same path.
    return this._electronUserDataPath
  }

  get userDataPath() {
    return this._userDataPath
  }

  get logPath() {
    return this._logPath
  }

  get preferencesPath() {
    return this._preferencesPath
  }

  get dataCenterPath() {
    return this._dataCenterPath
  }

  get preferencesFilePath() {
    return this._preferencesFilePath
  }
}

export default EnvPaths
