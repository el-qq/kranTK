import { useState, type FormEvent } from 'react'
import './login.css'

interface Props {
  onSubmit: (login: string, password: string) => boolean
}

const FEATURES = ['Контроль перегрузов', 'Хронология смены', 'Состояние систем']

export function LoginScreen({ onSubmit }: Props) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!login.trim() || !password) {
      setError('Введите логин и пароль')
      return
    }
    if (!onSubmit(login, password)) {
      setError('Неверный логин или пароль')
      return
    }
    setError(null)
  }

  return (
    <div className="login">
      <div className="login__inner">
        <div className="login__logo">
          <span className="login__logo-mark" />
          <span className="login__logo-text">
            CRANE
            <br />
            MONITOR
          </span>
        </div>

        <h1 className="login__heading">Мониторинг автокранов</h1>
        <p className="login__lead">
          Загрузка и перегрузы, геометрия стрелы, наработка и циклы, хронология смены — в одном
          окне.
        </p>

        <form className="login__form" onSubmit={handleSubmit}>
          <div className="login__title">Вход в систему</div>
          <div className="login__subtitle">Демонстрационный стенд</div>

          <label className="login__field">
            <span>Логин</span>
            <input
              value={login}
              onChange={(e) => {
                setLogin(e.target.value)
                setError(null)
              }}
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="login__field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              autoComplete="current-password"
              placeholder="••••"
            />
          </label>

          <div className="login__error" role="alert">
            {error}
          </div>

          <button className="login__submit" type="submit">
            Войти
          </button>

          <p className="login__note">
            Стенд работает на статических данных и не подключён к реальной системе. Форма входа —
            часть демонстрации интерфейса, а не средство защиты.
          </p>
        </form>

        <ul className="login__features">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      <div className="login__footer">Демонстрационный стенд · данные вымышлены</div>
    </div>
  )
}
