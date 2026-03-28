import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const { t } = useTranslation()
  const location = useLocation()

  const navItems = [
    { path: '/', label: t('nav.projectList') },
    { path: '/settings', label: t('nav.settings') },
  ]

  return (
    <header className="border-b bg-background px-6 h-12 flex items-center justify-between select-none">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-sm">{t('common.appName')}</span>
        <nav className="flex items-center gap-4">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm transition-colors hover:text-foreground ${
                location.pathname === item.path
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <ThemeToggle />
    </header>
  )
}
