import SearchIcon from '@/assets/icons/search.svg'
import { t } from '@/i18n'

export const sideBarIcons = [
  {
    id: 'search',
    name: () => t('sideBar.icons.search'),
    icon: SearchIcon
  }
]

// Icone in fondo alla sidebar rimosse (l'ingranaggio impostazioni apriva le preferenze
// legacy; il design v2 usa il settings modal dalla command palette/status bar).
export const sideBarBottomIcons = []
